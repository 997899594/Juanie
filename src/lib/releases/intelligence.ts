export type ReleaseRiskLevel = 'low' | 'medium' | 'high';
export type ReleaseIssueCode =
  | 'approval_blocked'
  | 'migration_failed'
  | 'migration_canceled'
  | 'deployment_failed'
  | 'preview_expired'
  | 'degraded'
  | 'release_failed';
export type ReleaseIssueKind = 'approval' | 'migration' | 'deployment' | 'environment' | 'release';

interface ReleaseLike {
  status: string;
  errorMessage?: string | null;
  environment?: {
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    expiresAt?: Date | string | null;
  } | null;
  deployments?: Array<{
    status: string;
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
  environment?: {
    isPreview?: boolean | null;
    expiresAt?: Date | string | null;
  } | null;
}

export interface DatabaseManualControlInput {
  latestMigration?: {
    status: string;
    releaseId?: string | null;
  } | null;
  hasLatestRelease: boolean;
  hasLatestImage: boolean;
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
    (deployment) => deployment.status === 'failed'
  );
  if (failedDeployment) {
    return '部署执行失败';
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
  const isPreview = release.environment?.isPreview === true;
  const previewExpiryState = isPreview
    ? getPreviewExpiryState(release.environment?.expiresAt)
    : null;

  if (release.migrationRuns?.some((run) => run.status === 'awaiting_approval')) {
    return 'approval_blocked';
  }

  if (release.migrationRuns?.some((run) => run.status === 'failed')) {
    return 'migration_failed';
  }

  if (release.migrationRuns?.some((run) => run.status === 'canceled')) {
    return 'migration_canceled';
  }

  if (release.deployments?.some((deployment) => deployment.status === 'failed')) {
    return 'deployment_failed';
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

  if (run.status === 'failed') {
    return 'migration_failed';
  }

  if (run.status === 'canceled') {
    return 'migration_canceled';
  }

  const isPreview = run.environment?.isPreview === true;
  const previewExpiryState = isPreview ? getPreviewExpiryState(run.environment?.expiresAt) : null;

  if (previewExpiryState === 'expired') {
    return 'preview_expired';
  }

  return null;
}

export function getIssueLabel(issueCode: ReleaseIssueCode | null): string | null {
  switch (issueCode) {
    case 'approval_blocked':
      return '审批阻塞';
    case 'migration_failed':
      return '迁移失败';
    case 'migration_canceled':
      return '迁移取消';
    case 'deployment_failed':
      return '部署失败';
    case 'preview_expired':
      return '预览已过期';
    case 'degraded':
      return '发布降级';
    case 'release_failed':
      return '发布失败';
    default:
      return null;
  }
}

export function getReleaseActionLabel(issueCode: ReleaseIssueCode | null): string | null {
  switch (issueCode) {
    case 'approval_blocked':
      return '处理迁移审批';
    case 'migration_failed':
    case 'migration_canceled':
      return '检查迁移并重试';
    case 'deployment_failed':
      return '检查部署日志';
    case 'preview_expired':
      return '重新创建预览环境';
    case 'degraded':
      return '检查后置迁移';
    case 'release_failed':
      return '检查发布日志';
    default:
      return null;
  }
}

export function getIssueKind(issueCode: ReleaseIssueCode | null): ReleaseIssueKind | null {
  switch (issueCode) {
    case 'approval_blocked':
      return 'approval';
    case 'migration_failed':
    case 'migration_canceled':
      return 'migration';
    case 'deployment_failed':
      return 'deployment';
    case 'preview_expired':
      return 'environment';
    case 'degraded':
    case 'release_failed':
      return 'release';
    default:
      return null;
  }
}

export function getIssueSummary(issueCode: ReleaseIssueCode | null): string | null {
  switch (issueCode) {
    case 'approval_blocked':
      return '发布被待审批迁移阻塞';
    case 'migration_failed':
      return '发布被失败迁移阻塞';
    case 'migration_canceled':
      return '发布被取消迁移中断';
    case 'deployment_failed':
      return '发布被失败部署中断';
    case 'preview_expired':
      return '预览环境已经过期';
    case 'degraded':
      return '发布已完成但处于降级状态';
    case 'release_failed':
      return '发布流程执行失败';
    default:
      return null;
  }
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

  if (!input.hasLatestImage) {
    return {
      issueCode: null,
      issueLabel: null,
      actionLabel: input.hasLatestRelease ? '补齐镜像来源' : '先创建 release',
      reason: '命令式迁移依赖最近一次可用 release 镜像；当前没有可用镜像。',
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

  const isProduction = release.environment?.isProduction === true;
  const isPreview = release.environment?.isPreview === true;
  const previewExpiryState = isPreview
    ? getPreviewExpiryState(release.environment?.expiresAt)
    : null;
  const hasApproval = release.migrationRuns?.some((run) => run.status === 'awaiting_approval');
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
    (deployment) => deployment.status === 'failed'
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

  if (hasManualProdGate && riskLevel !== 'high') {
    riskLevel = 'medium';
    reasons.push('生产迁移需要人工审批');
  }

  if (release.status === 'degraded' && riskLevel === 'low') {
    riskLevel = 'medium';
    reasons.push('发布处于降级状态');
  }

  if (['migration_pre_failed', 'failed'].includes(release.status)) {
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
