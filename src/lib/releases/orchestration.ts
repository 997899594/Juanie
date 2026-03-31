import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deployments,
  type MigrationRunStatus,
  migrationRuns,
  type ReleaseStatus,
  releases,
} from '@/lib/db/schema';
import { resolveAndCreateMigrationRuns } from '@/lib/migrations';
import { addMigrationJob } from '@/lib/queue';
import { persistReleaseRecapById } from '@/lib/releases/recap-service';

export async function loadReleaseForOrchestration(releaseId: string) {
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

export async function updateReleaseStatus(
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

export async function persistReleaseRecapSafely(releaseId: string) {
  await persistReleaseRecapById(releaseId).catch((recapError) => {
    console.error(`[Release] Failed to persist recap for ${releaseId}:`, recapError);
  });
}

export async function waitForMigrationRun(runId: string): Promise<MigrationRunStatus> {
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

export async function runReleaseMigrationPhase(
  release: NonNullable<Awaited<ReturnType<typeof loadReleaseForOrchestration>>>,
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

export async function failReleaseForCurrentPhase(releaseId: string, errorMessage: string) {
  const current = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: { status: true },
  });

  if (current?.status === 'migration_post_running') {
    await updateReleaseStatus(releaseId, 'degraded', errorMessage);
  } else if (current?.status === 'migration_pre_running') {
    await updateReleaseStatus(releaseId, 'migration_pre_failed', errorMessage);
  } else if (current?.status === 'verifying') {
    await updateReleaseStatus(releaseId, 'verification_failed', errorMessage);
  } else {
    await updateReleaseStatus(releaseId, 'failed', errorMessage);
  }

  await persistReleaseRecapSafely(releaseId);
}

export async function completeReleaseAfterDeployments(releaseId: string) {
  const release = await loadReleaseForOrchestration(releaseId);

  if (!release) {
    throw new Error(`Release ${releaseId} not found`);
  }

  await updateReleaseStatus(releaseId, 'verifying');
  await updateReleaseStatus(releaseId, 'migration_post_running');
  await runReleaseMigrationPhase(release, 'postDeploy');
  await updateReleaseStatus(releaseId, 'succeeded');
  await persistReleaseRecapSafely(releaseId);
}

export async function completeReleaseAfterRolloutIfReady(releaseId: string) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: {
      id: true,
      status: true,
    },
  });

  if (!release || release.status !== 'awaiting_rollout') {
    return false;
  }

  const releaseDeployments = await db.query.deployments.findMany({
    where: eq(deployments.releaseId, releaseId),
    columns: {
      status: true,
    },
  });

  if (
    releaseDeployments.length === 0 ||
    releaseDeployments.some((deployment) => deployment.status !== 'running')
  ) {
    return false;
  }

  await completeReleaseAfterDeployments(releaseId);
  return true;
}
