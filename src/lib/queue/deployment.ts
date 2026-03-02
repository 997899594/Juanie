import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, repositories, services } from '@/lib/db/schema';
import { getK8sConfigMapName, getK8sSecretName, syncEnvVarsToK8s } from '@/lib/env-sync';
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

    // 同步环境变量到 K8s（确保部署前 Secret/ConfigMap 是最新的）
    await syncEnvVarsToK8s(projectId, environmentId);

    // 构建 envFrom 引用（让每个 Pod 自动挂载环境变量）
    const envFrom: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }> = [];
    if (getIsConnected() && environment.namespace) {
      envFrom.push({ secretRef: { name: getK8sSecretName(environmentId) } });
      envFrom.push({ configMapRef: { name: getK8sConfigMapName(environmentId) } });
    }

    // 构建镜像名称
    // 格式: ghcr.io/{owner}/{repo}:sha-{commit} 或 {registry}/{project}:latest
    const imageName = buildImageName(project, deployment.commitSha);

    // 更新部署记录的镜像 URL
    if (imageName) {
      await db
        .update(deployments)
        .set({ imageUrl: imageName })
        .where(eq(deployments.id, deploymentId));
    }

    for (const service of serviceList) {
      console.log(`Deploying service ${service.name} for deployment ${deploymentId}`);

      // 如果 K8s 已连接且服务有镜像配置，执行真实部署
      if (getIsConnected() && environment.namespace) {
        const serviceImage = imageName || `${project.slug}-${service.name}:latest`;

        try {
          // 尝试更新已存在的 Deployment，如果不存在则创建
          await updateDeployment(environment.namespace, service.name, {
            image: serviceImage,
          });
          console.log(`✅ Updated deployment ${service.name} with image ${serviceImage}`);
        } catch (_updateError) {
          // 如果更新失败（可能不存在），尝试创建
          console.log(`Deployment ${service.name} not found, creating new one...`);
          try {
            await createDeployment(environment.namespace, service.name, {
              image: serviceImage,
              port: service.port ?? 3000,
              replicas: service.replicas ?? 1,
              envFrom,
              cpuRequest: service.cpuRequest ?? undefined,
              cpuLimit: service.cpuLimit ?? undefined,
              memoryRequest: service.memoryRequest ?? undefined,
              memoryLimit: service.memoryLimit ?? undefined,
            });
            console.log(`✅ Created deployment ${service.name} with image ${serviceImage}`);
          } catch (createError) {
            console.error(`Failed to create deployment for service ${service.name}:`, createError);
            throw createError;
          }
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
  if (!project.repository || !commitSha) {
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
