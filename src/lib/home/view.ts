import { buildEnvironmentAccessUrl, pickPrimaryEnvironmentDomain } from '@/lib/domains/defaults';
import {
  buildPreviewLifecycleSummary,
  type PreviewLifecycleSummary,
} from '@/lib/environments/lifecycle-summary';
import { type EnvironmentKindLike, isPreviewEnvironment } from '@/lib/environments/model';
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
import { formatRuntimeStatusLabel } from '@/lib/runtime/status-presentation';
import { buildPlatformSignalSnapshot, type PlatformSignalSnapshot } from '@/lib/signals/platform';
import { formatPlatformRelativeTime } from '@/lib/time/format';

export interface HomeStat {
  label: string;
  value: number | string;
}

export interface HomeCommandCenterAction {
  label: string;
  href: string;
  description: string;
  tone: 'danger' | 'neutral';
}

export interface HomeCommandCenterFocusItem {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  meta: string;
  tone: 'danger' | 'neutral';
}

export interface HomeCommandCenter {
  title: string;
  summary: string;
  primaryAction: HomeCommandCenterAction;
  secondaryAction?: Pick<HomeCommandCenterAction, 'label' | 'href'> | null;
  focusItems: HomeCommandCenterFocusItem[];
}

export interface HomeProjectLike {
  id: string;
  name: string;
  teamId: string;
  status?: string | null;
  repository?: {
    fullName?: string | null;
  } | null;
  environments?: Array<
    EnvironmentKindLike & {
      id: string;
      name: string;
    }
  >;
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
  environment?:
    | (EnvironmentKindLike & {
        name?: string | null;
        previewPrNumber?: number | null;
        branch?: string | null;
        expiresAt?: Date | string | null;
        domains?: Array<{
          id: string;
          hostname: string;
          isCustom?: boolean | null;
          isVerified?: boolean | null;
        }> | null;
      })
    | null;
  release?: {
    id: string;
    summary?: string | null;
    sourceRef?: string | null;
    sourceCommitSha?: string | null;
    environment?: EnvironmentKindLike | null;
  } | null;
  previewReviewMetadata?: PreviewReviewMetadata | null;
}

export interface HomeProjectDecorations {
  statusLabel: string;
  repositoryLabel: string;
  roleLabel: string | null;
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

function needsProjectAttention(status?: string | null): boolean {
  return status === 'initializing' || status === 'pending' || status === 'failed';
}

export function formatRelativeTime(date: Date | string): string {
  return formatPlatformRelativeTime(date) ?? '—';
}

export function buildHomeStats(input: {
  projectCount: number;
  teamCount: number;
  attentionCount: number;
  activeProjectCount: number;
}): HomeStat[] {
  return [
    { label: '项目', value: input.projectCount },
    { label: '团队', value: input.teamCount },
    { label: '待处理', value: input.attentionCount },
    { label: '运行中', value: input.activeProjectCount },
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
          roleLabel: null,
        };
      }

      const governance = buildProjectGovernanceSnapshot({
        role,
        environments: project.environments ?? [],
      });

      return {
        roleLabel: governance.roleLabel,
      };
    })(),
    ...project,
    statusLabel: formatRuntimeStatusLabel(project.status),
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
    const previewLifecycle =
      run.environment && isPreviewEnvironment(run.environment)
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
        ? `/projects/${run.projectId}/delivery/${run.releaseId}`
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

export function buildHomeCommandCenter<
  TProject extends HomeProjectLike & HomeProjectDecorations,
  TRun extends HomeAttentionRunLike & HomeAttentionRunDecorations,
>(input: { projectCards: TProject[]; attentionItems: TRun[] }): HomeCommandCenter {
  const projectNeedingAttention = input.projectCards.filter((project) =>
    needsProjectAttention(project.status)
  );

  const primaryAction = (() => {
    const firstAttention = input.attentionItems[0];
    if (firstAttention) {
      return {
        title:
          firstAttention.issueLabel ??
          firstAttention.releaseTitle ??
          `${firstAttention.projectName} 需要处理`,
        summary:
          firstAttention.platformSignals.primarySummary ??
          `${firstAttention.projectName} 有待确认的数据库变更或迁移结果。`,
        primaryAction: {
          label: '打开待处理项',
          href: firstAttention.href,
          description: `下一步：${firstAttention.platformSignals.nextActionLabel ?? firstAttention.actionLabel ?? '进入详情处理'}`,
          tone: firstAttention.status === 'failed' ? 'danger' : 'neutral',
        } satisfies HomeCommandCenterAction,
        secondaryAction: input.projectCards[0]
          ? {
              label: '查看项目',
              href: `/projects/${input.projectCards[0].id}`,
            }
          : null,
      };
    }

    const firstProjectAttention = projectNeedingAttention[0];
    if (firstProjectAttention) {
      return {
        title: `继续推进 ${firstProjectAttention.name}`,
        summary: `${firstProjectAttention.name} 当前处于${firstProjectAttention.statusLabel}，建议先进入项目确认环境、发布与诊断状态。`,
        primaryAction: {
          label: '打开项目',
          href: `/projects/${firstProjectAttention.id}`,
          description: `${firstProjectAttention.repositoryLabel} · ${firstProjectAttention.statusLabel}`,
          tone: firstProjectAttention.status === 'failed' ? 'danger' : 'neutral',
        } satisfies HomeCommandCenterAction,
        secondaryAction: {
          label: '查看全部项目',
          href: '/projects',
        },
      };
    }

    const firstProject = input.projectCards[0];
    if (firstProject) {
      return {
        title: `继续查看 ${firstProject.name}`,
        summary: '平台当前没有阻塞项，你可以直接进入项目查看环境、发布和日志。',
        primaryAction: {
          label: '打开最近项目',
          href: `/projects/${firstProject.id}`,
          description: `${firstProject.repositoryLabel} · ${firstProject.statusLabel}`,
          tone: 'neutral',
        } satisfies HomeCommandCenterAction,
        secondaryAction: {
          label: '查看审批',
          href: '/inbox',
        },
      };
    }

    return {
      title: '创建第一个项目',
      summary: '先把仓库接进来，平台就能开始管理环境、发布、迁移和日志。',
      primaryAction: {
        label: '新建项目',
        href: '/projects/new',
        description: '从模板创建，或导入现有仓库',
        tone: 'neutral',
      } satisfies HomeCommandCenterAction,
      secondaryAction: {
        label: '查看项目列表',
        href: '/projects',
      },
    };
  })();

  const focusItems = [
    ...input.attentionItems.slice(0, 3).map(
      (item) =>
        ({
          id: item.id,
          eyebrow:
            item.status === 'awaiting_approval'
              ? '待审批'
              : item.status === 'awaiting_external_completion'
                ? '待外部完成'
                : '待处理',
          title: item.releaseTitle ?? item.issueLabel ?? item.databaseName,
          description:
            item.platformSignals.primarySummary ??
            `${item.projectName} · ${item.databaseName} 需要进一步处理`,
          href: item.href,
          meta: `${item.projectName} · ${item.createdAtLabel}`,
          tone: item.status === 'failed' ? 'danger' : 'neutral',
        }) satisfies HomeCommandCenterFocusItem
    ),
    ...projectNeedingAttention
      .filter((project) => !input.attentionItems.some((item) => item.projectId === project.id))
      .slice(0, 3)
      .map(
        (project) =>
          ({
            id: `project:${project.id}`,
            eyebrow: '项目状态',
            title: project.name,
            description: `${project.repositoryLabel} · ${project.statusLabel}`,
            href: `/projects/${project.id}`,
            meta: project.roleLabel ?? '项目成员',
            tone: project.status === 'failed' ? 'danger' : 'neutral',
          }) satisfies HomeCommandCenterFocusItem
      ),
  ].slice(0, 4);

  return {
    title: primaryAction.title,
    summary: primaryAction.summary,
    primaryAction: primaryAction.primaryAction,
    secondaryAction: primaryAction.secondaryAction,
    focusItems,
  };
}
