import { and, eq, inArray, isNull, ne, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import {
  assertExecutionFence,
  buildMigrationExecutionKey,
  claimExecutionOwnership,
} from '@/lib/execution/ownership';
import { logger } from '@/lib/logger';
import { dispatchMigrationRunToSchemaRunner } from '@/lib/migrations/runner-job';
import { buildTraceLogFields } from '@/lib/trace/context';

const migrationWorkerLogger = logger.child({ component: 'migration-worker' });

export interface MigrationCommand {
  runId: string;
  allowApprovalBypass?: boolean;
  traceId?: string;
}

async function claimMigrationRunFence(runId: string) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`select 1 from ${migrationRuns} where ${migrationRuns.id} = ${runId} for update`
    );
    const run = await tx.query.migrationRuns.findFirst({
      where: eq(migrationRuns.id, runId),
      columns: {
        id: true,
        environmentId: true,
        databaseId: true,
        releaseMigrationPlanId: true,
        executionGeneration: true,
      },
    });
    if (!run) throw new Error(`Migration run ${runId} not found`);
    const scopeKey = buildMigrationExecutionKey(run.environmentId, run.databaseId);

    if (run.executionGeneration) {
      const fence = { scopeKey, ownerId: run.id, generation: run.executionGeneration };
      await assertExecutionFence(tx, fence);
      return fence;
    }

    const fence = await claimExecutionOwnership(tx, {
      scopeKey,
      scopeType: 'environment_database',
      ownerType: 'migration',
      ownerId: run.id,
    });
    const supersededAt = new Date();
    await tx
      .update(migrationRuns)
      .set({
        status: 'canceled',
        errorCode: 'MIGRATION_FENCE_SUPERSEDED',
        errorMessage: `Superseded by migration run ${run.id}`,
        finishedAt: supersededAt,
        updatedAt: supersededAt,
      })
      .where(
        and(
          ne(migrationRuns.id, run.id),
          eq(migrationRuns.environmentId, run.environmentId),
          eq(migrationRuns.databaseId, run.databaseId),
          or(
            inArray(migrationRuns.status, ['planning', 'running']),
            and(
              eq(migrationRuns.status, 'queued'),
              run.releaseMigrationPlanId
                ? or(
                    isNull(migrationRuns.releaseMigrationPlanId),
                    ne(migrationRuns.releaseMigrationPlanId, run.releaseMigrationPlanId)
                  )
                : sql`true`
            )
          )
        )
      );
    await tx
      .update(migrationRuns)
      .set({ executionGeneration: fence.generation, updatedAt: new Date() })
      .where(eq(migrationRuns.id, run.id));
    return fence;
  });
}

export async function runMigrationCommand(data: MigrationCommand, jobId?: string) {
  const traceFields = buildTraceLogFields({
    traceId: data.traceId,
    migrationRunId: data.runId,
    jobId,
    queue: jobId ? 'migration' : 'restate-migration',
  });
  const run = await db.query.migrationRuns.findFirst({
    where: (table, { eq }) => eq(table.id, data.runId),
    columns: {
      id: true,
      status: true,
      projectId: true,
      environmentId: true,
      releaseId: true,
    },
  });

  if (!run) {
    throw new Error(`Migration run ${data.runId} not found`);
  }

  migrationWorkerLogger.info('Processing migration job', {
    ...traceFields,
    projectId: run.projectId,
    environmentId: run.environmentId,
    releaseId: run.releaseId,
  });

  if (['success', 'failed', 'canceled', 'skipped'].includes(run.status)) {
    return { success: run.status === 'success', skipped: true };
  }

  await claimMigrationRunFence(run.id);

  await dispatchMigrationRunToSchemaRunner({
    runId: run.id,
    allowApprovalBypass: data.allowApprovalBypass,
  });

  return { success: true, dispatched: true };
}
