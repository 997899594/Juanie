import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deploymentLogs,
  deployments,
  environments,
  projects,
  releases,
  repositories,
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
  deploymentExists,
  ensureGhcrImagePullAccess,
  GHCR_PULL_SECRET_NAME,
  getDeploymentSnapshot,
  getIsConnected,
} from '@/lib/k8s';
import {
  buildCandidateDeploymentName,
  buildStableDeploymentName,
  syncEnvironmentServiceTrafficRoutes,
} from '@/lib/releases/traffic';
import {
  buildServiceVerificationPlan,
  buildTrafficBackends,
  deployCandidateWorkload,
  isProgressiveStrategy,
  promoteCandidateSnapshotToStable,
} from '@/lib/releases/workloads';
import { syncProjectServiceRuntimeContractsFromRepo } from '@/lib/services/runtime-contract';

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

  const release = deployment.releaseId
    ? await db.query.releases.findFirst({
        where: eq(releases.id, deployment.releaseId),
        columns: {
          sourceRef: true,
          sourceCommitSha: true,
          configCommitSha: true,
        },
      })
    : null;

  const serviceList = await syncProjectServiceRuntimeContractsFromRepo({
    projectId: deployment.projectId,
    sourceRef: release?.sourceRef ?? null,
    sourceCommitSha: release?.configCommitSha ?? release?.sourceCommitSha ?? deployment.commitSha,
  });

  await logDeployment(deploymentId, 'Starting deployment process');
  await db
    .update(deployments)
    .set({ status: 'building', errorMessage: null })
    .where(eq(deployments.id, deploymentId));

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
  const deploymentStrategy = targetEnvironment.deploymentStrategy ?? 'rolling';

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
        useGhcrPullSecret = await ensureGhcrImagePullAccess(targetEnvironment.namespace, {
          token: teamSession.accessToken,
        });
      }
    } catch (error) {
      console.warn('Could not ensure GHCR pull secret, will try env var fallback:', error);
      useGhcrPullSecret = await ensureGhcrImagePullAccess(targetEnvironment.namespace);
    }
  }

  let awaitingRollout = false;

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

    const stableName = buildStableDeploymentName(project.slug, service.name);
    const candidateName = buildCandidateDeploymentName(stableName);
    const verificationPlan = buildServiceVerificationPlan(service);
    const stableExists = await deploymentExists(targetEnvironment.namespace, stableName);
    const canShiftTraffic = service.type === 'web' && service.isPublic !== false;
    const shouldVerifyCandidateFirst = verificationPlan.blockingPaths.length > 0;

    if (!shouldVerifyCandidateFirst) {
      await promoteCandidateSnapshotToStable({
        namespace: targetEnvironment.namespace,
        projectSlug: project.slug,
        environmentId: targetEnvironment.id,
        service,
        stableName,
        candidateName,
        snapshot: {
          image: imageName,
          port: service.port ?? 3000,
          replicas: service.replicas ?? 1,
          envFrom,
          imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
          cpuRequest: service.cpuRequest ?? undefined,
          cpuLimit: service.cpuLimit ?? undefined,
          memoryRequest: service.memoryRequest ?? undefined,
          memoryLimit: service.memoryLimit ?? undefined,
        },
        stableExists,
        candidateVerified: false,
        onLog: (message) => logDeployment(deploymentId, message),
      });
      continue;
    }

    await deployCandidateWorkload({
      namespace: targetEnvironment.namespace,
      candidateName,
      imageName,
      service,
      envFrom,
      imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
      verificationPlan,
      onLog: (message) => logDeployment(deploymentId, message),
      onWarn: (message) => logDeployment(deploymentId, message, 'warn'),
    });

    if (!isProgressiveStrategy(deploymentStrategy) || !stableExists || !canShiftTraffic) {
      await logDeployment(
        deploymentId,
        stableExists
          ? `Promoting verified candidate for ${service.name} to stable`
          : `${service.name} has no stable workload yet, promoting verified candidate to stable`
      );
      const candidateSnapshot = await getDeploymentSnapshot(
        targetEnvironment.namespace,
        candidateName
      );

      if (!candidateSnapshot?.image) {
        throw new Error(`Candidate snapshot missing for ${candidateName}`);
      }

      await promoteCandidateSnapshotToStable({
        namespace: targetEnvironment.namespace,
        projectSlug: project.slug,
        environmentId: targetEnvironment.id,
        service,
        stableName,
        candidateName,
        snapshot: candidateSnapshot,
        stableExists,
        candidateVerified: true,
        onLog: (message) => logDeployment(deploymentId, message),
      });
      continue;
    }

    const backends = buildTrafficBackends({
      strategy: deploymentStrategy,
      stableExists,
      stableName,
      candidateName,
      servicePort: service.port ?? 80,
    });

    await syncEnvironmentServiceTrafficRoutes({
      projectSlug: project.slug,
      environmentId: targetEnvironment.id,
      namespace: targetEnvironment.namespace,
      service,
      backends,
    });

    await logDeployment(
      deploymentId,
      `Applied ${deploymentStrategy} route for ${service.name}: ${backends
        .map((backend) => `${backend.serviceName}:${backend.weight ?? 100}%`)
        .join(', ')}`
    );
    awaitingRollout = true;
  }

  await progress?.(80);

  await db
    .update(deployments)
    .set({
      status: awaitingRollout ? 'awaiting_rollout' : 'running',
      errorMessage: null,
      deployedAt: new Date(),
    })
    .where(eq(deployments.id, deploymentId));

  await logDeployment(
    deploymentId,
    awaitingRollout
      ? 'Candidate verified successfully and is awaiting rollout completion'
      : 'Deployment completed successfully'
  );
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
