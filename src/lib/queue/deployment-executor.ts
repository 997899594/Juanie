import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deploymentLogs,
  deployments,
  environments,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import { ensureEnvironmentDomains } from '@/lib/domains/service';
import {
  getK8sConfigMapName,
  getK8sSecretName,
  getK8sSvcConfigMapName,
  getK8sSvcSecretName,
  syncEnvVarsToK8s,
  syncServiceEnvVarsToK8s,
} from '@/lib/env-sync';
import { ensureEnvironmentScaffold } from '@/lib/environments/service';
import { getTeamIntegrationSession } from '@/lib/integrations/service/integration-control-plane';
import {
  createDeployment,
  ensureGhcrPullSecret,
  GHCR_PULL_SECRET_NAME,
  getIsConnected,
  updateDeployment,
} from '@/lib/k8s';

export async function logDeployment(
  deploymentId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  console.log(`[${level.toUpperCase()}] ${message}`);
  await db
    .insert(deploymentLogs)
    .values({ deploymentId, message, level })
    .catch(() => {
      // Swallow DB errors so log failures never break the deployment.
    });
}

export async function executeDeploymentWorkload(
  deploymentId: string,
  progress?: (value: number) => Promise<void>
) {
  const deployment = await db.query.deployments.findFirst({
    where: eq(deployments.id, deploymentId),
  });

  if (!deployment) {
    throw new Error(`Deployment ${deploymentId} not found`);
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, deployment.environmentId),
  });

  if (!environment) {
    throw new Error(`Environment ${deployment.environmentId} not found`);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, deployment.projectId),
    with: {
      repository: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${deployment.projectId} not found`);
  }

  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, deployment.projectId),
  });

  await logDeployment(deploymentId, 'Starting deployment process');
  await db.update(deployments).set({ status: 'building' }).where(eq(deployments.id, deploymentId));

  await logDeployment(deploymentId, 'Build phase started — resolving image');
  await progress?.(20);

  await db.update(deployments).set({ status: 'deploying' }).where(eq(deployments.id, deploymentId));

  await logDeployment(deploymentId, 'Deploying to Kubernetes');
  await progress?.(50);

  await ensureEnvironmentScaffold({
    project: {
      id: project.id,
      slug: project.slug,
      teamId: project.teamId,
    },
    environment: {
      id: environment.id,
      name: environment.name,
      namespace: environment.namespace,
      isProduction: environment.isProduction,
      isPreview: environment.isPreview,
    },
  });

  const freshEnvironment = await db.query.environments.findFirst({
    where: eq(environments.id, environment.id),
  });
  const targetEnvironment = freshEnvironment ?? environment;

  await ensureEnvironmentDomains({
    project: {
      id: project.id,
      slug: project.slug,
    },
    environment: {
      id: targetEnvironment.id,
      name: targetEnvironment.name,
      namespace: targetEnvironment.namespace,
      isPreview: targetEnvironment.isPreview,
    },
    services: serviceList.map((service) => ({
      id: service.id,
      name: service.name,
      type: service.type,
      isPublic: service.isPublic,
      port: service.port,
    })),
  });

  await syncEnvVarsToK8s(project.id, targetEnvironment.id);

  const imageName = deployment.imageUrl || buildImageName(project, deployment.commitSha);
  if (!imageName) {
    throw new Error(
      `Cannot resolve image name for project ${project.slug}: no imageUrl in deployment record and repository URL not configured`
    );
  }

  const targetServices = deployment.serviceId
    ? serviceList.filter((service) => service.id === deployment.serviceId)
    : serviceList;

  if (deployment.serviceId && targetServices.length === 0) {
    throw new Error(
      `Deployment service ${deployment.serviceId} not found in project ${deployment.projectId}`
    );
  }

  let useGhcrPullSecret = false;
  if (getIsConnected() && targetEnvironment.namespace) {
    try {
      const teamSession = await getTeamIntegrationSession({
        teamId: project.teamId,
        requiredCapabilities: [],
      });
      if (teamSession.provider === 'github') {
        await ensureGhcrPullSecret(targetEnvironment.namespace, { token: teamSession.accessToken });
        useGhcrPullSecret = true;
      }
    } catch (error) {
      console.warn('Could not ensure GHCR pull secret, will try env var fallback:', error);
      await ensureGhcrPullSecret(targetEnvironment.namespace);
      useGhcrPullSecret = !!process.env.GHCR_TOKEN;
    }
  }

  for (const service of targetServices) {
    await logDeployment(deploymentId, `Deploying service ${service.name}`);

    if (!getIsConnected() || !targetEnvironment.namespace) {
      continue;
    }

    const svcEnv = await syncServiceEnvVarsToK8s(service.id, targetEnvironment.namespace);
    const envFrom: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }> = [
      { configMapRef: { name: getK8sConfigMapName(environment.id) } },
      { secretRef: { name: getK8sSecretName(environment.id) } },
      ...(svcEnv.hasConfigs
        ? [{ configMapRef: { name: getK8sSvcConfigMapName(service.id) } }]
        : []),
      ...(svcEnv.hasSecrets ? [{ secretRef: { name: getK8sSvcSecretName(service.id) } }] : []),
    ];

    const deploymentName = `${project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    try {
      await updateDeployment(targetEnvironment.namespace, deploymentName, {
        image: imageName,
        envFrom,
      });
      await logDeployment(deploymentId, `Updated ${deploymentName} → ${imageName}`);
    } catch (_updateError) {
      await logDeployment(deploymentId, `${deploymentName} not found, creating new deployment`);
      await createDeployment(targetEnvironment.namespace, deploymentName, {
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
      await logDeployment(deploymentId, `Created ${deploymentName} → ${imageName}`);
    }
  }

  await progress?.(80);

  await db
    .update(deployments)
    .set({
      status: 'running',
      deployedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));

  await logDeployment(deploymentId, 'Deployment completed successfully');
  await progress?.(100);
}

function buildImageName(
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
  commitSha: string | null | undefined
): string | null {
  if (!project.repository || !commitSha || !project.repository.webUrl) {
    return null;
  }

  const webUrl = project.repository.webUrl;
  const githubMatch = webUrl.match(/github\.com\/([^/]+\/[^/]+)/);
  const gitlabMatch = webUrl.match(/gitlab[^/]*\/([^/]+\/[^/]+)/);

  const repoPath = githubMatch?.[1] || gitlabMatch?.[1];
  if (!repoPath) {
    return null;
  }

  const tag = `sha-${commitSha.slice(0, 7)}`;

  if (githubMatch) {
    return `ghcr.io/${repoPath.toLowerCase()}:${tag}`;
  }

  if (gitlabMatch) {
    return `registry.gitlab.com/${repoPath}:${tag}`;
  }

  return null;
}
