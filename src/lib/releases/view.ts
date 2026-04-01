import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import {
  formatEnvironmentExpiry,
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentDeploymentStrategyLabel,
  getEnvironmentInheritancePresentation,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
  getPreviewDatabasePresentation,
} from '@/lib/environments/presentation';
import type { PreviewReviewMetadata } from '@/lib/environments/review-metadata';
import {
  buildPreviewSourceMetadata,
  type PreviewSourceMetadata,
} from '@/lib/environments/source-metadata';
import type { InfrastructureDiagnosticsSnapshot } from '@/lib/infrastructure/diagnostics';
import {
  evaluateEnvironmentPolicy,
  evaluateReleasePolicy,
  type ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import type { ReleaseDiffSnapshot } from '@/lib/releases/diff';
import { buildReleaseDiff } from '@/lib/releases/diff';
import {
  getReleaseIntelligenceSnapshot,
  type ReleaseIntelligenceSnapshot,
} from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import {
  buildReleaseRecap,
  type ReleaseBlockingReason,
  type ReleaseGovernanceEvent,
  type ReleaseRecapRecord,
  type ReleaseSummarySnapshot,
} from '@/lib/releases/recap';
import {
  getDeploymentStatusDecoration,
  getMigrationStatusDecoration,
  getReleaseStatusDecoration,
  getTimelineTone,
  type ReleaseStatusDecoration,
} from '@/lib/releases/status-presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformDateTime } from '@/lib/time/format';

interface ReleaseViewLike {
  id: string;
  projectId?: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  sourceRepository?: string | null;
  configCommitSha?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  environment: {
    id: string;
    name?: string;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
    baseEnvironment?: {
      id: string;
      name: string;
    } | null;
    databases?: Array<{
      id: string;
      name: string;
      status?: string | null;
      sourceDatabaseId?: string | null;
    }> | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isPrimary?: boolean | null;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
    }>;
  };
  previewReviewMetadata?: PreviewReviewMetadata | null;
  artifacts: Array<{
    id?: string;
    serviceId?: string;
    service: {
      id: string;
      name: string;
    };
    imageUrl: string;
    imageDigest?: string | null;
  }>;
  migrationRuns: Array<{
    id?: string;
    createdAt?: Date | string;
    service?: {
      id: string;
      name: string;
    } | null;
    serviceId?: string | null;
    database?: {
      id: string;
      name: string;
    } | null;
    databaseId?: string;
    specification?: {
      tool?: string;
      phase?: string;
      command?: string;
      compatibility?: string | null;
      approvalPolicy?: string | null;
    } | null;
    status: string;
  }>;
  status: string;
  errorMessage?: string | null;
  recap?: ReleaseRecapRecord | null;
  deployments: Array<{
    id?: string;
    createdAt?: Date | string;
    serviceId?: string | null;
    version?: string | null;
    imageUrl?: string | null;
    errorMessage?: string | null;
    status: string;
  }>;
  infrastructureDiagnostics?: InfrastructureDiagnosticsSnapshot | null;
  governanceEvents?: ReleaseGovernanceEvent[] | null;
}

interface ReleaseDiffComparableLike {
  id?: string;
  artifacts: ReleaseViewLike['artifacts'];
  migrationRuns: ReleaseViewLike['migrationRuns'];
}

export interface ReleaseDiffSummary {
  isFirstRelease: boolean;
  artifactChanges: number;
  migrationChanges: number;
}

export type ReleaseRiskFilterState = 'all' | 'attention' | 'approval' | 'failed';

export interface ReleaseListStat {
  label: string;
  value: number | string;
}

export interface ReleaseListDecorations {
  displayTitle: string;
  previewSourceMeta: PreviewSourceMetadata;
  previewLifecycle: PreviewLifecycleSummary | null;
  platformSignals: PlatformSignalSnapshot;
  intelligence: ReleaseIntelligenceSnapshot;
  policy: ReleasePolicySnapshot;
  diffSummary: ReleaseDiffSummary;
  riskLabel: string;
  statusDecoration: ReleaseStatusDecoration;
  environmentScope: string | null;
  environmentSource: string | null;
  environmentStrategy: string | null;
  environmentDatabaseStrategy: string | null;
  environmentInheritance: string | null;
  environmentExpiry: string | null;
  primaryDomainUrl: string | null;
  approvalRunsCount: number;
  failedMigrationRunsCount: number;
  signalChips: ReleaseDetailChip[];
  deploymentItems: ReleaseDetailDecorations['deploymentItems'];
  migrationItems: Array<
    ReleaseDetailDecorations['migrationItems'][number] & {
      createdAtLabel: string;
    }
  >;
}

export function normalizeReleaseRiskFilterState(value?: string | null): ReleaseRiskFilterState {
  return value === 'attention' || value === 'approval' || value === 'failed' ? value : 'all';
}

export function filterReleaseCards<
  T extends ReleaseListDecorations & { status: string; environment: { name?: string } },
>(
  releases: T[],
  filters: {
    env?: string | null;
    risk?: ReleaseRiskFilterState;
  }
): T[] {
  const envFilter = filters.env && filters.env !== 'all' ? filters.env : 'all';
  const riskFilter = filters.risk ?? 'all';

  return releases.filter((release) => {
    if (envFilter !== 'all' && (release.environment.name ?? '环境') !== envFilter) {
      return false;
    }

    if (riskFilter === 'all') {
      return true;
    }

    if (riskFilter === 'attention') {
      return (
        release.approvalRunsCount > 0 ||
        release.failedMigrationRunsCount > 0 ||
        ['migration_pre_failed', 'failed', 'degraded', 'verification_failed'].includes(
          release.status
        )
      );
    }

    if (riskFilter === 'approval') {
      return release.approvalRunsCount > 0;
    }

    return (
      release.failedMigrationRunsCount > 0 ||
      ['failed', 'migration_pre_failed', 'verification_failed'].includes(release.status)
    );
  });
}

export function buildReleaseListStats<T extends ReleaseListDecorations>(
  releases: T[]
): ReleaseListStat[] {
  return [
    { label: '发布', value: releases.length },
    {
      label: '待审批',
      value: releases.filter((release) => release.approvalRunsCount > 0).length,
    },
    {
      label: '失败',
      value: releases.filter((release) => release.failedMigrationRunsCount > 0).length,
    },
  ];
}

export interface ReleaseDetailStat {
  label: string;
  value: number;
}

export interface ReleaseDetailChip {
  key: string;
  label: string;
  tone: 'danger' | 'neutral';
}

export interface ReleaseDetailMetadataItem {
  label: string;
  value: string;
  mono?: boolean;
}

export interface ReleaseTimelineItem {
  key: string;
  at: string | null;
  title: string;
  description: string;
  tone: 'neutral' | 'info' | 'success' | 'warning' | 'danger';
  href: string | null;
}

export interface ReleaseDetailDecorations {
  previewSourceMeta: PreviewSourceMetadata;
  previewLifecycle: PreviewLifecycleSummary | null;
  platformSignals: PlatformSignalSnapshot;
  intelligence: ReleaseIntelligenceSnapshot;
  policy: ReleasePolicySnapshot;
  diff: ReleaseDiffSnapshot;
  riskLabel: string;
  environmentScope: string | null;
  environmentSource: string | null;
  environmentStrategy: string | null;
  environmentDatabaseStrategy: string | null;
  environmentInheritance: string | null;
  environmentExpiry: string | null;
  primaryDomainUrl: string | null;
  statusDecoration: ReleaseStatusDecoration;
  approvalRunsCount: number;
  retryableRunsCount: number;
  stats: ReleaseDetailStat[];
  signalChips: ReleaseDetailChip[];
  narrativeSummary: ReleaseSummarySnapshot;
  blockingReason: ReleaseBlockingReason | null;
  timeline: ReleaseTimelineItem[];
  infrastructureDiagnostics: InfrastructureDiagnosticsSnapshot | null;
  governanceEvents: ReleaseGovernanceEvent[];
  metadataItems: ReleaseDetailMetadataItem[];
  deploymentItems: Array<{
    id: string;
    status: string;
    serviceId: string | null;
    version: string | null;
    imageUrl: string | null;
    errorMessage: string | null;
    statusDecoration: ReleaseStatusDecoration;
    serviceName: string;
  }>;
  migrationItems: Array<{
    id: string;
    status: string;
    serviceId: string | null;
    database: {
      id: string;
      name: string;
    };
    specification: {
      tool: string;
      phase: string;
      command: string;
    };
    statusDecoration: Omit<ReleaseStatusDecoration, 'label'> & { label: string };
    imageUrl: string | null;
    serviceName: string;
  }>;
}

function formatReleaseMetadataValue(value?: Date | string | null): string {
  return formatPlatformDateTime(value) ?? '—';
}

function formatTimelineTimestamp(value?: Date | string | null): string | null {
  const label = formatReleaseMetadataValue(value);
  return label === '—' ? null : label;
}

function getReleaseRiskLabel(riskLevel: ReleaseIntelligenceSnapshot['riskLevel']): string {
  if (riskLevel === 'high') {
    return '高风险';
  }

  if (riskLevel === 'medium') {
    return '中风险';
  }

  return '低风险';
}

function buildReleaseSignalChips(input: {
  platformSignals: PlatformSignalSnapshot;
  intelligence: ReleaseIntelligenceSnapshot;
  policy: ReleasePolicySnapshot;
  diff: ReleaseDiffSnapshot;
  failedMigrationRunsCount?: number;
  approvalRunsCount?: number;
  infrastructureDiagnostics?: InfrastructureDiagnosticsSnapshot | null;
}): ReleaseDetailChip[] {
  const chips: ReleaseDetailChip[] = [...input.platformSignals.chips];

  if (!input.intelligence.issue?.summary && input.intelligence.failureSummary) {
    chips.push({
      key: 'failure',
      label: input.intelligence.failureSummary,
      tone: 'danger',
    });
  }

  for (const reason of input.intelligence.reasons) {
    chips.push({
      key: `reason:${reason}`,
      label: reason,
      tone: 'neutral',
    });
  }

  if (!input.policy.primarySignal?.summary && input.policy.summary) {
    chips.push({
      key: 'policy-fallback',
      label: input.policy.summary,
      tone: 'neutral',
    });
  }

  if (!input.platformSignals.nextActionLabel && input.intelligence.actionLabel) {
    chips.push({
      key: 'action-fallback',
      label: `下一步：${input.intelligence.actionLabel}`,
      tone: 'neutral',
    });
  }

  if ((input.failedMigrationRunsCount ?? 0) > 0) {
    chips.push({
      key: 'failed-migrations',
      label: `${input.failedMigrationRunsCount} 个失败迁移`,
      tone: 'danger',
    });
  }

  if ((input.approvalRunsCount ?? 0) > 0) {
    chips.push({
      key: 'approval-runs',
      label: `${input.approvalRunsCount} 个待审批`,
      tone: 'neutral',
    });
  }

  if (input.diff.isFirstRelease) {
    chips.push({
      key: 'first-release',
      label: '首次发布',
      tone: 'neutral',
    });
  }

  if (input.diff.changedArtifacts.length > 0) {
    chips.push({
      key: 'artifact-changes',
      label: `镜像变更 ${input.diff.changedArtifacts.length} 项`,
      tone: 'neutral',
    });
  }

  if (input.diff.changedMigrations.length > 0) {
    chips.push({
      key: 'migration-changes',
      label: `迁移变更 ${input.diff.changedMigrations.length} 项`,
      tone: 'neutral',
    });
  }

  if (input.infrastructureDiagnostics?.abnormalResources.clusterLongPendingPods.count) {
    chips.push({
      key: 'cluster-long-pending',
      label: input.infrastructureDiagnostics.abnormalResources.clusterLongPendingPods.label,
      tone: 'neutral',
    });
  }

  return chips;
}

function buildDeploymentItems(
  release: ReleaseViewLike
): ReleaseDetailDecorations['deploymentItems'] {
  return release.deployments.map((deployment, index) => ({
    id: deployment.id ?? `${release.id}-deployment-${index}`,
    status: deployment.status,
    serviceId: deployment.serviceId ?? null,
    version: deployment.version ?? null,
    imageUrl: deployment.imageUrl ?? null,
    errorMessage: deployment.errorMessage ?? null,
    statusDecoration: getDeploymentStatusDecoration(deployment.status),
    serviceName: deployment.serviceId
      ? (release.artifacts.find((artifact) => artifact.service.id === deployment.serviceId)?.service
          .name ?? '服务')
      : '项目',
  }));
}

function buildMigrationItems(
  release: ReleaseViewLike
): Array<ReleaseDetailDecorations['migrationItems'][number] & { createdAtLabel: string }> {
  return release.migrationRuns.map((run, index) => ({
    id: run.id ?? `${release.id}-migration-${index}`,
    status: run.status,
    serviceId: run.serviceId ?? null,
    database: run.database ?? {
      id: run.databaseId ?? `database-${index}`,
      name: '数据库',
    },
    specification: {
      tool: run.specification?.tool ?? 'custom',
      phase: run.specification?.phase ?? 'manual',
      command: run.specification?.command ?? '未提供命令',
    },
    statusDecoration: getMigrationStatusDecoration(run.status),
    imageUrl:
      release.artifacts.find((artifact) => artifact.service.id === run.serviceId)?.imageUrl ?? null,
    serviceName: run.service?.name ?? '服务',
    createdAtLabel: formatReleaseMetadataValue(run.createdAt),
  }));
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
  statusDecoration: ReleaseStatusDecoration;
  primaryDomainUrl: string | null;
  environmentStrategy: string | null;
  infrastructureDiagnostics?: InfrastructureDiagnosticsSnapshot | null;
  governanceEvents?: ReleaseGovernanceEvent[] | null;
}): ReleaseTimelineItem[] {
  const { release } = input;
  const releaseHref = release.projectId
    ? `/projects/${release.projectId}/releases/${release.id}`
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
      description: `${run.service?.name ?? '服务'} · ${run.database?.name ?? '数据库'} · ${run.specification?.phase ?? 'manual'}`,
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
      title: `发布${input.statusDecoration.label}`,
      description: release.errorMessage ?? getReleaseDisplayTitle(release),
      tone: getTimelineTone(release.status, 'release'),
      href: releaseHref,
      sortValue: release.updatedAt ? new Date(release.updatedAt).getTime() : 0,
    });
  }

  for (const incident of input.infrastructureDiagnostics?.incidents ?? []) {
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

  for (const event of input.governanceEvents ?? []) {
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

export function decorateReleaseList<T extends ReleaseViewLike>(
  releases: T[]
): Array<T & ReleaseListDecorations> {
  const previousReleaseById = new Map<string, T | null>();
  const previousReleaseByEnvironment = new Map<string, T>();

  for (let index = releases.length - 1; index >= 0; index -= 1) {
    const release = releases[index];
    previousReleaseById.set(
      release.id,
      previousReleaseByEnvironment.get(release.environment.id) ?? null
    );
    previousReleaseByEnvironment.set(release.environment.id, release);
  }

  return releases.map((release) => {
    const previousRelease = previousReleaseById.get(release.id) ?? null;
    const intelligence = getReleaseIntelligenceSnapshot(release);
    const policy = evaluateReleasePolicy(release);
    const diff = buildReleaseDiff(release, previousRelease);
    const environmentPolicy = evaluateEnvironmentPolicy(release.environment);
    const approvalRunsCount = release.migrationRuns.filter(
      (run) => run.status === 'awaiting_approval'
    ).length;
    const failedMigrationRunsCount = release.migrationRuns.filter(
      (run) => run.status === 'failed'
    ).length;
    const primaryDomain = pickPrimaryEnvironmentDomain(release.environment?.domains ?? []);
    const previewSourceMeta = buildPreviewSourceMetadata({
      sourceRef: release.sourceRef,
      environment: release.environment,
      reviewRequest: release.previewReviewMetadata ?? null,
    });
    const primaryDomainUrl = primaryDomain
      ? buildEnvironmentAccessUrl(primaryDomain.hostname)
      : null;
    const environmentSource = getEnvironmentSourceLabel(release.environment ?? {});
    const environmentStrategy = getEnvironmentDeploymentStrategyLabel(
      release.environment?.deploymentStrategy
    );
    const environmentDatabaseStrategy = getEnvironmentDatabaseStrategyLabel(
      release.environment?.databaseStrategy
    );
    const environmentInheritance = getEnvironmentInheritancePresentation(release.environment);
    const previewDatabase = getPreviewDatabasePresentation({
      environment: release.environment,
    });
    const environmentExpiry = formatEnvironmentExpiry(release.environment?.expiresAt);
    const previewLifecycle = release.environment?.isPreview
      ? buildPreviewLifecycleSummary({
          sourceLabel: previewSourceMeta.label ?? environmentSource,
          expiryLabel: environmentExpiry,
          primaryDomainUrl,
          latestRelease: {
            id: release.id,
            title: getReleaseDisplayTitle(release),
          },
        })
      : null;
    const platformSignals = buildPlatformSignalSnapshot({
      customSignals: [
        ...(environmentInheritance
          ? [
              {
                key: environmentInheritance.key,
                label: environmentInheritance.label,
                tone: 'neutral' as const,
              },
            ]
          : []),
        ...(previewDatabase
          ? [
              {
                key: previewDatabase.key,
                label: previewDatabase.label,
                tone: previewDatabase.tone,
              },
            ]
          : []),
      ],
      customSummary: previewDatabase?.summary ?? null,
      customNextActionLabel: previewDatabase?.nextActionLabel ?? null,
      issue: intelligence.issue,
      environmentPolicySignals: environmentPolicy.signals,
      environmentPolicySignal: environmentPolicy.primarySignal,
      releasePolicySignals: policy.signals,
      releasePolicySignal: policy.primarySignal,
      previewLifecycle,
    });
    const recap = release.recap ?? buildReleaseRecap(release);

    return {
      ...release,
      recap,
      displayTitle: getReleaseDisplayTitle(release),
      previewSourceMeta,
      previewLifecycle,
      platformSignals,
      intelligence,
      policy,
      riskLabel: getReleaseRiskLabel(intelligence.riskLevel),
      statusDecoration: getReleaseStatusDecoration(release.status),
      environmentScope: getEnvironmentScopeLabel(release.environment ?? {}),
      environmentSource,
      environmentStrategy,
      environmentDatabaseStrategy,
      environmentInheritance: environmentInheritance?.label ?? null,
      environmentExpiry,
      primaryDomainUrl,
      approvalRunsCount,
      failedMigrationRunsCount,
      diffSummary: {
        isFirstRelease: diff.isFirstRelease,
        artifactChanges: diff.changedArtifacts.length,
        migrationChanges: diff.changedMigrations.length,
      },
      signalChips: buildReleaseSignalChips({
        platformSignals,
        intelligence,
        policy,
        diff: {
          isFirstRelease: diff.isFirstRelease,
          changedArtifacts: diff.changedArtifacts,
          changedMigrations: diff.changedMigrations,
        },
        failedMigrationRunsCount,
        approvalRunsCount,
      }),
      deploymentItems: buildDeploymentItems(release),
      migrationItems: buildMigrationItems(release),
    };
  });
}

export function decorateReleaseDetail<T extends ReleaseViewLike>(
  release: T,
  previousRelease: ReleaseDiffComparableLike | null
): T & ReleaseDetailDecorations {
  const intelligence = getReleaseIntelligenceSnapshot(release);
  const policy = evaluateReleasePolicy(release);
  const environmentPolicy = evaluateEnvironmentPolicy(release.environment);
  const diff = buildReleaseDiff(release, previousRelease);
  const riskLabel = getReleaseRiskLabel(intelligence.riskLevel);
  const primaryDomain = pickPrimaryEnvironmentDomain(release.environment?.domains ?? []);
  const approvalRunsCount = release.migrationRuns.filter(
    (run) => run.status === 'awaiting_approval'
  ).length;
  const retryableRunsCount = release.migrationRuns.filter((run) =>
    ['failed', 'canceled'].includes(run.status)
  ).length;
  const failedMigrationRunsCount = release.migrationRuns.filter(
    (run) => run.status === 'failed'
  ).length;
  const previewSourceMeta = buildPreviewSourceMetadata({
    sourceRef: release.sourceRef,
    environment: release.environment,
    reviewRequest: release.previewReviewMetadata ?? null,
  });
  const primaryDomainUrl = primaryDomain ? buildEnvironmentAccessUrl(primaryDomain.hostname) : null;
  const environmentSource = getEnvironmentSourceLabel(release.environment ?? {});
  const environmentStrategy = getEnvironmentDeploymentStrategyLabel(
    release.environment?.deploymentStrategy
  );
  const environmentDatabaseStrategy = getEnvironmentDatabaseStrategyLabel(
    release.environment?.databaseStrategy
  );
  const environmentInheritance = getEnvironmentInheritancePresentation(release.environment);
  const previewDatabase = getPreviewDatabasePresentation({
    environment: release.environment,
  });
  const environmentExpiry = formatEnvironmentExpiry(release.environment?.expiresAt);
  const previewLifecycle = release.environment?.isPreview
    ? buildPreviewLifecycleSummary({
        sourceLabel: previewSourceMeta.label ?? environmentSource,
        expiryLabel: environmentExpiry,
        primaryDomainUrl,
        latestRelease: {
          id: release.id,
          title: getReleaseDisplayTitle(release),
        },
      })
    : null;
  const effectiveIssue = release.infrastructureDiagnostics?.primaryIssue
    ? {
        code: release.infrastructureDiagnostics.primaryIssue.code,
        kind: 'release' as const,
        label: release.infrastructureDiagnostics.primaryIssue.label,
        summary: release.infrastructureDiagnostics.primaryIssue.summary,
        nextActionLabel: release.infrastructureDiagnostics.primaryIssue.nextActionLabel,
      }
    : intelligence.issue;
  const platformSignals = buildPlatformSignalSnapshot({
    customSignals: [
      ...(environmentInheritance
        ? [
            {
              key: environmentInheritance.key,
              label: environmentInheritance.label,
              tone: 'neutral' as const,
            },
          ]
        : []),
      ...(previewDatabase
        ? [
            {
              key: previewDatabase.key,
              label: previewDatabase.label,
              tone: previewDatabase.tone,
            },
          ]
        : []),
      ...(release.infrastructureDiagnostics?.signalChips ?? []),
    ],
    customSummary: release.infrastructureDiagnostics?.summary ?? previewDatabase?.summary ?? null,
    customNextActionLabel:
      release.infrastructureDiagnostics?.nextActionLabel ??
      previewDatabase?.nextActionLabel ??
      null,
    issue: effectiveIssue,
    environmentPolicySignals: environmentPolicy.signals,
    environmentPolicySignal: environmentPolicy.primarySignal,
    releasePolicySignals: policy.signals,
    releasePolicySignal: policy.primarySignal,
    previewLifecycle,
  });
  const recap =
    release.infrastructureDiagnostics || (release.governanceEvents?.length ?? 0) > 0
      ? buildReleaseRecap(release)
      : (release.recap ?? buildReleaseRecap(release));

  return {
    ...release,
    recap,
    previewSourceMeta,
    previewLifecycle,
    platformSignals,
    intelligence,
    policy,
    diff,
    riskLabel,
    environmentScope: getEnvironmentScopeLabel(release.environment ?? {}),
    environmentSource,
    environmentStrategy,
    environmentDatabaseStrategy,
    environmentInheritance: environmentInheritance?.label ?? null,
    environmentExpiry,
    primaryDomainUrl,
    statusDecoration: getReleaseStatusDecoration(release.status),
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
      statusDecoration: getReleaseStatusDecoration(release.status),
      primaryDomainUrl,
      environmentStrategy,
      infrastructureDiagnostics: release.infrastructureDiagnostics,
      governanceEvents: release.governanceEvents,
    }),
    signalChips: buildReleaseSignalChips({
      platformSignals,
      intelligence,
      policy,
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
        value: environmentStrategy ?? '滚动发布',
      },
      {
        label: '数据库策略',
        value: environmentDatabaseStrategy ?? '直连数据库',
      },
      ...(environmentInheritance
        ? [
            {
              label: '继承环境',
              value: environmentInheritance.label,
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
