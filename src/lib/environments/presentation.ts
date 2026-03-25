export interface PresentableEnvironment {
  isPreview?: boolean | null;
  previewPrNumber?: number | null;
  branch?: string | null;
  expiresAt?: Date | string | null;
}

export function getEnvironmentScopeLabel(environment: PresentableEnvironment): string | null {
  if (!environment.isPreview) {
    return null;
  }

  return '预览';
}

export function getEnvironmentSourceLabel(environment: PresentableEnvironment): string | null {
  if (!environment.isPreview) {
    return null;
  }

  if (environment.previewPrNumber) {
    return `PR #${environment.previewPrNumber}`;
  }

  if (environment.branch) {
    return environment.branch;
  }

  return null;
}

export function formatEnvironmentExpiry(
  expiresAt?: Date | string | null,
  now = new Date()
): string | null {
  if (!expiresAt) {
    return null;
  }

  const target = new Date(expiresAt);
  if (Number.isNaN(target.getTime())) {
    return null;
  }

  const diff = target.getTime() - now.getTime();
  if (diff <= 0) {
    return '已过期';
  }

  const hours = Math.round(diff / (1000 * 60 * 60));
  if (hours < 24) {
    return `${hours} 小时后到期`;
  }

  const days = Math.round(hours / 24);
  return `${days} 天后到期`;
}

export function formatEnvironmentTimestamp(value?: Date | string | null): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
