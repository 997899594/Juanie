import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { dispatchMigrationRunToSchemaRunner } from '@/lib/migrations/runner-job';
import { buildTraceLogFields } from '@/lib/trace/context';

const migrationWorkerLogger = logger.child({ component: 'migration-worker' });

export interface MigrationCommand {
  runId: string;
  allowApprovalBypass?: boolean;
  traceId?: string;
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

  await dispatchMigrationRunToSchemaRunner({
    runId: run.id,
    allowApprovalBypass: data.allowApprovalBypass,
  });

  return { success: true, dispatched: true };
}
