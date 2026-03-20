import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deploymentLogs,
  deployments,
  environments,
  migrationRuns,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import {
  getK8sConfigMapName,
  getK8sSecretName,
  getK8sSvcConfigMapName,
  getK8sSvcSecretName,
  syncEnvVarsToK8s,
  syncServiceEnvVarsToK8s,
} from '@/lib/env-sync';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import {
  createDeployment,
  ensureGhcrPullSecret,
  GHCR_PULL_SECRET_NAME,
  getIsConnected,
  updateDeployment,
} from '@/lib/k8s';
import { resolveAndCreateMigrationRuns } from '@/lib/migrations';
import type { DeploymentJobData } from './index';
import { addMigrationJob } from './index';

async function log(
  deploymentId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  console.log(`[${level.toUpperCase()}] ${message}`);
  await db
    .insert(deploymentLogs)
    .values({ deploymentId, message, level })
    .catch(() => {
      // Swallow DB errors so log failures never break the deployment
    });
}

async function waitForMigrationRun(
  runId: string
): Promise<'success' | 'failed' | 'awaiting_approval' | 'canceled' | 'skipped'> {
  for (let attempts = 0; attempts < 300; attempts++) {
    const run = await db.query.migrationRuns.findFirst({
      where: eq(migrationRuns.id, runId),
    });

    if (!run) {
      throw new Error(`Migration run ${runId} not found`);
    }

    if (
      run.status === 'success' ||
      run.status === 'failed' ||
      run.status === 'awaiting_approval' ||
      run.status === 'canceled' ||
      run.status === 'skipped'
    ) {
      return run.status;
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  throw new Error(`Timed out waiting for migration run ${runId}`);
}

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
    await log(deploymentId, 'Starting deployment process');
    await db
      .update(deployments)
      .set({ status: 'building' })
      .where(eq(deployments.id, deploymentId));

    await log(deploymentId, 'Build phase started — resolving image');
    await job.updateProgress(20);

    await db
      .update(deployments)
      .set({ status: 'deploying' })
      .where(eq(deployments.id, deploymentId));

    await log(deploymentId, 'Deploying to Kubernetes');
    await job.updateProgress(50);

    const serviceList = await db.query.services.findMany({
      where: eq(services.projectId, projectId),
    });

    // 同步环境级变量（项目级 + 环境级，所有服务共享）
    await syncEnvVarsToK8s(projectId, environmentId);

    // 优先使用 trigger 传入的精确镜像 URL（已含完整 SHA tag）
    // 回退到从 repo URL + commit SHA 重建（兼容非 CI 触发的部署）
    const imageName = deployment.imageUrl || buildImageName(project, deployment.commitSha);

    if (!imageName) {
      throw new Error(
        `Cannot resolve image name for project ${project.slug}: no imageUrl in deployment record and repository URL not configured`
      );
    }

    await db
      .update(deployments)
      .set({ status: 'migration_pending' })
      .where(eq(deployments.id, deploymentId));
    await log(deploymentId, 'Resolving pre-deploy migration specifications');

    const targetServices = deployment.serviceId
      ? serviceList.filter((service) => service.id === deployment.serviceId)
      : serviceList;

    if (deployment.serviceId && targetServices.length === 0) {
      throw new Error(
        `Deployment service ${deployment.serviceId} not found in project ${projectId}`
      );
    }

    const targetServiceIds = targetServices.map((svc) => svc.id);
    const createdMigrationRuns = await resolveAndCreateMigrationRuns(
      projectId,
      environmentId,
      'preDeploy',
      {
        deploymentId,
        triggeredBy: 'deploy',
        triggeredByUserId: deployment.deployedById ?? null,
        sourceCommitSha: deployment.commitSha,
        sourceCommitMessage: deployment.commitMessage,
        serviceIds: targetServiceIds,
        options: {
          imageUrl: imageName,
          allowApprovalBypass: false,
        },
      }
    );
    if (createdMigrationRuns.length > 0) {
      await db
        .update(deployments)
        .set({ status: 'migration_running' })
        .where(eq(deployments.id, deploymentId));
      await log(deploymentId, `Queued ${createdMigrationRuns.length} pre-deploy migration run(s)`);
      for (const run of createdMigrationRuns) {
        await log(deploymentId, `Starting migration run ${run.id}`);
        await addMigrationJob(run.id, {
          imageUrl: imageName,
          allowApprovalBypass: false,
        });
        const result = await waitForMigrationRun(run.id);
        await log(deploymentId, `Migration run ${run.id} finished with status ${result}`);
        if (result !== 'success') {
          throw new Error(`Migration run ${run.id} ended with status ${result}`);
        }
      }
      await log(
        deploymentId,
        `Completed ${createdMigrationRuns.length} pre-deploy migration run(s)`
      );
    } else {
      await log(deploymentId, 'No pre-deploy migrations configured for this deployment');
    }

    // 用团队 OAuth token 确保 GHCR 拉取凭证存在（GitHub 私有镜像需要）
    let useGhcrPullSecret = false;
    if (getIsConnected() && environment.namespace) {
      try {
        const teamSession = await getTeamIntegrationSession({
          teamId: project.teamId,
          requiredCapabilities: [],
        });
        if (teamSession.provider === 'github') {
          await ensureGhcrPullSecret(environment.namespace, { token: teamSession.accessToken });
          useGhcrPullSecret = true;
        }
      } catch (e) {
        console.warn('Could not ensure GHCR pull secret, will try env var fallback:', e);
        await ensureGhcrPullSecret(environment.namespace);
        useGhcrPullSecret = !!process.env.GHCR_TOKEN;
      }
    }

    for (const service of targetServices) {
      await log(deploymentId, `Deploying service ${service.name}`);

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
        ...(svcEnv.hasSecrets ? [{ secretRef: { name: getK8sSvcSecretName(service.id) } }] : []),
      ];

      const deploymentName = `${project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
      try {
        await updateDeployment(environment.namespace, deploymentName, {
          image: imageName,
          envFrom,
        });
        await log(deploymentId, `Updated ${deploymentName} → ${imageName}`);
      } catch (_updateError) {
        await log(deploymentId, `${deploymentName} not found, creating new deployment`);
        try {
          await createDeployment(environment.namespace, deploymentName, {
            image: imageName,
            port: service.port ?? 3000,
            replicas: service.replicas ?? 1,
            envFrom,
            imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
            cpuRequest: service.cpuRequest ?? undefined,
            cpuLimit: service.cpuLimit ?? undefined,
            memoryRequest: service.memoryRequest ?? undefined,
            memoryLimit: service.memoryLimit ?? undefined,
          });
          await log(deploymentId, `Created ${deploymentName} → ${imageName}`);
        } catch (createError) {
          await log(deploymentId, `Failed to deploy ${deploymentName}: ${createError}`, 'error');
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

    await log(deploymentId, 'Deployment completed successfully');
    await job.updateProgress(100);

    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    let finalStatus: 'failed' | 'migration_failed' = 'failed';
    if (
      message.includes('approval required') ||
      message.includes('Migration run') ||
      message.includes('MIGRATION_')
    ) {
      finalStatus = 'migration_failed';
    }
    await log(deploymentId, `Deployment failed: ${message}`, 'error');
    await db
      .update(deployments)
      .set({ status: finalStatus })
      .where(eq(deployments.id, deploymentId));

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
