import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLogs,
  deployments,
  environments,
  migrationRuns,
  releases,
  schemaRepairAtlasRuns,
} from '@/lib/db/schema';
import { getEnvironmentVariableOverview } from '@/lib/env-vars/overview';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import { buildGovernanceEventSnapshot } from '@/lib/environments/page-governance';
import {
  attachEnvironmentRecentActivity,
  buildEnvironmentRuntimeIndexes,
} from '@/lib/environments/page-runtime';
import { decorateEnvironmentList } from '@/lib/environments/view';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-management/presentation';
import { getLatestSchemaRepairPlansForProject } from '@/lib/schema-management/repair-plan';

function getLatestGovernanceEventForEnvironment(input: {
  projectId: string;
  environmentId: string;
  recentAuditLogs: Array<typeof auditLogs.$inferSelect>;
}) {
  for (const log of input.recentAuditLogs) {
    const snapshot = buildGovernanceEventSnapshot(log, input.projectId);
    if (snapshot?.environmentIds.includes(input.environmentId)) {
      return snapshot;
    }
  }

  return null;
}

export async function loadAIEnvironmentContext(input: {
  projectId: string;
  environmentId: string;
}) {
  const environment = await db.query.environments.findFirst({
    where: and(
      eq(environments.projectId, input.projectId),
      eq(environments.id, input.environmentId)
    ),
    with: {
      project: {
        columns: {
          id: true,
          teamId: true,
          name: true,
        },
      },
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
          type: true,
          status: true,
          environmentId: true,
          sourceDatabaseId: true,
        },
        with: {
          schemaState: {
            columns: {
              status: true,
              summary: true,
              expectedVersion: true,
              actualVersion: true,
              hasLedger: true,
              hasUserTables: true,
              lastInspectedAt: true,
            },
          },
        },
      },
    },
  });

  if (!environment) {
    throw new Error('Environment not found');
  }

  const [
    releaseList,
    deploymentList,
    migrationRunList,
    recentAuditLogs,
    latestRepairPlans,
    latestAtlasRuns,
    variableOverview,
  ] = await Promise.all([
    db.query.releases.findMany({
      where: and(
        eq(releases.projectId, input.projectId),
        eq(releases.environmentId, input.environmentId)
      ),
      orderBy: [desc(releases.createdAt)],
      limit: 40,
      with: {
        environment: true,
      },
    }),
    db.query.deployments.findMany({
      where: and(
        eq(deployments.projectId, input.projectId),
        eq(deployments.environmentId, input.environmentId)
      ),
      orderBy: [desc(deployments.createdAt)],
      limit: 40,
      with: {
        service: {
          columns: {
            name: true,
          },
        },
      },
    }),
    db.query.migrationRuns.findMany({
      where: and(
        eq(migrationRuns.projectId, input.projectId),
        eq(migrationRuns.environmentId, input.environmentId)
      ),
      orderBy: [desc(migrationRuns.createdAt)],
      limit: 40,
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
      where: eq(auditLogs.teamId, environment.project.teamId),
      orderBy: [desc(auditLogs.createdAt)],
      limit: 40,
    }),
    getLatestSchemaRepairPlansForProject(input.projectId),
    db.query.schemaRepairAtlasRuns.findMany({
      where: eq(schemaRepairAtlasRuns.projectId, input.projectId),
      orderBy: [desc(schemaRepairAtlasRuns.createdAt)],
    }),
    getEnvironmentVariableOverview(input.projectId, input.environmentId),
  ]);

  const runtimeIndexes = buildEnvironmentRuntimeIndexes({
    releases: releaseList,
    deployments: deploymentList,
    migrationRuns: migrationRunList,
  });
  const latestAtlasRunByDatabase = new Map<string, (typeof latestAtlasRuns)[number]>();

  for (const run of latestAtlasRuns) {
    if (!latestAtlasRunByDatabase.has(run.databaseId)) {
      latestAtlasRunByDatabase.set(run.databaseId, run);
    }
  }

  const decorateDatabaseRecord = (database: (typeof environment.databases)[number]) => {
    const run = latestAtlasRunByDatabase.get(database.id);

    return {
      ...database,
      schemaState: database.schemaState
        ? {
            ...database.schemaState,
            statusLabel: getEnvironmentSchemaStateLabel(database.schemaState.status),
          }
        : null,
      latestRepairPlan: latestRepairPlans.get(database.id) ?? null,
      latestAtlasRun: run
        ? {
            ...run,
            generatedFiles: Array.isArray(run.generatedFiles)
              ? (run.generatedFiles as string[])
              : null,
            diffSummary:
              typeof run.diffSummary === 'object' &&
              run.diffSummary !== null &&
              'changedFiles' in run.diffSummary &&
              'fileStats' in run.diffSummary
                ? (run.diffSummary as {
                    changedFiles: string[];
                    fileStats: Array<{
                      file: string;
                      added: number;
                      removed: number;
                    }>;
                  })
                : null,
          }
        : null,
    };
  };

  type DecoratedDatabaseRecord = ReturnType<typeof decorateDatabaseRecord>;

  const directDatabaseById = new Map<string, DecoratedDatabaseRecord>();
  for (const database of environment.databases) {
    directDatabaseById.set(database.id, decorateDatabaseRecord(database));
  }

  const effectiveDatabaseIds = (
    await getDatabasesForEnvironment({
      projectId: input.projectId,
      environmentId: input.environmentId,
    })
  ).map((database) => database.id);

  const latestGovernanceEvent = getLatestGovernanceEventForEnvironment({
    projectId: input.projectId,
    environmentId: input.environmentId,
    recentAuditLogs,
  });

  const decoratedEnvironment = decorateEnvironmentList([
    {
      ...environment,
      databases: effectiveDatabaseIds
        .map((databaseId) => directDatabaseById.get(databaseId))
        .filter((database): database is DecoratedDatabaseRecord => !!database)
        .map((database) => {
          const sourceEnvironmentName =
            database.environmentId === input.environmentId
              ? environment.name
              : (environment.baseEnvironment?.name ?? null);
          const isInherited =
            Boolean(database.environmentId) && database.environmentId !== input.environmentId;

          return {
            ...database,
            sourceEnvironmentName,
            isInherited,
            usageLabel: isInherited ? `继承自 ${sourceEnvironmentName ?? '基础环境'}` : '当前环境',
          };
        }),
      databaseBindingSummary: {
        directCount: environment.databases.length,
        effectiveCount: effectiveDatabaseIds.length,
        inheritedCount: effectiveDatabaseIds
          .map((databaseId) => directDatabaseById.get(databaseId))
          .filter(
            (database): database is DecoratedDatabaseRecord =>
              !!database && database.environmentId !== input.environmentId
          ).length,
      },
      latestRelease: runtimeIndexes.latestReleaseByEnvironment.get(input.environmentId) ?? null,
      latestSuccessfulRelease:
        runtimeIndexes.latestSuccessfulReleaseByEnvironment.get(input.environmentId) ?? null,
      activeReleaseCount:
        runtimeIndexes.activeReleaseCountByEnvironment.get(input.environmentId) ?? 0,
      latestDeployment:
        runtimeIndexes.latestDeploymentByEnvironment.get(input.environmentId) ?? null,
      latestMigrationRun:
        runtimeIndexes.latestMigrationByEnvironment.get(input.environmentId) ?? null,
      latestGovernanceEvent,
    },
  ])[0];

  if (!decoratedEnvironment) {
    throw new Error('Environment decoration failed');
  }

  const environmentWithActivity = attachEnvironmentRecentActivity(input.projectId, [
    decoratedEnvironment,
  ])[0];

  if (!environmentWithActivity) {
    throw new Error('Environment activity decoration failed');
  }

  return {
    teamId: environment.project.teamId,
    projectId: environment.project.id,
    projectName: environment.project.name,
    environment: environmentWithActivity,
    variableOverview,
  };
}
