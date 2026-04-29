import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { assertDeclaredDatabaseCapabilities } from '@/lib/databases/capabilities';
import { assertDeclaredDatabaseRuntimeAccess } from '@/lib/databases/runtime-access';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
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
import type { ReleaseJobData } from './index';

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
  const release = await loadReleaseForOrchestration(job.data.releaseId);

  if (!release) {
    throw new Error(`Release ${job.data.releaseId} not found`);
  }

  if (release.artifacts.length === 0) {
    await updateReleaseStatus(release.id, 'failed', 'Release has no artifacts to deploy');
    throw new Error('Release has no artifacts to deploy');
  }

  try {
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
      await assertDeclaredDatabaseCapabilities(database);
    }

    await updateReleaseStatus(release.id, 'planning');
    await updateReleaseStatus(release.id, 'migration_pre_running');
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
    concurrency: 5,
  });
}
