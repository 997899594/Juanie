import { desc, eq } from 'drizzle-orm';
import {
  buildDatabaseConsoleOverview,
  buildDbGateDatabaseConsoleLink,
  getDbGateConsoleConfig,
} from '@/lib/database-console/dbgate';
import { getDatabaseInsights } from '@/lib/databases/insights';
import { isSchemaManagedDatabaseType } from '@/lib/databases/platform-support';
import { db } from '@/lib/db';
import { environments, schemaRepairAtlasRuns, type TeamRole } from '@/lib/db/schema';
import { buildEnvironmentManageActionSnapshot } from '@/lib/environments/governance-view';
import { isPreviewEnvironment, isProductionEnvironment } from '@/lib/environments/model';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-management/presentation';
import { getLatestSchemaRepairPlansForProject } from '@/lib/schema-management/repair-plan';
import { syncLatestSchemaRepairPlans } from '@/lib/schema-management/review-sync';

export async function getProjectSchemaCenterData(input: {
  project: {
    id: string;
    name: string;
  };
  role: TeamRole;
  selectedEnvId?: string | null;
}) {
  const projectId = input.project.id;
  const databaseConsoleConfig = getDbGateConsoleConfig();

  const [environmentList, latestRepairPlansResult, latestAtlasRuns] = await Promise.all([
    db.query.environments.findMany({
      where: eq(environments.projectId, projectId),
      orderBy: [environments.createdAt],
      with: {
        databases: {
          columns: {
            id: true,
            name: true,
            type: true,
            status: true,
            host: true,
            port: true,
            databaseName: true,
            connectionString: true,
            namespace: true,
            serviceName: true,
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
    getLatestSchemaRepairPlansForProject(projectId),
    db.query.schemaRepairAtlasRuns.findMany({
      where: eq(schemaRepairAtlasRuns.projectId, projectId),
      orderBy: [desc(schemaRepairAtlasRuns.createdAt)],
    }),
  ]);
  const latestRepairPlans = await syncLatestSchemaRepairPlans(latestRepairPlansResult);

  const latestAtlasRunByDatabase = new Map<string, (typeof latestAtlasRuns)[number]>();
  for (const run of latestAtlasRuns) {
    if (!latestAtlasRunByDatabase.has(run.databaseId)) {
      latestAtlasRunByDatabase.set(run.databaseId, run);
    }
  }

  const environmentsWithSchema = await Promise.all(
    environmentList.map(async (environment) => ({
      id: environment.id,
      name: environment.name,
      kind: environment.kind,
      isProduction: isProductionEnvironment(environment),
      isPreview: isPreviewEnvironment(environment),
      actions: buildEnvironmentManageActionSnapshot(input.role, environment),
      databases: await Promise.all(
        environment.databases.map(async (database) => {
          const { connectionString: _connectionString, ...safeDatabase } = database;
          const schemaManagement = {
            enabled: isSchemaManagedDatabaseType(database.type),
          };
          const latestRepairPlan = schemaManagement.enabled
            ? (latestRepairPlans.get(database.id) ?? null)
            : null;
          const latestAtlasRun = schemaManagement.enabled
            ? (latestAtlasRunByDatabase.get(database.id) ?? null)
            : null;

          return {
            ...safeDatabase,
            schemaManagement,
            insights: await getDatabaseInsights(database),
            schemaState:
              schemaManagement.enabled && database.schemaState
                ? {
                    ...database.schemaState,
                    statusLabel: getEnvironmentSchemaStateLabel(database.schemaState.status),
                  }
                : null,
            latestRepairPlan,
            latestAtlasRun: latestAtlasRun
              ? {
                  ...latestAtlasRun,
                  generatedFiles: Array.isArray(latestAtlasRun.generatedFiles)
                    ? (latestAtlasRun.generatedFiles as string[])
                    : null,
                  artifactFiles:
                    typeof latestAtlasRun.artifactFiles === 'object' &&
                    latestAtlasRun.artifactFiles !== null
                      ? (latestAtlasRun.artifactFiles as Record<string, string>)
                      : null,
                  diffSummary:
                    typeof latestAtlasRun.diffSummary === 'object' &&
                    latestAtlasRun.diffSummary !== null &&
                    'changedFiles' in latestAtlasRun.diffSummary &&
                    'fileStats' in latestAtlasRun.diffSummary
                      ? (latestAtlasRun.diffSummary as {
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
            console: buildDbGateDatabaseConsoleLink({
              config: databaseConsoleConfig,
              project: input.project,
              environment,
              database,
            }),
          };
        })
      ),
    }))
  );

  const selectedEnvironment = input.selectedEnvId
    ? (environmentsWithSchema.find((environment) => environment.id === input.selectedEnvId) ?? null)
    : null;
  const visibleEnvironments = selectedEnvironment ? [selectedEnvironment] : environmentsWithSchema;
  const allDatabases = visibleEnvironments.flatMap((environment) => environment.databases);
  const schemaManagedDatabases = allDatabases.filter(
    (database) => database.schemaManagement.enabled
  );
  const blockingCount = schemaManagedDatabases.filter((database) =>
    ['aligned_untracked', 'drifted', 'unmanaged', 'blocked'].includes(
      database.schemaState?.status ?? 'unmanaged'
    )
  ).length;
  const pendingCount = schemaManagedDatabases.filter(
    (database) => database.schemaState?.status === 'pending_migrations'
  ).length;

  return {
    projectName: input.project.name,
    roleLabel: input.role,
    databaseConsole: buildDatabaseConsoleOverview(databaseConsoleConfig),
    environments: visibleEnvironments,
    selectedEnvId: selectedEnvironment?.id ?? null,
    summary: {
      databaseCount: allDatabases.length,
      schemaManagedCount: schemaManagedDatabases.length,
      blockingCount,
      pendingCount,
    },
  };
}
