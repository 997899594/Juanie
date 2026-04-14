import { getMigrationPhaseLabel } from '@/lib/migrations/presentation';
import { buildReleaseDiff } from '@/lib/releases/diff';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { buildReleaseRecap } from '@/lib/releases/recap';
import type {
  ReleaseDetailDecorations,
  ReleaseDiffComparableLike,
  ReleaseTimelineItem,
  ReleaseViewLike,
} from '@/lib/releases/release-view-shared';
import {
  buildDeploymentItems,
  buildMigrationItems,
  buildReleasePresentationBase,
  buildReleaseSignalChips,
  countApprovalRuns,
  countFailedMigrationRuns,
  countRetryableRuns,
  getEnvironmentScopeLabelForRelease,
  getReleaseRiskLabel,
} from '@/lib/releases/release-view-shared';
import {
  getDeploymentStatusDecoration,
  getMigrationStatusDecoration,
  getReleaseStatusDecoration,
  getTimelineTone,
} from '@/lib/releases/status-presentation';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformDateTime, formatPlatformTimeContext } from '@/lib/time/format';

function formatReleaseMetadataValue(value?: Date | string | null): string {
  return formatPlatformDateTime(value) ?? '—';
}

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

function buildReleaseTimeline(input: {
  release: ReleaseViewLike;
  statusLabel: string;
  primaryDomainUrl: string | null;
  environmentStrategy: string | null;
}) {
  const { release } = input;
  const releaseHref = release.projectId
    ? `/projects/${release.projectId}/delivery/${release.id}`
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
    release.environment?.isPreview &&
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

export function decorateReleaseDetail<T extends ReleaseViewLike>(
  release: T,
  previousRelease: ReleaseDiffComparableLike | null
): T & ReleaseDetailDecorations {
  const diff = buildReleaseDiff(release, previousRelease);
  const approvalRunsCount = countApprovalRuns(release);
  const retryableRunsCount = countRetryableRuns(release);
  const failedMigrationRunsCount = countFailedMigrationRuns(release);
  const presentation = buildReleasePresentationBase(release);
  const effectiveIssue = release.infrastructureDiagnostics?.primaryIssue
    ? {
        code: release.infrastructureDiagnostics.primaryIssue.code,
        kind: 'release' as const,
        label: release.infrastructureDiagnostics.primaryIssue.label,
        summary: release.infrastructureDiagnostics.primaryIssue.summary,
        nextActionLabel: release.infrastructureDiagnostics.primaryIssue.nextActionLabel,
      }
    : presentation.intelligence.issue;
  const platformSignals = buildPlatformSignalSnapshot({
    customSignals: [
      ...(presentation.environmentInheritance
        ? [
            {
              key: presentation.environmentInheritance.key,
              label: presentation.environmentInheritance.label,
              tone: 'neutral' as const,
            },
          ]
        : []),
      ...(presentation.previewDatabase
        ? [
            {
              key: presentation.previewDatabase.key,
              label: presentation.previewDatabase.label,
              tone: presentation.previewDatabase.tone,
            },
          ]
        : []),
      ...(release.infrastructureDiagnostics?.signalChips ?? []),
    ],
    customSummary:
      release.infrastructureDiagnostics?.summary ?? presentation.previewDatabase?.summary ?? null,
    customNextActionLabel:
      release.infrastructureDiagnostics?.nextActionLabel ??
      presentation.previewDatabase?.nextActionLabel ??
      null,
    issue: effectiveIssue,
    environmentPolicySignals: presentation.environmentPolicy.signals,
    environmentPolicySignal: presentation.environmentPolicy.primarySignal,
    releasePolicySignals: presentation.policy.signals,
    releasePolicySignal: presentation.policy.primarySignal,
    previewLifecycle: presentation.previewLifecycle,
  });
  const recap =
    release.infrastructureDiagnostics || (release.governanceEvents?.length ?? 0) > 0
      ? buildReleaseRecap(release)
      : (release.recap ?? buildReleaseRecap(release));
  const statusDecoration = getReleaseStatusDecoration(release.status);

  return {
    ...release,
    recap,
    previewSourceMeta: presentation.previewSourceMeta,
    previewLifecycle: presentation.previewLifecycle,
    platformSignals,
    intelligence: presentation.intelligence,
    policy: presentation.policy,
    diff,
    riskLabel: getReleaseRiskLabel(presentation.intelligence.riskLevel),
    environmentScope: getEnvironmentScopeLabelForRelease(release),
    environmentSource: presentation.environmentSource,
    environmentStrategy: presentation.environmentStrategy,
    environmentDatabaseStrategy: presentation.environmentDatabaseStrategy,
    environmentInheritance: presentation.environmentInheritance?.label ?? null,
    environmentExpiry: presentation.environmentExpiry,
    primaryDomainUrl: presentation.primaryDomainUrl,
    statusDecoration,
    approvalRunsCount,
    retryableRunsCount,
    stats: [
      { label: '服务', value: release.artifacts.length },
      { label: '部署', value: release.deployments.length },
      { label: '迁移', value: release.migrationRuns.length },
    ],
    narrativeSummary: recap.narrative,
    blockingReason: recap.blockingReason,
    timeline: buildReleaseTimeline({
      release,
      statusLabel: statusDecoration.label,
      primaryDomainUrl: presentation.primaryDomainUrl,
      environmentStrategy: presentation.environmentStrategy,
    }),
    signalChips: buildReleaseSignalChips({
      platformSignals,
      intelligence: presentation.intelligence,
      policy: presentation.policy,
      diff,
      failedMigrationRunsCount,
      approvalRunsCount,
      infrastructureDiagnostics: release.infrastructureDiagnostics,
    }),
    infrastructureDiagnostics: release.infrastructureDiagnostics ?? null,
    governanceEvents: release.governanceEvents ?? [],
    metadataItems: [
      {
        label: '配置提交',
        value: release.configCommitSha?.slice(0, 7) ?? '—',
      },
      {
        label: '更新时间',
        value: formatReleaseMetadataValue(release.updatedAt),
      },
      {
        label: '发布策略',
        value: presentation.environmentStrategy ?? '滚动发布',
      },
      {
        label: '数据库策略',
        value: presentation.environmentDatabaseStrategy ?? '直连数据库',
      },
      ...(presentation.environmentInheritance
        ? [
            {
              label: '继承环境',
              value: presentation.environmentInheritance.label,
            },
          ]
        : []),
      {
        label: '发布 ID',
        value: release.id,
        mono: true,
      },
    ],
    deploymentItems: buildDeploymentItems(release),
    migrationItems: buildMigrationItems(release),
  };
}
