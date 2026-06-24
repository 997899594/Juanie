import { Job, Worker } from 'bullmq';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, services } from '@/lib/db/schema';
import { captureDeploymentDiagnostics } from '@/lib/deployments/diagnostics';
import { isK8sAvailable } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import {
  appendDeploymentRealtimeLogs,
  updateDeploymentRealtimeState,
} from '@/lib/realtime/deployments';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import {
  shouldUseArgoRolloutsForService,
  supportsArgoRolloutsDeploymentStrategy,
} from '@/lib/releases/argo-rollouts';
import { SupersededDeploymentError } from '@/lib/releases/deployment-coordination';
import { resumeReleaseAfterDeploymentProgress } from '@/lib/releases/orchestration';
import { buildCandidateDeploymentName, buildStableDeploymentName } from '@/lib/releases/traffic';
import { buildServiceVerificationPlan, cleanupCandidateResources } from '@/lib/releases/workloads';
import { buildTraceLogFields } from '@/lib/trace/context';
import { executeDeploymentWorkload, logDeployment } from './deployment-executor';
import type { DeploymentJobData } from './index';

const deploymentWorkerLogger = logger.child({ component: 'deployment-worker' });
const SIBLING_CANCEL_REASON_MAX_CHARS = 500;

function classifyDeploymentFailureStatus(message: string) {
  const verificationSignals = [
    'Service verify failed',
    'Verification pod',
    'Readiness probe failed',
    'Liveness probe failed',
    'Startup probe failed',
    'CrashLoopBackOff',
    'ImagePullBackOff',
    'ErrImagePull',
    'CreateContainerConfigError',
    'HTTP probe failed',
    'Deployment rollout failed',
    'rollout timed out',
    'terminated:',
    'waiting:',
    'exit code ',
    'ready 0/',
    'Unhealthy',
    'is progressing',
    'Deployment diagnostics',
  ];

  if (verificationSignals.some((signal) => message.includes(signal))) {
    return 'verification_failed';
  }

  return 'failed';
}

async function cleanupFailedCandidateResources(deploymentId: string): Promise<boolean> {
  if (!isK8sAvailable()) {
    return false;
  }

  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });

  if (!deployment?.serviceId) {
    return false;
  }

  const [project, environment, service] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, deployment.projectId),
    }),
    db.query.environments.findFirst({
      where: eq(environments.id, deployment.environmentId),
    }),
    db.query.services.findFirst({
      where: eq(services.id, deployment.serviceId),
    }),
  ]);

  if (!project || !environment?.namespace || !service) {
    return false;
  }

  if (
    supportsArgoRolloutsDeploymentStrategy(environment.deploymentStrategy) &&
    shouldUseArgoRolloutsForService({
      strategy: environment.deploymentStrategy,
      service,
      hasBlockingVerification: buildServiceVerificationPlan(service).blockingPaths.length > 0,
    })
  ) {
    await logDeployment(
      deploymentId,
      'Skipped standalone candidate cleanup because Argo Rollouts owns the preview service',
      'warn'
    );
    return false;
  }

  const stableName = buildStableDeploymentName(project.slug, service.name);
  const candidateName = buildCandidateDeploymentName(stableName);
  await cleanupCandidateResources(environment.namespace, candidateName);
  await logDeployment(deploymentId, `Cleaned up candidate workload ${candidateName} after failure`);
  return true;
}

async function cancelSiblingAwaitingRolloutDeployments(input: {
  releaseId: string;
  failedDeploymentId: string;
  failureMessage: string;
}) {
  const siblingDeployments = await db.query.deployments.findMany({
    where: eq(deployments.releaseId, input.releaseId),
    columns: {
      id: true,
      status: true,
    },
  });
  const awaitingRolloutDeployments = siblingDeployments.filter(
    (deployment) =>
      deployment.id !== input.failedDeploymentId && deployment.status === 'awaiting_rollout'
  );

  if (awaitingRolloutDeployments.length === 0) {
    return;
  }

  const compactFailureMessage =
    input.failureMessage.length > SIBLING_CANCEL_REASON_MAX_CHARS
      ? `${input.failureMessage.slice(0, SIBLING_CANCEL_REASON_MAX_CHARS)}...<truncated>`
      : input.failureMessage;
  const message = `Canceled pending rollout because deployment ${input.failedDeploymentId} failed: ${compactFailureMessage}`;
  const now = new Date();

  await db
    .update(deployments)
    .set({
      status: 'canceled',
      errorMessage: message,
    })
    .where(
      and(
        inArray(
          deployments.id,
          awaitingRolloutDeployments.map((deployment) => deployment.id)
        ),
        eq(deployments.status, 'awaiting_rollout')
      )
    );

  await appendDeploymentRealtimeLogs(
    awaitingRolloutDeployments.map((deployment) => ({
      deploymentId: deployment.id,
      level: 'warn',
      message,
    }))
  );

  await Promise.all(
    awaitingRolloutDeployments.map((deployment) =>
      updateDeploymentRealtimeState(deployment.id, {
        status: 'canceled',
        errorMessage: message,
      })
    )
  );

  deploymentWorkerLogger.warn('Canceled sibling rollout deployments after release failure', {
    releaseId: input.releaseId,
    failedDeploymentId: input.failedDeploymentId,
    canceledDeploymentIds: awaitingRolloutDeployments.map((deployment) => deployment.id),
    at: now.toISOString(),
  });
}

export async function processDeployment(job: Job<DeploymentJobData>) {
  const traceFields = buildTraceLogFields({
    traceId: job.data.traceId,
    projectId: job.data.projectId,
    environmentId: job.data.environmentId,
    deploymentId: job.data.deploymentId,
    jobId: job.id,
    queue: 'deployment',
  });
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, job.data.deploymentId),
  });

  if (!deployment) {
    throw new Error(`Deployment ${job.data.deploymentId} not found`);
  }

  deploymentWorkerLogger.info('Processing deployment job', {
    ...traceFields,
    releaseId: deployment.releaseId,
    serviceId: deployment.serviceId,
  });

  try {
    await executeDeploymentWorkload(deployment.id, async (value) => {
      await job.updateProgress(value);
    });
    await resumeReleaseAfterDeploymentProgress(deployment.id);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (error instanceof SupersededDeploymentError) {
      await logDeployment(deployment.id, message, 'warn');
      await updateDeploymentRealtimeState(deployment.id, {
        status: 'canceled',
        errorMessage: message,
      });
      await resumeReleaseAfterDeploymentProgress(deployment.id);
      return { success: false, terminal: true, canceled: true };
    }

    const status = classifyDeploymentFailureStatus(message);
    await logDeployment(deployment.id, `Deployment failed: ${message}`, 'error');
    await updateDeploymentRealtimeState(deployment.id, {
      status,
      errorMessage: message,
    });
    const diagnostics = await captureDeploymentDiagnostics({
      deploymentId: deployment.id,
      reason: status === 'verification_failed' ? 'verification_failed' : 'deployment_failed',
      errorMessage: message,
    }).catch(async (diagnosticError) => {
      const diagnosticMessage =
        diagnosticError instanceof Error ? diagnosticError.message : String(diagnosticError);
      await logDeployment(
        deployment.id,
        `Deployment diagnostics capture failed: ${diagnosticMessage}`,
        'warn'
      );
      return null;
    });
    if (diagnostics) {
      await logDeployment(deployment.id, `Captured deployment diagnostics: ${diagnostics.summary}`);
    }

    if (deployment.releaseId) {
      await cancelSiblingAwaitingRolloutDeployments({
        releaseId: deployment.releaseId,
        failedDeploymentId: deployment.id,
        failureMessage: message,
      });
    }

    await resumeReleaseAfterDeploymentProgress(deployment.id);

    await cleanupFailedCandidateResources(deployment.id).catch(async (cleanupError) => {
      const cleanupMessage =
        cleanupError instanceof Error ? cleanupError.message : String(cleanupError);
      await logDeployment(
        deployment.id,
        `Candidate cleanup skipped after failure: ${cleanupMessage}`,
        'warn'
      );
    });

    if (status === 'verification_failed') {
      await logDeployment(
        deployment.id,
        'Verification failed; deployment is marked terminal and will not be auto-retried',
        'warn'
      );
      return { success: false, terminal: true };
    }

    throw error;
  }
}

export function createDeploymentWorker() {
  return new Worker<DeploymentJobData>('deployment', processDeployment, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 10,
  });
}
