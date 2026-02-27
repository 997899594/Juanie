import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, services } from '@/lib/db/schema';
import { getK8sConfigMapName, getK8sSecretName, syncEnvVarsToK8s } from '@/lib/env-sync';
import { createDeployment, getIsConnected } from '@/lib/k8s';
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

    // 同步环境变量到 K8s（确保部署前 Secret/ConfigMap 是最新的）
    await syncEnvVarsToK8s(projectId, environmentId);

    // 构建 envFrom 引用（让每个 Pod 自动挂载环境变量）
    const envFrom: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }> = [];
    if (getIsConnected() && environment.namespace) {
      envFrom.push({ secretRef: { name: getK8sSecretName(environmentId) } });
      envFrom.push({ configMapRef: { name: getK8sConfigMapName(environmentId) } });
    }

    for (const service of serviceList) {
      console.log(`Deploying service ${service.name} for deployment ${deploymentId}`);

      // 如果 K8s 已连接且服务有镜像配置，执行真实部署
      if (getIsConnected() && environment.namespace && service.dockerfile) {
        try {
          await createDeployment(environment.namespace, service.name, {
            image: `${service.name}:latest`, // 实际项目中应使用构建产出的镜像 tag
            port: service.port ?? 3000,
            replicas: service.replicas ?? 1,
            envFrom,
            cpuRequest: service.cpuRequest ?? undefined,
            cpuLimit: service.cpuLimit ?? undefined,
            memoryRequest: service.memoryRequest ?? undefined,
            memoryLimit: service.memoryLimit ?? undefined,
          });
        } catch (e) {
          console.error(`Failed to create deployment for service ${service.name}:`, e);
          throw e;
        }
      }
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
