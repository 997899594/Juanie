import { isPreviewEnvironment } from '@/lib/environments/model';
import { getMigrationPhaseLabel } from '@/lib/migrations/presentation';
import { getMigrationReleaseStageLabel } from '@/lib/migrations/release-graph';
import { getDeployableReleaseArtifacts } from '@/lib/releases/artifacts';
import { resolveReleaseLifecycle } from '@/lib/releases/lifecycle';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import type { ReleaseTimelineItem, ReleaseViewLike } from '@/lib/releases/release-view-shared';
import {
  getDeploymentStatusDecoration,
  getMigrationStatusDecoration,
  getReleaseStatusDecoration,
  getTimelineTone,
} from '@/lib/releases/status-presentation';
import { formatPlatformRelativeTime } from '@/lib/time/format';

function formatTimelineTimestamp(value?: Date | string | null): string | null {
  return formatPlatformRelativeTime(value);
}

function getReleaseTimelineTitle(status: string): string {
  const titles: Record<string, string> = {
    admission_running: '发布准入检查',
    admission_failed: '发布准入失败',
    queued: '发布排队',
    planning: '规划发布',
    migration_pre_running: '前置迁移中',
    awaiting_approval: '等待审批',
    awaiting_external_completion: '等待外部完成',
    migration_pre_failed: '前置迁移失败',
    deploying: '发布进行中',
    awaiting_rollout: '等待放量',
    verifying: '发布校验中',
    verification_failed: '校验失败',
    migration_post_running: '后置迁移中',
    degraded: '发布降级',
    succeeded: '发布完成',
    failed: '发布失败',
    canceled: '发布取消',
  };

  return titles[status] ?? `发布${getReleaseStatusDecoration(status).label}`;
}

function getMigrationTimelineTitle(status: string): string {
  const titles: Record<string, string> = {
    queued: '迁移排队',
    awaiting_approval: '迁移待审批',
    awaiting_external_completion: '迁移待外部完成',
    planning: '规划迁移',
    running: '迁移执行中',
    success: '迁移完成',
    failed: '迁移失败',
    canceled: '迁移取消',
    skipped: '迁移跳过',
  };

  return titles[status] ?? `迁移${getMigrationStatusDecoration(status).label ?? status}`;
}

function getDeploymentTimelineTitle(status: string, serviceName: string): string {
  const titles: Record<string, string> = {
    queued: `${serviceName} 排队`,
    building: `${serviceName} 构建中`,
    deploying: `${serviceName} 部署中`,
    awaiting_rollout: `${serviceName} 待放量`,
    verification_failed: `${serviceName} 校验失败`,
    running: `${serviceName} 运行中`,
    canceled: `${serviceName} 取消`,
    failed: `${serviceName} 失败`,
    rolled_back: `${serviceName} 已回滚`,
  };

  return titles[status] ?? `${serviceName} ${getDeploymentStatusDecoration(status).label}`;
}

function buildMigrationRetryTimelineItems(
  release: ReleaseViewLike,
  releaseHref: string | null
): Array<ReleaseTimelineItem & { sortValue: number }> {
  const items: Array<ReleaseTimelineItem & { sortValue: number }> = [];
  const historyByTarget = new Map<string, ReleaseViewLike['migrationRuns']>();
  const orderedRuns = [...release.migrationRuns].sort((left, right) => {
    const leftAt = left.createdAt ? new Date(left.createdAt).getTime() : 0;
    const rightAt = right.createdAt ? new Date(right.createdAt).getTime() : 0;
    return leftAt - rightAt;
  });

  for (const run of orderedRuns) {
    const targetKey = [
      run.serviceId ?? run.service?.id ?? 'service',
      run.databaseId ?? run.database?.id ?? 'database',
      run.specification?.phase ?? 'manual',
      run.specification?.command ?? 'command',
    ].join(':');
    const history = historyByTarget.get(targetKey) ?? [];

    if (history.length > 0) {
      const priorFailed = history.some((candidate) =>
        ['failed', 'canceled'].includes(candidate.status)
      );
      const attemptNumber = history.length + 1;

      items.push({
        key: `migration-retry-${run.id ?? `${targetKey}-${attemptNumber}`}`,
        type: 'migration',
        at: formatTimelineTimestamp(run.createdAt),
        title: priorFailed ? '迁移已重试' : '迁移再次执行',
        description: `${run.service?.name ?? '服务'} · ${run.database?.name ?? '数据库'} · 第 ${attemptNumber} 次尝试`,
        tone: priorFailed ? 'info' : 'neutral',
        href: releaseHref,
        sortValue: run.createdAt ? new Date(run.createdAt).getTime() : 0,
      });
    }

    history.push(run);
    historyByTarget.set(targetKey, history);
  }

  return items;
}

export function buildReleaseTimeline(input: {
  release: ReleaseViewLike;
  statusLabel: string;
  primaryDomainUrl: string | null;
  environmentStrategy: string | null;
}): ReleaseTimelineItem[] {
  const { release } = input;
  const lifecycle = resolveReleaseLifecycle(release);
  const releaseEnvironmentId = release.environment?.id ?? null;
  const releaseHref =
    release.projectId && releaseEnvironmentId
      ? buildReleaseDetailPath(release.projectId, releaseEnvironmentId, release.id)
      : null;
  const items: Array<ReleaseTimelineItem & { sortValue: number }> = [
    ...buildMigrationRetryTimelineItems(release, releaseHref),
  ];

  items.push({
    key: 'release-created',
    type: 'release',
    at: formatTimelineTimestamp(release.createdAt),
    title: '创建发布',
    description: getReleaseDisplayTitle(release),
    tone: 'neutral',
    href: releaseHref,
    sortValue: release.createdAt ? new Date(release.createdAt).getTime() : 0,
  });

  if (release.sourceRelease) {
    items.push({
      key: `source-release-${release.sourceRelease.id}`,
      type: 'release',
      at: formatTimelineTimestamp(release.createdAt),
      title: '复用来源发布',
      description: [
        release.sourceRelease.environment?.name ?? '来源环境',
        getReleaseDisplayTitle(release.sourceRelease),
      ]
        .filter(Boolean)
        .join(' · '),
      tone: 'info',
      href:
        release.projectId && release.sourceRelease.environment?.id
          ? buildReleaseDetailPath(
              release.projectId,
              release.sourceRelease.environment.id,
              release.sourceRelease.id
            )
          : null,
      sortValue: release.createdAt ? new Date(release.createdAt).getTime() : 0,
    });
  }

  for (const run of release.migrationRuns) {
    items.push({
      key: `migration-${run.id ?? `${run.serviceId ?? 'service'}-${run.status}`}`,
      type: 'migration',
      at: formatTimelineTimestamp(run.createdAt),
      title: getMigrationTimelineTitle(run.status),
      description: `${run.service?.name ?? '服务'} · ${run.database?.name ?? '数据库'} · ${
        (run.releaseStage ?? run.specification?.releaseStage) &&
        (run.releaseStage ?? run.specification?.releaseStage) !== 'standard'
          ? getMigrationReleaseStageLabel(run.releaseStage ?? run.specification?.releaseStage)
          : getMigrationPhaseLabel(run.specification?.phase ?? 'manual')
      }${run.targetVersion ? ` · ${run.targetVersion}` : ''}`,
      tone: getTimelineTone(run.status, 'migration'),
      href: releaseHref,
      sortValue: run.createdAt ? new Date(run.createdAt).getTime() : 0,
    });
  }

  for (const deployment of release.deployments) {
    const serviceName =
      getDeployableReleaseArtifacts(release.artifacts).find(
        (artifact) => artifact.service?.id === deployment.serviceId
      )?.service?.name ?? '服务';

    items.push({
      key: `deployment-${deployment.id ?? `${deployment.serviceId ?? 'service'}-${deployment.status}`}`,
      type: 'deployment',
      at: formatTimelineTimestamp(deployment.createdAt),
      title: getDeploymentTimelineTitle(deployment.status, serviceName),
      description: '服务部署',
      tone: getTimelineTone(deployment.status, 'deployment'),
      href: releaseHref,
      sortValue: deployment.createdAt ? new Date(deployment.createdAt).getTime() : 0,
    });
  }

  if (
    release.environment?.deploymentStrategy &&
    release.environment.deploymentStrategy !== 'rolling' &&
    lifecycle.canAcceptRolloutActions
  ) {
    items.push({
      key: 'rollout-ready',
      type: 'deployment',
      at: null,
      title: '渐进式发布待推进',
      description: input.environmentStrategy
        ? `${input.environmentStrategy} 已启用，可继续完成放量或切换`
        : '当前发布可继续推进 rollout',
      tone: 'warning',
      href: releaseHref,
      sortValue: release.updatedAt ? new Date(release.updatedAt).getTime() : 0,
    });
  }

  if (
    release.environment &&
    isPreviewEnvironment(release.environment) &&
    input.primaryDomainUrl &&
    ['succeeded', 'degraded'].includes(release.status)
  ) {
    items.push({
      key: 'preview-ready',
      type: 'deployment',
      at: null,
      title: '预览环境可访问',
      description: input.primaryDomainUrl.replace('https://', ''),
      tone: 'success',
      href: input.primaryDomainUrl,
      sortValue: release.updatedAt ? new Date(release.updatedAt).getTime() : 0,
    });
  }

  if (release.status !== 'queued') {
    items.push({
      key: 'release-result',
      type: 'release',
      at: formatTimelineTimestamp(release.updatedAt),
      title: getReleaseTimelineTitle(release.status),
      description: release.errorMessage ?? getReleaseDisplayTitle(release),
      tone: getTimelineTone(release.status, 'release'),
      href: releaseHref,
      sortValue: release.updatedAt ? new Date(release.updatedAt).getTime() : 0,
    });
  }

  for (const incident of release.infrastructureDiagnostics?.incidents ?? []) {
    items.push({
      key: incident.key,
      type: 'incident',
      at: formatTimelineTimestamp(incident.at),
      title: incident.title,
      description: incident.description,
      tone: incident.tone,
      href: releaseHref,
      sortValue: incident.timestamp ? new Date(incident.timestamp).getTime() : 0,
    });
  }

  for (const event of release.governanceEvents ?? []) {
    items.push({
      key: event.key,
      type: 'governance',
      at: formatTimelineTimestamp(event.at),
      title: event.title,
      description: event.description,
      tone: event.tone,
      href: releaseHref,
      sortValue: event.at ? new Date(event.at).getTime() : 0,
    });
  }

  return items.sort((a, b) => a.sortValue - b.sortValue).map(({ sortValue, ...item }) => item);
}
