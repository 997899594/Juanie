import type {
  DeploymentStatus,
  MigrationPhase,
  MigrationRunStatus,
  ReleaseStatus,
} from '@/lib/db/schema';
import { resolveReleaseLifecycle } from '@/lib/releases/lifecycle';

export const activeReleaseStatuses = [
  'admission_running',
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
  'admission_running',
  'queued',
  'planning',
  'migration_pre_running',
  'deploying',
  'awaiting_rollout',
  'verifying',
  'migration_post_running',
] as const satisfies ReleaseStatus[];

export const supersedableReleaseStatuses = [
  'admission_running',
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

export function canReleaseAcceptRolloutActions(status: string | null | undefined): boolean {
  return status
    ? resolveReleaseLifecycle({
        status,
      }).canAcceptRolloutActions
    : false;
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
  const lifecycle = resolveReleaseLifecycle({
    status: deployments.some((deployment) => deployment.status === 'awaiting_rollout')
      ? 'awaiting_rollout'
      : 'deploying',
    deployments,
  });

  if (lifecycle.issue?.code === 'verification_failed') {
    return {
      kind: 'failed',
      failureStatus: 'verification_failed',
      message: lifecycle.issue.summary,
    };
  }

  if (lifecycle.issue?.code === 'deployment_failed') {
    return {
      kind: 'failed',
      failureStatus: 'failed',
      message: lifecycle.issue.summary,
    };
  }

  if (lifecycle.issue?.code === 'release_canceled') {
    return {
      kind: 'canceled',
      failureStatus: 'canceled',
      message: lifecycle.issue.summary,
    };
  }

  if (lifecycle.issue?.code === 'rollout_pending') {
    return { kind: 'awaiting_rollout' };
  }

  return { kind: 'ready' };
}

export const postDeploymentReleaseStatuses = [
  'verifying',
  'migration_post_running',
  'succeeded',
] as const satisfies ReleaseStatus[];
