import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import { isPreviewEnvironment, isPromoteOnlyEnvironment } from '@/lib/environments/model';
import {
  type EnvironmentSourceBuildPresentation,
  formatEnvironmentExpiry,
  formatEnvironmentTimestamp,
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentDeploymentStrategyLabel,
  getEnvironmentInheritancePresentation,
  getEnvironmentScopeLabel,
  getEnvironmentSourceBuildPresentation,
  getEnvironmentSourceLabel,
  getPreviewDatabasePresentation,
} from '@/lib/environments/presentation';
import { isPreviewEnvironmentExpired } from '@/lib/environments/preview';
import { type EnvironmentPolicySnapshot, evaluateEnvironmentPolicy } from '@/lib/policies/delivery';
import {
  buildEnvironmentTrackingBranchName,
  buildReleaseEnvironmentTagName,
} from '@/lib/releases/environment-tracking-names';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import {
  getReleaseStatusDecoration,
  type ReleaseStatusDecoration,
} from '@/lib/releases/status-presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformTimeContext } from '@/lib/time/format';

interface EnvironmentViewLike {
  id: string;
  name: string;
  kind?: 'production' | 'persistent' | 'preview' | null;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
  deliveryMode?: 'direct' | 'promote_only' | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  previewPrNumber?: number | null;
  branch?: string | null;
  expiresAt?: Date | string | null;
  previewBuildStatus?: string | null;
  previewBuildSourceRef?: string | null;
  previewBuildSourceCommitSha?: string | null;
  previewBuildStartedAt?: Date | string | null;
  deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  domains?: Array<{
    id: string;
    hostname: string;
    isCustom?: boolean | null;
    isVerified?: boolean | null;
  }> | null;
  databases?: Array<{
    id: string;
    name: string;
    status?: string | null;
    sourceDatabaseId?: string | null;
  }> | null;
  latestRelease?: {
    id: string;
    status: string;
    summary?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    createdAt?: Date | string | null;
    environment?: {
      isPreview?: boolean | null;
    } | null;
  } | null;
  latestSuccessfulRelease?: {
    id: string;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    createdAt?: Date | string | null;
  } | null;
  activeReleaseCount?: number;
}

export interface EnvironmentListDecorations {
  policy: EnvironmentPolicySnapshot;
  platformSignals: PlatformSignalSnapshot;
  scopeLabel: string | null;
  sourceLabel: string | null;
  strategyLabel: string | null;
  databaseStrategyLabel: string | null;
  inheritanceLabel: string | null;
  expiryLabel: string | null;
  expiryTimestamp: string | null;
  primaryDomainUrl: string | null;
  previewLifecycle: PreviewLifecycleSummary | null;
  latestReleaseCard: {
    id: string;
    title: string;
    shortCommitSha: string | null;
    createdAtLabel: string | null;
    statusDecoration: ReleaseStatusDecoration;
  } | null;
  sourceBuild: EnvironmentSourceBuildPresentation | null;
  gitTracking: {
    state: 'pending' | 'synced';
    releaseId: string | null;
    trackingBranchName: string;
    expectsPromotionTag: boolean;
    releaseTagName: string | null;
    sourceRef: string | null;
    commitSha: string | null;
    shortCommitSha: string | null;
    syncedAtLabel: string | null;
    summary: string;
  } | null;
  cleanupState: {
    state: 'active' | 'expired_ready' | 'expired_blocked';
    label: string;
    summary: string;
  } | null;
}

function buildEnvironmentGitTracking(
  environment: EnvironmentViewLike,
  sourceBuild: EnvironmentSourceBuildPresentation | null
): EnvironmentListDecorations['gitTracking'] {
  if (isPreviewEnvironment(environment)) {
    return null;
  }

  const expectsPromotionTag = isPromoteOnlyEnvironment(environment);
  const trackingBranchName = buildEnvironmentTrackingBranchName(environment.name);
  const trackedRelease =
    environment.latestSuccessfulRelease ??
    (environment.latestRelease?.status === 'succeeded' ? environment.latestRelease : null);

  if (!trackedRelease?.sourceCommitSha) {
    return {
      state: 'pending',
      releaseId: null,
      trackingBranchName,
      expectsPromotionTag,
      releaseTagName: null,
      sourceRef: environment.previewBuildSourceRef ?? environment.branch ?? null,
      commitSha: environment.previewBuildSourceCommitSha ?? null,
      shortCommitSha: sourceBuild?.shortCommitSha ?? null,
      syncedAtLabel: sourceBuild?.startedAtLabel ?? null,
      summary:
        sourceBuild?.status === 'building'
          ? expectsPromotionTag
            ? `首发构建已触发，成功后会建立 ${trackingBranchName} 并生成提升标签。`
            : `首发构建已触发，成功后会建立 ${trackingBranchName}。`
          : sourceBuild?.status === 'failed'
            ? expectsPromotionTag
              ? `首发构建失败，${trackingBranchName} 和提升标签都还没有建立。`
              : `首发构建失败，${trackingBranchName} 还没有建立。`
            : expectsPromotionTag
              ? '当前环境还没有成功提升，首次成功后会建立追踪分支并生成提升标签。'
              : '当前环境还没有成功发布，首次成功后会建立追踪分支。',
    };
  }

  const shortCommitSha = trackedRelease.sourceCommitSha.slice(0, 7);
  const releaseTagName = expectsPromotionTag
    ? buildReleaseEnvironmentTagName({
        environmentName: environment.name,
        createdAt: trackedRelease.createdAt ?? new Date().toISOString(),
        sourceCommitSha: trackedRelease.sourceCommitSha,
      })
    : null;

  return {
    state: 'synced',
    releaseId: trackedRelease.id,
    trackingBranchName,
    expectsPromotionTag,
    releaseTagName,
    sourceRef: trackedRelease.sourceRef ?? environment.branch ?? null,
    commitSha: trackedRelease.sourceCommitSha,
    shortCommitSha,
    syncedAtLabel: formatPlatformTimeContext(trackedRelease.createdAt),
    summary: expectsPromotionTag
      ? `当前环境已同步到 ${shortCommitSha}，并保留可复用的提升标签。`
      : `当前环境已同步到 ${shortCommitSha}。`,
  };
}

export function decorateEnvironmentList<T extends EnvironmentViewLike>(
  environments: T[]
): Array<T & EnvironmentListDecorations> {
  return environments.map((environment) => {
    const sourceLabel = getEnvironmentSourceLabel(environment);
    const strategyLabel = getEnvironmentDeploymentStrategyLabel(environment.deploymentStrategy);
    const databaseStrategyLabel = getEnvironmentDatabaseStrategyLabel(environment.databaseStrategy);
    const inheritance = getEnvironmentInheritancePresentation(environment);
    const inheritanceLabel = inheritance?.label ?? null;
    const previewDatabase = getPreviewDatabasePresentation({ environment });
    const sourceBuild = getEnvironmentSourceBuildPresentation({ environment });
    const expiryLabel = formatEnvironmentExpiry(environment.expiresAt);
    const primaryDomainUrl = (() => {
      if (!environment.domains?.length) {
        return null;
      }

      const primaryDomain =
        pickPrimaryEnvironmentDomain(environment.domains)?.hostname ??
        environment.domains[0]?.hostname;

      return primaryDomain ? buildEnvironmentAccessUrl(primaryDomain) : null;
    })();
    const latestReleaseCard = environment.latestRelease
      ? {
          id: environment.latestRelease.id,
          title: getReleaseDisplayTitle(environment.latestRelease),
          shortCommitSha: environment.latestRelease.sourceCommitSha?.slice(0, 7) ?? null,
          createdAtLabel: formatPlatformTimeContext(environment.latestRelease.createdAt),
          statusDecoration: getReleaseStatusDecoration(environment.latestRelease.status),
        }
      : null;
    const gitTracking = buildEnvironmentGitTracking(environment, sourceBuild);
    const policy = evaluateEnvironmentPolicy(environment);
    const previewLifecycle = isPreviewEnvironment(environment)
      ? buildPreviewLifecycleSummary({
          sourceLabel,
          expiryLabel,
          primaryDomainUrl,
          latestRelease: latestReleaseCard,
        })
      : null;
    const cleanupState = (() => {
      if (!isPreviewEnvironment(environment)) {
        return null;
      }

      if (!isPreviewEnvironmentExpired(environment)) {
        return {
          state: 'active' as const,
          label: '按 TTL 存续',
          summary: '当前预览环境还在有效期内，会按到期时间进入自动治理。',
        };
      }

      if ((environment.activeReleaseCount ?? 0) > 0) {
        return {
          state: 'expired_blocked' as const,
          label: '过期但被发布阻塞',
          summary: `环境已经过期，但仍有 ${environment.activeReleaseCount} 个活跃 release，平台暂时不会自动删除。`,
        };
      }

      return {
        state: 'expired_ready' as const,
        label: '过期待回收',
        summary: '环境已经过期，没有活跃发布，平台会自动清理，也可以手动立即回收。',
      };
    })();

    return {
      ...environment,
      policy,
      platformSignals: buildPlatformSignalSnapshot({
        customSignals: [
          ...(inheritance
            ? [
                {
                  key: inheritance.key,
                  label: inheritance.label,
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
          ...(sourceBuild
            ? [
                {
                  key: sourceBuild.key,
                  label: sourceBuild.label,
                  tone: sourceBuild.tone,
                },
              ]
            : []),
        ],
        customSummary: sourceBuild?.summary ?? previewDatabase?.summary ?? null,
        customNextActionLabel:
          sourceBuild?.nextActionLabel ?? previewDatabase?.nextActionLabel ?? null,
        environmentPolicySignals: policy.signals,
        environmentPolicySignal: policy.primarySignal,
        previewLifecycle,
      }),
      scopeLabel: getEnvironmentScopeLabel(environment),
      sourceLabel,
      strategyLabel,
      databaseStrategyLabel,
      inheritanceLabel,
      expiryLabel,
      expiryTimestamp: formatEnvironmentTimestamp(environment.expiresAt),
      primaryDomainUrl,
      previewLifecycle,
      latestReleaseCard,
      sourceBuild,
      gitTracking,
      cleanupState,
    };
  });
}
