import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { deployments, environments, projects, releases } from '@/lib/db/schema';
import { resolveDeployImageReference } from '@/lib/deploy-images';
import {
  getK8sConfigMapName,
  getK8sSecretName,
  getK8sSvcConfigMapName,
  getK8sSvcSecretName,
  syncEnvVarsToK8s,
  syncServiceEnvVarsToK8s,
} from '@/lib/env-sync';
import {
  getEnvironmentDeploymentRuntime,
  getEnvironmentKind,
  usesArgoRolloutsRuntime,
} from '@/lib/environments/model';
import { reconcileEnvironmentState } from '@/lib/environments/service';
import { deploymentExists, getDeploymentSnapshot, isK8sAvailable } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import {
  appendDeploymentRealtimeLogs,
  updateDeploymentRealtimeState,
} from '@/lib/realtime/deployments';
import {
  deployArgoRolloutWorkload,
  supportsArgoRolloutsDeploymentStrategy,
} from '@/lib/releases/argo-rollouts';
import { assertDeploymentIsCurrent } from '@/lib/releases/deployment-coordination';
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
import {
  syncProjectDatabaseRuntimeContractsFromRepo,
  syncProjectServiceRuntimeContractsFromRepo,
} from '@/lib/services/runtime-contract';

const deploymentExecutorLogger = logger.child({ component: 'deployment-executor' });

export async function logDeployment(
  deploymentId: string,
  message: string,
  level: 'info' | 'warn' | 'error' = 'info'
) {
  const scopedLogger = deploymentExecutorLogger.child({ deploymentId });
  if (level === 'error') {
    scopedLogger.error(message);
  } else if (level === 'warn') {
    scopedLogger.warn(message);
  } else {
    scopedLogger.info(message);
  }
  await appendDeploymentRealtimeLogs([{ deploymentId, message, level }]).catch(() => {
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

  await assertDeploymentIsCurrent(deploymentId);

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
  await syncProjectDatabaseRuntimeContractsFromRepo({
    projectId: deployment.projectId,
    sourceRef: release?.sourceRef ?? null,
    sourceCommitSha: release?.configCommitSha ?? release?.sourceCommitSha ?? deployment.commitSha,
  });

  await logDeployment(deploymentId, 'Starting deployment process');
  await updateDeploymentRealtimeState(deploymentId, {
    status: 'building',
    errorMessage: null,
  });

  await logDeployment(deploymentId, 'Build phase started — resolving image');
  await progress?.(20);

  await updateDeploymentRealtimeState(deploymentId, {
    status: 'deploying',
  });

  await logDeployment(deploymentId, 'Deploying to Kubernetes');
  await progress?.(50);

  const runtimeState = await reconcileEnvironmentState({
    project: {
      id: project.id,
      slug: project.slug,
      configJson: project.configJson,
    },
    environment: {
      id: environment.id,
      name: environment.name,
      namespace: environment.namespace,
      kind: getEnvironmentKind(environment),
      isProduction: environment.isProduction,
      isPreview: environment.isPreview,
      deploymentStrategy: environment.deploymentStrategy,
    },
    services: serviceList,
    scope: 'full',
  });
  const targetEnvironment = {
    ...environment,
    namespace: runtimeState.namespace,
  };
  const deploymentStrategy = targetEnvironment.deploymentStrategy ?? 'rolling';
  const deploymentRuntime = getEnvironmentDeploymentRuntime(targetEnvironment);

  await syncEnvVarsToK8s(project.id, targetEnvironment.id);

  const imageName =
    deployment.imageUrl ||
    resolveDeployImageReference(
      {
        configJson: project.configJson,
        repositoryFullName: project.repository?.fullName ?? null,
      },
      deployment.commitSha
    );
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

  let awaitingRollout = false;

  for (const service of targetServices) {
    await assertDeploymentIsCurrent(deploymentId);
    await logDeployment(deploymentId, `Deploying service ${service.name}`);

    if (!isK8sAvailable() || !targetEnvironment.namespace) {
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
    const shouldUseArgoRollouts =
      usesArgoRolloutsRuntime({
        deploymentRuntime,
      }) &&
      supportsArgoRolloutsDeploymentStrategy(deploymentStrategy) &&
      canShiftTraffic &&
      shouldVerifyCandidateFirst;

    if (shouldUseArgoRollouts) {
      const rollout = await deployArgoRolloutWorkload({
        namespace: targetEnvironment.namespace,
        rolloutName: stableName,
        stableServiceName: stableName,
        previewServiceName: candidateName,
        imageName,
        strategy: deploymentStrategy,
        service,
        envFrom,
        verificationPlan,
        onLog: (message) => logDeployment(deploymentId, message),
        onWarn: (message) => logDeployment(deploymentId, message, 'warn'),
      });

      if (rollout.awaitingRollout) {
        await logDeployment(
          deploymentId,
          `Argo Rollout candidate for ${service.name} is verified and awaiting promotion`
        );
      } else {
        await logDeployment(
          deploymentId,
          `Argo Rollout for ${service.name} completed initial activation without manual promotion`
        );
      }

      awaitingRollout = awaitingRollout || rollout.awaitingRollout;
      continue;
    }

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
      servicePort: service.port ?? 3000,
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

  await assertDeploymentIsCurrent(deploymentId);

  await updateDeploymentRealtimeState(deploymentId, {
    status: awaitingRollout ? 'awaiting_rollout' : 'running',
    errorMessage: null,
    deployedAt: new Date(),
  });

  await logDeployment(
    deploymentId,
    awaitingRollout
      ? 'Candidate verified successfully and is awaiting rollout completion'
      : 'Deployment completed successfully'
  );
  await progress?.(100);
}
