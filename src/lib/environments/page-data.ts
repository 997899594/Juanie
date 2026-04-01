import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLogs,
  deployments,
  environments,
  migrationRuns,
  projects,
  releases,
  type TeamRole,
} from '@/lib/db/schema';
import { buildEnvironmentRecentActivity } from '@/lib/environments/activity';
import { isActivePreviewReleaseStatus } from '@/lib/environments/cleanup';
import {
  buildEnvironmentManageActionSnapshot,
  buildEnvironmentPageGovernanceSnapshot,
  buildPreviewEnvironmentActionSnapshot,
} from '@/lib/environments/governance-view';
import { isPreviewEnvironmentExpired } from '@/lib/environments/preview';
import { decorateEnvironmentList } from '@/lib/environments/view';
import { formatPlatformTimeContext } from '@/lib/time/format';

function getAuditMetadata(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function buildGovernanceEventSnapshot(log: typeof auditLogs.$inferSelect, projectId: string) {
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
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
      teamId: true,
    },
  });

  if (!project) {
    return {
      governance: buildEnvironmentPageGovernanceSnapshot(role),
      environments: [],
    };
  }

  const [environmentList, releaseList, deploymentList, migrationRunList, recentAuditLogs] =
    await Promise.all([
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
      db.query.deployments.findMany({
        where: eq(deployments.projectId, projectId),
        orderBy: [desc(deployments.createdAt)],
        limit: 120,
        with: {
          service: {
            columns: {
              name: true,
            },
          },
        },
      }),
      db.query.migrationRuns.findMany({
        where: eq(migrationRuns.projectId, projectId),
        orderBy: [desc(migrationRuns.createdAt)],
        limit: 120,
        with: {
          service: {
            columns: {
              name: true,
            },
          },
          database: {
            columns: {
              name: true,
            },
          },
        },
      }),
      db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.teamId, project.teamId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(40),
    ]);

  const latestReleaseByEnvironment = new Map<string, (typeof releaseList)[number]>();
  const activeReleaseCountByEnvironment = new Map<string, number>();
  const latestDeploymentByEnvironment = new Map<string, (typeof deploymentList)[number]>();
  const latestMigrationByEnvironment = new Map<string, (typeof migrationRunList)[number]>();

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

  for (const deployment of deploymentList) {
    if (!latestDeploymentByEnvironment.has(deployment.environmentId)) {
      latestDeploymentByEnvironment.set(deployment.environmentId, deployment);
    }
  }

  for (const run of migrationRunList) {
    if (!latestMigrationByEnvironment.has(run.environmentId)) {
      latestMigrationByEnvironment.set(run.environmentId, run);
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
  const governanceEventSnapshots = recentAuditLogs
    .map((log) => buildGovernanceEventSnapshot(log, projectId))
    .filter((event): event is NonNullable<typeof event> => !!event);
  const latestGovernanceByEnvironment = new Map<
    string,
    (typeof governanceEventSnapshots)[number]
  >();

  for (const event of governanceEventSnapshots) {
    for (const environmentId of event.environmentIds) {
      if (!latestGovernanceByEnvironment.has(environmentId)) {
        latestGovernanceByEnvironment.set(environmentId, event);
      }
    }
  }

  const recentGovernanceEvents = governanceEventSnapshots.slice(0, 4).map((event) => ({
    key: event.key,
    label: event.label,
    summary: event.summary,
    createdAtLabel: formatPlatformTimeContext(event.createdAt),
  }));

  const decoratedEnvironments = buildProjectEnvironmentListData(
    environmentList.map((environment) => ({
      ...environment,
      latestRelease: latestReleaseByEnvironment.get(environment.id) ?? null,
      activeReleaseCount: activeReleaseCountByEnvironment.get(environment.id) ?? 0,
      latestDeployment: latestDeploymentByEnvironment.get(environment.id) ?? null,
      latestMigrationRun: latestMigrationByEnvironment.get(environment.id) ?? null,
      latestGovernanceEvent: latestGovernanceByEnvironment.get(environment.id) ?? null,
    })),
    role
  ).map((environment) => ({
    ...environment,
    recentActivity: buildEnvironmentRecentActivity({
      projectId,
      environmentId: environment.id,
      latestRelease: environment.latestRelease
        ? {
            id: environment.latestRelease.id,
            status: environment.latestRelease.status,
            title:
              environment.latestReleaseCard?.title ??
              environment.latestRelease.sourceRef ??
              '最近发布',
            shortCommitSha: environment.latestReleaseCard?.shortCommitSha ?? null,
            createdAt: environment.latestRelease.createdAt,
          }
        : null,
      latestDeployment: environment.latestDeployment
        ? {
            id: environment.latestDeployment.id,
            status: environment.latestDeployment.status,
            serviceName: environment.latestDeployment.service?.name ?? null,
            createdAt: environment.latestDeployment.createdAt,
            releaseId: environment.latestDeployment.releaseId ?? null,
          }
        : null,
      latestMigration: environment.latestMigrationRun
        ? {
            id: environment.latestMigrationRun.id,
            status: environment.latestMigrationRun.status,
            serviceName: environment.latestMigrationRun.service?.name ?? null,
            databaseName: environment.latestMigrationRun.database?.name ?? null,
            createdAt: environment.latestMigrationRun.createdAt,
            releaseId: environment.latestMigrationRun.releaseId ?? null,
          }
        : null,
      latestGovernance: environment.latestGovernanceEvent
        ? {
            key: environment.latestGovernanceEvent.key,
            label: environment.latestGovernanceEvent.label,
            summary: environment.latestGovernanceEvent.summary,
            createdAt: environment.latestGovernanceEvent.createdAt,
          }
        : null,
    }),
  }));

  return {
    governance: buildEnvironmentPageGovernanceSnapshot(role, {
      cleanup: cleanupCounters,
      recentEvents: recentGovernanceEvents,
    }),
    environments: decoratedEnvironments,
  };
}
