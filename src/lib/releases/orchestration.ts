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
import { resolveMigrationPhaseNextAction } from '@/lib/releases/phase-progress';
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

export type StartReleaseMigrationPhaseResult =
  | {
      kind: 'completed';
    }
  | {
      kind: 'queued';
      runId: string;
    }
  | {
      kind: 'awaiting_approval';
      runId: string;
    }
  | {
      kind: 'awaiting_external_completion';
      runId: string;
    };

type ReleaseMigrationPhaseProgressResult =
  | StartReleaseMigrationPhaseResult
  | {
      kind: 'blocked';
      runId: string;
      status: MigrationRunStatus;
      errorMessage: string | null;
    };

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

async function driveReleaseMigrationPhaseForward(
  release: OrchestratedRelease,
  phase: 'preDeploy' | 'postDeploy',
  runs: Array<{
    id: string;
    status: MigrationRunStatus;
    createdAt: Date;
    errorMessage?: string | null;
  }>
): Promise<ReleaseMigrationPhaseProgressResult> {
  const action = resolveMigrationPhaseNextAction(runs);

  switch (action.kind) {
    case 'running':
      return {
        kind: 'queued',
        runId:
          runs.find((run) => run.status === 'planning' || run.status === 'running')?.id ??
          runs[0]?.id ??
          release.id,
      };
    case 'start_run':
      await addMigrationJob(action.runId, { allowApprovalBypass: false });
      return {
        kind: 'queued',
        runId: action.runId,
      };
    case 'awaiting_approval':
      await updateReleaseStatus(release.id, 'awaiting_approval');
      await cancelSupersededPendingReleases(release);
      return action;
    case 'awaiting_external_completion':
      await updateReleaseStatus(release.id, 'awaiting_external_completion');
      await cancelSupersededPendingReleases(release);
      return action;
    case 'completed':
      return action;
    case 'blocked':
      return {
        kind: 'blocked',
        runId: action.runId,
        status: action.status,
        errorMessage:
          runs.find((run) => run.id === action.runId)?.errorMessage ??
          `Migration run ${action.runId} for ${phase} is in terminal status ${action.status}`,
      };
  }
}

export async function startReleaseMigrationPhase(
  release: OrchestratedRelease,
  phase: 'preDeploy' | 'postDeploy'
): Promise<StartReleaseMigrationPhaseResult> {
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
      deferPendingInspectionToRunner: true,
    }
  );

  const phaseResult = await driveReleaseMigrationPhaseForward(release, phase, createdRuns);

  if (phaseResult.kind === 'blocked') {
    throw new Error(
      phaseResult.errorMessage ??
        `Migration run ${phaseResult.runId} for ${phase} is in terminal status ${phaseResult.status}`
    );
  }

  return phaseResult;
}

export async function startReleaseDeploymentStage(
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

  if (release.status !== 'deploying') {
    await updateReleaseStatus(release.id, 'deploying');
  }

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

  return {
    success: true,
    awaitingRollout: false,
    deploymentIds: releaseDeployments.map((deployment) => deployment.id),
  };
}

async function completeSuccessfulRelease(releaseId: string) {
  await updateReleaseStatus(releaseId, postDeploymentReleaseStatuses[2]);
  await syncReleaseGitTrackingSafely(releaseId);
  await persistReleaseRecapSafely(releaseId);
}

export async function continueReleaseAfterDeployments(releaseId: string) {
  const release = await loadReleaseForOrchestration(releaseId);

  if (!release) {
    throw new Error(`Release ${releaseId} not found`);
  }

  await updateReleaseStatus(releaseId, postDeploymentReleaseStatuses[0]);
  await updateReleaseStatus(releaseId, postDeploymentReleaseStatuses[1]);

  const phaseResult = await startReleaseMigrationPhase(release, 'postDeploy');
  if (phaseResult.kind === 'completed') {
    await completeSuccessfulRelease(releaseId);
    return {
      success: true,
      completed: true,
    };
  }

  await persistReleaseRecapSafely(releaseId);

  return {
    success: true,
    completed: false,
    phaseResult,
  };
}

export async function failReleaseForCurrentPhase(releaseId: string, errorMessage: string) {
  const current = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: { status: true },
  });

  await updateReleaseStatus(releaseId, resolveReleaseFailureStatus(current?.status), errorMessage);

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

export async function resumeReleaseAfterMigrationProgress(runId: string) {
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

  if (!run?.releaseId) {
    return { resumed: false, reason: 'run_not_resumable' as const };
  }

  if (!run.release) {
    return { resumed: false, reason: 'release_missing' as const };
  }

  const phase = run.specification.phase;
  if (phase === 'manual') {
    return { resumed: false, reason: 'manual_phase_not_supported' as const };
  }

  if (
    run.release.status !== 'awaiting_approval' &&
    run.release.status !== 'awaiting_external_completion' &&
    run.release.status !== 'migration_pre_running' &&
    run.release.status !== 'migration_post_running'
  ) {
    return { resumed: false, reason: 'release_state_not_match' as const };
  }

  const release = await loadReleaseForOrchestration(run.releaseId);
  if (!release) {
    return { resumed: false, reason: 'release_missing' as const };
  }

  const latestRuns = await loadLatestReleaseMigrationRuns(run.releaseId, phase);
  const phaseResult = await driveReleaseMigrationPhaseForward(release, phase, latestRuns);

  if (phaseResult.kind === 'blocked') {
    await failReleaseForCurrentPhase(
      run.releaseId,
      phaseResult.errorMessage ||
        `Migration run ${phaseResult.runId} for ${phase} is in terminal status ${phaseResult.status}`
    );
    return {
      resumed: true,
      reason: phase === 'preDeploy' ? 'predeploy_blocked' : 'postdeploy_blocked',
    };
  }

  if (phaseResult.kind === 'queued') {
    return {
      resumed: true,
      reason: phase === 'preDeploy' ? 'predeploy_progressed' : 'postdeploy_progressed',
    };
  }

  if (
    phaseResult.kind === 'awaiting_approval' ||
    phaseResult.kind === 'awaiting_external_completion'
  ) {
    await persistReleaseRecapSafely(run.releaseId);
    return {
      resumed: true,
      reason: phase === 'preDeploy' ? 'predeploy_waiting' : 'postdeploy_waiting',
    };
  }

  if (phase === 'preDeploy') {
    await startReleaseDeploymentStage(run.releaseId, release);
    return { resumed: true, reason: 'predeploy_resumed' as const };
  }

  await completeSuccessfulRelease(run.releaseId);
  return { resumed: true, reason: 'postdeploy_healed' as const };
}

export async function resumeReleaseAfterDeploymentProgress(deploymentId: string) {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
    columns: {
      id: true,
      releaseId: true,
    },
  });

  if (!deployment?.releaseId) {
    return { resumed: false, reason: 'deployment_not_linked' as const };
  }

  const release = await db.query.releases.findFirst({
    where: eq(releases.id, deployment.releaseId),
    columns: {
      id: true,
      status: true,
    },
  });

  if (!release || release.status !== 'deploying') {
    return { resumed: false, reason: 'release_not_deploying' as const };
  }

  const releaseDeployments = await db.query.deployments.findMany({
    where: eq(deployments.releaseId, deployment.releaseId),
    columns: {
      id: true,
      status: true,
      errorMessage: true,
    },
  });

  if (releaseDeployments.length === 0) {
    return { resumed: false, reason: 'deployments_missing' as const };
  }

  const observedDeployments = releaseDeployments.map((item) => ({
    id: item.id,
    status: getObservedDeploymentTerminalStatus(item.status),
    errorMessage: item.errorMessage ?? null,
  }));

  if (observedDeployments.some((item) => item.status === null)) {
    return { resumed: false, reason: 'deployments_in_progress' as const };
  }

  const resolution = resolveReleaseDeploymentResolution(
    observedDeployments as Array<{
      id: string;
      status: ObservedDeploymentTerminalStatus;
      errorMessage?: string | null;
    }>
  );

  if (resolution.kind === 'failed') {
    await updateReleaseStatus(
      deployment.releaseId,
      resolution.failureStatus ?? 'failed',
      resolution.message ?? 'Deployment phase failed'
    );
    await persistReleaseRecapSafely(deployment.releaseId);
    return { resumed: true, reason: 'deployment_failed' as const };
  }

  if (resolution.kind === 'canceled') {
    await updateReleaseStatus(
      deployment.releaseId,
      resolution.failureStatus ?? 'canceled',
      resolution.message ?? 'Deployment phase canceled'
    );
    await persistReleaseRecapSafely(deployment.releaseId);
    return { resumed: true, reason: 'deployment_canceled' as const };
  }

  if (resolution.kind === 'awaiting_rollout') {
    await updateReleaseStatus(deployment.releaseId, 'awaiting_rollout');
    await persistReleaseRecapSafely(deployment.releaseId);
    return { resumed: true, reason: 'awaiting_rollout' as const };
  }

  await continueReleaseAfterDeployments(deployment.releaseId);
  return { resumed: true, reason: 'deployments_ready' as const };
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

  await continueReleaseAfterDeployments(releaseId);
  return true;
}
