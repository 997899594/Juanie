import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, repositories, services } from '@/lib/db/schema';
import {
  getK8sConfigMapName,
  getK8sSecretName,
  getK8sSvcConfigMapName,
  getK8sSvcSecretName,
  syncEnvVarsToK8s,
  syncServiceEnvVarsToK8s,
} from '@/lib/env-sync';
import { createDeployment, getIsConnected, updateDeployment } from '@/lib/k8s';
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
    with: {
      repository: true,
    },
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

    // 同步环境级变量（项目级 + 环境级，所有服务共享）
    await syncEnvVarsToK8s(projectId, environmentId);

    // 构建镜像名称
    // 格式: ghcr.io/{owner}/{repo}:sha-{commit}
    const imageName = buildImageName(project, deployment.commitSha);

    if (!imageName) {
      throw new Error(
        `Cannot resolve image name for project ${project.slug}: repository URL not configured or unrecognized format`
      );
    }

    // 更新部署记录的镜像 URL
    await db
      .update(deployments)
      .set({ imageUrl: imageName })
      .where(eq(deployments.id, deploymentId));

    for (const service of serviceList) {
      console.log(`Deploying service ${service.name} for deployment ${deploymentId}`);

      if (!getIsConnected() || !environment.namespace) continue;

      // 同步服务级变量（仅该服务独有，覆盖同名的环境级变量）
      const svcEnv = await syncServiceEnvVarsToK8s(service.id, environment.namespace);

      // 构建 envFrom：环境级在前（低优先级），服务级在后（高优先级，同 key 覆盖）
      const envFrom: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }> = [
        { configMapRef: { name: getK8sConfigMapName(environmentId) } },
        { secretRef: { name: getK8sSecretName(environmentId) } },
        ...(svcEnv.hasConfigs
          ? [{ configMapRef: { name: getK8sSvcConfigMapName(service.id) } }]
          : []),
        ...(svcEnv.hasSecrets
          ? [{ secretRef: { name: getK8sSvcSecretName(service.id) } }]
          : []),
      ];

      const deploymentName = `${project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      try {
        await updateDeployment(environment.namespace, deploymentName, { image: imageName });
        console.log(`✅ Updated deployment ${deploymentName} with image ${imageName}`);
      } catch (_updateError) {
        console.log(`Deployment ${deploymentName} not found, creating...`);
        try {
          await createDeployment(environment.namespace, deploymentName, {
            image: imageName,
            port: service.port ?? 3000,
            replicas: service.replicas ?? 1,
            envFrom,
            cpuRequest: service.cpuRequest ?? undefined,
            cpuLimit: service.cpuLimit ?? undefined,
            memoryRequest: service.memoryRequest ?? undefined,
            memoryLimit: service.memoryLimit ?? undefined,
          });
          console.log(`✅ Created deployment ${deploymentName} with image ${imageName}`);
        } catch (createError) {
          console.error(`Failed to deploy service ${deploymentName}:`, createError);
          throw createError;
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

/**
 * 构建镜像名称
 * 格式: ghcr.io/{owner}/{repo}:sha-{commit}
 */
function buildImageName(
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
  commitSha: string | null | undefined
): string | null {
  if (!project.repository || !commitSha || !project.repository.webUrl) {
    return null;
  }

  // 从仓库 webUrl 提取 owner/repo
  // 例如: https://github.com/owner/repo -> owner/repo
  const webUrl = project.repository.webUrl;
  const githubMatch = webUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  const gitlabMatch = webUrl.match(/gitlab[^/]*\/([^/]+\/[^/]+)/);

  const repoPath = githubMatch?.[1] || gitlabMatch?.[1];
  if (!repoPath) {
    return null;
  }

  // 使用 commit sha 作为 tag
  const tag = `sha-${commitSha.slice(0, 7)}`;

  // GitHub Container Registry
  if (githubMatch) {
    return `ghcr.io/${repoPath.toLowerCase()}:${tag}`;
  }

  // GitLab Registry (假设使用官方 GitLab)
  if (gitlabMatch) {
    return `registry.gitlab.com/${repoPath}:${tag}`;
  }

  return null;
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
