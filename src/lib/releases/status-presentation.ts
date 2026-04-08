export interface ReleaseStatusDecoration {
  color: 'success' | 'warning' | 'error' | 'info' | 'neutral';
  pulse: boolean;
  label: string;
}

export type ReleaseTimelineTone = 'danger' | 'warning' | 'info' | 'success' | 'neutral';

export const releaseStatusDecorations: Record<string, ReleaseStatusDecoration> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  planning: { color: 'info', pulse: true, label: '规划中' },
  migration_pre_running: { color: 'warning', pulse: true, label: '前置迁移' },
  awaiting_approval: { color: 'warning', pulse: false, label: '待审批' },
  migration_pre_failed: { color: 'error', pulse: false, label: '前置迁移失败' },
  deploying: { color: 'info', pulse: true, label: '发布中' },
  awaiting_rollout: { color: 'warning', pulse: false, label: '待放量' },
  verifying: { color: 'info', pulse: true, label: '校验中' },
  verification_failed: { color: 'error', pulse: false, label: '校验失败' },
  migration_post_running: { color: 'warning', pulse: true, label: '后置迁移' },
  degraded: { color: 'warning', pulse: false, label: '降级' },
  succeeded: { color: 'success', pulse: false, label: '成功' },
  failed: { color: 'error', pulse: false, label: '失败' },
  canceled: { color: 'neutral', pulse: false, label: '已取消' },
};

export const deploymentStatusDecorations: Record<string, ReleaseStatusDecoration> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  building: { color: 'info', pulse: true, label: '构建中' },
  deploying: { color: 'info', pulse: true, label: '发布中' },
  awaiting_rollout: { color: 'warning', pulse: false, label: '待放量' },
  verification_failed: { color: 'error', pulse: false, label: '校验失败' },
  running: { color: 'success', pulse: false, label: '运行中' },
  canceled: { color: 'neutral', pulse: false, label: '已取消' },
  failed: { color: 'error', pulse: false, label: '失败' },
  rolled_back: { color: 'warning', pulse: false, label: '已回滚' },
};

export const migrationStatusDecorations: Record<string, ReleaseStatusDecoration> = {
  queued: { color: 'neutral', pulse: false, label: '排队中' },
  awaiting_approval: { color: 'warning', pulse: false, label: '待审批' },
  planning: { color: 'info', pulse: true, label: '规划中' },
  running: { color: 'info', pulse: true, label: '执行中' },
  success: { color: 'success', pulse: false, label: '成功' },
  failed: { color: 'error', pulse: false, label: '失败' },
  canceled: { color: 'neutral', pulse: false, label: '已取消' },
  skipped: { color: 'neutral', pulse: false, label: '已跳过' },
};

export function getReleaseStatusDecoration(status: string): ReleaseStatusDecoration {
  return releaseStatusDecorations[status] ?? releaseStatusDecorations.queued;
}

export function getDeploymentStatusDecoration(status: string): ReleaseStatusDecoration {
  return deploymentStatusDecorations[status] ?? deploymentStatusDecorations.queued;
}

export function getMigrationStatusDecoration(status: string): ReleaseStatusDecoration {
  return migrationStatusDecorations[status] ?? migrationStatusDecorations.queued;
}

export function findReleaseStatusLabel(status: string): string | null {
  return releaseStatusDecorations[status]?.label ?? null;
}

export function findMigrationStatusLabel(status: string): string | null {
  return migrationStatusDecorations[status]?.label ?? null;
}

export function getReleaseStatusLabel(status: string): string {
  return findReleaseStatusLabel(status) ?? status;
}

export function getTimelineTone(
  status: string,
  kind: 'release' | 'migration' | 'deployment' | 'preview' | 'rollout'
): ReleaseTimelineTone {
  if (kind === 'preview') return 'success';
  if (status === 'failed' || status === 'migration_pre_failed' || status === 'verification_failed')
    return 'danger';
  if (status === 'awaiting_approval' || status === 'degraded' || status === 'awaiting_rollout')
    return 'warning';
  if (
    status === 'running' ||
    status === 'planning' ||
    status === 'deploying' ||
    status === 'verifying'
  )
    return 'info';
  if (status === 'success' || status === 'succeeded') return 'success';
  return 'neutral';
}

export function getStatusDotClass(
  status: string,
  kind: 'release' | 'deployment' | 'migration' = 'release'
): string {
  const decoration =
    kind === 'deployment'
      ? getDeploymentStatusDecoration(status)
      : kind === 'migration'
        ? getMigrationStatusDecoration(status)
        : getReleaseStatusDecoration(status);

  switch (decoration.color) {
    case 'success':
      return 'bg-success';
    case 'warning':
      return 'bg-warning';
    case 'error':
      return 'bg-destructive';
    case 'info':
      return 'bg-info';
    default:
      return 'bg-muted-foreground';
  }
}
