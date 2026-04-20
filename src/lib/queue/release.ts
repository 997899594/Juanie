import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { assertDeclaredDatabaseCapabilities } from '@/lib/databases/capabilities';
import { assertDeclaredDatabaseRuntimeAccess } from '@/lib/databases/runtime-access';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import {
  continueReleaseFromDeploymentStage,
  failReleaseForCurrentPhase,
  loadReleaseForOrchestration,
  persistReleaseRecapSafely,
  ReleaseApprovalRequiredError,
  ReleaseExternalCompletionRequiredError,
  runReleaseMigrationPhase,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { syncProjectDatabaseRuntimeContractsFromRepo } from '@/lib/services/runtime-contract';
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
    await runReleaseMigrationPhase(release, 'preDeploy');
    return await continueReleaseFromDeploymentStage(release.id, release);
  } catch (error) {
    if (error instanceof ReleaseApprovalRequiredError) {
      await persistReleaseRecapSafely(release.id);
      return {
        success: false,
        terminal: true,
        approvalRequired: true,
        runId: error.runId,
        phase: error.phase,
      };
    }

    if (error instanceof ReleaseExternalCompletionRequiredError) {
      await persistReleaseRecapSafely(release.id);
      return {
        success: false,
        terminal: true,
        externalCompletionRequired: true,
        runId: error.runId,
        phase: error.phase,
      };
    }

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
