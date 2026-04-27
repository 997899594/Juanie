import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, services } from '@/lib/db/schema';
import { isK8sAvailable } from '@/lib/k8s';
import { updateDeploymentRealtimeState } from '@/lib/realtime/deployments';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import { SupersededDeploymentError } from '@/lib/releases/deployment-coordination';
import { resumeReleaseAfterDeploymentProgress } from '@/lib/releases/orchestration';
import { buildCandidateDeploymentName, buildStableDeploymentName } from '@/lib/releases/traffic';
import { cleanupCandidateResources } from '@/lib/releases/workloads';
import { executeDeploymentWorkload, logDeployment } from './deployment-executor';
import type { DeploymentJobData } from './index';

function classifyDeploymentFailureStatus(message: string) {
  const verificationSignals = [
    'Service verify failed',
    'Verification pod',
    'Readiness probe failed',
    'Liveness probe failed',
    'Startup probe failed',
    'HTTP probe failed',
    'Deployment rollout failed',
    'rollout timed out',
    'ready 0/',
    'Unhealthy',
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

  const stableName = buildStableDeploymentName(project.slug, service.name);
  const candidateName = buildCandidateDeploymentName(stableName);
  await cleanupCandidateResources(environment.namespace, candidateName);
  await logDeployment(deploymentId, `Cleaned up candidate workload ${candidateName} after failure`);
  return true;
}

export async function processDeployment(job: Job<DeploymentJobData>) {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, job.data.deploymentId),
  });

  if (!deployment) {
    throw new Error(`Deployment ${job.data.deploymentId} not found`);
  }

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
