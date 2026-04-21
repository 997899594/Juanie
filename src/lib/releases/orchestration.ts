import { and, eq, inArray, lt, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deployments,
  type MigrationRunStatus,
  migrationRuns,
  type ReleaseStatus,
  releases,
} from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { resolveAndCreateMigrationRuns } from '@/lib/migrations';
import { addDeploymentJob, addMigrationJob } from '@/lib/queue';
import { publishDeploymentRealtimeSnapshot } from '@/lib/realtime/deployments';
import {
  publishReleaseRealtimeSnapshot,
  publishReleaseRealtimeSnapshots,
} from '@/lib/realtime/releases';
import { cancelSupersededDeployments } from '@/lib/releases/deployment-coordination';
import { syncReleaseGitTrackingSafely } from '@/lib/releases/environment-tracking';
import { persistReleaseRecapById } from '@/lib/releases/recap-service';
import {
  getObservedDeploymentTerminalStatus,
  type ObservedDeploymentTerminalStatus,
  postDeploymentReleaseStatuses,
  resolveReleaseDeploymentResolution,
  resolveReleaseFailureStatus,
} from '@/lib/releases/state-machine';

type OrchestratedRelease = NonNullable<Awaited<ReturnType<typeof loadReleaseForOrchestration>>>;

const supersedableReleaseStatuses: ReleaseStatus[] = [
  'queued',
  'planning',
  'awaiting_approval',
  'awaiting_external_completion',
];

const supersedableRunStatuses: MigrationRunStatus[] = [
  'queued',
  'planning',
  'awaiting_approval',
  'awaiting_external_completion',
];
const releaseOrchestrationLogger = logger.child({ component: 'release-orchestration' });

export class ReleaseApprovalRequiredError extends Error {
  constructor(
    readonly runId: string,
    readonly phase: 'preDeploy' | 'postDeploy'
  ) {
    super(`Migration run ${runId} is awaiting approval`);
    this.name = 'ReleaseApprovalRequiredError';
  }
}

export class ReleaseExternalCompletionRequiredError extends Error {
  constructor(
    readonly runId: string,
    readonly phase: 'preDeploy' | 'postDeploy'
  ) {
    super(`Migration run ${runId} is awaiting external completion`);
    this.name = 'ReleaseExternalCompletionRequiredError';
  }
}

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

  await publishReleaseRealtimeSnapshot(releaseId);
}

export async function persistReleaseRecapSafely(releaseId: string) {
  await persistReleaseRecapById(releaseId).catch((recapError) => {
    releaseOrchestrationLogger.error('Failed to persist release recap', recapError, {
      releaseId,
    });
  });
}

async function cancelSupersededPendingReleases(target: OrchestratedRelease) {
  const candidates = await db.query.releases.findMany({
    where: and(
      ne(releases.id, target.id),
      eq(releases.projectId, target.projectId),
      eq(releases.environmentId, target.environmentId),
      lt(releases.createdAt, target.createdAt),
      inArray(releases.status, supersedableReleaseStatuses)
    ),
    columns: { id: true },
  });

  if (candidates.length === 0) {
    return;
  }

  const candidateIds = candidates.map((candidate) => candidate.id);
  const now = new Date();
  const message = `Superseded by release ${target.id}`;

  await db
    .update(migrationRuns)
    .set({
      status: 'canceled',
      errorCode: 'MIGRATION_SUPERSEDED',
      errorMessage: message,
      finishedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        inArray(migrationRuns.releaseId, candidateIds),
        inArray(migrationRuns.status, supersedableRunStatuses)
      )
    );

  await db
    .update(releases)
    .set({
      status: 'canceled',
      errorMessage: message,
      updatedAt: now,
    })
    .where(
      and(inArray(releases.id, candidateIds), inArray(releases.status, supersedableReleaseStatuses))
    );

  await publishReleaseRealtimeSnapshots(candidateIds);

  for (const candidateId of candidateIds) {
    await persistReleaseRecapSafely(candidateId);
  }
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
      run.status === 'awaiting_external_completion' ||
      run.status === 'canceled' ||
      run.status === 'skipped'
    ) {
      return run.status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for migration run ${runId}`);
}

async function waitForDeployment(deploymentId: string): Promise<ObservedDeploymentTerminalStatus> {
  for (let attempts = 0; attempts < 300; attempts++) {
    const deployment = await db.query.deployments.findFirst({
      where: eq(deployments.id, deploymentId),
    });

    if (!deployment) {
      throw new Error(`Deployment ${deploymentId} not found`);
    }

    const observed = getObservedDeploymentTerminalStatus(deployment.status);
    if (observed) {
      return observed;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for deployment ${deploymentId}`);
}

export async function runReleaseMigrationPhase(
  release: OrchestratedRelease,
  phase: 'preDeploy' | 'postDeploy'
) {
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
    }
  );

  for (const run of createdRuns) {
    if (run.status === 'queued') {
      await addMigrationJob(run.id, { allowApprovalBypass: false });
    }

    const result = await waitForMigrationRun(run.id);
    if (result === 'awaiting_approval') {
      await updateReleaseStatus(release.id, 'awaiting_approval');
      await cancelSupersededPendingReleases(release);
      throw new ReleaseApprovalRequiredError(run.id, phase);
    }

    if (result === 'awaiting_external_completion') {
      await updateReleaseStatus(release.id, 'awaiting_external_completion');
      await cancelSupersededPendingReleases(release);
      throw new ReleaseExternalCompletionRequiredError(run.id, phase);
    }

    if (result !== 'success') {
      throw new Error(`Migration run ${run.id} ended with status ${result}`);
    }
  }
}

export async function continueReleaseFromDeploymentStage(
  releaseId: string,
  loadedRelease?: OrchestratedRelease
) {
  const release = loadedRelease ?? (await loadReleaseForOrchestration(releaseId));

  if (!release) {
    throw new Error(`Release ${releaseId} not found`);
  }

  if (release.artifacts.length === 0) {
    await updateReleaseStatus(release.id, 'failed', 'Release has no artifacts to deploy');
    throw new Error('Release has no artifacts to deploy');
  }

  await updateReleaseStatus(release.id, 'deploying');

  const existingDeployments = await db.query.deployments.findMany({
    where: eq(deployments.releaseId, release.id),
  });
  const deploymentsByServiceId = new Map(
    existingDeployments
      .filter((deployment) => deployment.serviceId)
      .map((deployment) => [deployment.serviceId!, deployment])
  );

  const releaseDeployments = [];
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

    await cancelSupersededDeployments(deployment);

    if (!existingDeployment) {
      await publishDeploymentRealtimeSnapshot(deployment.id);
    }

    if (deployment.status === 'queued') {
      await addDeploymentJob(deployment.id, release.projectId, release.environmentId);
    }

    releaseDeployments.push(deployment);
  }

  const deploymentResults = [];

  for (const deployment of releaseDeployments) {
    const result =
      getObservedDeploymentTerminalStatus(deployment.status) ??
      (await waitForDeployment(deployment.id));
    const latestDeployment = await db.query.deployments.findFirst({
      where: eq(deployments.id, deployment.id),
      columns: {
        errorMessage: true,
      },
    });
    deploymentResults.push({
      id: deployment.id,
      status: result,
      errorMessage: latestDeployment?.errorMessage ?? null,
    });
  }

  const resolution = resolveReleaseDeploymentResolution(deploymentResults);

  if (resolution.kind === 'failed') {
    await updateReleaseStatus(
      release.id,
      resolution.failureStatus ?? 'failed',
      resolution.message ?? 'Deployment phase failed'
    );
    await persistReleaseRecapSafely(release.id);
    throw new Error(resolution.message ?? 'Deployment phase failed');
  }

  if (resolution.kind === 'canceled') {
    await updateReleaseStatus(
      release.id,
      resolution.failureStatus ?? 'canceled',
      resolution.message ?? 'Deployment phase canceled'
    );
    await persistReleaseRecapSafely(release.id);
    return { success: false, awaitingRollout: false, canceled: true };
  }

  if (resolution.kind === 'awaiting_rollout') {
    await updateReleaseStatus(release.id, 'awaiting_rollout');
    await persistReleaseRecapSafely(release.id);
    return { success: true, awaitingRollout: true };
  }

  await completeReleaseAfterDeployments(release.id);
  return { success: true, awaitingRollout: false };
}

export async function failReleaseForCurrentPhase(releaseId: string, errorMessage: string) {
  const current = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: { status: true },
  });

  await updateReleaseStatus(releaseId, resolveReleaseFailureStatus(current?.status), errorMessage);

  await persistReleaseRecapSafely(releaseId);
}

export async function completeReleaseAfterDeployments(releaseId: string) {
  const release = await loadReleaseForOrchestration(releaseId);

  if (!release) {
    throw new Error(`Release ${releaseId} not found`);
  }

  for (const status of postDeploymentReleaseStatuses.slice(0, 2)) {
    await updateReleaseStatus(releaseId, status);
  }
  await runReleaseMigrationPhase(release, 'postDeploy');
  await updateReleaseStatus(releaseId, postDeploymentReleaseStatuses[2]);
  await syncReleaseGitTrackingSafely(releaseId);
  await persistReleaseRecapSafely(releaseId);
}

async function loadLatestReleaseMigrationRuns(
  releaseId: string,
  phase: 'preDeploy' | 'postDeploy'
) {
  const runs = await db.query.migrationRuns.findMany({
    where: eq(migrationRuns.releaseId, releaseId),
    with: {
      specification: {
        columns: {
          phase: true,
        },
      },
    },
    orderBy: (run, { desc }) => [desc(run.createdAt), desc(run.updatedAt)],
  });

  const latestRunsByTarget = new Map<string, (typeof runs)[number]>();

  for (const run of runs) {
    if (run.specification.phase !== phase) {
      continue;
    }

    const key = `${run.specificationId}:${run.serviceId}:${run.databaseId}`;
    if (!latestRunsByTarget.has(key)) {
      latestRunsByTarget.set(key, run);
    }
  }

  return Array.from(latestRunsByTarget.values());
}

export async function resumeReleaseAfterSuccessfulMigration(runId: string) {
  const run = await db.query.migrationRuns.findFirst({
    where: eq(migrationRuns.id, runId),
    with: {
      release: {
        columns: {
          id: true,
          status: true,
        },
      },
      specification: {
        columns: {
          phase: true,
        },
      },
    },
  });

  if (!run?.releaseId || run.status !== 'success') {
    return { resumed: false, reason: 'run_not_resumable' as const };
  }

  if (!run.release) {
    return { resumed: false, reason: 'release_missing' as const };
  }

  if (
    run.specification.phase === 'preDeploy' &&
    (run.release.status === 'awaiting_approval' ||
      run.release.status === 'awaiting_external_completion' ||
      run.release.status === 'migration_pre_running')
  ) {
    const latestRuns = await loadLatestReleaseMigrationRuns(run.releaseId, 'preDeploy');
    if (latestRuns.length === 0 || latestRuns.some((candidate) => candidate.status !== 'success')) {
      return { resumed: false, reason: 'predeploy_not_ready' as const };
    }

    await continueReleaseFromDeploymentStage(run.releaseId);
    return { resumed: true, reason: 'predeploy_resumed' as const };
  }

  if (
    run.specification.phase === 'postDeploy' &&
    (run.release.status === 'awaiting_approval' ||
      run.release.status === 'awaiting_external_completion' ||
      run.release.status === 'migration_post_running')
  ) {
    const latestRuns = await loadLatestReleaseMigrationRuns(run.releaseId, 'postDeploy');
    if (latestRuns.length === 0 || latestRuns.some((candidate) => candidate.status !== 'success')) {
      return { resumed: false, reason: 'postdeploy_not_ready' as const };
    }

    await updateReleaseStatus(run.releaseId, 'succeeded');
    await syncReleaseGitTrackingSafely(run.releaseId);
    await persistReleaseRecapSafely(run.releaseId);
    return { resumed: true, reason: 'postdeploy_healed' as const };
  }

  return { resumed: false, reason: 'release_state_not_match' as const };
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
