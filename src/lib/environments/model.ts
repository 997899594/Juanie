import type {
  EnvironmentDeliveryMode,
  EnvironmentDeploymentRuntime,
  EnvironmentDeploymentStrategy,
  EnvironmentKind,
} from '@/lib/db/schema';

export interface EnvironmentKindLike {
  kind?: EnvironmentKind | null;
  isPreview?: boolean | null;
  isProduction?: boolean | null;
}

export interface EnvironmentDeliveryModeLike extends EnvironmentKindLike {
  deliveryMode?: EnvironmentDeliveryMode | null;
}

export interface EnvironmentDeploymentRuntimeLike {
  deploymentRuntime?: EnvironmentDeploymentRuntime | null;
  deploymentStrategy?: EnvironmentDeploymentStrategy | null;
}

export interface EnvironmentIdentityLike extends EnvironmentKindLike {
  name?: string | null;
}

export function getEnvironmentKind(environment: EnvironmentKindLike): EnvironmentKind {
  if (environment.kind) {
    return environment.kind;
  }

  if (environment.isPreview) {
    return 'preview';
  }

  if (environment.isProduction) {
    return 'production';
  }

  return 'persistent';
}

export function isPreviewEnvironment(environment: EnvironmentKindLike): boolean {
  return getEnvironmentKind(environment) === 'preview';
}

export function isProductionEnvironment(environment: EnvironmentKindLike): boolean {
  return getEnvironmentKind(environment) === 'production';
}

export function isPersistentEnvironment(environment: EnvironmentKindLike): boolean {
  return getEnvironmentKind(environment) === 'persistent';
}

export function getEnvironmentDeliveryMode(
  environment: EnvironmentDeliveryModeLike
): EnvironmentDeliveryMode {
  if (environment.deliveryMode) {
    return environment.deliveryMode;
  }

  return isProductionEnvironment(environment) ? 'promote_only' : 'direct';
}

export function isPromoteOnlyEnvironment(environment: EnvironmentDeliveryModeLike): boolean {
  return getEnvironmentDeliveryMode(environment) === 'promote_only';
}

export function inferEnvironmentDeploymentRuntime(
  strategy?: EnvironmentDeploymentStrategy | null
): EnvironmentDeploymentRuntime {
  if (
    strategy === 'rolling' ||
    strategy === 'controlled' ||
    strategy === 'canary' ||
    strategy === 'blue_green'
  ) {
    return 'argo_rollouts';
  }

  return 'native_k8s';
}

export function getEnvironmentDeploymentRuntime(
  environment: EnvironmentDeploymentRuntimeLike
): EnvironmentDeploymentRuntime {
  if (environment.deploymentRuntime) {
    return environment.deploymentRuntime;
  }

  return inferEnvironmentDeploymentRuntime(environment.deploymentStrategy);
}

export function usesArgoRolloutsRuntime(environment: EnvironmentDeploymentRuntimeLike): boolean {
  return getEnvironmentDeploymentRuntime(environment) === 'argo_rollouts';
}

export function allowsGitRouting(environment: EnvironmentDeliveryModeLike): boolean {
  return getEnvironmentDeliveryMode(environment) === 'direct';
}

export function allowsDirectReleaseCreation(environment: EnvironmentDeliveryModeLike): boolean {
  return getEnvironmentDeliveryMode(environment) === 'direct';
}

export function getEnvironmentSortRank(environment: EnvironmentKindLike): number {
  switch (getEnvironmentKind(environment)) {
    case 'persistent':
      return 0;
    case 'production':
      return 1;
    case 'preview':
      return 2;
    default:
      return 3;
  }
}

export function compareEnvironmentDisplayOrder(
  left: EnvironmentIdentityLike,
  right: EnvironmentIdentityLike
): number {
  const leftRank = getEnvironmentSortRank(left);
  const rightRank = getEnvironmentSortRank(right);

  if (leftRank !== rightRank) {
    return leftRank - rightRank;
  }

  return (left.name ?? '').localeCompare(right.name ?? '');
}

export function pickDefaultEnvironment<T extends EnvironmentIdentityLike>(
  environments: T[]
): T | null {
  const ordered = [...environments].sort(compareEnvironmentDisplayOrder);
  return ordered[0] ?? null;
}

export function pickProductionEnvironment<T extends EnvironmentKindLike>(
  environments: T[]
): T | null {
  return environments.find((environment) => isProductionEnvironment(environment)) ?? null;
}
