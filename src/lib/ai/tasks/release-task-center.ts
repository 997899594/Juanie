import { and, eq } from 'drizzle-orm';
import { createMigrationApprovalToken } from '@/lib/ai/runtime/approval-token';
import { listRecentReleaseAITasks } from '@/lib/ai/tasks/generic-task-service';
import {
  type AITaskCenterItem,
  buildAITaskCenterSnapshot,
  toAIAnalysisTaskItem,
} from '@/lib/ai/tasks/view-model';
import {
  type ApprovalItemDecorations,
  decorateApprovalRuns,
  formatApprovalStatusLabel,
} from '@/lib/approvals/view';
import { db } from '@/lib/db';
import { deployments, migrationRuns, releases } from '@/lib/db/schema';
import { collapseRunsToLatestByLockKey } from '@/lib/migrations/attention';

type RawReleaseMigrationRun = Awaited<ReturnType<typeof db.query.migrationRuns.findMany>>[number];
type RawReleaseDeployment = Awaited<ReturnType<typeof db.query.deployments.findMany>>[number];

type DecoratedReleaseApprovalRun = RawReleaseMigrationRun &
  ApprovalItemDecorations & {
    database?: {
      name: string;
    } | null;
    service?: {
      name?: string | null;
    } | null;
  };

export interface ReleaseTaskItem extends AITaskCenterItem {}

export interface ReleaseTaskCenterSnapshot {
  summary: string;
  actionableCount: number;
  tasks: ReleaseTaskItem[];
}

export function sortReleaseTasks(tasks: ReleaseTaskItem[]): ReleaseTaskItem[] {
  return [...tasks].sort((left, right) => {
    const priority: Record<ReleaseTaskItem['kind'], number> = {
      migration_approval: 0,
      migration_external: 1,
      migration_failed: 2,
      deployment_failed: 3,
      ai_analysis: 4,
      schema_repair: 5,
      preview_cleanup_blocked: 6,
    };

    return priority[left.kind] - priority[right.kind];
  });
}

export function buildReleaseTaskCenterSnapshot(
  tasks: ReleaseTaskItem[]
): ReleaseTaskCenterSnapshot {
  const sortedTasks = sortReleaseTasks(tasks);

  return buildAITaskCenterSnapshot({
    tasks: sortedTasks,
    subjectLabel: '发布',
  });
}

function toReleaseTask(
  teamId: string,
  projectId: string,
  environmentId: string,
  actorUserId: string | null,
  run: DecoratedReleaseApprovalRun
): ReleaseTaskItem {
  const databaseName = run.database?.name ?? '数据库';
  const serviceName = run.service?.name ?? '应用';
  const actionLabel =
    run.status === 'awaiting_approval'
      ? '审批通过'
      : run.status === 'awaiting_external_completion'
        ? '标记完成'
        : run.status === 'failed'
          ? '重试'
          : null;

  return {
    id: `migration-${run.id}`,
    kind:
      run.status === 'awaiting_approval'
        ? 'migration_approval'
        : run.status === 'awaiting_external_completion'
          ? 'migration_external'
          : 'migration_failed',
    title: `${serviceName} · ${databaseName}`,
    summary: run.issue?.summary ?? run.errorMessage ?? run.actionLabel ?? '等待处理迁移状态',
    statusLabel: formatApprovalStatusLabel(run.status),
    actionLabel,
    migrationRunId: run.id,
    migrationRunStatus: run.status,
    approvalToken:
      run.status === 'awaiting_approval' && actorUserId
        ? createMigrationApprovalToken({
            teamId,
            projectId,
            environmentId,
            runId: run.id,
            actorUserId,
          })
        : null,
  };
}

function toDeploymentFailureTask(
  projectId: string,
  environmentId: string,
  deployment: RawReleaseDeployment & {
    service?: {
      name?: string | null;
    } | null;
  }
): ReleaseTaskItem {
  const serviceName = deployment.service?.name ?? '应用';
  const summary =
    deployment.errorMessage ?? '部署或运行态校验没有通过，当前版本不会被切到稳定服务。';

  return {
    id: `deployment-${deployment.id}`,
    kind: 'deployment_failed',
    title: `${serviceName} · 运行态校验`,
    summary,
    statusLabel: deployment.status === 'verification_failed' ? '校验失败' : '部署失败',
    actionLabel: '打开变量',
    href: `/projects/${projectId}/environments/${environmentId}/variables`,
  };
}

export async function getReleaseTaskCenterData(input: {
  projectId: string;
  releaseId: string;
  actorUserId?: string | null;
}): Promise<ReleaseTaskCenterSnapshot> {
  const release = await db.query.releases.findFirst({
    where: and(eq(releases.id, input.releaseId), eq(releases.projectId, input.projectId)),
    columns: {
      id: true,
      projectId: true,
      environmentId: true,
    },
    with: {
      project: {
        columns: {
          teamId: true,
        },
      },
    },
  });

  if (!release) {
    return buildReleaseTaskCenterSnapshot([]);
  }

  const rawMigrationRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.projectId, input.projectId),
      eq(migrationRuns.releaseId, input.releaseId)
    ),
    with: {
      database: true,
      environment: {
        with: {
          domains: true,
        },
      },
      service: true,
      project: true,
      specification: true,
      release: {
        with: {
          artifacts: true,
        },
      },
    },
  });

  const collapsedAttentionRuns = collapseRunsToLatestByLockKey(
    rawMigrationRuns.filter((run) =>
      ['awaiting_approval', 'awaiting_external_completion', 'failed'].includes(run.status)
    )
  );
  const decoratedAttentionRuns = decorateApprovalRuns(
    collapsedAttentionRuns
  ) as DecoratedReleaseApprovalRun[];

  const tasks = decoratedAttentionRuns.map((run) =>
    toReleaseTask(
      release.project.teamId,
      input.projectId,
      release.environmentId,
      input.actorUserId ?? null,
      run
    )
  );

  const failedDeployments = await db.query.deployments.findMany({
    where: and(
      eq(deployments.projectId, input.projectId),
      eq(deployments.releaseId, input.releaseId)
    ),
    with: {
      service: true,
    },
  });

  for (const deployment of failedDeployments) {
    if (!['failed', 'verification_failed', 'rolled_back'].includes(deployment.status)) {
      continue;
    }

    tasks.push(toDeploymentFailureTask(input.projectId, release.environmentId, deployment));
  }

  const recentAITasks = await listRecentReleaseAITasks({
    projectId: input.projectId,
    releaseId: input.releaseId,
  });

  for (const task of recentAITasks) {
    tasks.push({
      ...toAIAnalysisTaskItem({
        task,
      }),
    });
  }

  return buildReleaseTaskCenterSnapshot(tasks);
}
