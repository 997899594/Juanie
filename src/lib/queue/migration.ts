import { Job, Worker } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';
import { resolveMigrationSpecifications } from '@/lib/migrations';
import { executeMigrationRun } from '@/lib/migrations/runner';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import { resumeReleaseAfterMigrationProgress } from '@/lib/releases/orchestration';
import type { MigrationJobData } from './index';

const activeMigrationRunStatuses = ['queued', 'planning', 'running'] as const;
const activeMigrationItemStatuses = ['queued', 'planning', 'running'] as const;

export function shouldReconcileUnexpectedMigrationJobFailure(status: string): boolean {
  return activeMigrationRunStatuses.includes(status as (typeof activeMigrationRunStatuses)[number]);
}

export function getUnexpectedMigrationJobFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('stalled more than allowable limit')
    ? 'MIGRATION_JOB_STALLED'
    : 'MIGRATION_JOB_FAILED';
}

export async function reconcileUnexpectedMigrationJobFailure(runId: string, error: unknown) {
  const run = await db.query.migrationRuns.findFirst({
    where: (table, { eq }) => eq(table.id, runId),
    columns: {
      id: true,
      status: true,
    },
  });

  if (!run) {
    return { reconciled: false, reason: 'run_missing' as const };
  }

  if (shouldReconcileUnexpectedMigrationJobFailure(run.status)) {
    const finishedAt = new Date();
    const errorMessage = error instanceof Error ? error.message : String(error);

    await db
      .update(migrationRunItems)
      .set({
        status: 'failed',
        error: errorMessage,
        output: errorMessage,
        finishedAt,
      })
      .where(
        and(
          eq(migrationRunItems.migrationRunId, runId),
          inArray(migrationRunItems.status, [...activeMigrationItemStatuses])
        )
      );

    await db
      .update(migrationRuns)
      .set({
        status: 'failed',
        errorCode: getUnexpectedMigrationJobFailureCode(error),
        errorMessage,
        finishedAt,
        updatedAt: finishedAt,
      })
      .where(eq(migrationRuns.id, runId));
  }

  await resumeReleaseAfterMigrationProgress(runId);
  return { reconciled: true, reason: 'run_updated' as const };
}

export async function processMigration(job: Job<MigrationJobData>) {
  const run = await db.query.migrationRuns.findFirst({
    where: (table, { eq }) => eq(table.id, job.data.runId),
    with: {
      release: true,
      specification: true,
    },
  });

  if (!run) {
    throw new Error(`Migration run ${job.data.runId} not found`);
  }

  if (['success', 'failed', 'canceled', 'skipped'].includes(run.status)) {
    return { success: run.status === 'success', skipped: true };
  }

  const specs = await resolveMigrationSpecifications(
    run.projectId,
    run.environmentId,
    run.specification.phase,
    {
      serviceIds: [run.serviceId],
      sourceRef: run.release?.sourceRef ?? null,
      sourceCommitSha:
        run.release?.configCommitSha ?? run.release?.sourceCommitSha ?? run.sourceCommitSha,
    }
  );
  const spec = specs.find((candidate) => candidate.specification.id === run.specificationId);

  if (!spec) {
    await db
      .update(migrationRuns)
      .set({
        status: 'failed',
        errorCode: 'MIGRATION_SPEC_NOT_FOUND',
        errorMessage: 'Migration specification could not be resolved',
        updatedAt: new Date(),
      })
      .where(eq(migrationRuns.id, run.id));
    throw new Error('Migration specification could not be resolved');
  }

  try {
    await executeMigrationRun(run.id, spec, {
      allowApprovalBypass: job.data.allowApprovalBypass,
      sourceRef: run.release?.sourceRef ?? null,
      sourceCommitSha:
        run.release?.configCommitSha ?? run.release?.sourceCommitSha ?? run.sourceCommitSha,
    });
    await resumeReleaseAfterMigrationProgress(run.id);
  } catch (error) {
    const latestRun = await db.query.migrationRuns.findFirst({
      where: (table, { eq }) => eq(table.id, run.id),
      columns: {
        status: true,
      },
    });

    if (
      latestRun &&
      (latestRun.status === 'awaiting_approval' ||
        latestRun.status === 'awaiting_external_completion')
    ) {
      await resumeReleaseAfterMigrationProgress(run.id);
      return {
        success: false,
        waiting: latestRun.status,
      };
    }

    if (latestRun && shouldReconcileUnexpectedMigrationJobFailure(latestRun.status)) {
      await db
        .update(migrationRuns)
        .set({
          status: 'failed',
          errorCode: 'MIGRATION_RUNNER_ERROR',
          errorMessage: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(migrationRuns.id, run.id));
    }

    await resumeReleaseAfterMigrationProgress(run.id);

    throw error;
  }

  return { success: true };
}

export function createMigrationWorker() {
  return new Worker<MigrationJobData>('migration', processMigration, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 5,
  });
}
