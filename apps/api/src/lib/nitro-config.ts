import configuration from "../config/configuration";

// 为 Nitro 运行时创建配置适配层
// 由于 Nitro 在构建时需要配置，我们需要直接调用配置工厂函数
export const nitroConfig = configuration();

// 导出兼容的配置对象，保持与旧系统的接口一致
export const config = {
  app: nitroConfig.app,
  security: nitroConfig.security,
  tracing: nitroConfig.tracing,
  database: nitroConfig.database,
  oauth: nitroConfig.oauth,
  redis: nitroConfig.redis,
  rateLimit: nitroConfig.rateLimit,
  cache: nitroConfig.cache,
  logging: nitroConfig.logging,
  monitoring: nitroConfig.monitoring,
  
  // 添加计算属性以保持兼容性
  isProduction: nitroConfig.app.environment === "production",
  isDevelopment: nitroConfig.app.environment === "development",
  isTest: nitroConfig.app.environment === "test",
  hasRedis: Boolean(nitroConfig.redis.url && nitroConfig.redis.token),
  canUseRateLimit: nitroConfig.rateLimit.enabled && 
    Boolean(nitroConfig.redis.url && nitroConfig.redis.token),
  canUseCache: nitroConfig.cache.enabled && 
    Boolean(nitroConfig.redis.url && nitroConfig.redis.token),
};

export type Config = typeof config;