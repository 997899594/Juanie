import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import { type EnvironmentKindLike, isPreviewEnvironment } from '@/lib/environments/model';
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
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview';
import {
  evaluateEnvironmentPolicy,
  evaluateReleasePolicy,
  type ReleasePolicySnapshot,
} from '@/lib/policies/delivery';
import type { ReleaseDiffSnapshot } from '@/lib/releases/diff';
import {
  getReleaseIntelligenceSnapshot,
  type ReleaseIntelligenceSnapshot,
} from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import type {
  ReleaseBlockingReason,
  ReleaseGovernanceEvent,
  ReleaseRecapRecord,
  ReleaseSummarySnapshot,
} from '@/lib/releases/recap';
import {
  getDeploymentStatusDecoration,
  getMigrationStatusDecoration,
  type ReleaseStatusDecoration,
} from '@/lib/releases/status-presentation';
import type { PlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformTimeContext } from '@/lib/time/format';

export interface ReleaseViewLike {
  id: string;
  projectId?: string;
  sourceRef?: string | null;
  sourceCommitSha?: string | null;
  sourceRepository?: string | null;
  configCommitSha?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  environment: EnvironmentKindLike & {
    id: string;
    name?: string;
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
      type?: string | null;
    } | null;
    databaseId?: string;
    specification?: {
      tool?: string;
      phase?: string;
      command?: string;
      executionMode?: string | null;
      workingDirectory?: string | null;
      migrationPath?: string | null;
      lockStrategy?: string | null;
      compatibility?: string | null;
      approvalPolicy?: string | null;
      filePreview?: MigrationFilePreviewSnapshot | null;
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

export interface ReleaseDiffComparableLike {
  id?: string;
  artifacts: ReleaseViewLike['artifacts'];
  migrationRuns: ReleaseViewLike['migrationRuns'];
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
      type?: string | null;
    };
    specification: {
      tool: string;
      phase: string;
      command: string;
      executionMode: string;
      workingDirectory: string;
      migrationPath: string | null;
      lockStrategy: string;
      compatibility: string;
      approvalPolicy: string;
      filePreview?: MigrationFilePreviewSnapshot | null;
    };
    statusDecoration: Omit<ReleaseStatusDecoration, 'label'> & { label: string };
    imageUrl: string | null;
    serviceName: string;
  }>;
}

export function getReleaseRiskLabel(riskLevel: ReleaseIntelligenceSnapshot['riskLevel']): string {
  if (riskLevel === 'high') {
    return '高风险';
  }

  if (riskLevel === 'medium') {
    return '中风险';
  }

  return '低风险';
}

export function countApprovalRuns(release: ReleaseViewLike): number {
  return release.migrationRuns.filter((run) =>
    ['awaiting_approval', 'awaiting_external_completion'].includes(run.status)
  ).length;
}

export function countFailedMigrationRuns(release: ReleaseViewLike): number {
  return release.migrationRuns.filter((run) => run.status === 'failed').length;
}

export function countRetryableRuns(release: ReleaseViewLike): number {
  return release.migrationRuns.filter((run) => ['failed', 'canceled'].includes(run.status)).length;
}

export function buildReleasePresentationBase(release: ReleaseViewLike) {
  const intelligence = getReleaseIntelligenceSnapshot(release);
  const policy = evaluateReleasePolicy(release);
  const environmentPolicy = evaluateEnvironmentPolicy(release.environment);
  const primaryDomain = pickPrimaryEnvironmentDomain(release.environment?.domains ?? []);
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
  const previewLifecycle =
    release.environment && isPreviewEnvironment(release.environment)
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

  return {
    intelligence,
    policy,
    environmentPolicy,
    previewSourceMeta,
    primaryDomainUrl,
    environmentSource,
    environmentStrategy,
    environmentDatabaseStrategy,
    environmentInheritance,
    previewDatabase,
    environmentExpiry,
    previewLifecycle,
  };
}

export function buildReleaseSignalChips(input: {
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
      label: `${input.approvalRunsCount} 个待处理门禁`,
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

export function buildDeploymentItems(
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

export function buildMigrationItems(
  release: ReleaseViewLike
): Array<ReleaseDetailDecorations['migrationItems'][number] & { createdAtLabel: string }> {
  return release.migrationRuns.map((run, index) => ({
    id: run.id ?? `${release.id}-migration-${index}`,
    status: run.status,
    serviceId: run.serviceId ?? null,
    database: run.database ?? {
      id: run.databaseId ?? `database-${index}`,
      name: '数据库',
      type: null,
    },
    specification: {
      tool: run.specification?.tool ?? 'custom',
      phase: run.specification?.phase ?? 'manual',
      command: run.specification?.command ?? '未提供命令',
      executionMode: run.specification?.executionMode ?? 'automatic',
      workingDirectory: run.specification?.workingDirectory ?? '.',
      migrationPath: run.specification?.migrationPath ?? null,
      lockStrategy: run.specification?.lockStrategy ?? 'platform',
      compatibility: run.specification?.compatibility ?? 'backward_compatible',
      approvalPolicy: run.specification?.approvalPolicy ?? 'auto',
      filePreview: run.specification?.filePreview ?? null,
    },
    statusDecoration: getMigrationStatusDecoration(run.status),
    imageUrl:
      release.artifacts.find((artifact) => artifact.service.id === run.serviceId)?.imageUrl ?? null,
    serviceName: run.service?.name ?? '服务',
    createdAtLabel: formatPlatformTimeContext(run.createdAt) ?? '—',
  }));
}

export function getEnvironmentScopeLabelForRelease(release: ReleaseViewLike): string | null {
  return getEnvironmentScopeLabel(release.environment ?? {});
}
