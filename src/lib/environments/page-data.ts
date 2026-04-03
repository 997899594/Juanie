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
import {
  buildEnvironmentManageActionSnapshot,
  buildPreviewEnvironmentActionSnapshot,
} from '@/lib/environments/governance-view';
import { buildEnvironmentGovernanceData } from '@/lib/environments/page-governance';
import {
  attachEnvironmentRecentActivity,
  buildEnvironmentRuntimeIndexes,
} from '@/lib/environments/page-runtime';
import { decorateEnvironmentList } from '@/lib/environments/view';

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
      governance: buildEnvironmentGovernanceData({
        projectId,
        role,
        environments: [],
        activeReleaseCountByEnvironment: new Map(),
        recentAuditLogs: [],
      }).governance,
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
      db.query.auditLogs.findMany({
        where: (log, { eq }) => eq(log.teamId, project.teamId),
        orderBy: [desc(auditLogs.createdAt)],
        limit: 40,
      }),
    ]);
  const runtimeIndexes = buildEnvironmentRuntimeIndexes({
    releases: releaseList,
    deployments: deploymentList,
    migrationRuns: migrationRunList,
  });
  const governanceData = buildEnvironmentGovernanceData({
    projectId,
    role,
    environments: environmentList,
    activeReleaseCountByEnvironment: runtimeIndexes.activeReleaseCountByEnvironment,
    recentAuditLogs,
  });
  const decoratedEnvironments = attachEnvironmentRecentActivity(
    projectId,
    buildProjectEnvironmentListData(
      environmentList.map((environment) => ({
        ...environment,
        latestRelease: runtimeIndexes.latestReleaseByEnvironment.get(environment.id) ?? null,
        activeReleaseCount: runtimeIndexes.activeReleaseCountByEnvironment.get(environment.id) ?? 0,
        latestDeployment: runtimeIndexes.latestDeploymentByEnvironment.get(environment.id) ?? null,
        latestMigrationRun: runtimeIndexes.latestMigrationByEnvironment.get(environment.id) ?? null,
        latestGovernanceEvent:
          governanceData.latestGovernanceByEnvironment.get(environment.id) ?? null,
      })),
      role
    )
  );

  return {
    governance: governanceData.governance,
    environments: decoratedEnvironments,
  };
}
