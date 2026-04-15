import {
  type EnvironmentKindLike,
  isPreviewEnvironment,
  isProductionEnvironment,
} from '@/lib/environments/model';

export type ReleaseRiskLevel = 'low' | 'medium' | 'high';
export type ReleaseIssueCode =
  | 'approval_blocked'
  | 'external_completion_blocked'
  | 'migration_failed'
  | 'migration_canceled'
  | 'release_canceled'
  | 'deployment_failed'
  | 'verification_failed'
  | 'rollout_pending'
  | 'preview_expired'
  | 'degraded'
  | 'release_failed';
export type ReleaseIssueKind = 'approval' | 'migration' | 'deployment' | 'environment' | 'release';

interface ReleaseLike {
  status: string;
  errorMessage?: string | null;
  environment?: (EnvironmentKindLike & { expiresAt?: Date | string | null }) | null;
  deployments?: Array<{
    status: string;
    errorMessage?: string | null;
  }>;
  migrationRuns?: Array<{
    status: string;
    specification?: {
      compatibility?: string | null;
      approvalPolicy?: string | null;
    } | null;
  }>;
}

export interface MigrationAttentionLike {
  status: string;
  environment?: (EnvironmentKindLike & { expiresAt?: Date | string | null }) | null;
}

export interface DatabaseManualControlInput {
  latestMigration?: {
    status: string;
    releaseId?: string | null;
  } | null;
  hasLatestRelease: boolean;
  hasLatestImage: boolean;
  executionMode?: 'automatic' | 'manual_platform' | 'external' | null;
  planBlockingReason?: string | null;
}

export interface DatabaseManualControlSnapshot {
  issueCode: ReleaseIssueCode | null;
  issueLabel: string | null;
  actionLabel: string | null;
  reason: string;
}

export interface ReleaseIssueSnapshot {
  code: ReleaseIssueCode;
  kind: ReleaseIssueKind;
  label: string;
  summary: string;
  nextActionLabel: string;
}

export interface ReleaseIntelligenceSnapshot {
  riskLevel: ReleaseRiskLevel;
  reasons: string[];
  failureSummary: string | null;
  issueCode: ReleaseIssueCode | null;
  actionLabel: string | null;
  issue: ReleaseIssueSnapshot | null;
}

function uniqueReasons(reasons: string[]): string[] {
  return [...new Set(reasons)];
}

function isSupersededMessage(message?: string | null): boolean {
  return message?.includes('Superseded by deployment') ?? false;
}

function getCanceledReleaseMessage(release: ReleaseLike): string | null {
  const canceledDeployment = release.deployments?.find(
    (deployment) => deployment.status === 'canceled'
  );
  const canceledMessage = canceledDeployment?.errorMessage ?? release.errorMessage ?? null;

  if (!canceledDeployment && release.status !== 'canceled') {
    return null;
  }

  if (isSupersededMessage(canceledMessage)) {
    return '发布已被更新版本接管';
  }

  return '发布已取消';
}

const releaseIssueConfig: Record<
  ReleaseIssueCode,
  {
    kind: ReleaseIssueKind;
    label: string;
    summary: string;
    nextActionLabel: string;
  }
> = {
  approval_blocked: {
    kind: 'approval',
    label: '审批阻塞',
    summary: '发布被待审批迁移阻塞',
    nextActionLabel: '处理迁移审批',
  },
  external_completion_blocked: {
    kind: 'migration',
    label: '外部迁移阻塞',
    summary: '发布正在等待外部迁移完成确认',
    nextActionLabel: '标记外部迁移结果',
  },
  migration_failed: {
    kind: 'migration',
    label: '迁移失败',
    summary: '发布被失败迁移阻塞',
    nextActionLabel: '检查迁移并重试',
  },
  migration_canceled: {
    kind: 'migration',
    label: '迁移取消',
    summary: '发布被取消迁移中断',
    nextActionLabel: '检查迁移并重试',
  },
  release_canceled: {
    kind: 'release',
    label: '发布取消',
    summary: '当前发布已被取消，通常是因为同环境有更新版本接管',
    nextActionLabel: '查看最新 release',
  },
  deployment_failed: {
    kind: 'deployment',
    label: '部署失败',
    summary: '发布被失败部署中断',
    nextActionLabel: '检查部署日志',
  },
  verification_failed: {
    kind: 'deployment',
    label: '校验失败',
    summary: '发布被校验失败阻断',
    nextActionLabel: '检查校验与运行时日志',
  },
  rollout_pending: {
    kind: 'release',
    label: '待放量',
    summary: '候选版本已就绪，等待完成放量',
    nextActionLabel: '完成放量',
  },
  preview_expired: {
    kind: 'environment',
    label: '预览已过期',
    summary: '预览环境已经过期',
    nextActionLabel: '重新创建预览环境',
  },
  degraded: {
    kind: 'release',
    label: '发布降级',
    summary: '发布已完成但处于降级状态',
    nextActionLabel: '检查后置迁移',
  },
  release_failed: {
    kind: 'release',
    label: '发布失败',
    summary: '发布流程执行失败',
    nextActionLabel: '检查发布日志',
  },
};

function getPreviewExpiryState(expiresAt?: Date | string | null): 'expired' | 'soon' | 'active' {
  if (!expiresAt) {
    return 'active';
  }

  const target = new Date(expiresAt);
  if (Number.isNaN(target.getTime())) {
    return 'active';
  }

  const diff = target.getTime() - Date.now();
  if (diff <= 0) {
    return 'expired';
  }

  if (diff <= 24 * 60 * 60 * 1000) {
    return 'soon';
  }

  return 'active';
}

export function getReleaseFailureSummary(release: ReleaseLike): string | null {
  const canceledReleaseMessage = getCanceledReleaseMessage(release);
  if (canceledReleaseMessage) {
    return canceledReleaseMessage;
  }

  if (release.errorMessage) {
    return release.errorMessage;
  }

  const failedMigration = release.migrationRuns?.find((run) => run.status === 'failed');
  if (failedMigration) {
    return '迁移执行失败';
  }

  const canceledMigration = release.migrationRuns?.find((run) => run.status === 'canceled');
  if (canceledMigration) {
    return '迁移被取消';
  }

  const failedDeployment = release.deployments?.find(
    (deployment) => deployment.status === 'failed' || deployment.status === 'verification_failed'
  );
  if (failedDeployment) {
    return failedDeployment.status === 'verification_failed' ? '部署校验失败' : '部署执行失败';
  }

  if (release.status === 'awaiting_rollout') {
    return '发布等待放量完成';
  }

  if (release.status === 'awaiting_approval') {
    return '发布等待迁移审批';
  }

  if (release.status === 'awaiting_external_completion') {
    return '发布等待外部迁移完成';
  }

  const externalMigration = release.migrationRuns?.find(
    (run) => run.status === 'awaiting_external_completion'
  );
  if (externalMigration) {
    return '迁移等待外部完成确认';
  }

  if (release.status === 'verification_failed') {
    return '发布校验失败';
  }

  if (release.status === 'migration_pre_failed') {
    return '前置迁移失败';
  }

  if (release.status === 'failed') {
    return '发布失败';
  }

  if (release.status === 'degraded') {
    return '发布降级';
  }

  return null;
}

export function getReleaseIssueCode(release: ReleaseLike): ReleaseIssueCode | null {
  const isPreview = release.environment ? isPreviewEnvironment(release.environment) : false;
  const previewExpiryState = isPreview
    ? getPreviewExpiryState(release.environment?.expiresAt)
    : null;

  if (release.status === 'awaiting_approval') {
    return 'approval_blocked';
  }

  if (release.status === 'awaiting_external_completion') {
    return 'external_completion_blocked';
  }

  if (release.migrationRuns?.some((run) => run.status === 'awaiting_approval')) {
    return 'approval_blocked';
  }

  if (release.migrationRuns?.some((run) => run.status === 'awaiting_external_completion')) {
    return 'external_completion_blocked';
  }

  if (release.migrationRuns?.some((run) => run.status === 'failed')) {
    return 'migration_failed';
  }

  if (release.migrationRuns?.some((run) => run.status === 'canceled')) {
    return 'migration_canceled';
  }

  if (
    release.status === 'canceled' ||
    release.deployments?.some((deployment) => deployment.status === 'canceled')
  ) {
    return 'release_canceled';
  }

  if (release.deployments?.some((deployment) => deployment.status === 'failed')) {
    return 'deployment_failed';
  }

  if (
    release.deployments?.some((deployment) => deployment.status === 'verification_failed') ||
    release.status === 'verification_failed'
  ) {
    return 'verification_failed';
  }

  if (
    release.deployments?.some((deployment) => deployment.status === 'awaiting_rollout') ||
    release.status === 'awaiting_rollout'
  ) {
    return 'rollout_pending';
  }

  if (previewExpiryState === 'expired') {
    return 'preview_expired';
  }

  if (release.status === 'degraded') {
    return 'degraded';
  }

  if (['migration_pre_failed', 'failed'].includes(release.status)) {
    return 'release_failed';
  }

  return null;
}

export function getMigrationAttentionIssueCode(
  run: MigrationAttentionLike
): ReleaseIssueCode | null {
  if (run.status === 'awaiting_approval') {
    return 'approval_blocked';
  }

  if (run.status === 'awaiting_external_completion') {
    return 'external_completion_blocked';
  }

  if (run.status === 'failed') {
    return 'migration_failed';
  }

  if (run.status === 'canceled') {
    return 'migration_canceled';
  }

  const isPreview = run.environment ? isPreviewEnvironment(run.environment) : false;
  const previewExpiryState = isPreview ? getPreviewExpiryState(run.environment?.expiresAt) : null;

  if (previewExpiryState === 'expired') {
    return 'preview_expired';
  }

  return null;
}

export function getIssueLabel(issueCode: ReleaseIssueCode | null): string | null {
  return issueCode ? (releaseIssueConfig[issueCode]?.label ?? null) : null;
}

export function getReleaseActionLabel(issueCode: ReleaseIssueCode | null): string | null {
  return issueCode ? (releaseIssueConfig[issueCode]?.nextActionLabel ?? null) : null;
}

export function getIssueKind(issueCode: ReleaseIssueCode | null): ReleaseIssueKind | null {
  return issueCode ? (releaseIssueConfig[issueCode]?.kind ?? null) : null;
}

export function getIssueSummary(issueCode: ReleaseIssueCode | null): string | null {
  return issueCode ? (releaseIssueConfig[issueCode]?.summary ?? null) : null;
}

export function buildIssueSnapshot(
  issueCode: ReleaseIssueCode | null
): ReleaseIssueSnapshot | null {
  if (!issueCode) {
    return null;
  }

  const kind = getIssueKind(issueCode);
  const label = getIssueLabel(issueCode);
  const summary = getIssueSummary(issueCode);
  const nextActionLabel = getReleaseActionLabel(issueCode);

  if (!kind || !label || !summary || !nextActionLabel) {
    return null;
  }

  return {
    code: issueCode,
    kind,
    label,
    summary,
    nextActionLabel,
  };
}

export function getDatabaseManualControlSnapshot(
  input: DatabaseManualControlInput
): DatabaseManualControlSnapshot {
  const issueCode = input.latestMigration
    ? getMigrationAttentionIssueCode({ status: input.latestMigration.status })
    : null;

  if (input.latestMigration?.status === 'failed') {
    return {
      issueCode,
      issueLabel: getIssueLabel(issueCode),
      actionLabel: input.latestMigration.releaseId ? '去 release 重试' : '人工重试',
      reason: '最近一次迁移失败，这里适合人工重试和排障。',
    };
  }

  if (input.latestMigration?.status === 'awaiting_approval') {
    return {
      issueCode,
      issueLabel: getIssueLabel(issueCode),
      actionLabel: input.latestMigration.releaseId ? '去 release 审批' : '人工审批',
      reason: input.latestMigration.releaseId
        ? '最近一次迁移正在等待审批；常规处理应回到关联 release。'
        : '最近一次迁移正在等待审批；这里只适合应急人工执行。',
    };
  }

  if (input.latestMigration?.status === 'awaiting_external_completion') {
    return {
      issueCode,
      issueLabel: getIssueLabel(issueCode),
      actionLabel: input.latestMigration.releaseId ? '去 release 标记结果' : '标记外部结果',
      reason: input.latestMigration.releaseId
        ? '最近一次迁移正在等待外部完成确认；常规处理应回到关联 release。'
        : '最近一次迁移正在等待外部完成确认；需要人工标记成功或失败。',
    };
  }

  if (input.latestMigration?.status === 'canceled') {
    return {
      issueCode,
      issueLabel: getIssueLabel(issueCode),
      actionLabel: input.latestMigration.releaseId ? '去 release 重试' : '人工重试',
      reason: '最近一次迁移已取消，这里适合重新确认后再人工执行。',
    };
  }

  if (input.planBlockingReason) {
    return {
      issueCode: null,
      issueLabel: null,
      actionLabel: null,
      reason: '当前计划存在阻断条件，手动入口仅用于查看原因和后续介入。',
    };
  }

  if (input.executionMode !== 'external' && !input.hasLatestImage) {
    return {
      issueCode: null,
      issueLabel: null,
      actionLabel: input.hasLatestRelease ? '补齐镜像来源' : '先创建 release',
      reason: '命令式迁移依赖最近一次可用 release 镜像；当前没有可用镜像。',
    };
  }

  if (input.executionMode === 'external') {
    return {
      issueCode: null,
      issueLabel: null,
      actionLabel: input.hasLatestRelease ? '登记外部结果' : '创建外部门禁',
      reason: '当前迁移由外部系统执行，Juanie 只负责追踪门禁状态和恢复 release。',
    };
  }

  if (input.hasLatestRelease) {
    return {
      issueCode: null,
      issueLabel: null,
      actionLabel: '优先走 release',
      reason: '常规迁移应跟随 release 执行；这里用于人工介入、重试和紧急处理。',
    };
  }

  return {
    issueCode: null,
    issueLabel: null,
    actionLabel: '手动执行',
    reason: '当前没有关联 release，手动迁移会直接走控制面队列。',
  };
}

export function getReleaseIntelligenceSnapshot(release: ReleaseLike): ReleaseIntelligenceSnapshot {
  const reasons: string[] = [];
  let riskLevel: ReleaseRiskLevel = 'low';

  const isProduction = release.environment ? isProductionEnvironment(release.environment) : false;
  const isPreview = release.environment ? isPreviewEnvironment(release.environment) : false;
  const previewExpiryState = isPreview
    ? getPreviewExpiryState(release.environment?.expiresAt)
    : null;
  const hasApproval =
    release.status === 'awaiting_approval' ||
    release.migrationRuns?.some((run) => run.status === 'awaiting_approval');
  const hasExternalCompletion =
    release.status === 'awaiting_external_completion' ||
    release.migrationRuns?.some((run) => run.status === 'awaiting_external_completion');
  const hasFailedMigration = release.migrationRuns?.some((run) =>
    ['failed', 'canceled'].includes(run.status)
  );
  const hasBreakingMigration = release.migrationRuns?.some(
    (run) => run.specification?.compatibility === 'breaking'
  );
  const hasManualProdGate = release.migrationRuns?.some(
    (run) => run.specification?.approvalPolicy === 'manual_in_production' && isProduction
  );
  const hasFailedDeployment = release.deployments?.some(
    (deployment) => deployment.status === 'failed' || deployment.status === 'verification_failed'
  );
  const hasCanceledRelease =
    release.status === 'canceled' ||
    release.deployments?.some((deployment) => deployment.status === 'canceled');
  const hasAwaitingRollout = release.deployments?.some(
    (deployment) => deployment.status === 'awaiting_rollout'
  );

  if (isProduction) {
    riskLevel = 'medium';
    reasons.push('生产环境发布');
  }

  if (isPreview) {
    reasons.push('预览环境发布');
  }

  if (previewExpiryState === 'soon' && riskLevel === 'low') {
    riskLevel = 'medium';
    reasons.push('预览环境即将过期');
  }

  if (previewExpiryState === 'expired') {
    if (riskLevel === 'low') {
      riskLevel = 'medium';
    }
    reasons.push('预览环境已过期');
  }

  if (hasApproval) {
    riskLevel = 'high';
    reasons.push('存在待审批迁移');
  }

  if (hasExternalCompletion) {
    riskLevel = 'high';
    reasons.push('存在待外部完成迁移');
  }

  if (hasFailedMigration) {
    riskLevel = 'high';
    reasons.push('存在失败或取消的迁移');
  }

  if (hasBreakingMigration) {
    riskLevel = 'high';
    reasons.push('包含破坏性迁移');
  }

  if (hasFailedDeployment) {
    riskLevel = 'high';
    reasons.push('存在失败部署');
  }

  if (hasCanceledRelease) {
    reasons.push('有发布被更新版本接管');
  }

  if (hasAwaitingRollout && riskLevel !== 'high') {
    riskLevel = 'medium';
    reasons.push('存在待完成放量的候选版本');
  }

  if (hasManualProdGate && riskLevel !== 'high') {
    riskLevel = 'medium';
    reasons.push('生产迁移需要人工审批');
  }

  if (release.status === 'degraded' && riskLevel === 'low') {
    riskLevel = 'medium';
    reasons.push('发布处于降级状态');
  }

  if (['migration_pre_failed', 'failed', 'verification_failed'].includes(release.status)) {
    riskLevel = 'high';
  }

  const issueCode = getReleaseIssueCode(release);
  const issue = buildIssueSnapshot(issueCode);

  return {
    riskLevel,
    reasons: uniqueReasons(reasons),
    failureSummary: getReleaseFailureSummary(release),
    issueCode,
    actionLabel: issue?.nextActionLabel ?? null,
    issue,
  };
}
