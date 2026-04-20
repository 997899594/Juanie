import {
  type ArgoRolloutSpec,
  deleteDeployment,
  deploymentExists,
  getArgoRollout,
  resumeArgoRollout,
  upsertArgoRollout,
  upsertService,
  verifyServiceReachability,
} from '@/lib/k8s';
import type {
  ProgressiveDeploymentStrategy,
  ReleaseWorkloadServiceLike,
  ServiceVerificationPlan,
  WorkloadEnvFromRef,
} from '@/lib/releases/workloads';

export type ArgoRolloutsDeploymentStrategy = Extract<
  ProgressiveDeploymentStrategy,
  'controlled' | 'blue_green'
>;

export interface ArgoRolloutSnapshot {
  image: string | null;
  paused: boolean;
}

export function supportsArgoRolloutsDeploymentStrategy(
  strategy?: ProgressiveDeploymentStrategy | 'rolling' | null
): strategy is ArgoRolloutsDeploymentStrategy {
  return strategy === 'controlled' || strategy === 'blue_green';
}

function buildArgoRolloutSpec(input: {
  namespace: string;
  rolloutName: string;
  stableServiceName: string;
  previewServiceName: string;
  imageName: string;
  strategy: ArgoRolloutsDeploymentStrategy;
  service: ReleaseWorkloadServiceLike;
  envFrom: WorkloadEnvFromRef[];
  imagePullSecrets?: string[];
}): ArgoRolloutSpec {
  return {
    name: input.rolloutName,
    namespace: input.namespace,
    image: input.imageName,
    port: input.service.port ?? 3000,
    replicas: input.service.replicas ?? 1,
    stableServiceName: input.stableServiceName,
    previewServiceName: input.previewServiceName,
    strategy: input.strategy,
    envFrom: input.envFrom,
    imagePullSecrets: input.imagePullSecrets,
    healthcheckPath: input.service.healthcheckPath ?? undefined,
    cpuRequest: input.service.cpuRequest ?? undefined,
    cpuLimit: input.service.cpuLimit ?? undefined,
    memoryRequest: input.service.memoryRequest ?? undefined,
    memoryLimit: input.service.memoryLimit ?? undefined,
  };
}

export async function getArgoRolloutSnapshot(
  namespace: string,
  rolloutName: string
): Promise<ArgoRolloutSnapshot | null> {
  const rollout = await getArgoRollout(namespace, rolloutName);

  if (!rollout) {
    return null;
  }

  const image = rollout.spec?.template?.spec?.containers?.[0]?.image ?? null;
  const paused =
    Boolean(rollout.spec?.paused) || Boolean((rollout.status?.pauseConditions?.length ?? 0) > 0);

  return {
    image,
    paused,
  };
}

export async function deployArgoRolloutWorkload(input: {
  namespace: string;
  rolloutName: string;
  stableServiceName: string;
  previewServiceName: string;
  imageName: string;
  strategy: ArgoRolloutsDeploymentStrategy;
  service: ReleaseWorkloadServiceLike;
  envFrom: WorkloadEnvFromRef[];
  imagePullSecrets?: string[];
  verificationPlan: ServiceVerificationPlan;
  onLog?: (message: string) => Promise<void>;
  onWarn?: (message: string) => Promise<void>;
}): Promise<{ awaitingRollout: boolean }> {
  const [existingRollout, legacyStableDeploymentExists] = await Promise.all([
    getArgoRollout(input.namespace, input.rolloutName),
    deploymentExists(input.namespace, input.rolloutName),
  ]);

  await upsertService(input.namespace, input.stableServiceName, {
    port: input.service.port ?? 3000,
    targetPort: input.service.port ?? 3000,
    selector: { app: input.rolloutName },
  });
  await upsertService(input.namespace, input.previewServiceName, {
    port: input.service.port ?? 3000,
    targetPort: input.service.port ?? 3000,
    selector: { app: input.rolloutName },
  });

  await upsertArgoRollout(
    buildArgoRolloutSpec({
      namespace: input.namespace,
      rolloutName: input.rolloutName,
      stableServiceName: input.stableServiceName,
      previewServiceName: input.previewServiceName,
      imageName: input.imageName,
      strategy: input.strategy,
      service: input.service,
      envFrom: input.envFrom,
      imagePullSecrets: input.imagePullSecrets,
    })
  );

  await input.onLog?.(
    existingRollout
      ? `Updated Argo Rollout ${input.rolloutName} → ${input.imageName}`
      : `Created Argo Rollout ${input.rolloutName} → ${input.imageName}`
  );

  if (input.verificationPlan.blockingPaths.length > 0) {
    await verifyServiceReachability({
      namespace: input.namespace,
      serviceName: input.previewServiceName,
      port: input.service.port ?? 3000,
      paths: input.verificationPlan.blockingPaths,
      timeoutMs: 60_000,
      pollMs: 3_000,
    });
    await input.onLog?.(
      `Verified preview service ${input.previewServiceName} on ${input.verificationPlan.blockingPaths.join(', ')}`
    );
  }

  if (input.verificationPlan.observedPaths.length > 0) {
    try {
      await verifyServiceReachability({
        namespace: input.namespace,
        serviceName: input.previewServiceName,
        port: input.service.port ?? 3000,
        paths: input.verificationPlan.observedPaths,
        timeoutMs: 30_000,
        pollMs: 3_000,
      });
      await input.onLog?.(
        `Observed preview entry checks ${input.previewServiceName} on ${input.verificationPlan.observedPaths.join(', ')}`
      );
    } catch (error) {
      await input.onWarn?.(
        `Observed preview entry checks failed for ${input.previewServiceName}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    awaitingRollout: Boolean(existingRollout) || legacyStableDeploymentExists,
  };
}

export async function finalizeArgoRollout(input: {
  namespace: string;
  rolloutName: string;
  stableServiceName: string;
  previewServiceName: string;
  service: ReleaseWorkloadServiceLike;
  verificationPlan: ServiceVerificationPlan;
  onLog?: (message: string) => Promise<void>;
}): Promise<void> {
  await resumeArgoRollout(input.namespace, input.rolloutName);
  await input.onLog?.(`Resumed Argo Rollout ${input.rolloutName} for promotion`);

  if (input.verificationPlan.blockingPaths.length > 0) {
    await verifyServiceReachability({
      namespace: input.namespace,
      serviceName: input.stableServiceName,
      port: input.service.port ?? 3000,
      paths: input.verificationPlan.blockingPaths,
      timeoutMs: 90_000,
      pollMs: 3_000,
    });
    await input.onLog?.(
      `Verified active service ${input.stableServiceName} after rollout promotion`
    );
  }

  await Promise.all([
    deleteDeployment(input.namespace, input.rolloutName).catch(() => undefined),
    deleteDeployment(input.namespace, input.previewServiceName).catch(() => undefined),
  ]);
}
