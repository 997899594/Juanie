import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRunItems, migrationRuns } from '@/lib/db/schema';

export const MIGRATION_STALE_RUN_TIMEOUT_MS = 30 * 60 * 1000;
export const activeMigrationRunStatuses = ['queued', 'planning', 'running'] as const;
export const activeMigrationItemStatuses = ['queued', 'planning', 'running'] as const;

export function isActiveMigrationRunStatus(
  status: string
): status is (typeof activeMigrationRunStatuses)[number] {
  return activeMigrationRunStatuses.includes(status as (typeof activeMigrationRunStatuses)[number]);
}

export async function appendMigrationRunLog(
  runId: string,
  message: string,
  options?: {
    touchUpdatedAt?: boolean;
    dedupeConsecutive?: boolean;
  }
): Promise<void> {
  const existing = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
  });
  const currentExcerpt = existing?.logExcerpt ?? '';
  const previousLine = currentExcerpt.trimEnd().split('\n').at(-1) ?? '';

  if (options?.dedupeConsecutive && previousLine === message) {
    return;
  }

  const next = [existing?.logExcerpt ?? '', message].filter(Boolean).join('\n').slice(-8000);
  await db
    .update(migrationRuns)
    .set({
      logExcerpt: next,
      ...(options?.touchUpdatedAt === false ? {} : { updatedAt: new Date() }),
    })
    .where(eq(migrationRuns.id, runId));
}

export async function getMigrationRunStartedAt(runId: string): Promise<Date | null> {
  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    columns: { startedAt: true },
  });
  return run?.startedAt ?? null;
}

export async function failMigrationRunWithoutThrow(
  runId: string,
  errorCode: string,
  errorMessage: string,
  options?: {
    appendLog?: boolean;
  }
): Promise<void> {
  const finishedAt = new Date();
  const startedAt = await getMigrationRunStartedAt(runId);

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
      errorCode,
      errorMessage,
      finishedAt,
      durationMs: startedAt ? finishedAt.getTime() - startedAt.getTime() : null,
      updatedAt: finishedAt,
    })
    .where(eq(migrationRuns.id, runId));

  if (options?.appendLog !== false) {
    await appendMigrationRunLog(runId, errorMessage);
  }
}

export async function markMigrationRunFailed(
  runId: string,
  errorCode: string,
  errorMessage: string
): Promise<never> {
  await failMigrationRunWithoutThrow(runId, errorCode, errorMessage, {
    appendLog: false,
  });
  throw new Error(errorMessage);
}

export async function reconcileStaleActiveMigrationRun(run: {
  id: string;
  status: string;
  updatedAt: Date;
  startedAt: Date | null;
  createdAt: Date;
}): Promise<boolean> {
  if (!isActiveMigrationRunStatus(run.status)) {
    return false;
  }

  const referenceTime = run.updatedAt ?? run.startedAt ?? run.createdAt;
  const staleForMs = Date.now() - referenceTime.getTime();

  if (staleForMs < MIGRATION_STALE_RUN_TIMEOUT_MS) {
    return false;
  }

  const staleMinutes = Math.floor(staleForMs / 60000);
  await failMigrationRunWithoutThrow(
    run.id,
    'MIGRATION_RUN_STALE',
    `Migration run became stale after ${staleMinutes} minutes without progress updates`
  );
  return true;
}
