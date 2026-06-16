export type ReleaseLifecycleIssueCode =
  | 'admission_failed'
  | 'approval_blocked'
  | 'external_completion_blocked'
  | 'migration_failed'
  | 'migration_canceled'
  | 'verification_failed'
  | 'deployment_failed'
  | 'rollout_pending'
  | 'release_canceled'
  | 'degraded'
  | 'release_failed';

export type ReleaseLifecycleResolution = 'running' | 'succeeded' | 'failed' | 'action_required';
export type ReleaseLifecyclePhase =
  | 'admission'
  | 'migration_pre'
  | 'deployment'
  | 'rollout'
  | 'verification'
  | 'migration_post'
  | 'completed'
  | 'canceled';

export interface ReleaseLifecycleMigrationLike {
  id?: string | null;
  status: string;
  service?: { name?: string | null } | null;
  database?: { name?: string | null } | null;
}

export interface ReleaseLifecycleDeploymentLike {
  id?: string | null;
  serviceId?: string | null;
  service?: { name?: string | null } | null;
  status: string;
  errorMessage?: string | null;
}

export interface ReleaseLifecycleLike {
  status: string;
  errorMessage?: string | null;
  migrationRuns?: ReleaseLifecycleMigrationLike[];
  deployments?: ReleaseLifecycleDeploymentLike[];
}

export interface ReleaseLifecycleIssue {
  code: ReleaseLifecycleIssueCode;
  phase: ReleaseLifecyclePhase;
  summary: string;
  actionRequired: boolean;
  source: 'release' | 'migration' | 'deployment';
  sourceId: string | null;
}

export interface ReleaseLifecycleSnapshot {
  phase: ReleaseLifecyclePhase;
  issue: ReleaseLifecycleIssue | null;
  resolution: ReleaseLifecycleResolution;
  terminal: boolean;
  succeeded: boolean;
  failed: boolean;
  canAcceptRolloutActions: boolean;
  actionableRolloutDeploymentIds: string[];
  failureSummary: string | null;
}

const activeReleaseStatuses = [
  'admission_running',
  'queued',
  'planning',
  'migration_pre_running',
  'deploying',
  'awaiting_rollout',
  'verifying',
  'migration_post_running',
] as const;

const terminalIssueCodes = new Set<ReleaseLifecycleIssueCode>([
  'admission_failed',
  'migration_failed',
  'migration_canceled',
  'verification_failed',
  'deployment_failed',
  'release_canceled',
  'degraded',
  'release_failed',
]);

function isActiveReleaseStatus(status: string): boolean {
  return activeReleaseStatuses.includes(status as (typeof activeReleaseStatuses)[number]);
}

function getTargetName(item: {
  id?: string | null;
  service?: { name?: string | null } | null;
  database?: { name?: string | null } | null;
}): string | null {
  return item.service?.name ?? item.database?.name ?? item.id ?? null;
}

function isSupersededMessage(message?: string | null): boolean {
  return message?.includes('Superseded by deployment') ?? false;
}

function buildIssue(input: {
  code: ReleaseLifecycleIssueCode;
  phase: ReleaseLifecyclePhase;
  summary: string;
  actionRequired?: boolean;
  source: 'release' | 'migration' | 'deployment';
  sourceId?: string | null;
}): ReleaseLifecycleIssue {
  return {
    code: input.code,
    phase: input.phase,
    summary: input.summary,
    actionRequired: input.actionRequired ?? false,
    source: input.source,
    sourceId: input.sourceId ?? null,
  };
}

function resolveReleasePhase(status: string): ReleaseLifecyclePhase {
  if (status === 'admission_running' || status === 'admission_failed' || status === 'queued') {
    return 'admission';
  }

  if (
    status === 'planning' ||
    status === 'migration_pre_running' ||
    status === 'awaiting_approval' ||
    status === 'awaiting_external_completion' ||
    status === 'migration_pre_failed'
  ) {
    return 'migration_pre';
  }

  if (status === 'deploying' || status === 'failed' || status === 'verification_failed') {
    return 'deployment';
  }

  if (status === 'awaiting_rollout') {
    return 'rollout';
  }

  if (status === 'verifying') {
    return 'verification';
  }

  if (status === 'migration_post_running' || status === 'degraded') {
    return 'migration_post';
  }

  if (status === 'canceled') {
    return 'canceled';
  }

  return 'completed';
}

export function resolveReleaseLifecycle(release: ReleaseLifecycleLike): ReleaseLifecycleSnapshot {
  const migrationRuns = release.migrationRuns ?? [];
  const deployments = release.deployments ?? [];
  const explicitReleaseError = release.errorMessage ?? null;
  let issue: ReleaseLifecycleIssue | null = null;

  if (release.status === 'admission_failed') {
    issue = buildIssue({
      code: 'admission_failed',
      phase: 'admission',
      summary: explicitReleaseError ?? '发布准入失败',
      source: 'release',
    });
  }

  const approvalRun = migrationRuns.find((run) => run.status === 'awaiting_approval');
  if (!issue && (release.status === 'awaiting_approval' || approvalRun)) {
    const targetName = approvalRun ? getTargetName(approvalRun) : null;
    issue = buildIssue({
      code: 'approval_blocked',
      phase: 'migration_pre',
      summary: targetName ? `迁移 ${targetName} 正在等待审批` : '发布等待迁移审批',
      actionRequired: true,
      source: approvalRun ? 'migration' : 'release',
      sourceId: approvalRun?.id ?? null,
    });
  }

  const externalRun = migrationRuns.find((run) => run.status === 'awaiting_external_completion');
  if (!issue && (release.status === 'awaiting_external_completion' || externalRun)) {
    const targetName = externalRun ? getTargetName(externalRun) : null;
    issue = buildIssue({
      code: 'external_completion_blocked',
      phase: 'migration_pre',
      summary: targetName ? `迁移 ${targetName} 正在等待外部完成确认` : '发布等待外部迁移完成',
      actionRequired: true,
      source: externalRun ? 'migration' : 'release',
      sourceId: externalRun?.id ?? null,
    });
  }

  const failedMigration = migrationRuns.find((run) => run.status === 'failed');
  if (!issue && (release.status === 'migration_pre_failed' || failedMigration)) {
    const targetName = failedMigration ? getTargetName(failedMigration) : null;
    issue = buildIssue({
      code:
        release.status === 'migration_pre_failed' && explicitReleaseError
          ? 'release_failed'
          : 'migration_failed',
      phase: 'migration_pre',
      summary:
        explicitReleaseError ?? (targetName ? `迁移 ${targetName} 执行失败` : '迁移执行失败'),
      source: failedMigration ? 'migration' : 'release',
      sourceId: failedMigration?.id ?? null,
    });
  }

  const canceledMigration = migrationRuns.find((run) => run.status === 'canceled');
  if (!issue && canceledMigration) {
    const targetName = getTargetName(canceledMigration);
    issue = buildIssue({
      code: 'migration_canceled',
      phase: 'migration_pre',
      summary: targetName ? `迁移 ${targetName} 已取消` : '迁移被取消',
      source: 'migration',
      sourceId: canceledMigration.id ?? null,
    });
  }

  const verificationFailedDeployment = deployments.find(
    (deployment) => deployment.status === 'verification_failed'
  );
  if (!issue && (release.status === 'verification_failed' || verificationFailedDeployment)) {
    issue = buildIssue({
      code: 'verification_failed',
      phase: 'deployment',
      summary: verificationFailedDeployment?.errorMessage ?? explicitReleaseError ?? '部署校验失败',
      source: verificationFailedDeployment ? 'deployment' : 'release',
      sourceId: verificationFailedDeployment?.id ?? null,
    });
  }

  const failedDeployment = deployments.find(
    (deployment) => deployment.status === 'failed' || deployment.status === 'rolled_back'
  );
  if (!issue && failedDeployment) {
    const failedDeploymentSummary = failedDeployment.errorMessage
      ? failedDeployment.errorMessage
      : failedDeployment.id
        ? `部署 ${failedDeployment.id} 结束状态为 ${failedDeployment.status}`
        : failedDeployment.status === 'rolled_back'
          ? '部署已回滚'
          : '部署执行失败';

    issue = buildIssue({
      code: 'deployment_failed',
      phase: 'deployment',
      summary: failedDeploymentSummary,
      source: 'deployment',
      sourceId: failedDeployment.id ?? null,
    });
  }

  if (!issue && release.status === 'failed') {
    issue = buildIssue({
      code: 'release_failed',
      phase: 'deployment',
      summary: explicitReleaseError ?? '发布失败',
      source: 'release',
    });
  }

  const canceledDeployment = deployments.find((deployment) => deployment.status === 'canceled');
  if (!issue && (release.status === 'canceled' || canceledDeployment)) {
    const message = canceledDeployment?.errorMessage ?? explicitReleaseError ?? null;
    issue = buildIssue({
      code: 'release_canceled',
      phase: 'canceled',
      summary: isSupersededMessage(message) ? '发布已被更新版本接管' : (message ?? '发布已取消'),
      source: canceledDeployment ? 'deployment' : 'release',
      sourceId: canceledDeployment?.id ?? null,
    });
  }

  const rolloutDeployments = deployments.filter(
    (deployment) => deployment.status === 'awaiting_rollout'
  );

  if (!issue && release.status === 'awaiting_rollout') {
    issue = buildIssue({
      code: 'rollout_pending',
      phase: 'rollout',
      summary: '发布等待放量完成',
      actionRequired: true,
      source: 'release',
    });
  }

  if (!issue && release.status === 'degraded') {
    issue = buildIssue({
      code: 'degraded',
      phase: 'migration_post',
      summary: explicitReleaseError ?? '发布降级',
      source: 'release',
    });
  }

  const actionRequired = issue?.actionRequired ?? false;
  const terminal = Boolean(
    actionRequired ||
      (issue && terminalIssueCodes.has(issue.code)) ||
      !isActiveReleaseStatus(release.status)
  );
  const succeeded = release.status === 'succeeded';
  const failed = terminal && !succeeded && !actionRequired;
  const resolution: ReleaseLifecycleResolution = actionRequired
    ? 'action_required'
    : succeeded
      ? 'succeeded'
      : failed
        ? 'failed'
        : 'running';

  return {
    phase: issue?.phase ?? resolveReleasePhase(release.status),
    issue,
    resolution,
    terminal,
    succeeded,
    failed,
    canAcceptRolloutActions:
      release.status === 'awaiting_rollout' && issue?.code === 'rollout_pending',
    actionableRolloutDeploymentIds:
      release.status === 'awaiting_rollout' && issue?.code === 'rollout_pending'
        ? rolloutDeployments
            .map((deployment) => deployment.id)
            .filter((id): id is string => Boolean(id))
        : [],
    failureSummary: issue?.summary ?? null,
  };
}
