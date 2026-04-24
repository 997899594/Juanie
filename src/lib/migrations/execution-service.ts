import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { resolveMigrationSpecifications } from '@/lib/migrations';
import {
  failMigrationRunWithoutThrow,
  isActiveMigrationRunStatus,
} from '@/lib/migrations/run-state';
import { executeMigrationRun } from '@/lib/migrations/runner';
import { resumeReleaseAfterMigrationProgress } from '@/lib/releases/orchestration';

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
    },
  });

  if (!run) {
    throw new Error(`Migration run ${input.runId} not found`);
  }

  if (['success', 'failed', 'canceled', 'skipped'].includes(run.status)) {
    return { success: run.status === 'success', skipped: true };
  }

  const sourceRef = run.release?.sourceRef ?? null;
  const sourceCommitSha =
    run.release?.configCommitSha ?? run.release?.sourceCommitSha ?? run.sourceCommitSha;

  const specs = await resolveMigrationSpecifications(
    run.projectId,
    run.environmentId,
    run.specification.phase,
    {
      serviceIds: [run.serviceId],
      sourceRef,
      sourceCommitSha,
    }
  );
  const spec = specs.find((candidate) => candidate.specification.id === run.specificationId);

  if (!spec) {
    const errorMessage = 'Migration specification could not be resolved';
    await failMigrationRunWithoutThrow(run.id, 'MIGRATION_SPEC_NOT_FOUND', errorMessage);
    await resumeReleaseAfterMigrationProgress(run.id);
    throw new Error(errorMessage);
  }

  try {
    await executeMigrationRun(run.id, spec, {
      allowApprovalBypass: input.allowApprovalBypass,
      sourceRef,
      sourceCommitSha,
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
