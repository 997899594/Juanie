import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import {
  formatEnvironmentExpiry,
  formatEnvironmentTimestamp,
  getEnvironmentDatabaseStrategyLabel,
  getEnvironmentDeploymentStrategyLabel,
  getEnvironmentInheritancePresentation,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
  getPreviewDatabasePresentation,
} from '@/lib/environments/presentation';
import { isPreviewEnvironmentExpired } from '@/lib/environments/preview';
import { type EnvironmentPolicySnapshot, evaluateEnvironmentPolicy } from '@/lib/policies/delivery';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';

interface EnvironmentViewLike {
  id: string;
  name: string;
  baseEnvironment?: {
    id: string;
    name: string;
  } | null;
  databaseStrategy?: 'direct' | 'inherit' | 'isolated_clone' | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  previewPrNumber?: number | null;
  branch?: string | null;
  expiresAt?: Date | string | null;
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
  } | null;
  cleanupState: {
    state: 'active' | 'expired_ready' | 'expired_blocked';
    label: string;
    summary: string;
  } | null;
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
          createdAtLabel: formatEnvironmentTimestamp(environment.latestRelease.createdAt),
        }
      : null;
    const policy = evaluateEnvironmentPolicy(environment);
    const previewLifecycle = environment.isPreview
      ? buildPreviewLifecycleSummary({
          sourceLabel,
          expiryLabel,
          primaryDomainUrl,
          latestRelease: latestReleaseCard,
        })
      : null;
    const cleanupState = (() => {
      if (!environment.isPreview) {
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
        ],
        customSummary: previewDatabase?.summary ?? null,
        customNextActionLabel: previewDatabase?.nextActionLabel ?? null,
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
      cleanupState,
    };
  });
}
