import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewAction {
  label: string;
  href: string;
}

export interface ProjectCommandCenterSnapshot {
  eyebrow: string;
  title: string;
  summary: string;
  primaryAction: ProjectOverviewAction;
  secondaryAction: ProjectOverviewAction | null;
}

export function buildProjectCommandCenter(
  projectId: string,
  pageData: ProjectOverviewPageData
): ProjectCommandCenterSnapshot {
  const currentRelease = pageData.recentReleaseCards[0] ?? null;
  const primaryAttention = pageData.attentionItems[0] ?? null;
  const primaryEnvironment = pageData.environmentCards[0] ?? null;

  if (primaryAttention) {
    return {
      eyebrow: '待处理优先',
      title: primaryAttention.releaseTitle ?? primaryAttention.issueLabel ?? '处理当前阻塞项',
      summary:
        primaryAttention.platformSignals.primarySummary ??
        '当前有迁移审批或失败项需要先处理，处理完再继续推进发布。',
      primaryAction: {
        label: '打开待处理项',
        href: primaryAttention.releaseId
          ? `/projects/${projectId}/delivery/${primaryAttention.releaseId}`
          : `/projects/${projectId}/delivery`,
      },
      secondaryAction: primaryEnvironment
        ? {
            label: '查看环境日志',
            href: `/projects/${projectId}/runtime/logs?env=${primaryEnvironment.id}`,
          }
        : null,
    };
  }

  if (currentRelease) {
    return {
      eyebrow: '当前主链路',
      title: currentRelease.title,
      summary:
        currentRelease.platformSignals.primarySummary ??
        currentRelease.sourceSummary ??
        '进入发布详情查看时间线、迁移和部署进度。',
      primaryAction: {
        label: '打开当前发布',
        href: `/projects/${projectId}/delivery/${currentRelease.id}`,
      },
      secondaryAction: {
        label: '查看环境日志',
        href: `/projects/${projectId}/runtime/logs?env=${currentRelease.environment.id}`,
      },
    };
  }

  if (primaryEnvironment) {
    return {
      eyebrow: '从环境开始',
      title: `进入 ${primaryEnvironment.name}`,
      summary:
        primaryEnvironment.platformSignals.primarySummary ??
        '先进入环境确认 live 状态、发布记录和诊断信息。',
      primaryAction: {
        label: '打开运行',
        href: `/projects/${projectId}/runtime`,
      },
      secondaryAction: {
        label: '查看交付',
        href: `/projects/${projectId}/delivery`,
      },
    };
  }

  return {
    eyebrow: '项目初始化',
    title: '继续完成项目配置',
    summary: '先补齐环境和第一次发布，平台主链路才会完整运行起来。',
    primaryAction: {
      label: '查看运行',
      href: `/projects/${projectId}/runtime`,
    },
    secondaryAction: {
      label: '查看设置',
      href: `/projects/${projectId}/settings`,
    },
  };
}
