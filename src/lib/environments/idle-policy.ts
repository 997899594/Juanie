const DEFAULT_PREVIEW_IDLE_SLEEP_MINUTES = 60;
const DEFAULT_PERSISTENT_IDLE_SLEEP_MINUTES = 360;
const MIN_IDLE_SLEEP_MINUTES = 15;
const MAX_IDLE_SLEEP_MINUTES = 24 * 60;

export interface EnvironmentIdlePolicyLike {
  kind?: 'production' | 'persistent' | 'preview' | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
  autoSleepEnabled?: boolean | null;
  idleSleepMinutes?: number | null;
  lastRuntimeActivityAt?: Date | string | null;
  lastRuntimeSleptAt?: Date | string | null;
  updatedAt?: Date | string | null;
  createdAt?: Date | string | null;
}

export interface EnvironmentAutoSleepSnapshot {
  enabled: boolean;
  idleMinutes: number | null;
  lastActivityAt: Date | string | null;
  lastSleptAt: Date | string | null;
  summary: string;
}

function clampIdleMinutes(value: number): number {
  return Math.max(MIN_IDLE_SLEEP_MINUTES, Math.min(value, MAX_IDLE_SLEEP_MINUTES));
}

function getDefaultIdleSleepMinutes(environment: EnvironmentIdlePolicyLike): number | null {
  if (isProductionLike(environment)) {
    return null;
  }

  return isPreviewLike(environment)
    ? DEFAULT_PREVIEW_IDLE_SLEEP_MINUTES
    : DEFAULT_PERSISTENT_IDLE_SLEEP_MINUTES;
}

export function resolveEnvironmentIdleSleepMinutes(
  environment: EnvironmentIdlePolicyLike
): number | null {
  if (isProductionLike(environment) || environment.autoSleepEnabled === false) {
    return null;
  }

  if (environment.idleSleepMinutes && environment.idleSleepMinutes > 0) {
    return clampIdleMinutes(environment.idleSleepMinutes);
  }

  return getDefaultIdleSleepMinutes(environment);
}

export function getEnvironmentLastRuntimeActivityAt(
  environment: EnvironmentIdlePolicyLike
): Date | string | null {
  return (
    environment.lastRuntimeActivityAt ?? environment.updatedAt ?? environment.createdAt ?? null
  );
}

export function buildEnvironmentAutoSleepSnapshot(
  environment: EnvironmentIdlePolicyLike
): EnvironmentAutoSleepSnapshot {
  const idleMinutes = resolveEnvironmentIdleSleepMinutes(environment);
  const lastActivityAt = getEnvironmentLastRuntimeActivityAt(environment);

  if (!idleMinutes) {
    return {
      enabled: false,
      idleMinutes: null,
      lastActivityAt,
      lastSleptAt: environment.lastRuntimeSleptAt ?? null,
      summary: isProductionLike(environment) ? '生产环境不自动休眠' : '自动休眠已关闭',
    };
  }

  return {
    enabled: true,
    idleMinutes,
    lastActivityAt,
    lastSleptAt: environment.lastRuntimeSleptAt ?? null,
    summary: `空闲 ${idleMinutes} 分钟后自动休眠`,
  };
}

function isProductionLike(environment: EnvironmentIdlePolicyLike): boolean {
  return environment.kind === 'production' || environment.isProduction === true;
}

function isPreviewLike(environment: EnvironmentIdlePolicyLike): boolean {
  return environment.kind === 'preview' || environment.isPreview === true;
}
