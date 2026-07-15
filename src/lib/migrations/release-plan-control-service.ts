import { and, eq } from 'drizzle-orm';
import { verifyReleaseMigrationPlanApprovalToken } from '@/lib/ai/runtime/approval-token';
import { getProjectReleaseAccessOrThrow } from '@/lib/api/access';
import { db } from '@/lib/db';
import { releaseMigrationPlans } from '@/lib/db/schema';
import { MigrationControlError } from '@/lib/migrations/control-service';
import { approveReleaseMigrationPlan } from '@/lib/migrations/release-plan';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';

export async function approveReleaseMigrationPlanForActor(input: {
  actorUserId: string;
  projectId: string;
  releaseId: string;
  approvalToken: string;
}): Promise<{ message: string; planId: string }> {
  const { project, member } = await getProjectReleaseAccessOrThrow(
    input.projectId,
    input.releaseId,
    input.actorUserId
  );
  const plan = await db.query.releaseMigrationPlans.findFirst({
    where: and(
      eq(releaseMigrationPlans.releaseId, input.releaseId),
      eq(releaseMigrationPlans.projectId, input.projectId)
    ),
    with: {
      release: {
        with: { environment: true },
      },
    },
  });
  if (!plan?.release) throw new MigrationControlError(404, '迁移计划不存在');
  if (!canManageEnvironment(member.role, plan.release.environment)) {
    throw new MigrationControlError(403, getEnvironmentGuardReason(plan.release.environment));
  }
  if (plan.status !== 'awaiting_approval') {
    throw new MigrationControlError(409, '迁移计划不在待审批状态');
  }
  const tokenValid = verifyReleaseMigrationPlanApprovalToken({
    token: input.approvalToken,
    teamId: project.teamId,
    projectId: input.projectId,
    environmentId: plan.environmentId,
    releaseId: input.releaseId,
    planId: plan.id,
    digest: plan.digest,
    actorUserId: input.actorUserId,
  });
  if (!tokenValid) throw new MigrationControlError(400, '审批确认无效，请刷新后重试');

  await approveReleaseMigrationPlan({
    planId: plan.id,
    projectId: input.projectId,
    actorUserId: input.actorUserId,
    digest: plan.digest,
  });
  return { message: '迁移计划已批准，发布将继续执行', planId: plan.id };
}
