/**
 * Nitro 配置模块 - 为 Nitro 环境提供配置访问
 */

import { type Config, ConfigError } from './index'
import { getCachedConfig, loadConfig } from './loader'

// ============================================================================
// 全局配置实例
// ============================================================================

let globalConfig: Config | null = null

/** 初始化全局配置 */
function initializeConfig(): Config {
  if (!globalConfig) {
    try {
      globalConfig = loadConfig()
    } catch (error) {
      throw new ConfigError(
        `Failed to initialize Nitro configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
  return globalConfig
}

// ============================================================================
// 配置访问函数
// ============================================================================

/** 获取完整配置 */
export function getConfig(): Config {
  return initializeConfig()
}

/** 获取应用配置 */
export function getAppConfig(): Config['app'] {
  return getConfig().app
}

/** 获取数据库配置 */
export function getDatabaseConfig(): Config['database'] {
  return getConfig().database
}

/** 获取 Redis 配置 */
export function getRedisConfig(): Config['redis'] {
  return getConfig().redis
}

/** 获取 OAuth 配置 */
export function getOAuthConfig(): Config['oauth'] {
  return getConfig().oauth
}

/** 获取安全配置 */
export function getSecurityConfig(): Config['security'] {
  return getConfig().security
}

/** 获取监控配置 */
export function getMonitoringConfig(): Config['monitoring'] {
  return getConfig().monitoring
}

/** 获取嵌套配置值 */
export function getConfigValue<T = any>(path: string): T | undefined {
  const keys = path.split('.')
  let current: any = getConfig()

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = current[key]
  }

  return current
}

/** 获取嵌套配置值（带默认值） */
export function getConfigValueOrThrow<T = any>(path: string): T {
  const value = getConfigValue<T>(path)
  if (value === undefined) {
    throw new ConfigError(`Configuration value not found: ${path}`)
  }
  return value
}

/** 检查配置路径是否存在 */
export function hasConfigValue(path: string): boolean {
  return getConfigValue(path) !== undefined
}

// ============================================================================
// 环境检查函数
// ============================================================================

/** 获取当前环境 */
export function getEnvironment(): Config['app']['environment'] {
  return getAppConfig().environment
}

/** 检查是否为开发环境 */
export function isDevelopment(): boolean {
  return getEnvironment() === 'development'
}

/** 检查是否为生产环境 */
export function isProduction(): boolean {
  return getEnvironment() === 'production'
}

/** 检查是否为测试环境 */
export function isTest(): boolean {
  return getEnvironment() === 'test'
}

/** 检查是否启用调试 */
export function isDebug(): boolean {
  return getAppConfig().debug
}

// ============================================================================
// 配置重载和缓存管理
// ============================================================================

/** 重新加载配置 */
export function reloadConfig(): Config {
  globalConfig = null
  return initializeConfig()
}

/** 清除配置缓存 */
export function clearConfigCache(): void {
  globalConfig = null
}

/** 检查配置是否已初始化 */
export function isConfigInitialized(): boolean {
  return globalConfig !== null
}

// ============================================================================
// 配置验证和健康检查
// ============================================================================

/** 验证配置完整性 */
export function validateConfig(): { valid: boolean; errors: string[] } {
  try {
    const config = getConfig()
    const errors: string[] = []

    // 检查必需的配置
    if (!config.database.url) {
      errors.push('Database URL is required')
    }

    if (!config.oauth.github.clientId || !config.oauth.github.clientSecret) {
      errors.push('GitHub OAuth configuration is incomplete')
    }

    if (!config.oauth.gitlab.clientId || !config.oauth.gitlab.clientSecret) {
      errors.push('GitLab OAuth configuration is incomplete')
    }

    if (!config.security.sessionSecret) {
      errors.push('Session secret is required')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  } catch (error) {
    return {
      valid: false,
      errors: [error instanceof Error ? error.message : 'Unknown configuration error'],
    }
  }
}

/** 获取配置健康状态 */
export function getConfigHealth(): {
  status: 'healthy' | 'unhealthy'
  details: {
    initialized: boolean
    valid: boolean
    environment: string
    errors: string[]
  }
} {
  const validation = validateConfig()

  return {
    status: validation.valid ? 'healthy' : 'unhealthy',
    details: {
      initialized: isConfigInitialized(),
      valid: validation.valid,
      environment: getEnvironment(),
      errors: validation.errors,
    },
  }
}

// ============================================================================
// 类型导出
// ============================================================================

export type { Config } from './index'

// ============================================================================
// 错误类导出
// ============================================================================

export { ConfigError, ConfigValidationError } from './index'

// ============================================================================
// 默认导出（向后兼容）
// ============================================================================

export default {
  getConfig,
  getAppConfig,
  getDatabaseConfig,
  getRedisConfig,
  getOAuthConfig,
  getSecurityConfig,
  getMonitoringConfig,
  getConfigValue,
  getConfigValueOrThrow,
  hasConfigValue,
  getEnvironment,
  isDevelopment,
  isProduction,
  isTest,
  isDebug,
  reloadConfig,
  clearConfigCache,
  validateConfig,
  getConfigHealth,
}
