import { isPreviewEnvironment } from '@/lib/environments/model';
import { getMigrationPhaseLabel } from '@/lib/migrations/presentation';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import type { ReleaseTimelineItem, ReleaseViewLike } from '@/lib/releases/release-view-shared';
import {
  getDeploymentStatusDecoration,
  getMigrationStatusDecoration,
  getTimelineTone,
} from '@/lib/releases/status-presentation';
import { formatPlatformTimeContext } from '@/lib/time/format';

function formatTimelineTimestamp(value?: Date | string | null): string | null {
  return formatPlatformTimeContext(value);
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
    at: formatTimelineTimestamp(release.createdAt),
    title: '发布已创建',
    description: getReleaseDisplayTitle(release),
    tone: 'neutral',
    href: releaseHref,
    sortValue: release.createdAt ? new Date(release.createdAt).getTime() : 0,
  });

  if (release.sourceRelease) {
    items.push({
      key: `source-release-${release.sourceRelease.id}`,
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
      at: formatTimelineTimestamp(run.createdAt),
      title: `迁移${getMigrationStatusDecoration(run.status).label ?? run.status}`,
      description: `${run.service?.name ?? '服务'} · ${run.database?.name ?? '数据库'} · ${getMigrationPhaseLabel(
        run.specification?.phase ?? 'manual'
      )}`,
      tone: getTimelineTone(run.status, 'migration'),
      href: releaseHref,
      sortValue: run.createdAt ? new Date(run.createdAt).getTime() : 0,
    });
  }

  for (const deployment of release.deployments) {
    const serviceName =
      release.artifacts.find((artifact) => artifact.service.id === deployment.serviceId)?.service
        .name ?? '服务';

    items.push({
      key: `deployment-${deployment.id ?? `${deployment.serviceId ?? 'service'}-${deployment.status}`}`,
      at: formatTimelineTimestamp(deployment.createdAt),
      title: `部署${getDeploymentStatusDecoration(deployment.status).label ?? deployment.status}`,
      description: serviceName,
      tone: getTimelineTone(deployment.status, 'deployment'),
      href: releaseHref,
      sortValue: deployment.createdAt ? new Date(deployment.createdAt).getTime() : 0,
    });
  }

  if (
    release.environment?.deploymentStrategy &&
    release.environment.deploymentStrategy !== 'rolling' &&
    release.deployments.some(
      (deployment) =>
        deployment.status === 'awaiting_rollout' || deployment.status === 'verification_failed'
    )
  ) {
    items.push({
      key: 'rollout-ready',
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
      at: formatTimelineTimestamp(release.updatedAt),
      title: `发布${input.statusLabel}`,
      description: release.errorMessage ?? getReleaseDisplayTitle(release),
      tone: getTimelineTone(release.status, 'release'),
      href: releaseHref,
      sortValue: release.updatedAt ? new Date(release.updatedAt).getTime() : 0,
    });
  }

  for (const incident of release.infrastructureDiagnostics?.incidents ?? []) {
    items.push({
      key: incident.key,
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
