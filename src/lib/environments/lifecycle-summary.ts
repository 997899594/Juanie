export interface PreviewLifecycleInput {
  sourceLabel?: string | null;
  expiryLabel?: string | null;
  primaryDomainUrl?: string | null;
  latestRelease?: {
    id: string;
    title: string;
  } | null;
}

export interface PreviewLifecycleSummary {
  stateLabel: string;
  summary: string | null;
  nextActionLabel: string;
}

export function buildPreviewLifecycleSummary(
  input: PreviewLifecycleInput
): PreviewLifecycleSummary {
  const summaryParts = [
    input.sourceLabel ? `来源 ${input.sourceLabel}` : null,
    input.latestRelease ? `最近发布 ${input.latestRelease.title}` : null,
    input.expiryLabel,
  ].filter(Boolean);

  if (input.expiryLabel === '已过期') {
    return {
      stateLabel: '已过期',
      summary: summaryParts.join(' · ') || null,
      nextActionLabel: input.latestRelease ? '打开发布' : '重新创建',
    };
  }

  if (input.primaryDomainUrl) {
    return {
      stateLabel: '可访问',
      summary: summaryParts.join(' · ') || null,
      nextActionLabel: '打开环境',
    };
  }

  if (input.latestRelease) {
    return {
      stateLabel: '已发布',
      summary: summaryParts.join(' · ') || null,
      nextActionLabel: '打开发布',
    };
  }

  return {
    stateLabel: '待发布',
    summary: summaryParts.join(' · ') || null,
    nextActionLabel: '等待发布',
  };
}
