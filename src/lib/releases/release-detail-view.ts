import { buildReleaseDiff } from '@/lib/releases/diff';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { buildReleaseRecap } from '@/lib/releases/recap';
import type {
  ReleaseDetailDecorations,
  ReleaseDiffComparableLike,
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
import { getReleaseStatusDecoration } from '@/lib/releases/status-presentation';
import { buildReleaseTimeline } from '@/lib/releases/timeline';
import { buildPlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformDateTime } from '@/lib/time/format';

function formatReleaseMetadataValue(value?: Date | string | null): string {
  return formatPlatformDateTime(value) ?? '—';
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
      ...(release.sourceRelease
        ? [
            {
              label: '来源发布',
              value: `${release.sourceRelease.environment?.name ?? '来源环境'} · ${getReleaseDisplayTitle(release.sourceRelease)}`,
            },
          ]
        : []),
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
