import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { MigrationRunStatus, ReleaseStatus } from '@/lib/db/schema';
import { deployments, migrationRuns, releases } from '@/lib/db/schema';
import { resolveAndCreateMigrationRuns } from '@/lib/migrations';
import { addDeploymentJob, addMigrationJob, type ReleaseJobData } from './index';

async function loadRelease(releaseId: string) {
  return db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    with: {
      project: true,
      environment: true,
      artifacts: {
        with: {
          service: true,
        },
      },
    },
  });
}

async function updateReleaseStatus(
  releaseId: string,
  status: ReleaseStatus,
  errorMessage?: string | null
) {
  await db
    .update(releases)
    .set({
      status,
      errorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(eq(releases.id, releaseId));
}

async function waitForMigrationRun(runId: string): Promise<MigrationRunStatus> {
  for (let attempts = 0; attempts < 300; attempts++) {
    const run = await db.query.migrationRuns.findFirst({
      where: eq(migrationRuns.id, runId),
    });

    if (!run) {
      throw new Error(`Migration run ${runId} not found`);
    }

    if (
      run.status === 'success' ||
      run.status === 'failed' ||
      run.status === 'awaiting_approval' ||
      run.status === 'canceled' ||
      run.status === 'skipped'
    ) {
      return run.status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for migration run ${runId}`);
}

async function waitForDeployment(
  deploymentId: string
): Promise<'running' | 'failed' | 'rolled_back'> {
  for (let attempts = 0; attempts < 300; attempts++) {
    const deployment = await db.query.deployments.findFirst({
      where: eq(deployments.id, deploymentId),
    });

    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    if (
      deployment.status === 'running' ||
      deployment.status === 'failed' ||
      deployment.status === 'rolled_back'
    ) {
      return deployment.status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for deployment ${deploymentId}`);
}

async function runMigrationPhase(
  release: NonNullable<Awaited<ReturnType<typeof loadRelease>>>,
  phase: 'preDeploy' | 'postDeploy'
) {
  const imageByServiceId = new Map(
    release.artifacts.map((artifact) => [artifact.serviceId, artifact.imageUrl])
  );
  const createdRuns = await resolveAndCreateMigrationRuns(
    release.projectId,
    release.environmentId,
    phase,
    {
      releaseId: release.id,
      triggeredBy: 'deploy',
      triggeredByUserId: release.triggeredByUserId ?? null,
      sourceRef: release.sourceRef,
      sourceCommitSha: release.configCommitSha ?? release.sourceCommitSha,
      sourceCommitMessage: release.summary,
      serviceIds: release.artifacts.map((artifact) => artifact.serviceId),
      options: {
        allowApprovalBypass: false,
      },
    }
  );

  for (const run of createdRuns) {
    await addMigrationJob(run.id, {
      imageUrl: imageByServiceId.get(run.serviceId) ?? null,
      allowApprovalBypass: false,
    });
    const result = await waitForMigrationRun(run.id);
    if (result !== 'success') {
      throw new Error(`Migration run ${run.id} ended with status ${result}`);
    }
  }
}

export async function processRelease(job: Job<ReleaseJobData>) {
  const release = await loadRelease(job.data.releaseId);

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
    await runMigrationPhase(release, 'preDeploy');

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

    for (const deployment of queuedDeployments) {
      const result = await waitForDeployment(deployment.id);
      if (result !== 'running') {
        throw new Error(`Deployment ${deployment.id} ended with status ${result}`);
      }
    }

    await updateReleaseStatus(release.id, 'verifying');
    await updateReleaseStatus(release.id, 'migration_post_running');
    await runMigrationPhase(release, 'postDeploy');
    await updateReleaseStatus(release.id, 'succeeded');

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = await db.query.releases.findFirst({
      where: eq(releases.id, release.id),
      columns: { status: true },
    });

    if (current?.status === 'migration_post_running') {
      await updateReleaseStatus(release.id, 'degraded', message);
    } else if (current?.status === 'migration_pre_running') {
      await updateReleaseStatus(release.id, 'migration_pre_failed', message);
    } else {
      await updateReleaseStatus(release.id, 'failed', message);
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
