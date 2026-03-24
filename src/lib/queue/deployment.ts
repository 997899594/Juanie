import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments } from '@/lib/db/schema';
import { executeDeploymentWorkload, logDeployment } from './deployment-executor';
import type { DeploymentJobData } from './index';

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
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await logDeployment(deployment.id, `Deployment failed: ${message}`, 'error');
    await db.update(deployments).set({ status: 'failed' }).where(eq(deployments.id, deployment.id));
    throw error;
  }
}

export function createDeploymentWorker() {
  return new Worker<DeploymentJobData>('deployment', processDeployment, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    },
    concurrency: 10,
  });
}
