const PLATFORM_MANAGED_RUNTIME_ENV_KEYS = new Set(['NODE_ENV', 'APP_ENV']);

export function normalizeEnvVarKey(key: string): string {
  return key.trim().toUpperCase();
}

export function isPlatformManagedRuntimeEnvKey(key: string): boolean {
  return PLATFORM_MANAGED_RUNTIME_ENV_KEYS.has(normalizeEnvVarKey(key));
}

export function buildPlatformRuntimeEnv(environmentName: string): Record<string, string> {
  return {
    NODE_ENV: 'production',
    APP_ENV: environmentName,
  };
}

export function getPlatformManagedRuntimeEnvKeyMessage(key: string): string {
  return `${normalizeEnvVarKey(
    key
  )} is managed by Juanie. Use the environment name in APP_ENV and keep NODE_ENV as production.`;
}
