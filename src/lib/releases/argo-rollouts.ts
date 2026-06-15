import {
  type ArgoRolloutSpec,
  getArgoRollout,
  isArgoRolloutCompleted,
  resumeArgoRollout,
  upsertArgoRollout,
  waitForArgoRolloutReady,
} from '@/lib/argocd';
import {
  deleteDeployment,
  deploymentExists,
  upsertService,
  verifyServiceReachability,
} from '@/lib/k8s';
import type {
  ProgressiveDeploymentStrategy,
  ReleaseWorkloadServiceLike,
  ServiceVerificationPlan,
  WorkloadEnvFromRef,
} from '@/lib/releases/workloads';
import { buildServiceRuntimeCommandSpec } from '@/lib/services/runtime-command';

const ARGO_ROLLOUT_VERIFICATION_TIMEOUT_MS = 180_000;

export type ArgoRolloutsDeploymentStrategy = Extract<
  ProgressiveDeploymentStrategy | 'rolling',
  'rolling' | 'controlled' | 'canary' | 'blue_green'
>;

export interface ArgoRolloutSnapshot {
  image: string | null;
  paused: boolean;
}

export function supportsArgoRolloutsDeploymentStrategy(
  strategy?: ProgressiveDeploymentStrategy | 'rolling' | null
): strategy is ArgoRolloutsDeploymentStrategy {
  return (
    strategy === 'rolling' ||
    strategy === 'controlled' ||
    strategy === 'canary' ||
    strategy === 'blue_green'
  );
}

export function requiresManualArgoRolloutPromotion(
  strategy?: ArgoRolloutsDeploymentStrategy | null
): boolean {
  return strategy === 'controlled' || strategy === 'blue_green';
}

export function shouldUseArgoRolloutsForService(input: {
  strategy?: ProgressiveDeploymentStrategy | 'rolling' | null;
  service: Pick<ReleaseWorkloadServiceLike, 'type' | 'isPublic'>;
  hasBlockingVerification?: boolean;
}): input is typeof input & { strategy: ArgoRolloutsDeploymentStrategy } {
  return (
    supportsArgoRolloutsDeploymentStrategy(input.strategy) &&
    input.service.type === 'web' &&
    input.service.isPublic !== false &&
    input.hasBlockingVerification !== false
  );
}

function buildArgoRolloutSpec(input: {
  namespace: string;
  rolloutName: string;
  stableServiceName: string;
  previewServiceName?: string;
  imageName: string;
  strategy: ArgoRolloutsDeploymentStrategy;
  autoPromotionEnabled: boolean;
  service: ReleaseWorkloadServiceLike;
  env?: Record<string, string>;
  envFrom: WorkloadEnvFromRef[];
  imagePullSecrets?: string[];
}): ArgoRolloutSpec {
  const runtimeCommand = buildServiceRuntimeCommandSpec(input.service);

  return {
    name: input.rolloutName,
    namespace: input.namespace,
    image: input.imageName,
    port: input.service.port ?? 3000,
    replicas: input.service.replicas ?? 1,
    stableServiceName: input.stableServiceName,
    previewServiceName: input.previewServiceName,
    strategy: input.strategy,
    autoPromotionEnabled: input.autoPromotionEnabled,
    env: input.env,
    envFrom: input.envFrom,
    imagePullSecrets: input.imagePullSecrets,
    command: runtimeCommand.command,
    args: runtimeCommand.args,
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
  env?: Record<string, string>;
  envFrom: WorkloadEnvFromRef[];
  imagePullSecrets?: string[];
  verificationPlan: ServiceVerificationPlan;
  onLog?: (message: string) => Promise<void>;
  onWarn?: (message: string) => Promise<void>;
}): Promise<{ awaitingRollout: boolean }> {
  const requiresManualPromotion = requiresManualArgoRolloutPromotion(input.strategy);
  const usesPreviewService = input.strategy !== 'canary';
  const [existingRollout, legacyStableDeploymentExists] = await Promise.all([
    getArgoRollout(input.namespace, input.rolloutName),
    deploymentExists(input.namespace, input.rolloutName),
  ]);
  const existingImage = existingRollout?.spec?.template?.spec?.containers?.[0]?.image ?? null;
  const existingImageAlreadyActive =
    existingImage === input.imageName && isArgoRolloutCompleted(existingRollout);
  const awaitingRollout =
    requiresManualPromotion &&
    (Boolean(existingRollout) || legacyStableDeploymentExists) &&
    !existingImageAlreadyActive;
  const verificationServiceName =
    awaitingRollout && usesPreviewService ? input.previewServiceName : input.stableServiceName;
  const verificationServiceLabel = awaitingRollout && usesPreviewService ? 'preview' : 'active';

  await upsertService(input.namespace, input.stableServiceName, {
    port: input.service.port ?? 3000,
    targetPort: input.service.port ?? 3000,
    selector: { app: input.rolloutName },
  });
  if (usesPreviewService) {
    await upsertService(input.namespace, input.previewServiceName, {
      port: input.service.port ?? 3000,
      targetPort: input.service.port ?? 3000,
      selector: { app: input.rolloutName },
    });
  }

  const nextSpec = buildArgoRolloutSpec({
    namespace: input.namespace,
    rolloutName: input.rolloutName,
    stableServiceName: input.stableServiceName,
    previewServiceName: usesPreviewService ? input.previewServiceName : undefined,
    imageName: input.imageName,
    strategy: input.strategy,
    autoPromotionEnabled: !awaitingRollout,
    service: input.service,
    env: input.env,
    envFrom: input.envFrom,
    imagePullSecrets: input.imagePullSecrets,
  });
  const rollbackSpec =
    awaitingRollout && existingImage && existingImage !== input.imageName
      ? buildArgoRolloutSpec({
          namespace: input.namespace,
          rolloutName: input.rolloutName,
          stableServiceName: input.stableServiceName,
          previewServiceName: usesPreviewService ? input.previewServiceName : undefined,
          imageName: existingImage,
          strategy: input.strategy,
          autoPromotionEnabled: true,
          service: input.service,
          env: input.env,
          envFrom: input.envFrom,
          imagePullSecrets: input.imagePullSecrets,
        })
      : null;

  let awaitingPromotionAfterReady = awaitingRollout;

  try {
    await upsertArgoRollout(nextSpec);

    await input.onLog?.(
      existingRollout
        ? `Updated Argo Rollout ${input.rolloutName} → ${input.imageName}`
        : `Created Argo Rollout ${input.rolloutName} → ${input.imageName}`
    );

    const readyRollout = await waitForArgoRolloutReady({
      namespace: input.namespace,
      name: input.rolloutName,
    });
    await input.onLog?.(`Argo Rollout ${input.rolloutName} is ready for verification`);
    awaitingPromotionAfterReady = awaitingRollout && !isArgoRolloutCompleted(readyRollout);

    if (input.verificationPlan.blockingPaths.length > 0) {
      await verifyServiceReachability({
        namespace: input.namespace,
        serviceName: verificationServiceName,
        port: input.service.port ?? 3000,
        paths: input.verificationPlan.blockingPaths,
        timeoutMs: ARGO_ROLLOUT_VERIFICATION_TIMEOUT_MS,
        pollMs: 3_000,
      });
      await input.onLog?.(
        `Verified ${verificationServiceLabel} service ${verificationServiceName} on ${input.verificationPlan.blockingPaths.join(', ')}`
      );
    }

    if (input.verificationPlan.observedPaths.length > 0) {
      try {
        await verifyServiceReachability({
          namespace: input.namespace,
          serviceName: verificationServiceName,
          port: input.service.port ?? 3000,
          paths: input.verificationPlan.observedPaths,
          timeoutMs: 30_000,
          pollMs: 3_000,
        });
        await input.onLog?.(
          `Observed ${verificationServiceLabel} entry checks ${verificationServiceName} on ${input.verificationPlan.observedPaths.join(', ')}`
        );
      } catch (error) {
        await input.onWarn?.(
          `Observed ${verificationServiceLabel} entry checks failed for ${verificationServiceName}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }

    if (!awaitingPromotionAfterReady) {
      await Promise.all([
        deleteDeployment(input.namespace, input.rolloutName).catch(() => undefined),
        deleteDeployment(input.namespace, input.previewServiceName).catch(() => undefined),
      ]);
    }
  } catch (error) {
    if (rollbackSpec) {
      await input.onWarn?.(
        `Argo Rollout ${input.rolloutName} verification failed; restoring previous stable image`
      );
      await upsertArgoRollout(rollbackSpec);
      await waitForArgoRolloutReady({
        namespace: input.namespace,
        name: input.rolloutName,
      });
      await input.onWarn?.(`Restored Argo Rollout ${input.rolloutName} → ${existingImage}`);
    }

    throw error;
  }

  return {
    awaitingRollout: awaitingPromotionAfterReady,
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

  await waitForArgoRolloutReady({
    namespace: input.namespace,
    name: input.rolloutName,
  });
  await input.onLog?.(`Argo Rollout ${input.rolloutName} is ready after promotion`);

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
