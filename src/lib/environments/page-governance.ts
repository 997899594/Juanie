import type { TeamRole } from '@/lib/db/schema';
import { auditLogs } from '@/lib/db/schema';
import { buildEnvironmentPageGovernanceSnapshot } from '@/lib/environments/governance-view';
import { isPreviewEnvironment } from '@/lib/environments/model';
import { isPreviewEnvironmentExpired } from '@/lib/environments/preview';
import { formatPlatformTimeContext } from '@/lib/time/format';

function getAuditMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export interface EnvironmentGovernanceEventSnapshot {
  key: string;
  label: string;
  summary: string;
  createdAt: Date;
  environmentIds: string[];
}

export function buildGovernanceEventSnapshot(
  log: typeof auditLogs.$inferSelect,
  projectId: string
): EnvironmentGovernanceEventSnapshot | null {
  if (
    log.action !== 'environment.preview_deleted' &&
    log.action !== 'environment.preview_cleanup_completed' &&
    log.action !== 'environment.remediation_triggered'
  ) {
    return null;
  }

  const metadata = getAuditMetadata(log.metadata);
  if (metadata?.projectId !== projectId) {
    return null;
  }

  if (log.action === 'environment.preview_deleted') {
    const environmentId =
      typeof metadata?.environmentId === 'string'
        ? metadata.environmentId
        : typeof log.resourceId === 'string'
          ? log.resourceId
          : null;

    return {
      key: log.id,
      label: '手动回收',
      summary: `${String(metadata?.environmentName ?? '预览环境')} 已被手动回收`,
      createdAt: log.createdAt,
      environmentIds: environmentId ? [environmentId] : [],
    };
  }

  if (log.action === 'environment.remediation_triggered') {
    const action = typeof metadata?.action === 'string' ? metadata.action : 'remediation';
    const podCount = typeof metadata?.podCount === 'number' ? metadata.podCount : 0;
    const environmentId =
      typeof metadata?.environmentId === 'string'
        ? metadata.environmentId
        : typeof log.resourceId === 'string'
          ? log.resourceId
          : null;
    const environmentName = String(metadata?.environmentName ?? '环境');
    const mode = metadata?.mode === 'auto' ? 'auto' : 'manual';

    return {
      key: log.id,
      label:
        action === 'cleanup_terminating_pods'
          ? mode === 'auto'
            ? '自动残留清理'
            : '残留清理'
          : mode === 'auto'
            ? '自动环境重启'
            : '环境重启',
      summary:
        action === 'cleanup_terminating_pods'
          ? `${environmentName} 已清理 ${podCount} 个卡住的 Terminating Pod`
          : `${environmentName} 已触发 Deployment 滚动重启`,
      createdAt: log.createdAt,
      environmentIds: environmentId ? [environmentId] : [],
    };
  }

  const deletedCount = typeof metadata?.deletedCount === 'number' ? metadata.deletedCount : 0;
  const blockedCount = typeof metadata?.blockedCount === 'number' ? metadata.blockedCount : 0;
  const deletedIds = Array.isArray(metadata?.deletedIds)
    ? metadata.deletedIds.filter((value): value is string => typeof value === 'string')
    : [];

  return {
    key: log.id,
    label: '批量治理',
    summary: `已回收 ${deletedCount} 个过期预览环境，${blockedCount} 个仍被活跃发布阻塞`,
    createdAt: log.createdAt,
    environmentIds: deletedIds,
  };
}

export function buildEnvironmentCleanupCounters<
  TEnvironment extends {
    id: string;
    kind?: 'production' | 'persistent' | 'preview' | null;
    isPreview?: boolean | null;
    expiresAt?: Date | string | null;
  },
>(environments: TEnvironment[], activeReleaseCountByEnvironment: Map<string, number>) {
  return environments.reduce(
    (accumulator, environment) => {
      if (!isPreviewEnvironment(environment) || !isPreviewEnvironmentExpired(environment)) {
        return accumulator;
      }

      const activeReleaseCount = activeReleaseCountByEnvironment.get(environment.id) ?? 0;
      accumulator.expiredCount += 1;

      if (activeReleaseCount > 0) {
        accumulator.blockedCount += 1;
      } else {
        accumulator.eligibleCount += 1;
      }

      return accumulator;
    },
    {
      eligibleCount: 0,
      blockedCount: 0,
      expiredCount: 0,
    }
  );
}

export function buildEnvironmentGovernanceData(input: {
  projectId: string;
  role: TeamRole;
  environments: Array<{
    id: string;
    kind?: 'production' | 'persistent' | 'preview' | null;
    isPreview?: boolean | null;
    expiresAt?: Date | string | null;
  }>;
  activeReleaseCountByEnvironment: Map<string, number>;
  recentAuditLogs: Array<typeof auditLogs.$inferSelect>;
}) {
  const cleanupCounters = buildEnvironmentCleanupCounters(
    input.environments,
    input.activeReleaseCountByEnvironment
  );
  const governanceEventSnapshots = input.recentAuditLogs
    .map((log) => buildGovernanceEventSnapshot(log, input.projectId))
    .filter((event): event is EnvironmentGovernanceEventSnapshot => !!event);
  const latestGovernanceByEnvironment = new Map<string, EnvironmentGovernanceEventSnapshot>();

  for (const event of governanceEventSnapshots) {
    for (const environmentId of event.environmentIds) {
      if (!latestGovernanceByEnvironment.has(environmentId)) {
        latestGovernanceByEnvironment.set(environmentId, event);
      }
    }
  }

  return {
    governance: buildEnvironmentPageGovernanceSnapshot(input.role, {
      cleanup: cleanupCounters,
      recentEvents: governanceEventSnapshots.slice(0, 4).map((event) => ({
        key: event.key,
        label: event.label,
        summary: event.summary,
        createdAtLabel: formatPlatformTimeContext(event.createdAt),
      })),
    }),
    latestGovernanceByEnvironment,
  };
}
