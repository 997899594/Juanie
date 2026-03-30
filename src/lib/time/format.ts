const platformLocale = 'zh-CN';
const platformTimeZone = 'Asia/Shanghai';

function toDate(value?: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatPlatformDateTime(
  value?: Date | string | null,
  options?: {
    includeYear?: boolean;
    includeSeconds?: boolean;
  }
): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(platformLocale, {
    timeZone: platformTimeZone,
    year: options?.includeYear === false ? undefined : 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: options?.includeSeconds ? '2-digit' : undefined,
    hour12: false,
  }).format(date);
}

export function formatPlatformDateTimeShort(value?: Date | string | null): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(platformLocale, {
    timeZone: platformTimeZone,
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

export function formatPlatformDate(value?: Date | string | null): string | null {
  const date = toDate(value);
  if (!date) {
    return null;
  }

  return new Intl.DateTimeFormat(platformLocale, {
    timeZone: platformTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}
