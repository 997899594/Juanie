import { z } from "zod";

// 环境变量转换辅助函数
const booleanFromString = z
  .union([z.string(), z.boolean()])
  .transform((val) => (typeof val === "string" ? val !== "false" : val));

const numberFromString = z
  .union([z.string(), z.number()])
  .transform((val) => (typeof val === "string" ? parseInt(val, 10) : val))
  .pipe(z.number());

const arrayFromString = z
  .union([z.string(), z.array(z.string())])
  .transform((val) =>
    typeof val === "string"
      ? val
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : val
  );

const floatFromString = z
  .union([z.string(), z.number()])
  .transform((val) => (typeof val === "string" ? parseFloat(val) : val))
  .pipe(z.number());

// Duration 类型约束
type Unit = "ms" | "s" | "m" | "h" | "d";
type Duration = `${number}${Unit}` | `${number} ${Unit}`;
const durationRegex = /^(\d+)\s*(ms|s|m|h|d)$/;
const duration: z.ZodType<Duration> = z.string().regex(durationRegex, {
  message: "Duration must be like '1m' or '1 m'",
}) as any;

// 配置 Schema
const configSchema = z.object({
  // 应用配置
  app: z.object({
    name: z.string().default("juanie-api"),
    version: z.string().default("1.0.0"),
    environment: z
      .enum(["development", "production", "test"])
      .default("development"),
    port: numberFromString.default(3000),
    host: z.string().default("0.0.0.0"),
  }),

  // 数据库配置
  database: z.object({
    url: z.string().min(1, "DATABASE_URL is required"),
    poolMax: numberFromString.default(10),
    ssl: booleanFromString.default(false),
  }),

  // 安全配置
  security: z.object({
    corsOrigins: arrayFromString.default([
      "http://localhost:3000",
      "http://localhost:1997",
    ]),
    jwtSecret: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
    bcryptRounds: numberFromString.default(12),
    rateLimitBypass: arrayFromString.default([]),
  }),

  // OAuth 配置
  oauth: z.object({
    github: z.object({
      clientId: z.string().min(1, "GITHUB_CLIENT_ID is required"),
      clientSecret: z.string().min(1, "GITHUB_CLIENT_SECRET is required"),
      redirectUri: z.string().url("GITHUB_REDIRECT_URI must be a valid URL"),
    }),
    gitlab: z.object({
      clientId: z.string().min(1, "GITLAB_CLIENT_ID is required"),
      clientSecret: z.string().min(1, "GITLAB_CLIENT_SECRET is required"),
      redirectUri: z.string().url("GITLAB_REDIRECT_URI must be a valid URL"),
      baseUrl: z.string().url().default("https://gitlab.com"),
    }),
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

  // 限流配置
  rateLimit: z.object({
    enabled: booleanFromString.default(false),
    requests: numberFromString.default(100),
    window: duration.default("1m"),
    skipSuccessfulRequests: booleanFromString.default(false),
    skipFailedRequests: booleanFromString.default(false),
    keyGenerator: z.enum(["ip", "user", "custom"]).default("ip"),
  }),

  // 缓存配置
  cache: z.object({
    enabled: booleanFromString.default(false),
    defaultTtl: numberFromString.default(300),
    maxSize: numberFromString.default(1000),
    keyPrefix: z.string().default("juanie:"),
    compression: booleanFromString.default(true),
  }),

  // 日志配置
  logging: z.object({
    enabled: booleanFromString.default(true),
    level: z
      .enum(["trace", "debug", "info", "warn", "error", "fatal"])
      .default("info"),
    pretty: booleanFromString.default(true),
    redact: arrayFromString.default([
      "password",
      "token",
      "secret",
      "authorization",
    ]),
    destination: z.string().optional(),
  }),

  // 追踪配置
  tracing: z.object({
    enabled: booleanFromString.default(false),
    serviceName: z.string().default("juanie-api"),
    endpoint: z.string().optional(),
    sampleRate: floatFromString
      .default(1.0)
      .refine((val) => val >= 0 && val <= 1, {
        message: "Sample rate must be between 0 and 1",
      }),
    attributes: z.record(z.string(), z.string()).default({}),
  }),

  // 监控配置
  monitoring: z.object({
    healthCheck: booleanFromString.default(true),
    metrics: booleanFromString.default(true),
    profiling: booleanFromString.default(false),
  }),
});

// 配置类型推断
export type Config = z.infer<typeof configSchema>;

// 配置工厂函数
export default (): Config => {
  const env = process.env;

  const rawConfig = {
    app: {
      name: env.APP_NAME,
      version: env.APP_VERSION,
      environment: env.NODE_ENV,
      port: env.PORT,
      host: env.HOST,
    },
    database: {
      url: env.DATABASE_URL,
      poolMax: env.DATABASE_POOL_MAX,
      ssl: env.DATABASE_SSL,
    },
    security: {
      corsOrigins: env.CORS_ORIGINS,
      jwtSecret: env.JWT_SECRET,
      bcryptRounds: env.BCRYPT_ROUNDS,
      rateLimitBypass: env.RATE_LIMIT_BYPASS,
    },
    oauth: {
      github: {
        clientId: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        redirectUri: env.GITHUB_REDIRECT_URI,
      },
      gitlab: {
        clientId: env.GITLAB_CLIENT_ID,
        clientSecret: env.GITLAB_CLIENT_SECRET,
        redirectUri: env.GITLAB_REDIRECT_URI,
        baseUrl: env.GITLAB_BASE_URL,
      },
    },
    redis: {
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      maxRetries: env.REDIS_MAX_RETRIES,
      retryDelay: env.REDIS_RETRY_DELAY,
      connectTimeout: env.REDIS_CONNECT_TIMEOUT,
      commandTimeout: env.REDIS_COMMAND_TIMEOUT,
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
    tracing: {
      enabled: env.TRACING_ENABLED,
      serviceName: env.TRACING_SERVICE_NAME,
      endpoint: env.TRACING_ENDPOINT,
      sampleRate: env.TRACING_SAMPLE_RATE,
      attributes: env.TRACING_ATTRIBUTES
        ? JSON.parse(env.TRACING_ATTRIBUTES)
        : {},
    },
    monitoring: {
      healthCheck: env.HEALTH_CHECK_ENABLED,
      metrics: env.METRICS_ENABLED,
      profiling: env.PROFILING_ENABLED,
    },
  };

  try {
    const validatedConfig = configSchema.parse(rawConfig);

    // 添加计算属性
    return {
      ...validatedConfig,
      // 环境判断
      isProduction: validatedConfig.app.environment === "production",
      isDevelopment: validatedConfig.app.environment === "development",
      isTest: validatedConfig.app.environment === "test",
      // Redis 可用性
      hasRedis: Boolean(
        validatedConfig.redis.url && validatedConfig.redis.token
      ),
      // 功能可用性
      canUseRateLimit:
        validatedConfig.rateLimit.enabled &&
        Boolean(validatedConfig.redis.url && validatedConfig.redis.token),
      canUseCache:
        validatedConfig.cache.enabled &&
        Boolean(validatedConfig.redis.url && validatedConfig.redis.token),
    } as Config & {
      isProduction: boolean;
      isDevelopment: boolean;
      isTest: boolean;
      hasRedis: boolean;
      canUseRateLimit: boolean;
      canUseCache: boolean;
    };
  } catch (error) {
    console.error("❌ Configuration validation failed:");
    if (error instanceof z.ZodError) {
      error.issues.forEach((err) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
    } else {
      console.error(error);
    }
    throw new Error(
      "Invalid configuration. Please check your environment variables."
    );
  }
};

// 验证函数（用于开发时调试）
export function validateConfig(config: any): void {
  try {
    configSchema.parse(config);
    console.log("✅ Configuration validation passed");
  } catch (error) {
    console.error("❌ Configuration validation failed:", error);
    throw error;
  }
}
