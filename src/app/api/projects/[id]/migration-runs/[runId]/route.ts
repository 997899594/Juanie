import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { migrationRuns, projects, type ReleaseStatus, teamMembers } from '@/lib/db/schema';
import { createMigrationRun, findActiveMigrationRun, getMigrationRunById } from '@/lib/migrations';
import { canManageEnvironment, getEnvironmentGuardReason } from '@/lib/policies/delivery';
import { addMigrationJob } from '@/lib/queue';
import {
  persistReleaseRecapSafely,
  resumeReleaseAfterSuccessfulMigration,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { getReleaseRunningStatusForMigrationPhase } from '@/lib/releases/state-machine';

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

function getInitialStatusForExecutionMode(
  executionMode: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getMigrationRunById>>>['specification']
  >['executionMode']
) {
  if (executionMode === 'manual_platform') {
    return 'awaiting_approval' as const;
  }

  if (executionMode === 'external') {
    return 'awaiting_external_completion' as const;
  }

  return 'queued' as const;
}

function getReleaseStatusForPendingRun(
  phase: NonNullable<
    NonNullable<Awaited<ReturnType<typeof getMigrationRunById>>>['specification']
  >['phase'],
  runStatus: 'queued' | 'awaiting_approval' | 'awaiting_external_completion'
): ReleaseStatus | null {
  if (runStatus === 'awaiting_approval') {
    return 'awaiting_approval';
  }

  if (runStatus === 'awaiting_external_completion') {
    return 'awaiting_external_completion';
  }

  return getReleaseRunningStatusForMigrationPhase(phase);
}

function getRetryMessage(status: 'queued' | 'awaiting_approval' | 'awaiting_external_completion') {
  if (status === 'awaiting_approval') {
    return '迁移重试已创建，等待审批';
  }

  if (status === 'awaiting_external_completion') {
    return '迁移重试已创建，等待外部完成确认';
  }

  return '迁移重试已加入队列';
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

  const { action, imageUrl, errorMessage } = await request.json().catch(() => ({}));

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

    if (run.releaseId && run.release) {
      const nextReleaseStatus = getReleaseRunningStatusForMigrationPhase(run.specification.phase);

      if (nextReleaseStatus) {
        await updateReleaseStatus(run.releaseId, nextReleaseStatus);
      }
    }

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

  if (action === 'mark_external_complete') {
    if (run.status !== 'awaiting_external_completion') {
      return NextResponse.json({ error: '当前迁移不在待外部完成状态' }, { status: 400 });
    }

    const finishedAt = new Date();
    const startedAt = run.startedAt ?? finishedAt;

    await db
      .update(migrationRuns)
      .set({
        status: 'success',
        errorCode: null,
        errorMessage: null,
        startedAt,
        finishedAt,
        durationMs: Math.max(finishedAt.getTime() - startedAt.getTime(), 0),
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, run.id));

    if (run.releaseId) {
      await resumeReleaseAfterSuccessfulMigration(run.id);
    }

    return NextResponse.json(
      {
        message: '已标记外部迁移完成',
        runId: run.id,
      },
      { status: 200 }
    );
  }

  if (action === 'mark_external_failed') {
    if (run.status !== 'awaiting_external_completion') {
      return NextResponse.json({ error: '当前迁移不在待外部完成状态' }, { status: 400 });
    }

    const failureMessage =
      typeof errorMessage === 'string' && errorMessage.trim().length > 0
        ? errorMessage.trim()
        : '外部迁移被人工标记为失败';

    await db
      .update(migrationRuns)
      .set({
        status: 'failed',
        errorCode: 'external_marked_failed',
        errorMessage: failureMessage,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(migrationRuns.id, run.id));

    if (run.releaseId) {
      const failureStatus: ReleaseStatus =
        run.specification.phase === 'postDeploy' ? 'degraded' : 'migration_pre_failed';
      await updateReleaseStatus(run.releaseId, failureStatus, failureMessage);
      await persistReleaseRecapSafely(run.releaseId);
    }

    return NextResponse.json(
      {
        message: '已标记外部迁移失败',
        runId: run.id,
      },
      { status: 200 }
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

    const initialStatus = getInitialStatusForExecutionMode(run.specification.executionMode);
    const retryRun = await createMigrationRun(buildResolvedSpec(run), {
      releaseId: run.releaseId,
      deploymentId: run.deploymentId,
      triggeredBy: 'manual',
      triggeredByUserId: session.user.id,
      sourceCommitSha: run.sourceCommitSha,
      sourceCommitMessage: run.sourceCommitMessage,
      runnerType: initialStatus === 'queued' && imageUrl ? 'k8s_job' : 'worker',
      initialStatus,
    });

    if (run.releaseId) {
      const nextReleaseStatus = getReleaseStatusForPendingRun(
        run.specification.phase,
        initialStatus
      );
      if (nextReleaseStatus) {
        await updateReleaseStatus(run.releaseId, nextReleaseStatus);
      }
    }

    if (initialStatus === 'queued') {
      await addMigrationJob(retryRun.id, {
        imageUrl: imageUrl ?? null,
        allowApprovalBypass: false,
      });
    }

    return NextResponse.json(
      {
        message: getRetryMessage(initialStatus),
        runId: retryRun.id,
      },
      { status: 202 }
    );
  }

  return NextResponse.json({ error: '不支持的操作' }, { status: 400 });
}
