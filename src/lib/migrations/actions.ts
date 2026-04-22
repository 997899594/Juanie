import { and, eq } from 'drizzle-orm';
import { verifyMigrationApprovalToken } from '@/lib/ai/runtime/approval-token';
import { db } from '@/lib/db';
import { migrationRuns, projects, teamMembers } from '@/lib/db/schema';
import { getMigrationRunById } from '@/lib/migrations';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { addMigrationJob } from '@/lib/queue';
import { updateReleaseStatus } from '@/lib/releases/orchestration';
import { getReleaseRunningStatusForMigrationPhase } from '@/lib/releases/state-machine';

export interface MigrationRunActionResult {
  message: string;
  runId: string;
}

export async function approveMigrationRunForActor(input: {
  actorUserId: string;
  projectId: string;
  runId: string;
  approvalToken: string;
}): Promise<MigrationRunActionResult> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
  });

  if (!project) {
    throw new Error('项目不存在');
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, input.actorUserId)),
  });

  if (!member) {
    throw new Error('没有权限执行这个操作');
  }

  const run = await getMigrationRunById(input.runId);
  if (!run || run.projectId !== input.projectId) {
    throw new Error('迁移记录不存在');
  }

  if (!canManageEnvironment(member.role, run.environment)) {
    throw new Error(getEnvironmentGuardReason(run.environment));
  }

  if (run.status !== 'awaiting_approval') {
    throw new Error('当前迁移不在待审批状态');
  }

  const tokenValid = verifyMigrationApprovalToken({
    token: input.approvalToken,
    teamId: project.teamId,
    projectId: input.projectId,
    environmentId: run.environmentId,
    runId: run.id,
    actorUserId: input.actorUserId,
  });

  if (!tokenValid) {
    throw new Error('审批确认无效，请刷新后重试');
  }

  await db
    .update(migrationRuns)
    .set({
      status: 'queued',
      errorCode: null,
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(migrationRuns.id, run.id));

  if (run.releaseId && run.release) {
    const nextReleaseStatus = getReleaseRunningStatusForMigrationPhase(run.specification.phase);

    if (nextReleaseStatus) {
      await updateReleaseStatus(run.releaseId, nextReleaseStatus);
    }
  }

  await addMigrationJob(run.id, {
    allowApprovalBypass: true,
  });

  return {
    message: '迁移审批已通过，已重新加入队列',
    runId: run.id,
  };
}
