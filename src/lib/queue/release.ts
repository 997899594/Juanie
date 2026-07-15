import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { releases } from '@/lib/db/schema';
import { assertReleaseExecutionFence } from '@/lib/execution/ownership';
import { logger } from '@/lib/logger';
import { getDeployableReleaseArtifacts } from '@/lib/releases/artifacts';
import {
  failReleaseForCurrentPhase,
  loadReleaseForOrchestration,
  persistReleaseRecapSafely,
  runReleaseAdmission,
  startReleaseDeploymentStage,
  startReleaseMigrationPhase,
  updateReleaseStatus,
} from '@/lib/releases/orchestration';
import { buildTraceLogFields } from '@/lib/trace/context';

const releaseWorkerLogger = logger.child({ component: 'release-worker' });
const schemaAdmissionRetryDelayMs = 10_000;

export interface ReleaseCommand {
  releaseId: string;
  traceId?: string;
}

export async function runReleaseCommand(data: ReleaseCommand, jobId?: string) {
  const traceFields = buildTraceLogFields({
    traceId: data.traceId,
    releaseId: data.releaseId,
    jobId,
    queue: jobId ? 'release' : 'restate-release',
  });
  const release = await loadReleaseForOrchestration(data.releaseId);

  if (!release) {
    throw new Error(`Release ${data.releaseId} not found`);
  }

  await assertReleaseExecutionFence(release.id);

  releaseWorkerLogger.info('Processing release job', {
    ...traceFields,
    projectId: release.projectId,
    environmentId: release.environmentId,
  });

  if (release.status !== 'admission_running' && release.status !== 'queued') {
    return {
      success: true,
      skipped: true,
      status: release.status,
    };
  }

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

    if (release.status === 'admission_running') {
      const admission = await runReleaseAdmission(release);

      if (admission.kind === 'pending_schema_refresh') {
        return {
          success: true,
          terminal: false,
          phase: 'admission',
          retryAfterMs: schemaAdmissionRetryDelayMs,
        };
      }

      if (admission.kind === 'blocked') {
        return {
          success: false,
          terminal: true,
          phase: 'admission',
          blocked: true,
          reason: admission.reason,
        };
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
