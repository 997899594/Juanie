import { z } from 'zod'

// 环境变量转换辅助函数
const booleanFromString = z
  .union([z.string(), z.boolean()])
  .transform((val) => (typeof val === 'string' ? val !== 'false' : val))
const numberFromString = z
  .union([z.string(), z.number()])
  .transform((val) => (typeof val === 'string' ? parseInt(val, 10) : val))
  .pipe(z.number())
const arrayFromString = z.union([z.string(), z.array(z.string())]).transform((val) =>
  typeof val === 'string'
    ? val
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
    : val,
)
const floatFromString = z
  .union([z.string(), z.number()])
  .transform((val) => (typeof val === 'string' ? parseFloat(val) : val))
  .pipe(z.number())

// 增加 Duration 类型约束（用于限流窗口）
type Unit = 'ms' | 's' | 'm' | 'h' | 'd'
type Duration = `${number}${Unit}` | `${number} ${Unit}`
const durationRegex = /^(\d+)\s*(ms|s|m|h|d)$/
const duration: z.ZodType<Duration> = z
  .string()
  .regex(durationRegex, { message: "Duration must be like '1m' or '1 m'" }) as any

// 配置模式定义
const configSchema = z
  .object({
    // 应用配置
    app: z.object({
      name: z.string().default('juanie-api'),
      version: z.string().default('1.0.0'),
      environment: z.enum(['development', 'production', 'test']).default('development'),
      port: numberFromString.default(300),
      host: z.string().default('0.0.0.0'),
    }),

    // 追踪配置
    tracing: z.object({
      enabled: booleanFromString.default(false),
      serviceName: z.string().default('juanie-api'),
      endpoint: z.string().optional(),
      sampleRate: floatFromString.default(1.0).refine((val) => val >= 0 && val <= 1, {
        message: 'Sample rate must be between 0 and 1',
      }),
      attributes: z.record(z.string(), z.string()).default({}),
    }),

    // 限流配置
    rateLimit: z.object({
      enabled: booleanFromString.default(false),
      requests: numberFromString.default(100),
      window: duration.default('1m'),
      skipSuccessfulRequests: booleanFromString.default(false),
      skipFailedRequests: booleanFromString.default(false),
      keyGenerator: z.enum(['ip', 'user', 'custom']).default('ip'),
    }),

    // 缓存配置
    cache: z.object({
      enabled: booleanFromString.default(false),
      defaultTtl: numberFromString.default(300),
      maxSize: numberFromString.default(1000),
      keyPrefix: z.string().default('juanie:'),
      compression: booleanFromString.default(true),
    }),

    // 日志配置
    logging: z.object({
      enabled: booleanFromString.default(true),
      level: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
      pretty: booleanFromString.default(true),
      redact: arrayFromString.default(['password', 'token', 'secret', 'authorization']),
      destination: z.string().optional(),
    }),

    // Redis 配置
    redis: z.object({
      url: z.string().optional(),
      token: z.string().optional(),
      maxRetries: numberFromString.default(3),
      retryDelay: numberFromString.default(1000),
      connectTimeout: numberFromString.default(5000),
      commandTimeout: numberFromString.default(5000),
    }),

    // 安全配置
    security: z.object({
      corsOrigins: arrayFromString.default(['http://localhost:3000']),
      jwtSecret: z.string().min(32),
      bcryptRounds: numberFromString.default(12),
      rateLimitBypass: arrayFromString.default([]),
    }),

    // 监控配置
    monitoring: z.object({
      healthCheck: booleanFromString.default(true),
      metrics: booleanFromString.default(true),
      profiling: booleanFromString.default(false),
    }),
  })
  .transform((data) => ({
    ...data,
    // 计算属性
    isProduction: data.app.environment === 'production',
    isDevelopment: data.app.environment === 'development',
    isTest: data.app.environment === 'test',
    hasRedis: Boolean(data.redis.url && data.redis.token),
    canUseRateLimit: data.rateLimit.enabled && Boolean(data.redis.url && data.redis.token),
    canUseCache: data.cache.enabled && Boolean(data.redis.url && data.redis.token),
  }))

// 解析配置函数
function parseConfig() {
  const env = process.env

  try {
    return configSchema.parse({
      app: {
        name: env.APP_NAME,
        version: env.APP_VERSION,
        environment: env.NODE_ENV,
        port: env.PORT,
        host: env.HOST,
      },
      tracing: {
        enabled: env.TRACING_ENABLED,
        serviceName: env.TRACING_SERVICE_NAME,
        endpoint: env.TRACING_ENDPOINT,
        sampleRate: env.TRACING_SAMPLE_RATE,
        attributes: env.TRACING_ATTRIBUTES ? JSON.parse(env.TRACING_ATTRIBUTES) : {},
      },
      rateLimit: {
        enabled: env.RATE_LIMIT_ENABLED,
        requests: env.RATE_LIMIT_REQUESTS,
        window: env.RATE_LIMIT_WINDOW,
        skipSuccessfulRequests: env.RATE_LIMIT_SKIP_SUCCESS,
        skipFailedRequests: env.RATE_LIMIT_SKIP_FAILED,
        keyGenerator: env.RATE_LIMIT_KEY_GENERATOR,
      },
      cache: {
        enabled: env.CACHE_ENABLED,
        defaultTtl: env.CACHE_DEFAULT_TTL,
        maxSize: env.CACHE_MAX_SIZE,
        keyPrefix: env.CACHE_KEY_PREFIX,
        compression: env.CACHE_COMPRESSION,
      },
      logging: {
        enabled: env.LOGGING_ENABLED,
        level: env.LOGGING_LEVEL,
        pretty: env.LOGGING_PRETTY,
        redact: env.LOGGING_REDACT,
        destination: env.LOGGING_DESTINATION,
      },
      redis: {
        url: env.UPSTASH_REDIS_REST_URL,
        token: env.UPSTASH_REDIS_REST_TOKEN,
        maxRetries: env.REDIS_MAX_RETRIES,
        retryDelay: env.REDIS_RETRY_DELAY,
        connectTimeout: env.REDIS_CONNECT_TIMEOUT,
        commandTimeout: env.REDIS_COMMAND_TIMEOUT,
      },
      security: {
        corsOrigins: env.CORS_ORIGINS,
        jwtSecret: env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
        bcryptRounds: env.BCRYPT_ROUNDS,
        rateLimitBypass: env.RATE_LIMIT_BYPASS,
      },
      monitoring: {
        healthCheck: env.HEALTH_CHECK_ENABLED,
        metrics: env.METRICS_ENABLED,
        profiling: env.PROFILING_ENABLED,
      },
    })
  } catch (error) {
    console.error('Configuration validation failed:', error)
    throw new Error('Invalid configuration. Please check your environment variables.')
  }
}

// 配置验证函数
export function validateConfig(config: Config): void {
  const errors: string[] = []

  if (
    config.isProduction &&
    config.security.jwtSecret === 'your-super-secret-jwt-key-change-in-production'
  ) {
    errors.push('JWT_SECRET must be set in production environment')
  }

  if (config.rateLimit.enabled && !config.hasRedis) {
    console.warn(
      '⚠️  Rate limiting is enabled but Redis is not configured. Rate limiting will be disabled.',
    )
  }

  if (config.cache.enabled && !config.hasRedis) {
    console.warn('⚠️  Caching is enabled but Redis is not configured. Caching will be disabled.')
  }

  if (config.tracing.enabled && !config.tracing.endpoint && config.isProduction) {
    console.warn('⚠️  Tracing is enabled but no endpoint configured in production.')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration errors:\n${errors.join('\n')}`)
  }
}

// 导出配置
export const config = parseConfig()
export type Config = typeof config

// 验证配置
validateConfig(config)

// 开发环境下打印配置摘要
if (config.isDevelopment) {
  console.log('🔧 Configuration loaded:', {
    environment: config.app.environment,
    port: config.app.port,
    redis: config.hasRedis ? '✅' : '❌',
    tracing: config.tracing.enabled ? '✅' : '❌',
    rateLimit: config.canUseRateLimit ? '✅' : '❌',
    cache: config.canUseCache ? '✅' : '❌',
  })
}
