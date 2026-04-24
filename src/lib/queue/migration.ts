import { Job, Worker } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';
import { dispatchMigrationRunToSchemaRunner } from '@/lib/migrations/runner-job';
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
      runnerType: true,
      jobName: true,
    },
  });

  if (!run) {
    return { reconciled: false, reason: 'run_missing' as const };
  }

  if (run.runnerType === 'schema_runner' && run.jobName) {
    return { reconciled: false, reason: 'handoff_completed' as const };
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
    columns: {
      id: true,
      status: true,
    },
  });

  if (!run) {
    throw new Error(`Migration run ${job.data.runId} not found`);
  }

  if (['success', 'failed', 'canceled', 'skipped'].includes(run.status)) {
    return { success: run.status === 'success', skipped: true };
  }

  await dispatchMigrationRunToSchemaRunner({
    runId: run.id,
    allowApprovalBypass: job.data.allowApprovalBypass,
  });

  return { success: true, dispatched: true };
}

export function createMigrationWorker() {
  return new Worker<MigrationJobData>('migration', processMigration, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 5,
  });
}
