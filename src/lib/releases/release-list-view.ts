import type { PreviewLifecycleSummary } from '@/lib/environments/lifecycle-summary';
import type { PreviewSourceMetadata } from '@/lib/environments/source-metadata';
import type { ReleasePolicySnapshot } from '@/lib/policies/delivery';
import { buildReleaseDiff } from '@/lib/releases/diff';
import type { ReleaseIntelligenceSnapshot } from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { buildReleaseRecap } from '@/lib/releases/recap';
import type {
  ReleaseDetailChip,
  ReleaseDetailDecorations,
  ReleaseViewLike,
} from '@/lib/releases/release-view-shared';
import {
  buildDeploymentItems,
  buildMigrationItems,
  buildReleasePresentationBase,
  buildReleaseSignalChips,
  countApprovalRuns,
  countFailedMigrationRuns,
  getEnvironmentScopeLabelForRelease,
  getReleaseRiskLabel,
} from '@/lib/releases/release-view-shared';
import {
  getReleaseStatusDecoration,
  type ReleaseStatusDecoration,
} from '@/lib/releases/status-presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';

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
    const diff = buildReleaseDiff(release, previousRelease);
    const approvalRunsCount = countApprovalRuns(release);
    const failedMigrationRunsCount = countFailedMigrationRuns(release);
    const presentation = buildReleasePresentationBase(release);
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
      ],
      customSummary: presentation.previewDatabase?.summary ?? null,
      customNextActionLabel: presentation.previewDatabase?.nextActionLabel ?? null,
      issue: presentation.intelligence.issue,
      environmentPolicySignals: presentation.environmentPolicy.signals,
      environmentPolicySignal: presentation.environmentPolicy.primarySignal,
      releasePolicySignals: presentation.policy.signals,
      releasePolicySignal: presentation.policy.primarySignal,
      previewLifecycle: presentation.previewLifecycle,
    });
    const recap = release.recap ?? buildReleaseRecap(release);

    return {
      ...release,
      recap,
      displayTitle: getReleaseDisplayTitle(release),
      previewSourceMeta: presentation.previewSourceMeta,
      previewLifecycle: presentation.previewLifecycle,
      platformSignals,
      intelligence: presentation.intelligence,
      policy: presentation.policy,
      riskLabel: getReleaseRiskLabel(presentation.intelligence.riskLevel),
      statusDecoration: getReleaseStatusDecoration(release.status),
      environmentScope: getEnvironmentScopeLabelForRelease(release),
      environmentSource: presentation.environmentSource,
      environmentStrategy: presentation.environmentStrategy,
      environmentDatabaseStrategy: presentation.environmentDatabaseStrategy,
      environmentInheritance: presentation.environmentInheritance?.label ?? null,
      environmentExpiry: presentation.environmentExpiry,
      primaryDomainUrl: presentation.primaryDomainUrl,
      approvalRunsCount,
      failedMigrationRunsCount,
      diffSummary: {
        isFirstRelease: diff.isFirstRelease,
        artifactChanges: diff.changedArtifacts.length,
        migrationChanges: diff.changedMigrations.length,
      },
      signalChips: buildReleaseSignalChips({
        platformSignals,
        intelligence: presentation.intelligence,
        policy: presentation.policy,
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
