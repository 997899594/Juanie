import { desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, projects, schemaRepairAtlasRuns, type TeamRole } from '@/lib/db/schema';
import { buildEnvironmentManageActionSnapshot } from '@/lib/environments/governance-view';
import { getEnvironmentSchemaStateLabel } from '@/lib/schema-management/presentation';
import { getLatestSchemaRepairPlansForProject } from '@/lib/schema-management/repair-plan';

export async function getProjectSchemaCenterData(projectId: string, role: TeamRole) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    columns: {
      id: true,
      teamId: true,
      name: true,
    },
  });

  if (!project) {
    return {
      projectName: '',
      roleLabel: role,
      environments: [],
      summary: {
        databaseCount: 0,
        blockingCount: 0,
        pendingCount: 0,
      },
    };
  }

  const [environmentList, latestRepairPlans, latestAtlasRuns] = await Promise.all([
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

  const latestAtlasRunByDatabase = new Map<string, (typeof latestAtlasRuns)[number]>();
  for (const run of latestAtlasRuns) {
    if (!latestAtlasRunByDatabase.has(run.databaseId)) {
      latestAtlasRunByDatabase.set(run.databaseId, run);
    }
  }

  const environmentsWithSchema = environmentList.map((environment) => ({
    id: environment.id,
    name: environment.name,
    isProduction: environment.isProduction,
    isPreview: environment.isPreview,
    actions: buildEnvironmentManageActionSnapshot(role, environment),
    databases: environment.databases.map((database) => {
      const latestRepairPlan = latestRepairPlans.get(database.id) ?? null;
      const latestAtlasRun = latestAtlasRunByDatabase.get(database.id) ?? null;

      return {
        ...database,
        schemaState: database.schemaState
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
      };
    }),
  }));

  const allDatabases = environmentsWithSchema.flatMap((environment) => environment.databases);
  const blockingCount = allDatabases.filter((database) =>
    ['aligned_untracked', 'drifted', 'unmanaged', 'blocked'].includes(
      database.schemaState?.status ?? 'unmanaged'
    )
  ).length;
  const pendingCount = allDatabases.filter(
    (database) => database.schemaState?.status === 'pending_migrations'
  ).length;

  return {
    projectName: project.name,
    roleLabel: role,
    environments: environmentsWithSchema,
    summary: {
      databaseCount: allDatabases.length,
      blockingCount,
      pendingCount,
    },
  };
}
