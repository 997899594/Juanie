import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import {
  formatEnvironmentExpiry,
  getEnvironmentScopeLabel,
  getEnvironmentSourceLabel,
} from '@/lib/environments/presentation';
import type { PreviewReviewMetadata } from '@/lib/environments/review-metadata';
import {
  buildPreviewSourceMetadata,
  type PreviewSourceMetadata,
} from '@/lib/environments/source-metadata';
import { buildProjectGovernanceSnapshot } from '@/lib/projects/settings-view';
import {
  buildIssueSnapshot,
  getIssueLabel,
  getMigrationAttentionIssueCode,
  getReleaseActionLabel,
  type ReleaseIssueCode,
  type ReleaseIssueSnapshot,
} from '@/lib/releases/intelligence';
import { getReleaseDisplayTitle } from '@/lib/releases/presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';

export interface HomeStat {
  label: string;
  value: number | string;
}

export interface HomeProjectLike {
  id: string;
  name: string;
  teamId: string;
  status?: string | null;
  repository?: {
    fullName?: string | null;
  } | null;
  environments?: Array<{
    id: string;
    name: string;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  }>;
}

export interface HomeAttentionRunLike {
  id: string;
  projectId: string;
  releaseId?: string | null;
  status: string;
  createdAt?: Date | string | null;
  database?: {
    name?: string | null;
  } | null;
  project?: {
    name?: string | null;
  } | null;
  environment?: {
    name?: string | null;
    isPreview?: boolean | null;
    previewPrNumber?: number | null;
    branch?: string | null;
    expiresAt?: Date | string | null;
    domains?: Array<{
      id: string;
      hostname: string;
      isCustom?: boolean | null;
      isVerified?: boolean | null;
    }> | null;
  } | null;
  release?: {
    id: string;
    summary?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    environment?: {
      isPreview?: boolean | null;
    } | null;
  } | null;
  previewReviewMetadata?: PreviewReviewMetadata | null;
}

export interface HomeProjectDecorations {
  statusLabel: string;
  repositoryLabel: string;
  governanceSummary: string | null;
  governanceSignals: Array<{
    key: string;
    label: string;
    tone: 'danger' | 'neutral';
  }>;
}

export interface HomeAttentionRunDecorations {
  platformSignals: PlatformSignalSnapshot;
  issue: ReleaseIssueSnapshot | null;
  issueCode: ReleaseIssueCode | null;
  issueLabel: string | null;
  actionLabel: string | null;
  href: string;
  databaseName: string;
  projectName: string;
  createdAtLabel: string;
  environmentScopeLabel: string | null;
  environmentSourceLabel: string | null;
  environmentExpiryLabel: string | null;
  primaryDomainUrl: string | null;
  releaseTitle: string | null;
  previewSourceMeta: PreviewSourceMetadata;
  previewLifecycle: PreviewLifecycleSummary | null;
}

function formatProjectStatusLabel(value?: string | null): string {
  const labels: Record<string, string> = {
    active: '运行中',
    running: '运行中',
    initializing: '初始化中',
    pending: '待处理',
    failed: '失败',
    archived: '已归档',
  };

  return value ? (labels[value] ?? value) : '待处理';
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  const diff = now.getTime() - target.getTime();

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes} 分钟前`;
  if (hours < 24) return `${hours} 小时前`;
  if (days < 7) return `${days} 天前`;
  return target.toLocaleDateString();
}

export function buildHomeStats(input: {
  projectCount: number;
  teamCount: number;
  attentionCount: number;
  resourceValue?: string;
}): HomeStat[] {
  return [
    { label: '项目', value: input.projectCount },
    { label: '团队', value: input.teamCount },
    { label: '待处理', value: input.attentionCount },
    { label: '资源', value: input.resourceValue ?? '—' },
  ];
}

export function decorateHomeProjects<TProject extends HomeProjectLike>(
  projects: TProject[],
  input: {
    rolesByTeamId?: Map<string, 'owner' | 'admin' | 'member'>;
  } = {}
): Array<TProject & HomeProjectDecorations> {
  return projects.map((project) => ({
    ...(() => {
      const role = input.rolesByTeamId?.get(project.teamId);
      if (!role) {
        return {
          governanceSummary: null,
          governanceSignals: [],
        };
      }

      const governance = buildProjectGovernanceSnapshot({
        role,
        environments: project.environments ?? [],
      });

      return {
        governanceSummary: governance.primarySummary,
        governanceSignals: governance.signals,
      };
    })(),
    ...project,
    statusLabel: formatProjectStatusLabel(project.status),
    repositoryLabel: project.repository?.fullName || '未绑定仓库',
  }));
}

export function decorateHomeAttentionRuns<TRun extends HomeAttentionRunLike>(
  runs: TRun[]
): Array<TRun & HomeAttentionRunDecorations> {
  return runs.map((run) => {
    const issueCode = getMigrationAttentionIssueCode(run);
    const issue = buildIssueSnapshot(issueCode);
    const environmentScopeLabel = run.environment
      ? getEnvironmentScopeLabel(run.environment)
      : null;
    const environmentSourceLabel = run.environment
      ? getEnvironmentSourceLabel(run.environment)
      : null;
    const environmentExpiryLabel = formatEnvironmentExpiry(run.environment?.expiresAt);
    const primaryDomainUrl = (() => {
      const primaryDomain = run.environment?.domains?.length
        ? pickPrimaryEnvironmentDomain(run.environment.domains)
        : null;

      return primaryDomain ? buildEnvironmentAccessUrl(primaryDomain.hostname) : null;
    })();
    const releaseTitle = run.release ? getReleaseDisplayTitle(run.release) : null;
    const previewSourceMeta = buildPreviewSourceMetadata({
      sourceRef: run.release?.sourceRef,
      environment: run.environment,
      reviewRequest: run.previewReviewMetadata ?? null,
    });
    const previewLifecycle = run.environment?.isPreview
      ? buildPreviewLifecycleSummary({
          sourceLabel: previewSourceMeta.label ?? environmentSourceLabel,
          expiryLabel: environmentExpiryLabel,
          primaryDomainUrl,
          latestRelease: run.release
            ? {
                id: run.release.id,
                title: releaseTitle ?? '最近发布',
              }
            : null,
        })
      : null;

    return {
      ...run,
      platformSignals: buildPlatformSignalSnapshot({
        issue,
        previewLifecycle,
      }),
      issue,
      issueCode,
      issueLabel: issue?.label ?? getIssueLabel(issueCode),
      actionLabel: issue?.nextActionLabel ?? getReleaseActionLabel(issueCode),
      href: run.releaseId
        ? `/projects/${run.projectId}/releases/${run.releaseId}`
        : `/projects/${run.projectId}`,
      databaseName: run.database?.name ?? '数据库',
      projectName: run.project?.name ?? '项目',
      createdAtLabel: run.createdAt ? formatRelativeTime(run.createdAt) : '—',
      environmentScopeLabel,
      environmentSourceLabel,
      environmentExpiryLabel,
      primaryDomainUrl,
      releaseTitle,
      previewSourceMeta,
      previewLifecycle,
    };
  });
}
