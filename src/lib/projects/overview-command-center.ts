import type { ProjectOverviewPageData } from '@/lib/projects/service';

interface ProjectOverviewAction {
  label: string;
  href: string;
  description?: string;
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
      eyebrow: '从环境开始',
      title: `先进入 ${primaryEnvironment.name}`,
      summary:
        primaryEnvironment.platformSignals.primarySummary ??
        '项目页只做索引，真正的工作都放到具体环境里继续处理。',
      primaryAction: {
        label: '打开环境',
        href: `/projects/${projectId}/runtime?env=${primaryEnvironment.id}`,
        description:
          primaryEnvironment.platformSignals.nextActionLabel ??
          '进入后先看当前版本、诊断和下一步动作。',
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
      eyebrow: '先补主链',
      title: currentRelease.title,
      summary:
        currentRelease.platformSignals.primarySummary ??
        currentRelease.sourceSummary ??
        '先确认最新发布，再决定下一步去哪个环境处理。',
      primaryAction: {
        label: '查看最新发布',
        href: `/projects/${projectId}/delivery/${currentRelease.id}`,
        description: '确认这次发布影响了哪个环境，再继续处理。',
      },
      secondaryAction: {
        label: '查看环境',
        href: `/projects/${projectId}/runtime`,
      },
    };
  }

  return {
    eyebrow: '项目初始化',
    title: '继续完成项目配置',
    summary: '先补齐环境和第一次发布，让项目先形成可进入的主链路。',
    primaryAction: {
      label: '查看环境',
      href: `/projects/${projectId}/runtime`,
      description: '先把项目内的环境结构建立起来。',
    },
    secondaryAction: {
      label: '查看设置',
      href: `/projects/${projectId}/settings`,
    },
  };
}
