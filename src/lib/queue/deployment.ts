import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, services } from '@/lib/db/schema';
import type { DeploymentJobData } from './index';

export async function processDeployment(job: Job<DeploymentJobData>) {
  const { deploymentId, projectId, environmentId } = job.data;

  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
  });

  if (!environment) {
    throw new Error(`Environment ${environmentId} not found`);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  try {
    await db
      .update(deployments)
      .set({ status: 'building' })
      .where(eq(deployments.id, deploymentId));

    await job.updateProgress(20);

    await db
      .update(deployments)
      .set({ status: 'deploying' })
      .where(eq(deployments.id, deploymentId));

    await job.updateProgress(50);

    const serviceList = await db.query.services.findMany({
      where: eq(services.projectId, projectId),
    });

    for (const service of serviceList) {
      console.log(`Deploying service ${service.name} for deployment ${deploymentId}`);
    }

    await job.updateProgress(80);

    await db
      .update(deployments)
      .set({
        status: 'running',
        deployedAt: new Date(),
      })
      .where(eq(deployments.id, deploymentId));

    await job.updateProgress(100);

    return { success: true };
  } catch (error) {
    await db.update(deployments).set({ status: 'failed' }).where(eq(deployments.id, deploymentId));

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
