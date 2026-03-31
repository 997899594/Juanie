import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, releases } from '@/lib/db/schema';
import {
  completeReleaseAfterDeployments,
  failReleaseForCurrentPhase,
  loadReleaseForOrchestration,
  persistReleaseRecapSafely,
  runReleaseMigrationPhase,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { addDeploymentJob, type ReleaseJobData } from './index';

async function waitForDeployment(
  deploymentId: string
): Promise<'running' | 'failed' | 'rolled_back' | 'awaiting_rollout' | 'verification_failed'> {
  for (let attempts = 0; attempts < 300; attempts++) {
    const deployment = await db.query.deployments.findFirst({
      where: eq(deployments.id, deploymentId),
    });

    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (
      deployment.status === 'running' ||
      deployment.status === 'awaiting_rollout' ||
      deployment.status === 'verification_failed' ||
      deployment.status === 'failed' ||
      deployment.status === 'rolled_back'
    ) {
      return deployment.status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for deployment ${deploymentId}`);
}

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

    await updateReleaseStatus(release.id, 'deploying');

    const existingDeployments = await db.query.deployments.findMany({
      where: eq(deployments.releaseId, release.id),
    });
    const deploymentsByServiceId = new Map(
      existingDeployments
        .filter((deployment) => deployment.serviceId)
        .map((deployment) => [deployment.serviceId!, deployment])
    );

    const queuedDeployments = [];
    for (const artifact of release.artifacts) {
      const existingDeployment = deploymentsByServiceId.get(artifact.serviceId);
      const deployment =
        existingDeployment ??
        (
          await db
            .insert(deployments)
            .values({
              releaseId: release.id,
              projectId: release.projectId,
              environmentId: release.environmentId,
              serviceId: artifact.serviceId,
              commitSha: release.sourceCommitSha,
              commitMessage:
                release.summary || `Release ${release.sourceCommitSha?.slice(0, 7) ?? ''}`,
              imageUrl: artifact.imageUrl,
              status: 'queued',
              deployedById: release.triggeredByUserId ?? null,
            })
            .returning()
        )[0];

      queuedDeployments.push(deployment);
      await addDeploymentJob(deployment.id, release.projectId, release.environmentId);
    }

    let awaitingRollout = false;

    for (const deployment of queuedDeployments) {
      const result = await waitForDeployment(deployment.id);
      if (result === 'awaiting_rollout') {
        awaitingRollout = true;
        continue;
      }

      if (result === 'verification_failed') {
        await updateReleaseStatus(
          release.id,
          'verification_failed',
          `Deployment ${deployment.id} ended with status ${result}`
        );
        await persistReleaseRecapSafely(release.id);
        throw new Error(`Deployment ${deployment.id} ended with status ${result}`);
      }

      if (result !== 'running') {
        throw new Error(`Deployment ${deployment.id} ended with status ${result}`);
      }
    }

    if (awaitingRollout) {
      await updateReleaseStatus(release.id, 'awaiting_rollout');
      await persistReleaseRecapSafely(release.id);
      return { success: true, awaitingRollout: true };
    }

    await completeReleaseAfterDeployments(release.id);

    return { success: true };
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
