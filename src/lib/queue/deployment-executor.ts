import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deploymentLogs,
  deployments,
  domains,
  environments,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import { buildDomainRouteName } from '@/lib/domains/defaults';
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
  createCiliumHTTPRoute,
  createDeployment,
  createService,
  deleteCiliumHTTPRoute,
  deleteDeployment,
  deleteService,
  deploymentExists,
  ensureGhcrPullSecret,
  GHCR_PULL_SECRET_NAME,
  getIsConnected,
  updateDeployment,
  verifyServiceReachability,
  waitForDeploymentReady,
} from '@/lib/k8s';

function buildServiceResourceName(projectSlug: string, serviceName: string): string {
  return `${projectSlug}-${serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

function buildCandidateResourceName(baseName: string): string {
  return `${baseName}-candidate`.slice(0, 63);
}

function buildServiceVerificationPaths(service: {
  type: string;
  isPublic?: boolean | null;
  healthcheckPath?: string | null;
}) {
  if (service.type !== 'web') {
    return [];
  }

  const paths = new Set<string>();

  if (service.healthcheckPath) {
    paths.add(service.healthcheckPath);
  } else {
    paths.add('/api/health/ready');
  }

  if (service.isPublic !== false) {
    paths.add('/');
  }

  return Array.from(paths);
}

function isProgressiveStrategy(
  strategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null
): strategy is 'controlled' | 'canary' | 'blue_green' {
  return strategy === 'controlled' || strategy === 'canary' || strategy === 'blue_green';
}

function buildTrafficBackends(input: {
  strategy: 'controlled' | 'canary' | 'blue_green';
  stableExists: boolean;
  stableName: string;
  candidateName: string;
  servicePort: number;
}) {
  if (!input.stableExists) {
    return [
      {
        serviceName: input.candidateName,
        servicePort: input.servicePort,
        weight: 100,
      },
    ];
  }

  if (input.strategy === 'canary') {
    return [
      {
        serviceName: input.stableName,
        servicePort: input.servicePort,
        weight: 90,
      },
      {
        serviceName: input.candidateName,
        servicePort: input.servicePort,
        weight: 10,
      },
    ];
  }

  if (input.strategy === 'blue_green') {
    return [
      {
        serviceName: input.candidateName,
        servicePort: input.servicePort,
        weight: 100,
      },
    ];
  }

  return [
    {
      serviceName: input.stableName,
      servicePort: input.servicePort,
      weight: 100,
    },
  ];
}

async function syncServiceTrafficRoutes(input: {
  projectId: string;
  projectSlug: string;
  environmentId: string;
  namespace: string;
  service: {
    id: string;
    name: string;
    type: string;
    isPublic?: boolean | null;
    port?: number | null;
  };
  backends: Array<{
    serviceName: string;
    servicePort: number;
    weight?: number;
  }>;
}) {
  if (input.service.type !== 'web' || input.service.isPublic === false) {
    return;
  }

  const domainList = await db.query.domains.findMany({
    where: eq(domains.environmentId, input.environmentId),
  });

  const serviceDomains = domainList.filter(
    (domain) => domain.serviceId === input.service.id || domain.serviceId === null
  );

  for (const domain of serviceDomains) {
    const routeName = buildDomainRouteName(domain.hostname);
    const routeSpec = {
      name: routeName,
      namespace: input.namespace,
      gatewayName: 'shared-gateway',
      gatewayNamespace: 'juanie',
      sectionName: 'https-wildcard',
      hostnames: [domain.hostname],
      serviceName:
        input.backends[0]?.serviceName ??
        buildServiceResourceName(input.projectSlug, input.service.name),
      servicePort: input.backends[0]?.servicePort ?? input.service.port ?? 80,
      backendRefs: input.backends,
      path: '/',
    };

    await deleteCiliumHTTPRoute(input.namespace, routeName).catch(() => undefined);
    await createCiliumHTTPRoute(routeSpec);
  }
}

async function cleanupCandidateResources(namespace: string, candidateName: string) {
  await deleteDeployment(namespace, candidateName).catch(() => undefined);
  await deleteService(namespace, candidateName).catch(() => undefined);
}

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

    const stableName = buildServiceResourceName(project.slug, service.name);
    const candidateName = buildCandidateResourceName(stableName);
    const verificationPaths = buildServiceVerificationPaths(service);

    if (!isProgressiveStrategy(deploymentStrategy)) {
      try {
        await updateDeployment(targetEnvironment.namespace, stableName, {
          image: imageName,
          port: service.port ?? 3000,
          envFrom,
          imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
          healthcheckPath: service.healthcheckPath ?? undefined,
          cpuRequest: service.cpuRequest ?? undefined,
          cpuLimit: service.cpuLimit ?? undefined,
          memoryRequest: service.memoryRequest ?? undefined,
          memoryLimit: service.memoryLimit ?? undefined,
        });
        await logDeployment(deploymentId, `Updated ${stableName} → ${imageName}`);
      } catch (_updateError) {
        await logDeployment(deploymentId, `${stableName} not found, creating new deployment`);
        await createDeployment(targetEnvironment.namespace, stableName, {
          image: imageName,
          port: service.port ?? 3000,
          replicas: service.replicas ?? 1,
          envFrom,
          imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
          healthcheckPath: service.healthcheckPath ?? undefined,
          cpuRequest: service.cpuRequest ?? undefined,
          cpuLimit: service.cpuLimit ?? undefined,
          memoryRequest: service.memoryRequest ?? undefined,
          memoryLimit: service.memoryLimit ?? undefined,
        });
        await logDeployment(deploymentId, `Created ${stableName} → ${imageName}`);
      }

      await waitForDeploymentReady({
        namespace: targetEnvironment.namespace,
        name: stableName,
      });

      if (verificationPaths.length > 0) {
        await verifyServiceReachability({
          namespace: targetEnvironment.namespace,
          serviceName: stableName,
          port: service.port ?? 3000,
          paths: verificationPaths,
        });
        await logDeployment(
          deploymentId,
          `Verified ${stableName} on ${verificationPaths.join(', ')}`
        );
      }

      await cleanupCandidateResources(targetEnvironment.namespace, candidateName);
      await syncServiceTrafficRoutes({
        projectId: project.id,
        projectSlug: project.slug,
        environmentId: targetEnvironment.id,
        namespace: targetEnvironment.namespace,
        service,
        backends: [
          {
            serviceName: stableName,
            servicePort: service.port ?? 80,
            weight: 100,
          },
        ],
      });
      continue;
    }

    const stableExists = await deploymentExists(targetEnvironment.namespace, stableName);

    try {
      await createService(targetEnvironment.namespace, candidateName, {
        port: service.port ?? 3000,
        targetPort: service.port ?? 3000,
      });
    } catch (_serviceError) {
      // Service already exists or will be recreated by the next route sync.
    }

    try {
      await updateDeployment(targetEnvironment.namespace, candidateName, {
        image: imageName,
        port: service.port ?? 3000,
        envFrom,
        imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
        healthcheckPath: service.healthcheckPath ?? undefined,
        cpuRequest: service.cpuRequest ?? undefined,
        cpuLimit: service.cpuLimit ?? undefined,
        memoryRequest: service.memoryRequest ?? undefined,
        memoryLimit: service.memoryLimit ?? undefined,
      });
      await logDeployment(deploymentId, `Updated ${candidateName} → ${imageName}`);
    } catch (_updateError) {
      await logDeployment(
        deploymentId,
        `${candidateName} not found, creating candidate deployment`
      );
      await createDeployment(targetEnvironment.namespace, candidateName, {
        image: imageName,
        port: service.port ?? 3000,
        replicas: service.replicas ?? 1,
        envFrom,
        imagePullSecrets: useGhcrPullSecret ? [GHCR_PULL_SECRET_NAME] : undefined,
        healthcheckPath: service.healthcheckPath ?? undefined,
        cpuRequest: service.cpuRequest ?? undefined,
        cpuLimit: service.cpuLimit ?? undefined,
        memoryRequest: service.memoryRequest ?? undefined,
        memoryLimit: service.memoryLimit ?? undefined,
      });
      await logDeployment(deploymentId, `Created ${candidateName} → ${imageName}`);
    }

    await waitForDeploymentReady({
      namespace: targetEnvironment.namespace,
      name: candidateName,
    });

    if (verificationPaths.length > 0) {
      await verifyServiceReachability({
        namespace: targetEnvironment.namespace,
        serviceName: candidateName,
        port: service.port ?? 3000,
        paths: verificationPaths,
      });
      await logDeployment(
        deploymentId,
        `Verified ${candidateName} on ${verificationPaths.join(', ')}`
      );
    }

    const backends = buildTrafficBackends({
      strategy: deploymentStrategy,
      stableExists,
      stableName,
      candidateName,
      servicePort: service.port ?? 80,
    });

    await syncServiceTrafficRoutes({
      projectId: project.id,
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
