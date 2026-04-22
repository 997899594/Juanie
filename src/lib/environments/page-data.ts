import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  auditLogs,
  deliveryRules,
  deployments,
  environments,
  migrationRuns,
  projects,
  promotionFlows,
  releases,
  schemaRepairAtlasRuns,
  type TeamRole,
} from '@/lib/db/schema';
import { buildDeliveryControlSnapshot } from '@/lib/environments/control-plane';
import {
  buildEnvironmentManageActionSnapshot,
  buildPreviewEnvironmentActionSnapshot,
} from '@/lib/environments/governance-view';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import { isPreviewEnvironment } from '@/lib/environments/model';
import { buildEnvironmentGovernanceData } from '@/lib/environments/page-governance';
import {
  attachEnvironmentRecentActivity,
  buildEnvironmentRuntimeIndexes,
} from '@/lib/environments/page-runtime';
import { decorateEnvironmentList } from '@/lib/environments/view';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-management/presentation';
import { getLatestSchemaRepairPlansForProject } from '@/lib/schema-management/repair-plan';
import { syncLatestSchemaRepairPlans } from '@/lib/schema-management/review-sync';

export function buildProjectEnvironmentListData<
  TEnvironment extends Parameters<typeof decorateEnvironmentList>[0][number],
>(environments: TEnvironment[], role: TeamRole) {
  return decorateEnvironmentList(environments).map((environment) => ({
    ...environment,
    actions: {
      ...buildEnvironmentManageActionSnapshot(role, environment),
      ...(isPreviewEnvironment(environment) ? buildPreviewEnvironmentActionSnapshot(role) : {}),
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
      deliveryControl: buildDeliveryControlSnapshot({
        role,
        environments: [],
        deliveryRules: [],
        promotionFlows: [],
      }),
      environments: [],
    };
  }

  const [
    environmentList,
    releaseList,
    deploymentList,
    migrationRunList,
    recentAuditLogs,
    latestRepairPlansResult,
    latestAtlasRuns,
    deliveryRuleList,
    promotionFlowList,
  ] = await Promise.all([
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      with: {
        baseEnvironment: {
          columns: {
            id: true,
            name: true,
          },
        },
        deliveryRules: {
          columns: {
            kind: true,
            pattern: true,
            priority: true,
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
    getLatestSchemaRepairPlansForProject(projectId),
    db.query.schemaRepairAtlasRuns.findMany({
      where: eq(schemaRepairAtlasRuns.projectId, projectId),
      orderBy: [desc(schemaRepairAtlasRuns.createdAt)],
    }),
    db.query.deliveryRules.findMany({
      where: eq(deliveryRules.projectId, projectId),
      orderBy: [deliveryRules.priority],
    }),
    db.query.promotionFlows.findMany({
      where: eq(promotionFlows.projectId, projectId),
      orderBy: [promotionFlows.createdAt],
    }),
  ]);
  const latestRepairPlans = await syncLatestSchemaRepairPlans(latestRepairPlansResult);
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
  const environmentNameById = new Map(
    environmentList.map((environment) => [environment.id, environment.name])
  );
  const decorateDatabaseRecord = (
    database: (typeof environmentList)[number]['databases'][number]
  ) => {
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
  for (const environment of environmentList) {
    for (const database of environment.databases) {
      directDatabaseById.set(database.id, decorateDatabaseRecord(database));
    }
  }
  const effectiveDatabaseIdsByEnvironment = new Map<string, string[]>(
    await Promise.all(
      environmentList.map(
        async (environment): Promise<[string, string[]]> => [
          environment.id,
          (
            await getDatabasesForEnvironment({
              projectId,
              environmentId: environment.id,
            })
          ).map((database) => database.id),
        ]
      )
    )
  );
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
        databases: (effectiveDatabaseIdsByEnvironment.get(environment.id) ?? [])
          .map((databaseId) => directDatabaseById.get(databaseId))
          .filter((database): database is DecoratedDatabaseRecord => !!database)
          .map((database) => {
            const sourceEnvironmentName = database.environmentId
              ? (environmentNameById.get(database.environmentId) ?? null)
              : null;
            const isInherited =
              Boolean(database.environmentId) && database.environmentId !== environment.id;

            return {
              ...database,
              sourceEnvironmentName,
              isInherited,
              usageLabel: isInherited
                ? `继承自 ${sourceEnvironmentName ?? '基础环境'}`
                : '当前环境',
            };
          }),
        databaseBindingSummary: {
          directCount: environment.databases.length,
          effectiveCount: (effectiveDatabaseIdsByEnvironment.get(environment.id) ?? []).length,
          inheritedCount: (effectiveDatabaseIdsByEnvironment.get(environment.id) ?? [])
            .map((databaseId) => directDatabaseById.get(databaseId))
            .filter(
              (database): database is DecoratedDatabaseRecord =>
                !!database && database.environmentId !== environment.id
            ).length,
        },
        latestRelease: runtimeIndexes.latestReleaseByEnvironment.get(environment.id) ?? null,
        latestSuccessfulRelease:
          runtimeIndexes.latestSuccessfulReleaseByEnvironment.get(environment.id) ?? null,
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
    deliveryControl: buildDeliveryControlSnapshot({
      role,
      environments: environmentList,
      deliveryRules: deliveryRuleList,
      promotionFlows: promotionFlowList,
    }),
    environments: decoratedEnvironments,
  };
}
