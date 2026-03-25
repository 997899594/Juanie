export type ReleaseRiskLevel = 'low' | 'medium' | 'high';
export type ReleaseIssueCode =
  | 'approval_blocked'
  | 'migration_failed'
  | 'migration_canceled'
  | 'deployment_failed'
  | 'preview_expired'
  | 'degraded'
  | 'release_failed';

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

export interface ReleaseIntelligenceSnapshot {
  riskLevel: ReleaseRiskLevel;
  reasons: string[];
  failureSummary: string | null;
  issueCode: ReleaseIssueCode | null;
  actionLabel: string | null;
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

  return {
    riskLevel,
    reasons: uniqueReasons(reasons),
    failureSummary: getReleaseFailureSummary(release),
    issueCode,
    actionLabel: getReleaseActionLabel(issueCode),
  };
}
