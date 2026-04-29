import type {
  DeploymentStatus,
  MigrationPhase,
  MigrationRunStatus,
  ReleaseStatus,
} from '@/lib/db/schema';

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

export const releaseStatusesRequiringFailureReconciliation = [
  'queued',
  'planning',
  'migration_pre_running',
  'deploying',
  'awaiting_rollout',
  'verifying',
  'migration_post_running',
] as const satisfies ReleaseStatus[];

export const supersedableReleaseStatuses = [
  'queued',
  'planning',
  'awaiting_approval',
  'awaiting_external_completion',
] as const satisfies ReleaseStatus[];

export const supersedableMigrationRunStatuses = [
  'queued',
  'planning',
  'awaiting_approval',
  'awaiting_external_completion',
] as const satisfies MigrationRunStatus[];

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

  if (
    status === 'migration_pre_running' ||
    status === 'awaiting_approval' ||
    status === 'awaiting_external_completion'
  ) {
    return 'migration_pre_failed';
  }

  if (status === 'verifying') {
    return 'verification_failed';
  }

  return 'failed';
}

export function getReleaseRunningStatusForMigrationPhase(
  phase: MigrationPhase
): Extract<ReleaseStatus, 'migration_pre_running' | 'migration_post_running'> | null {
  if (phase === 'preDeploy') {
    return 'migration_pre_running';
  }

  if (phase === 'postDeploy') {
    return 'migration_post_running';
  }

  return null;
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
      message:
        verificationFailed.errorMessage ??
        `Deployment ${verificationFailed.id} ended with status verification_failed`,
    };
  }

  const failed = deployments.find(
    (deployment) => deployment.status === 'failed' || deployment.status === 'rolled_back'
  );
  if (failed) {
    return {
      kind: 'failed',
      failureStatus: 'failed',
      message: failed.errorMessage ?? `Deployment ${failed.id} ended with status ${failed.status}`,
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
