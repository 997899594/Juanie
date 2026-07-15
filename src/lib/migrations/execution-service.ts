import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { verifyReleaseMigrationPlanForRun } from '@/lib/migrations/release-plan';
import {
  failMigrationRunWithoutThrow,
  isActiveMigrationRunStatus,
} from '@/lib/migrations/run-state';
import { executeMigrationRun } from '@/lib/migrations/runner';
import { restoreMigrationSpecificationSnapshot } from '@/lib/migrations/specification-snapshot';
import type { ResolvedMigrationSpec } from '@/lib/migrations/types';
import { resumeReleaseAfterMigrationProgress } from '@/lib/releases/orchestration';
import { inspectEnvironmentSchemaStateLocally } from '@/lib/schema-management/inspect';
import { buildTraceLogFields } from '@/lib/trace/context';

const migrationExecutionLogger = logger.child({ component: 'migration-execution-service' });

export type MigrationExecutionServiceResult =
  | {
      success: true;
      skipped?: boolean;
    }
  | {
      success: false;
      skipped?: boolean;
      waiting?: 'awaiting_approval' | 'awaiting_external_completion';
    };

export async function executeMigrationRunInExecutionService(input: {
  runId: string;
  allowApprovalBypass?: boolean;
}): Promise<MigrationExecutionServiceResult> {
  const run = await db.query.migrationRuns.findFirst({
    where: (table, { eq: eqRun }) => eqRun(table.id, input.runId),
    with: {
      release: true,
      specification: true,
      database: true,
      service: true,
      environment: true,
    },
  });

  if (!run) {
    throw new Error(`Migration run ${input.runId} not found`);
  }

  if (['success', 'failed', 'canceled', 'skipped'].includes(run.status)) {
    return { success: run.status === 'success', skipped: true };
  }

  const traceFields = buildTraceLogFields({
    projectId: run.projectId,
    environmentId: run.environmentId,
    releaseId: run.releaseId,
    migrationRunId: run.id,
  });

  const sourceRef = run.release?.sourceRef ?? null;
  const sourceCommitSha =
    run.release?.configCommitSha ?? run.release?.sourceCommitSha ?? run.sourceCommitSha;

  const spec = {
    specification: restoreMigrationSpecificationSnapshot(
      run.specification,
      run.specificationSnapshot
    ),
    database: run.database,
    service: run.service,
    environment: run.environment,
    resolution: {
      strategy: 'run_snapshot',
      selector: {
        bindingName: null,
        bindingRole: null,
        bindingDatabaseType: null,
      },
    },
  } satisfies ResolvedMigrationSpec;

  try {
    migrationExecutionLogger.info('Executing migration run', traceFields);
    if (run.releaseMigrationPlanId) {
      await verifyReleaseMigrationPlanForRun(run.id);
    }
    await executeMigrationRun(run.id, spec, {
      allowApprovalBypass: input.allowApprovalBypass,
      sourceRef,
      sourceCommitSha,
    });
    await inspectEnvironmentSchemaStateLocally({
      projectId: run.projectId,
      databaseId: spec.database.id,
      sourceRef,
      sourceCommitSha,
    }).catch((error) => {
      migrationExecutionLogger.warn('Failed to refresh schema state after migration success', {
        runId: run.id,
        projectId: run.projectId,
        environmentId: run.environmentId,
        databaseId: spec.database.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    });
    await resumeReleaseAfterMigrationProgress(run.id);
  } catch (error) {
    const latestRun = await db.query.migrationRuns.findFirst({
      where: eq(migrationRuns.id, run.id),
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

    if (latestRun && isActiveMigrationRunStatus(latestRun.status)) {
      await failMigrationRunWithoutThrow(
        run.id,
        'MIGRATION_RUNNER_ERROR',
        error instanceof Error ? error.message : String(error)
      );
    }

    await resumeReleaseAfterMigrationProgress(run.id);

    throw error;
  }

  return { success: true };
}
