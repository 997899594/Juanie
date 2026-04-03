import type { DeploymentStatus, ReleaseStatus } from '@/lib/db/schema';

export const activeReleaseStatuses = [
  'queued',
  'planning',
  'migration_pre_running',
  'deploying',
  'awaiting_rollout',
  'verifying',
  'migration_post_running',
] as const satisfies ReleaseStatus[];

export type ActiveReleaseStatus = (typeof activeReleaseStatuses)[number];

export type ObservedDeploymentTerminalStatus =
  | 'running'
  | 'canceled'
  | 'failed'
  | 'rolled_back'
  | 'awaiting_rollout'
  | 'verification_failed';

export interface ReleaseDeploymentResolution {
  kind: 'ready' | 'awaiting_rollout' | 'failed' | 'canceled';
  failureStatus?: ReleaseStatus;
  message?: string;
}

export function isActiveReleaseStatus(status: string): boolean {
  return activeReleaseStatuses.includes(status as ActiveReleaseStatus);
}

export function getObservedDeploymentTerminalStatus(
  status: DeploymentStatus
): ObservedDeploymentTerminalStatus | null {
  if (
    status === 'running' ||
    status === 'canceled' ||
    status === 'failed' ||
    status === 'rolled_back' ||
    status === 'awaiting_rollout' ||
    status === 'verification_failed'
  ) {
    return status;
  }

  return null;
}

export function resolveReleaseFailureStatus(
  status: ReleaseStatus | null | undefined
): ReleaseStatus {
  if (status === 'migration_post_running') {
    return 'degraded';
  }

  if (status === 'migration_pre_running') {
    return 'migration_pre_failed';
  }

  if (status === 'verifying') {
    return 'verification_failed';
  }

  return 'failed';
}

export function resolveReleaseDeploymentResolution(
  deployments: Array<{
    id: string;
    status: ObservedDeploymentTerminalStatus;
    errorMessage?: string | null;
  }>
): ReleaseDeploymentResolution {
  const canceled = deployments.find((deployment) => deployment.status === 'canceled');
  if (canceled) {
    return {
      kind: 'canceled',
      failureStatus: 'canceled',
      message: canceled.errorMessage ?? `Deployment ${canceled.id} ended with status canceled`,
    };
  }

  const verificationFailed = deployments.find(
    (deployment) => deployment.status === 'verification_failed'
  );
  if (verificationFailed) {
    return {
      kind: 'failed',
      failureStatus: 'verification_failed',
      message: `Deployment ${verificationFailed.id} ended with status verification_failed`,
    };
  }

  const failed = deployments.find(
    (deployment) => deployment.status === 'failed' || deployment.status === 'rolled_back'
  );
  if (failed) {
    return {
      kind: 'failed',
      failureStatus: 'failed',
      message: `Deployment ${failed.id} ended with status ${failed.status}`,
    };
  }

  if (deployments.some((deployment) => deployment.status === 'awaiting_rollout')) {
    return { kind: 'awaiting_rollout' };
  }

  return { kind: 'ready' };
}

export const postDeploymentReleaseStatuses = [
  'verifying',
  'migration_post_running',
  'succeeded',
] as const satisfies ReleaseStatus[];
