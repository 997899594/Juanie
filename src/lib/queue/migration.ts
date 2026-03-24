import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { migrationRuns } from '@/lib/db/schema';
import { resolveMigrationSpecifications } from '@/lib/migrations';
import { executeMigrationRun } from '@/lib/migrations/runner';
import type { MigrationJobData } from './index';

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

  const specs = await resolveMigrationSpecifications(
    run.projectId,
    run.environmentId,
    run.specification.phase,
    {
      serviceIds: [run.serviceId],
      sourceRef: run.release?.sourceRef ?? null,
      sourceCommitSha: run.release?.configCommitSha ?? run.release?.sourceCommitSha ?? run.sourceCommitSha,
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

  await executeMigrationRun(run.id, spec, {
    imageUrl: job.data.imageUrl,
    allowApprovalBypass: job.data.allowApprovalBypass,
    sourceRef: run.release?.sourceRef ?? null,
    sourceCommitSha: run.release?.configCommitSha ?? run.release?.sourceCommitSha ?? run.sourceCommitSha,
  });

  return { success: true };
}

export function createMigrationWorker() {
  return new Worker<MigrationJobData>('migration', processMigration, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    },
    concurrency: 5,
  });
}
