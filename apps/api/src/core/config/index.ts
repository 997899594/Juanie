/**
 * 全新配置系统 - 专为 Nitro + NestJS 架构设计
 *
 * 设计原则：
 * 1. 单一数据源：所有配置都来自环境变量
 * 2. 类型安全：完整的 TypeScript 类型支持
 * 3. 运行时验证：使用 Zod 进行严格验证
 * 4. 分层架构：支持 Nitro 静态加载和 NestJS 动态注入
 * 5. 开发友好：清晰的错误信息和调试支持
 */

import { z } from 'zod'

// ============================================================================
// 基础类型定义
// ============================================================================

/** 环境类型 */
export const Environment = z.enum(['development', 'test', 'production'])
export type Environment = z.infer<typeof Environment>

/** 日志级别 */
export const LogLevel = z.enum(['error', 'warn', 'info', 'debug', 'trace'])
export type LogLevel = z.infer<typeof LogLevel>

// ============================================================================
// 配置模式定义
// ============================================================================

/** 应用配置 */
export const AppConfigSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
  environment: Environment,
  port: z.number().int().min(1).max(65535),
  host: z.string().min(1),
  debug: z.boolean(),
})

/** 数据库配置 */
export const DatabaseConfigSchema = z.object({
  url: z.string().url(),
  poolSize: z.number().int().min(1).max(100),
  ssl: z.boolean(),
  timeout: z.number().int().min(1000),
})

/** Redis 配置 */
export const RedisConfigSchema = z.object({
  url: z.string().url(),
  token: z.string().min(1),
  maxRetries: z.number().int().min(0),
  retryDelay: z.number().int().min(100),
  timeout: z.number().int().min(1000),
})

/** OAuth 配置 */
export const OAuthConfigSchema = z.object({
  github: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
  }),
  gitlab: z.object({
    clientId: z.string().min(1),
    clientSecret: z.string().min(1),
    redirectUri: z.string().url(),
    baseUrl: z.string().url(),
  }),
})

/** 安全配置 */
export const SecurityConfigSchema = z.object({
  corsOrigins: z.array(z.string()),
  bcryptRounds: z.number().int().min(4).max(20),
  sessionSecret: z.string().min(32),
  rateLimitEnabled: z.boolean(),
  rateLimitRequests: z.number().int().min(1),
  rateLimitWindow: z.number().int().min(1000),
})

/** 监控配置 */
export const MonitoringConfigSchema = z.object({
  healthCheckEnabled: z.boolean(),
  metricsEnabled: z.boolean(),
  tracingEnabled: z.boolean(),
  tracingEndpoint: z.string().url().optional(),
  logLevel: LogLevel,
  logPretty: z.boolean(),
})

/** 完整配置模式 */
export const ConfigSchema = z.object({
  app: AppConfigSchema,
  database: DatabaseConfigSchema,
  redis: RedisConfigSchema.optional(),
  oauth: OAuthConfigSchema,
  security: SecurityConfigSchema,
  monitoring: MonitoringConfigSchema,
})

export type Config = z.infer<typeof ConfigSchema>

// ============================================================================
// 环境变量映射
// ============================================================================

/** 环境变量到配置的映射关系 */
export const ENV_MAPPING = {
  // 应用配置
  APP_NAME: 'app.name',
  APP_VERSION: 'app.version',
  NODE_ENV: 'app.environment',
  PORT: 'app.port',
  HOST: 'app.host',
  DEBUG: 'app.debug',

  // 数据库配置
  DATABASE_URL: 'database.url',
  DATABASE_POOL_SIZE: 'database.poolSize',
  DATABASE_SSL: 'database.ssl',
  DATABASE_TIMEOUT: 'database.timeout',

  // Redis 配置
  REDIS_URL: 'redis.url',
  REDIS_TOKEN: 'redis.token',
  REDIS_MAX_RETRIES: 'redis.maxRetries',
  REDIS_RETRY_DELAY: 'redis.retryDelay',
  REDIS_TIMEOUT: 'redis.timeout',

  // OAuth 配置
  GITHUB_CLIENT_ID: 'oauth.github.clientId',
  GITHUB_CLIENT_SECRET: 'oauth.github.clientSecret',
  GITHUB_REDIRECT_URI: 'oauth.github.redirectUri',
  GITLAB_CLIENT_ID: 'oauth.gitlab.clientId',
  GITLAB_CLIENT_SECRET: 'oauth.gitlab.clientSecret',
  GITLAB_REDIRECT_URI: 'oauth.gitlab.redirectUri',
  GITLAB_BASE_URL: 'oauth.gitlab.baseUrl',

  // 安全配置
  CORS_ORIGINS: 'security.corsOrigins',
  BCRYPT_ROUNDS: 'security.bcryptRounds',
  SESSION_SECRET: 'security.sessionSecret',
  RATE_LIMIT_ENABLED: 'security.rateLimitEnabled',
  RATE_LIMIT_REQUESTS: 'security.rateLimitRequests',
  RATE_LIMIT_WINDOW: 'security.rateLimitWindow',

  // 监控配置
  HEALTH_CHECK_ENABLED: 'monitoring.healthCheckEnabled',
  METRICS_ENABLED: 'monitoring.metricsEnabled',
  TRACING_ENABLED: 'monitoring.tracingEnabled',
  TRACING_ENDPOINT: 'monitoring.tracingEndpoint',
  LOG_LEVEL: 'monitoring.logLevel',
  LOG_PRETTY: 'monitoring.logPretty',
} as const

// ============================================================================
// 默认值定义
// ============================================================================

export const DEFAULT_VALUES: Partial<Config> = {}

// ============================================================================
// 配置错误类
// ============================================================================

export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
    public readonly value?: unknown,
  ) {
    super(message)
    this.name = 'ConfigError'
  }
}

export class ConfigValidationError extends ConfigError {
  constructor(
    public readonly errors: z.ZodError,
    message = 'Configuration validation failed',
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}

// ============================================================================
// 导出类型
// ============================================================================

export type {
  AppConfigSchema as AppConfig,
  DatabaseConfigSchema as DatabaseConfig,
  RedisConfigSchema as RedisConfig,
  OAuthConfigSchema as OAuthConfig,
  SecurityConfigSchema as SecurityConfig,
  MonitoringConfigSchema as MonitoringConfig,
}

// ============================================================================
// 导出函数
// ============================================================================

export { getConfig } from './nitro'
