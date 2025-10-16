/**
 * 配置加载器 - 负责从环境变量加载和验证配置
 */

import {
  type Config,
  ConfigError,
  ConfigSchema,
  ConfigValidationError,
  ENV_MAPPING,
  type Environment,
} from './index'

// ============================================================================
// 类型转换工具
// ============================================================================

/** 字符串转布尔值 */
function parseBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue
  const normalized = value.toLowerCase().trim()
  return normalized === 'true' || normalized === '1' || normalized === 'yes'
}

/** 字符串转数字 */
function parseNumber(value: string | undefined, defaultValue = 0): number {
  if (!value) return defaultValue
  const parsed = Number(value)
  if (isNaN(parsed)) {
    throw new ConfigError(`Invalid number value: ${value}`)
  }
  return parsed
}

/** 字符串转数组 */
function parseArray(value: string | undefined, separator = ','): string[] {
  if (!value) return []
  return value
    .split(separator)
    .map((item) => item.trim())
    .filter(Boolean)
}

/** 字符串转 JSON */
function parseJSON<T>(value: string | undefined, defaultValue: T): T {
  if (!value) return defaultValue
  try {
    return JSON.parse(value)
  } catch {
    throw new ConfigError(`Invalid JSON value: ${value}`)
  }
}

// ============================================================================
// 环境变量读取器
// ============================================================================

class EnvironmentReader {
  private readonly env: Record<string, string | undefined>

  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env
  }

  /** 获取字符串值 */
  getString(key: string, defaultValue?: string): string | undefined {
    const value = this.env[key]
    return value !== undefined ? value : defaultValue
  }

  /** 获取必需的字符串值 */
  getRequiredString(key: string): string {
    const value = this.getString(key)
    if (!value) {
      throw new ConfigError(`Required environment variable ${key} is missing`)
    }
    return value
  }

  /** 获取数字值 */
  getNumber(key: string, defaultValue?: number): number | undefined {
    const value = this.getString(key)
    if (value === undefined) return defaultValue
    return parseNumber(value, defaultValue)
  }

  /** 获取必需的数字值 */
  getRequiredNumber(key: string): number {
    const value = this.getNumber(key)
    if (value === undefined) {
      throw new ConfigError(`Required environment variable ${key} is missing`)
    }
    return value
  }

  /** 获取布尔值 */
  getBoolean(key: string, defaultValue = false): boolean {
    const value = this.getString(key)
    return parseBoolean(value, defaultValue)
  }

  /** 获取数组值 */
  getArray(key: string, separator = ',', defaultValue: string[] = []): string[] {
    const value = this.getString(key)
    return value ? parseArray(value, separator) : defaultValue
  }

  /** 获取 JSON 值 */
  getJSON<T>(key: string, defaultValue: T): T {
    const value = this.getString(key)
    return parseJSON(value, defaultValue)
  }

  /** 检查环境变量是否存在 */
  has(key: string): boolean {
    return this.env[key] !== undefined
  }

  /** 获取所有环境变量 */
  getAll(): Record<string, string | undefined> {
    return { ...this.env }
  }
}

// ============================================================================
// 配置构建器
// ============================================================================

class ConfigBuilder {
  private readonly reader: EnvironmentReader
  private readonly config: Partial<Config> = {}

  constructor(reader: EnvironmentReader) {
    this.reader = reader
  }

  /** 构建应用配置 */
  private buildAppConfig(): Config['app'] {
    const environment = this.reader.getString('NODE_ENV', 'development') as Environment

    return {
      name: this.reader.getRequiredString('APP_NAME'),
      version: this.reader.getRequiredString('APP_VERSION'),
      environment,
      port: this.reader.getRequiredNumber('PORT'),
      host: this.reader.getRequiredString('HOST'),
      debug: this.reader.getBoolean('DEBUG', environment === 'development'),
    }
  }

  /** 构建数据库配置 */
  private buildDatabaseConfig(): Config['database'] {
    return {
      url: this.reader.getRequiredString('DATABASE_URL'),
      poolSize: this.reader.getRequiredNumber('DATABASE_POOL_SIZE'),
      ssl: this.reader.getBoolean('DATABASE_SSL'),
      timeout: this.reader.getRequiredNumber('DATABASE_TIMEOUT'),
    }
  }

  /** 构建 Redis 配置 */
  private buildRedisConfig(): Config['redis'] {
    const url = this.reader.getString('REDIS_URL')
    const token = this.reader.getString('REDIS_TOKEN')

    // Redis 是可选的
    if (!url || !token) {
      return undefined
    }

    return {
      url,
      token,
      maxRetries: this.reader.getRequiredNumber('REDIS_MAX_RETRIES'),
      retryDelay: this.reader.getRequiredNumber('REDIS_RETRY_DELAY'),
      timeout: this.reader.getRequiredNumber('REDIS_TIMEOUT'),
    }
  }

  /** 构建 OAuth 配置 */
  private buildOAuthConfig(): Config['oauth'] {
    return {
      github: {
        clientId: this.reader.getRequiredString('GITHUB_CLIENT_ID'),
        clientSecret: this.reader.getRequiredString('GITHUB_CLIENT_SECRET'),
        redirectUri: this.reader.getRequiredString('GITHUB_REDIRECT_URI'),
      },
      gitlab: {
        clientId: this.reader.getRequiredString('GITLAB_CLIENT_ID'),
        clientSecret: this.reader.getRequiredString('GITLAB_CLIENT_SECRET'),
        redirectUri: this.reader.getRequiredString('GITLAB_REDIRECT_URI'),
        baseUrl: this.reader.getRequiredString('GITLAB_BASE_URL'),
      },
    }
  }

  /** 构建安全配置 */
  private buildSecurityConfig(): Config['security'] {
    return {
      corsOrigins: this.reader.getArray('CORS_ORIGINS', ','),
      bcryptRounds: this.reader.getRequiredNumber('BCRYPT_ROUNDS'),
      sessionSecret: this.reader.getRequiredString('SESSION_SECRET'),
      rateLimitEnabled: this.reader.getBoolean('RATE_LIMIT_ENABLED'),
      rateLimitRequests: this.reader.getRequiredNumber('RATE_LIMIT_REQUESTS'),
      rateLimitWindow: this.reader.getRequiredNumber('RATE_LIMIT_WINDOW'),
    }
  }

  /** 构建监控配置 */
  private buildMonitoringConfig(): Config['monitoring'] {
    return {
      healthCheckEnabled: this.reader.getBoolean('HEALTH_CHECK_ENABLED'),
      metricsEnabled: this.reader.getBoolean('METRICS_ENABLED'),
      tracingEnabled: this.reader.getBoolean('TRACING_ENABLED'),
      tracingEndpoint: this.reader.getString('TRACING_ENDPOINT'),
      logLevel: this.reader.getString('LOG_LEVEL', 'info') as Config['monitoring']['logLevel'],
      logPretty: this.reader.getBoolean('LOG_PRETTY'),
    }
  }

  /** 构建完整配置 */
  build(): Config {
    try {
      const config: Config = {
        app: this.buildAppConfig(),
        database: this.buildDatabaseConfig(),
        redis: this.buildRedisConfig(),
        oauth: this.buildOAuthConfig(),
        security: this.buildSecurityConfig(),
        monitoring: this.buildMonitoringConfig(),
      }

      return config
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error
      }
      throw new ConfigError(
        `Failed to build configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}

// ============================================================================
// 配置加载器
// ============================================================================

export class ConfigLoader {
  private static instance: ConfigLoader | null = null
  private cachedConfig: Config | null = null

  private constructor() {}

  /** 获取单例实例 */
  static getInstance(): ConfigLoader {
    if (!ConfigLoader.instance) {
      ConfigLoader.instance = new ConfigLoader()
    }
    return ConfigLoader.instance
  }

  /** 加载配置 */
  load(env?: Record<string, string | undefined>): Config {
    if (this.cachedConfig) {
      return this.cachedConfig
    }

    try {
      const reader = new EnvironmentReader(env)
      const builder = new ConfigBuilder(reader)
      const config = builder.build()

      // 验证配置
      const validatedConfig = this.validate(config)

      // 缓存配置
      this.cachedConfig = validatedConfig

      return validatedConfig
    } catch (error) {
      if (error instanceof ConfigError) {
        throw error
      }
      throw new ConfigError(
        `Configuration loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /** 验证配置 */
  private validate(config: Config): Config {
    try {
      return ConfigSchema.parse(config)
    } catch (error) {
      if (error instanceof Error && 'issues' in error) {
        throw new ConfigValidationError(error as any)
      }
      throw new ConfigError(
        `Configuration validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /** 重新加载配置 */
  reload(env?: Record<string, string | undefined>): Config {
    this.cachedConfig = null
    return this.load(env)
  }

  /** 获取缓存的配置 */
  getCached(): Config | null {
    return this.cachedConfig
  }

  /** 清除缓存 */
  clearCache(): void {
    this.cachedConfig = null
  }

  /** 重置单例（用于测试） */
  static reset(): void {
    if (ConfigLoader.instance) {
      ConfigLoader.instance.clearCache()
      ConfigLoader.instance = null
    }
  }
}

// ============================================================================
// 便捷函数
// ============================================================================

/** 加载配置 */
export function loadConfig(env?: Record<string, string | undefined>): Config {
  return ConfigLoader.getInstance().load(env)
}

/** 重新加载配置 */
export function reloadConfig(env?: Record<string, string | undefined>): Config {
  return ConfigLoader.getInstance().reload(env)
}

/** 获取缓存的配置 */
export function getCachedConfig(): Config | null {
  return ConfigLoader.getInstance().getCached()
}

// 默认导出
export default ConfigLoader
