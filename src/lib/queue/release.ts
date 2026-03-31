import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import {
  continueReleaseFromDeploymentStage,
  failReleaseForCurrentPhase,
  loadReleaseForOrchestration,
  runReleaseMigrationPhase,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import type { ReleaseJobData } from './index';

export async function processRelease(job: Job<ReleaseJobData>) {
  const release = await loadReleaseForOrchestration(job.data.releaseId);

  if (!release) {
    throw new Error(`Release ${job.data.releaseId} not found`);
  }

  if (release.artifacts.length === 0) {
    await updateReleaseStatus(release.id, 'failed', 'Release has no artifacts to deploy');
    throw new Error('Release has no artifacts to deploy');
  }

  try {
    await updateReleaseStatus(release.id, 'planning');
    await updateReleaseStatus(release.id, 'migration_pre_running');
    await runReleaseMigrationPhase(release, 'preDeploy');
    return await continueReleaseFromDeploymentStage(release.id, release);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = await db.query.releases.findFirst({
      where: eq(releases.id, release.id),
      columns: { status: true },
    });

    if (current?.status !== 'verification_failed') {
      await failReleaseForCurrentPhase(release.id, message);
    }

    throw error;
  }
}

export function createReleaseWorker() {
  return new Worker<ReleaseJobData>('release', processRelease, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    },
    concurrency: 5,
  });
}
