import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { schemaRepairAtlasRuns } from '@/lib/db/schema';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import { executeSchemaRepairAtlasRun } from '@/lib/schema-management/atlas-run';
import type { SchemaRepairAtlasJobData } from './index';

export async function processSchemaRepairAtlas(job: Job<SchemaRepairAtlasJobData>) {
  const run = await db.query.schemaRepairAtlasRuns.findFirst({
    where: eq(schemaRepairAtlasRuns.id, job.data.atlasRunId),
  });

  if (!run) {
    throw new Error(`Schema repair Atlas run ${job.data.atlasRunId} not found`);
  }

  if (['succeeded', 'failed'].includes(run.status)) {
    return { success: run.status === 'succeeded', skipped: true };
  }

  await executeSchemaRepairAtlasRun({
    atlasRunId: run.id,
    projectId: job.data.projectId,
    userId: job.data.userId ?? null,
  });

  return { success: true };
}

export function createSchemaRepairAtlasWorker() {
  return new Worker<SchemaRepairAtlasJobData>('schema-repair-atlas', processSchemaRepairAtlas, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 2,
  });
}
