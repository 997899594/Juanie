import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { migrationRuns, projects, teamMembers } from '@/lib/db/schema';
import { createMigrationRun, findActiveMigrationRun, getMigrationRunById } from '@/lib/migrations';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { addMigrationJob } from '@/lib/queue';

function buildResolvedSpec(run: NonNullable<Awaited<ReturnType<typeof getMigrationRunById>>>) {
  return {
    specification: run.specification,
    database: run.database,
    service: run.service,
    environment: run.environment,
    resolution: {
      strategy: 'unknown',
      selector: {
        bindingName: null,
        bindingRole: null,
        bindingDatabaseType: null,
      },
    },
  };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  const { id: projectId, runId } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: '未登录' }, { status: 401 });
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    return NextResponse.json({ error: '项目不存在' }, { status: 404 });
  }

  const member = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, project.teamId), eq(teamMembers.userId, session.user.id)),
  });

  if (!member) {
    return NextResponse.json({ error: '没有权限执行这个操作' }, { status: 403 });
  }

  const run = await getMigrationRunById(runId);
  if (!run || run.projectId !== projectId) {
    return NextResponse.json({ error: '迁移记录不存在' }, { status: 404 });
  }

  if (!canManageEnvironment(member.role, run.environment)) {
    return NextResponse.json(
      { error: getEnvironmentGuardReason(run.environment) },
      { status: 403 }
    );
  }

  const { action, imageUrl } = await request.json().catch(() => ({}));

  if (action === 'approve') {
    if (run.status !== 'awaiting_approval') {
      return NextResponse.json({ error: '当前迁移不在待审批状态' }, { status: 400 });
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

    await addMigrationJob(run.id, {
      imageUrl: imageUrl ?? null,
      allowApprovalBypass: true,
    });

    return NextResponse.json(
      {
        message: '迁移审批已通过，已重新加入队列',
        runId: run.id,
      },
      { status: 202 }
    );
  }

  if (action === 'retry') {
    if (!['failed', 'canceled'].includes(run.status)) {
      return NextResponse.json({ error: '只有失败或已取消的迁移才能重试' }, { status: 400 });
    }

    const activeRun = await findActiveMigrationRun({
      databaseId: run.databaseId,
      environmentId: run.environmentId,
    });

    if (activeRun) {
      return NextResponse.json(
        {
          error: `已有迁移正在处理中（${activeRun.status}）`,
          runId: activeRun.id,
        },
        { status: 409 }
      );
    }

    const retryRun = await createMigrationRun(buildResolvedSpec(run), {
      releaseId: run.releaseId,
      deploymentId: run.deploymentId,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      sourceCommitSha: run.sourceCommitSha,
      sourceCommitMessage: run.sourceCommitMessage,
      runnerType: imageUrl ? 'k8s_job' : 'worker',
    });

    await addMigrationJob(retryRun.id, {
      imageUrl: imageUrl ?? null,
      allowApprovalBypass: false,
    });

    return NextResponse.json(
      {
        message: '迁移重试已加入队列',
        runId: retryRun.id,
      },
      { status: 202 }
    );
  }

  return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
}
