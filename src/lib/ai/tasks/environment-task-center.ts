import { and, eq } from 'drizzle-orm';
import { loadAIEnvironmentContext } from '@/lib/ai/context/environment-context';
import { createMigrationApprovalToken } from '@/lib/ai/runtime/approval-token';
import { listRecentEnvironmentAITasks } from '@/lib/ai/tasks/generic-task-service';
import {
  type ApprovalItemDecorations,
  decorateApprovalRuns,
  formatApprovalStatusLabel,
} from '@/lib/approvals/view';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { collapseRunsToLatestByLockKey } from '@/lib/migrations/attention';
import { formatPlatformTimeContext } from '@/lib/time/format';

type RawEnvironmentMigrationRun = Awaited<
  ReturnType<typeof db.query.migrationRuns.findMany>
>[number];

type DecoratedEnvironmentApprovalRun = RawEnvironmentMigrationRun &
  ApprovalItemDecorations & {
    database?: {
      name: string;
    } | null;
    service?: {
      name?: string | null;
    } | null;
  };

export interface EnvironmentTaskItem {
  id: string;
  kind:
    | 'migration_approval'
    | 'migration_external'
    | 'migration_failed'
    | 'ai_analysis'
    | 'schema_repair'
    | 'preview_cleanup_blocked';
  title: string;
  summary: string;
  statusLabel: string;
  actionLabel: string | null;
  href: string | null;
  inputSummary?: string | null;
  detail?: string | null;
  createdAtLabel?: string | null;
  completedAtLabel?: string | null;
  migrationRunId?: string | null;
  migrationRunStatus?: string | null;
  approvalToken?: string | null;
}

export interface EnvironmentTaskCenterSnapshot {
  summary: string;
  actionableCount: number;
  tasks: EnvironmentTaskItem[];
}

export function sortEnvironmentTasks(tasks: EnvironmentTaskItem[]): EnvironmentTaskItem[] {
  return [...tasks].sort((left, right) => {
    const priority = {
      migration_approval: 0,
      migration_external: 1,
      migration_failed: 2,
      ai_analysis: 3,
      schema_repair: 4,
      preview_cleanup_blocked: 5,
    };

    return priority[left.kind] - priority[right.kind];
  });
}

export function buildEnvironmentTaskCenterSnapshot(
  tasks: EnvironmentTaskItem[]
): EnvironmentTaskCenterSnapshot {
  const sortedTasks = sortEnvironmentTasks(tasks);

  return {
    summary:
      sortedTasks.length > 0
        ? `当前环境有 ${sortedTasks.length} 个待处理事项`
        : '当前环境没有待处理事项',
    actionableCount: sortedTasks.length,
    tasks: sortedTasks,
  };
}

function toApprovalTask(
  teamId: string,
  projectId: string,
  environmentId: string,
  actorUserId: string | null,
  run: DecoratedEnvironmentApprovalRun
): EnvironmentTaskItem {
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
    href: `/projects/${projectId}/environments/${environmentId}/schema`,
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

export async function getEnvironmentTaskCenterData(input: {
  projectId: string;
  environmentId: string;
  actorUserId?: string | null;
}): Promise<EnvironmentTaskCenterSnapshot> {
  const { teamId, environment } = await loadAIEnvironmentContext(input);
  const rawMigrationRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.projectId, input.projectId),
      eq(migrationRuns.environmentId, input.environmentId)
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
  ) as DecoratedEnvironmentApprovalRun[];

  const tasks: EnvironmentTaskItem[] = decoratedAttentionRuns.map((run) =>
    toApprovalTask(teamId, input.projectId, input.environmentId, input.actorUserId ?? null, run)
  );

  for (const database of environment.databases) {
    const schemaStatus = database.schemaState?.status ?? null;
    const repairPlan = database.latestRepairPlan;
    const needsRepair =
      schemaStatus === 'drifted' ||
      schemaStatus === 'blocked' ||
      schemaStatus === 'aligned_untracked' ||
      schemaStatus === 'unmanaged' ||
      repairPlan?.status === 'failed';

    if (!needsRepair) {
      continue;
    }

    tasks.push({
      id: `schema-${database.id}`,
      kind: 'schema_repair',
      title: `${database.name} · Schema 修复`,
      summary:
        repairPlan?.summary ??
        database.schemaState?.summary ??
        `${database.name} 当前 schema 状态需要人工处理`,
      statusLabel: database.schemaState?.statusLabel ?? '待处理',
      actionLabel: '进入数据页',
      href: `/projects/${input.projectId}/environments/${input.environmentId}/schema`,
    });
  }

  if (environment.cleanupState?.state === 'expired_blocked') {
    tasks.push({
      id: `cleanup-${environment.id}`,
      kind: 'preview_cleanup_blocked',
      title: `${environment.name} · 回收阻塞`,
      summary: environment.cleanupState.summary,
      statusLabel: environment.cleanupState.label,
      actionLabel: '进入发布',
      href: `/projects/${input.projectId}/environments/${input.environmentId}/delivery`,
    });
  }

  const recentAITasks = await listRecentEnvironmentAITasks({
    projectId: input.projectId,
    environmentId: input.environmentId,
  });

  for (const task of recentAITasks) {
    tasks.push({
      id: `ai-${task.id}`,
      kind: 'ai_analysis',
      title: `AI 深度分析 · ${task.title}`,
      summary: task.resultSummary ?? task.errorMessage ?? task.inputSummary,
      statusLabel:
        task.status === 'succeeded'
          ? '已完成'
          : task.status === 'failed'
            ? '失败'
            : task.status === 'running'
              ? '进行中'
              : '排队中',
      actionLabel: null,
      href: `/projects/${input.projectId}/environments/${input.environmentId}`,
      inputSummary: task.inputSummary,
      detail: task.resultSummary ?? task.errorMessage,
      createdAtLabel: formatPlatformTimeContext(task.createdAt),
      completedAtLabel: formatPlatformTimeContext(task.completedAt),
    });
  }

  return buildEnvironmentTaskCenterSnapshot(tasks);
}
