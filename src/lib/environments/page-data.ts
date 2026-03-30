import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { auditLogs, environments, projects, releases, type TeamRole } from '@/lib/db/schema';
import { isActivePreviewReleaseStatus } from '@/lib/environments/cleanup';
import {
  buildEnvironmentManageActionSnapshot,
  buildEnvironmentPageGovernanceSnapshot,
  buildPreviewEnvironmentActionSnapshot,
} from '@/lib/environments/governance-view';
import { isPreviewEnvironmentExpired } from '@/lib/environments/preview';
import { decorateEnvironmentList } from '@/lib/environments/view';
import { formatPlatformDateTimeShort } from '@/lib/time/format';

export function buildProjectEnvironmentListData<
  TEnvironment extends Parameters<typeof decorateEnvironmentList>[0][number],
>(environments: TEnvironment[], role: TeamRole) {
  return decorateEnvironmentList(environments).map((environment) => ({
    ...environment,
    actions: {
      ...buildEnvironmentManageActionSnapshot(role, environment),
      ...(environment.isPreview ? buildPreviewEnvironmentActionSnapshot(role) : {}),
    },
  }));
}

export async function getProjectEnvironmentListData(projectId: string, role: TeamRole) {
  const [project, environmentList, releaseList] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, projectId),
      columns: {
        id: true,
        teamId: true,
      },
    }),
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
          },
        },
        domains: {
          with: {
            service: true,
          },
        },
        databases: {
          columns: {
            id: true,
            name: true,
            status: true,
            sourceDatabaseId: true,
          },
        },
      },
    }),
    db.query.releases.findMany({
      where: eq(releases.projectId, projectId),
      orderBy: [desc(releases.createdAt)],
      with: {
        environment: true,
      },
    }),
  ]);

  const recentAuditLogs = project
    ? await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.teamId, project.teamId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(40)
    : [];

  const latestReleaseByEnvironment = new Map<string, (typeof releaseList)[number]>();
  const activeReleaseCountByEnvironment = new Map<string, number>();

  for (const release of releaseList) {
    if (!latestReleaseByEnvironment.has(release.environmentId)) {
      latestReleaseByEnvironment.set(release.environmentId, release);
    }

    if (isActivePreviewReleaseStatus(release.status)) {
      activeReleaseCountByEnvironment.set(
        release.environmentId,
        (activeReleaseCountByEnvironment.get(release.environmentId) ?? 0) + 1
      );
    }
  }

  const cleanupCounters = environmentList.reduce(
    (accumulator, environment) => {
      if (!environment.isPreview || !isPreviewEnvironmentExpired(environment)) {
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
  const recentGovernanceEvents = recentAuditLogs
    .filter((log) => {
      if (
        log.action !== 'environment.preview_deleted' &&
        log.action !== 'environment.preview_cleanup_completed' &&
        log.action !== 'environment.remediation_triggered'
      ) {
        return false;
      }

      const metadata =
        log.metadata && typeof log.metadata === 'object'
          ? (log.metadata as Record<string, unknown>)
          : null;
      return metadata?.projectId === projectId;
    })
    .slice(0, 4)
    .map((log) => {
      const metadata =
        log.metadata && typeof log.metadata === 'object'
          ? (log.metadata as Record<string, unknown>)
          : null;

      if (log.action === 'environment.preview_deleted') {
        return {
          key: log.id,
          label: '手动回收',
          summary: `${String(metadata?.environmentName ?? '预览环境')} 已被手动回收`,
          createdAtLabel: formatPlatformDateTimeShort(log.createdAt),
        };
      }

      if (log.action === 'environment.remediation_triggered') {
        const action = typeof metadata?.action === 'string' ? metadata.action : 'remediation';
        const podCount = typeof metadata?.podCount === 'number' ? metadata.podCount : 0;
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
          createdAtLabel: formatPlatformDateTimeShort(log.createdAt),
        };
      }

      const deletedCount = typeof metadata?.deletedCount === 'number' ? metadata.deletedCount : 0;
      const blockedCount = typeof metadata?.blockedCount === 'number' ? metadata.blockedCount : 0;

      return {
        key: log.id,
        label: '批量治理',
        summary: `已回收 ${deletedCount} 个过期预览环境，${blockedCount} 个仍被活跃发布阻塞`,
        createdAtLabel: formatPlatformDateTimeShort(log.createdAt),
      };
    });

  return {
    governance: buildEnvironmentPageGovernanceSnapshot(role, {
      cleanup: cleanupCounters,
      recentEvents: recentGovernanceEvents,
    }),
    environments: buildProjectEnvironmentListData(
      environmentList.map((environment) => ({
        ...environment,
        latestRelease: latestReleaseByEnvironment.get(environment.id) ?? null,
        activeReleaseCount: activeReleaseCountByEnvironment.get(environment.id) ?? 0,
      })),
      role
    ),
  };
}
