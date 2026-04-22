import { and, desc, eq } from 'drizzle-orm';
import { loadAIEnvironmentContext } from '@/lib/ai/context/environment-context';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { collapseRunsToLatestByLockKey } from '@/lib/migrations/attention';

export interface EnvironmentMigrationReviewEvidence {
  teamId: string;
  projectId: string;
  projectName: string;
  environmentId: string;
  environmentName: string;
  latestReleaseTitle: string | null;
  latestMigrationStatus: string | null;
  migration: {
    totalRuns: number;
    awaitingApprovalCount: number;
    awaitingExternalCount: number;
    failedCount: number;
    runningCount: number;
    latestStatusLabel: string | null;
  };
  schema: {
    databaseCount: number;
    blockedCount: number;
    pendingCount: number;
    summary: string;
  };
  attentionRuns: Array<{
    id: string;
    serviceName: string | null;
    databaseName: string | null;
    status: string;
    errorMessage: string | null;
    createdAt: string | null;
  }>;
}

function buildSchemaSummary(input: {
  databaseCount: number;
  blockedCount: number;
  pendingCount: number;
}): string {
  return [
    `${input.databaseCount} 个数据库`,
    input.blockedCount > 0 ? `${input.blockedCount} 个阻塞` : null,
    input.pendingCount > 0 ? `${input.pendingCount} 个待迁移` : null,
    input.blockedCount === 0 && input.pendingCount === 0 ? 'schema 稳定' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

export async function buildEnvironmentMigrationReviewEvidence(input: {
  projectId: string;
  environmentId: string;
}): Promise<EnvironmentMigrationReviewEvidence> {
  const { teamId, projectName, environment } = await loadAIEnvironmentContext(input);
  const rawMigrationRuns = await db.query.migrationRuns.findMany({
    where: and(
      eq(migrationRuns.projectId, input.projectId),
      eq(migrationRuns.environmentId, input.environmentId)
    ),
    orderBy: [desc(migrationRuns.createdAt)],
    limit: 40,
    with: {
      database: {
        columns: {
          name: true,
        },
      },
      service: {
        columns: {
          name: true,
        },
      },
    },
  });

  const attentionRuns = collapseRunsToLatestByLockKey(
    rawMigrationRuns.filter((run) =>
      ['awaiting_approval', 'awaiting_external_completion', 'failed'].includes(run.status)
    )
  );
  const blockedCount = environment.databases.filter(
    (database) => database.schemaState?.status === 'blocked'
  ).length;
  const pendingCount = environment.databases.filter((database) =>
    database.schemaState
      ? ['pending_migrations', 'drifted'].includes(database.schemaState.status)
      : false
  ).length;

  return {
    teamId,
    projectId: input.projectId,
    projectName,
    environmentId: environment.id,
    environmentName: environment.name,
    latestReleaseTitle: environment.latestReleaseCard?.title ?? null,
    latestMigrationStatus: environment.latestMigrationRun?.status ?? null,
    migration: {
      totalRuns: rawMigrationRuns.length,
      awaitingApprovalCount: rawMigrationRuns.filter((run) => run.status === 'awaiting_approval')
        .length,
      awaitingExternalCount: rawMigrationRuns.filter(
        (run) => run.status === 'awaiting_external_completion'
      ).length,
      failedCount: rawMigrationRuns.filter((run) => run.status === 'failed').length,
      runningCount: rawMigrationRuns.filter((run) =>
        ['queued', 'planning', 'running'].includes(run.status)
      ).length,
      latestStatusLabel: environment.latestMigrationRun?.status ?? null,
    },
    schema: {
      databaseCount: environment.databases.length,
      blockedCount,
      pendingCount,
      summary: buildSchemaSummary({
        databaseCount: environment.databases.length,
        blockedCount,
        pendingCount,
      }),
    },
    attentionRuns: attentionRuns.slice(0, 5).map((run) => ({
      id: run.id,
      serviceName: run.service?.name ?? null,
      databaseName: run.database?.name ?? null,
      status: run.status,
      errorMessage: run.errorMessage ?? null,
      createdAt: run.createdAt ? new Date(run.createdAt).toISOString() : null,
    })),
  };
}
