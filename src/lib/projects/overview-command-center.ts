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

  if (primaryEnvironment) {
    return {
      eyebrow: 'environment first',
      title: `先进入 ${primaryEnvironment.name}`,
      summary: primaryEnvironment.platformSignals.primarySummary ?? '项目页只保留入口。',
      primaryAction: {
        label: '打开环境',
        href: `/projects/${projectId}/environments/${primaryEnvironment.id}`,
      },
      secondaryAction: primaryAttention
        ? {
            label: '查看待处理',
            href: primaryAttention.releaseId
              ? `/projects/${projectId}/delivery/${primaryAttention.releaseId}`
              : `/projects/${projectId}/delivery`,
          }
        : currentRelease
          ? {
              label: '查看最新发布',
              href: `/projects/${projectId}/delivery/${currentRelease.id}`,
            }
          : null,
    };
  }

  if (currentRelease) {
    return {
      eyebrow: 'latest release',
      title: currentRelease.title,
      summary:
        currentRelease.platformSignals.primarySummary ??
        currentRelease.sourceSummary ??
        '查看最新发布。',
      primaryAction: {
        label: '查看最新发布',
        href: `/projects/${projectId}/delivery/${currentRelease.id}`,
      },
      secondaryAction: {
        label: '查看环境',
        href: `/projects/${projectId}/environments`,
      },
    };
  }

  return {
    eyebrow: 'setup',
    title: '继续完成项目配置',
    summary: '先补齐环境和第一次发布。',
    primaryAction: {
      label: '查看环境',
      href: `/projects/${projectId}/environments`,
    },
    secondaryAction: {
      label: '查看设置',
      href: `/projects/${projectId}/settings`,
    },
  };
}
