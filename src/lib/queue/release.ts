import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import {
  ensureDeclaredDatabaseCapabilities,
  formatDatabaseCapabilityIssues,
} from '@/lib/databases/capabilities';
import { assertDeclaredDatabaseRuntimeAccess } from '@/lib/databases/runtime-access';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import { logger } from '@/lib/logger';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import { getDeployableReleaseArtifacts } from '@/lib/releases/artifacts';
import {
  failReleaseForCurrentPhase,
  loadReleaseForOrchestration,
  persistReleaseRecapSafely,
  startReleaseDeploymentStage,
  startReleaseMigrationPhase,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { releaseStatusesRequiringFailureReconciliation } from '@/lib/releases/state-machine';
import { syncProjectDatabaseRuntimeContractsFromRepo } from '@/lib/services/runtime-contract';
import { buildTraceLogFields } from '@/lib/trace/context';
import type { ReleaseJobData } from './index';

const releaseWorkerLogger = logger.child({ component: 'release-worker' });
const releaseWorkerLockDurationMs = 300_000;
const releaseWorkerLockRenewTimeMs = 60_000;

export function shouldReconcileUnexpectedReleaseJobFailure(status: string): boolean {
  return (releaseStatusesRequiringFailureReconciliation as readonly string[]).includes(status);
}

export async function reconcileUnexpectedReleaseJobFailure(releaseId: string, error: unknown) {
  const release = await db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    columns: {
      id: true,
      status: true,
    },
  });

  if (!release) {
    return { reconciled: false, reason: 'release_missing' as const };
  }

  if (!shouldReconcileUnexpectedReleaseJobFailure(release.status)) {
    return { reconciled: false, reason: 'release_state_not_match' as const };
  }

  const message = error instanceof Error ? error.message : String(error);
  await failReleaseForCurrentPhase(release.id, message);
  await persistReleaseRecapSafely(release.id);

  return { reconciled: true, reason: 'release_updated' as const };
}

export async function processRelease(job: Job<ReleaseJobData>) {
  const traceFields = buildTraceLogFields({
    traceId: job.data.traceId,
    releaseId: job.data.releaseId,
    jobId: job.id,
    queue: 'release',
  });
  const release = await loadReleaseForOrchestration(job.data.releaseId);

  if (!release) {
    throw new Error(`Release ${job.data.releaseId} not found`);
  }

  releaseWorkerLogger.info('Processing release job', {
    ...traceFields,
    projectId: release.projectId,
    environmentId: release.environmentId,
  });

  if (release.artifacts.length === 0) {
    await updateReleaseStatus(release.id, 'failed', 'Release has no artifacts to verify');
    throw new Error('Release has no artifacts to verify');
  }

  try {
    const deployableArtifacts = getDeployableReleaseArtifacts(release.artifacts);
    if (deployableArtifacts.length === 0) {
      await updateReleaseStatus(release.id, 'succeeded');
      await persistReleaseRecapSafely(release.id);
      return {
        success: true,
        terminal: true,
        artifactOnly: true,
      };
    }

    await syncProjectDatabaseRuntimeContractsFromRepo({
      projectId: release.projectId,
      sourceRef: release.sourceRef,
      sourceCommitSha: release.configCommitSha ?? release.sourceCommitSha,
      strict: true,
    });

    const environmentDatabases = await getDatabasesForEnvironment({
      projectId: release.projectId,
      environmentId: release.environmentId,
    });

    for (const database of environmentDatabases) {
      await assertDeclaredDatabaseRuntimeAccess(database);
      const capabilityCheck = await ensureDeclaredDatabaseCapabilities(database);
      if (!capabilityCheck.satisfied) {
        throw new Error(formatDatabaseCapabilityIssues(database, capabilityCheck.issues));
      }
    }

    await updateReleaseStatus(release.id, 'planning');
    const phaseResult = await startReleaseMigrationPhase(release, 'preDeploy');

    if (phaseResult.kind === 'completed') {
      return await startReleaseDeploymentStage(release.id, release);
    }

    if (phaseResult.kind === 'queued') {
      return {
        success: true,
        terminal: false,
        phase: 'preDeploy',
        queuedRunId: phaseResult.runId,
      };
    }

    if (phaseResult.kind === 'awaiting_approval') {
      await persistReleaseRecapSafely(release.id);
      return {
        success: false,
        terminal: true,
        approvalRequired: true,
        runId: phaseResult.runId,
        phase: 'preDeploy',
      };
    }

    if (phaseResult.kind === 'awaiting_external_completion') {
      await persistReleaseRecapSafely(release.id);
      return {
        success: false,
        terminal: true,
        externalCompletionRequired: true,
        runId: phaseResult.runId,
        phase: 'preDeploy',
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = await db.query.releases.findFirst({
      where: eq(releases.id, release.id),
      columns: { status: true },
    });

    if (current?.status !== 'verification_failed' && current?.status !== 'canceled') {
      await failReleaseForCurrentPhase(release.id, message);
    }

    throw error;
  }
}

export function createReleaseWorker() {
  return new Worker<ReleaseJobData>('release', processRelease, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    lockDuration: releaseWorkerLockDurationMs,
    lockRenewTime: releaseWorkerLockRenewTimeMs,
    concurrency: 5,
  });
}
