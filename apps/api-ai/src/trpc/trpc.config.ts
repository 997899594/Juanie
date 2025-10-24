/**
 * 🚀 Juanie AI - tRPC 配置
 * 实现类型安全的API和智能缓存策略
 */

import { Logger } from "@nestjs/common";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { z } from "zod";
import {
  CONSTANTS,
  getBooleanEnvVar,
  getEnvVar,
  getNumberEnvVar,
} from "../core";
import { Context } from "./trpc.context";

// ============================================================================
// tRPC 配置Schema
// ============================================================================

export const TRPCConfigSchema = z.object({
  // 基础配置
  isDev: z.boolean().default(false),
  enableBatching: z.boolean().default(true),
  maxBatchSize: z.number().min(1).max(100).default(10),

  // 缓存配置
  cache: z
    .object({
      enabled: z.boolean().default(true),
      defaultTTL: z.number().default(300), // 5分钟
      maxSize: z.number().default(1000),
      strategy: z.enum(["lru", "lfu", "fifo"]).default("lru"),
      compression: z.boolean().default(true),
      distributedCache: z
        .object({
          enabled: z.boolean().default(false),
          redis: z.object({
            host: z.string().default("localhost"),
            port: z.number().default(6379),
            password: z.string().optional(),
            db: z.number().default(0),
          }),
        })
        .default({}),
    })
    .default({}),

  // 速率限制
  rateLimit: z
    .object({
      enabled: z.boolean().default(true),
      windowMs: z.number().default(60000), // 1分钟
      maxRequests: z.number().default(100),
      skipSuccessfulRequests: z.boolean().default(false),
      skipFailedRequests: z.boolean().default(false),
    })
    .default({}),

  // 边缘计算配置
  edge: z
    .object({
      enabled: z.boolean().default(false),
      regions: z
        .array(z.string())
        .default(["us-east-1", "eu-west-1", "ap-southeast-1"]),
      autoRouting: z.boolean().default(true),
      latencyThreshold: z.number().default(100), // 100ms
      failoverEnabled: z.boolean().default(true),
    })
    .default({}),

  // 监控配置
  monitoring: z
    .object({
      enabled: z.boolean().default(true),
      metricsEnabled: z.boolean().default(true),
      tracingEnabled: z.boolean().default(true),
      loggingLevel: z.enum(["error", "warn", "info", "debug"]).default("info"),
      slowQueryThreshold: z.number().default(1000), // 1秒
    })
    .default({}),

  // 安全配置
  security: z
    .object({
      enableCORS: z.boolean().default(true),
      allowedOrigins: z.array(z.string()).default(["http://localhost:3000"]),
      enableCSRF: z.boolean().default(true),
      maxPayloadSize: z.number().default(1048576), // 1MB
      enableCompression: z.boolean().default(true),
    })
    .default({}),
});

export type TRPCConfig = z.infer<typeof TRPCConfigSchema>;

// ============================================================================
// 缓存接口
// ============================================================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  evictions: number;
  hitRate: number;
  memoryUsage: number;
}

// ============================================================================
// 智能缓存管理器
// ============================================================================

export class IntelligentCacheManager {
  private readonly logger = new Logger(IntelligentCacheManager.name);
  private cache = new Map<string, CacheEntry>();
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    evictions: 0,
    hitRate: 0,
    memoryUsage: 0,
  };

  // 访问频率跟踪
  private accessFrequency = new Map<string, number>();
  private lastAccess = new Map<string, number>();

  constructor(private config: TRPCConfig["cache"]) {
    // 定期清理过期缓存
    setInterval(() => this.cleanup(), 60000); // 每分钟清理一次

    // 定期更新统计信息
    setInterval(() => this.updateStats(), 30000); // 每30秒更新统计

    this.logger.log("Intelligent cache manager initialized");
  }

  /**
   * 获取缓存
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // 检查是否过期
    if (Date.now() - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      this.accessFrequency.delete(key);
      this.lastAccess.delete(key);
      this.stats.misses++;
      this.stats.evictions++;
      return null;
    }

    // 更新访问统计
    entry.hits++;
    this.accessFrequency.set(key, (this.accessFrequency.get(key) || 0) + 1);
    this.lastAccess.set(key, Date.now());
    this.stats.hits++;

    return entry.data;
  }

  /**
   * 设置缓存
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const actualTTL = ttl || this.config.defaultTTL;
    const dataSize = this.calculateSize(data);

    // 检查缓存大小限制
    if (this.cache.size >= this.config.maxSize) {
      await this.evict();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      ttl: actualTTL,
      hits: 0,
      size: dataSize,
    };

    this.cache.set(key, entry);
    this.accessFrequency.set(key, 1);
    this.lastAccess.set(key, Date.now());
    this.stats.sets++;

    this.logger.debug(
      `Cached data for key: ${key} (TTL: ${actualTTL}s, Size: ${dataSize} bytes)`
    );
  }

  /**
   * 删除缓存
   */
  async delete(key: string): Promise<boolean> {
    const deleted = this.cache.delete(key);
    if (deleted) {
      this.accessFrequency.delete(key);
      this.lastAccess.delete(key);
      this.stats.deletes++;
    }
    return deleted;
  }

  /**
   * 清空缓存
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.accessFrequency.clear();
    this.lastAccess.clear();
    this.logger.log("Cache cleared");
  }

  /**
   * 智能缓存驱逐
   */
  private async evict(): Promise<void> {
    let keyToEvict: string | null = null;

    switch (this.config.strategy) {
      case "lru":
        keyToEvict = this.findLRUKey();
        break;
      case "lfu":
        keyToEvict = this.findLFUKey();
        break;
      case "fifo":
        keyToEvict = this.findFIFOKey();
        break;
    }

    if (keyToEvict) {
      await this.delete(keyToEvict);
      this.stats.evictions++;
      this.logger.debug(
        `Evicted cache key: ${keyToEvict} (strategy: ${this.config.strategy})`
      );
    }
  }

  /**
   * 查找最近最少使用的键
   */
  private findLRUKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Date.now();

    for (const [key, lastAccessTime] of this.lastAccess) {
      if (lastAccessTime < oldestTime) {
        oldestTime = lastAccessTime;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 查找最少使用的键
   */
  private findLFUKey(): string | null {
    let leastUsedKey: string | null = null;
    let leastFrequency = Infinity;

    for (const [key, frequency] of this.accessFrequency) {
      if (frequency < leastFrequency) {
        leastFrequency = frequency;
        leastUsedKey = key;
      }
    }

    return leastUsedKey;
  }

  /**
   * 查找最先进入的键
   */
  private findFIFOKey(): string | null {
    let oldestKey: string | null = null;
    let oldestTimestamp = Date.now();

    for (const [key, entry] of this.cache) {
      if (entry.timestamp < oldestTimestamp) {
        oldestTimestamp = entry.timestamp;
        oldestKey = key;
      }
    }

    return oldestKey;
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache) {
      if (now - entry.timestamp > entry.ttl * 1000) {
        this.cache.delete(key);
        this.accessFrequency.delete(key);
        this.lastAccess.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.stats.evictions += cleanedCount;
      this.logger.debug(`Cleaned up ${cleanedCount} expired cache entries`);
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(): void {
    const totalRequests = this.stats.hits + this.stats.misses;
    this.stats.hitRate =
      totalRequests > 0 ? this.stats.hits / totalRequests : 0;

    // 计算内存使用量
    let totalSize = 0;
    for (const entry of this.cache.values()) {
      totalSize += entry.size;
    }
    this.stats.memoryUsage = totalSize;
  }

  /**
   * 计算数据大小
   */
  private calculateSize(data: any): number {
    try {
      return JSON.stringify(data).length * 2; // 粗略估算（UTF-16）
    } catch {
      return 1024; // 默认1KB
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): CacheStats {
    this.updateStats();
    return { ...this.stats };
  }

  /**
   * 获取缓存信息
   */
  getInfo() {
    return {
      size: this.cache.size,
      maxSize: this.config.maxSize,
      strategy: this.config.strategy,
      stats: this.getStats(),
      topKeys: this.getTopKeys(10),
    };
  }

  /**
   * 获取访问频率最高的键
   */
  private getTopKeys(
    limit: number
  ): Array<{ key: string; frequency: number; lastAccess: number }> {
    return Array.from(this.accessFrequency.entries())
      .map(([key, frequency]) => ({
        key,
        frequency,
        lastAccess: this.lastAccess.get(key) || 0,
      }))
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, limit);
  }
}

// ============================================================================
// tRPC 实例配置
// ============================================================================

export const createTRPCConfig = (): TRPCConfig => {
  return TRPCConfigSchema.parse({
    isDev: getEnvVar("NODE_ENV", "development"),
    enableBatching: getBooleanEnvVar("TRPC_ENABLE_BATCHING", true),
    maxBatchSize: getNumberEnvVar("TRPC_MAX_BATCH_SIZE", 10),

    cache: {
      enabled: getBooleanEnvVar("TRPC_CACHE_ENABLED", true),
      defaultTTL: getNumberEnvVar("TRPC_CACHE_DEFAULT_TTL", 300),
      maxSize: getNumberEnvVar("TRPC_CACHE_MAX_SIZE", 1000),
      strategy: getEnvVar("TRPC_CACHE_STRATEGY", "lru") as any,
      compression: getBooleanEnvVar("TRPC_CACHE_COMPRESSION", true),
      distributedCache: {
        enabled: getBooleanEnvVar("TRPC_DISTRIBUTED_CACHE_ENABLED", false),
        redis: {
          host: getEnvVar("REDIS_HOST", "localhost"),
          port: getNumberEnvVar("REDIS_PORT", 6379),
          password: getEnvVar("REDIS_PASSWORD", undefined),
          db: getNumberEnvVar("REDIS_DB", 0),
        },
      },
    },

    rateLimit: {
      enabled: getBooleanEnvVar("TRPC_RATE_LIMIT_ENABLED", true),
      windowMs: getNumberEnvVar("TRPC_RATE_LIMIT_WINDOW_MS", 60000),
      maxRequests: getNumberEnvVar("TRPC_RATE_LIMIT_MAX_REQUESTS", 100),
      skipSuccessfulRequests: getBooleanEnvVar(
        "TRPC_RATE_LIMIT_SKIP_SUCCESS",
        false
      ),
      skipFailedRequests: getBooleanEnvVar(
        "TRPC_RATE_LIMIT_SKIP_FAILED",
        false
      ),
    },

    edge: {
      enabled: getBooleanEnvVar("TRPC_EDGE_ENABLED", false),
      regions: getEnvVar(
        "TRPC_EDGE_REGIONS",
        "us-east-1,eu-west-1,ap-southeast-1"
      ).split(","),
      autoRouting: getBooleanEnvVar("TRPC_EDGE_AUTO_ROUTING", true),
      latencyThreshold: getNumberEnvVar("TRPC_EDGE_LATENCY_THRESHOLD", 100),
      failoverEnabled: getBooleanEnvVar("TRPC_EDGE_FAILOVER_ENABLED", true),
    },

    monitoring: {
      enabled: getBooleanEnvVar("TRPC_MONITORING_ENABLED", true),
      metricsEnabled: getBooleanEnvVar("TRPC_MONITORING_METRICS_ENABLED", true),
      tracingEnabled: getBooleanEnvVar("TRPC_MONITORING_TRACING_ENABLED", true),
      loggingLevel: getEnvVar("TRPC_MONITORING_LOGGING_LEVEL", "info") as any,
      slowQueryThreshold: getNumberEnvVar(
        "TRPC_MONITORING_SLOW_QUERY_THRESHOLD",
        1000
      ),
    },

    security: {
      enableCORS: getBooleanEnvVar("TRPC_SECURITY_ENABLE_CORS", true),
      allowedOrigins: getEnvVar(
        "TRPC_SECURITY_ALLOWED_ORIGINS",
        "http://localhost:3000"
      ).split(","),
      enableCSRF: getBooleanEnvVar("TRPC_SECURITY_ENABLE_CSRF", true),
      maxPayloadSize: getNumberEnvVar(
        "TRPC_SECURITY_MAX_PAYLOAD_SIZE",
        1048576
      ),
      enableCompression: getBooleanEnvVar(
        "TRPC_SECURITY_ENABLE_COMPRESSION",
        true
      ),
    },
  });
};

// ============================================================================
// tRPC 实例初始化
// ============================================================================

const config = createTRPCConfig();
const cacheManager = new IntelligentCacheManager(config.cache);

export const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof z.ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

// ============================================================================
// 中间件
// ============================================================================

/**
 * 日志中间件
 */
export const loggerMiddleware = t.middleware(
  async ({ path, type, next, ctx }) => {
    const start = Date.now();
    const logger = new Logger(`tRPC:${type}`);

    logger.debug(`${type.toUpperCase()} ${path} - Start`);

    const result = await next();

    const duration = Date.now() - start;
    const level =
      duration > config.monitoring.slowQueryThreshold ? "warn" : "debug";

    logger[level](`${type.toUpperCase()} ${path} - ${duration}ms`);

    return result;
  }
);

/**
 * 缓存中间件
 */
export const cacheMiddleware = t.middleware(
  async ({ path, type, input, next, ctx }) => {
    if (!config.cache.enabled || type !== "query") {
      return next();
    }

    const cacheKey = `trpc:${path}:${JSON.stringify(input)}`;

    // 尝试从缓存获取
    const cached = await cacheManager.get(cacheKey);
    if (cached) {
      return next({
        ctx: {
          ...ctx,
          cached: true,
        },
      });
    }

    // 执行查询
    const result = await next();

    // 缓存结果
    if (result.ok) {
      await cacheManager.set(cacheKey, result.data);
    }

    return result;
  }
);

/**
 * 速率限制中间件
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export const rateLimitMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!config.rateLimit.enabled) {
    return next();
  }

  const clientId = ctx.user?.sub || ctx.req?.ip || "anonymous";
  const now = Date.now();
  const windowStart = now - config.rateLimit.windowMs;

  let rateLimitData = rateLimitMap.get(clientId);

  if (!rateLimitData || rateLimitData.resetTime < windowStart) {
    rateLimitData = {
      count: 1,
      resetTime: now + config.rateLimit.windowMs,
    };
  } else {
    rateLimitData.count++;
  }

  rateLimitMap.set(clientId, rateLimitData);

  if (rateLimitData.count > config.rateLimit.maxRequests) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "Rate limit exceeded",
    });
  }

  return next();
});

/**
 * 认证中间件
 */
export const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "需要身份验证",
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

// ============================================================================
// 过程定义
// ============================================================================

export const publicProcedure = t.procedure
  .use(loggerMiddleware)
  .use(rateLimitMiddleware)
  .use(cacheMiddleware);

export const protectedProcedure = publicProcedure.use(authMiddleware);

// ============================================================================
// 路由器
// ============================================================================

export const router = t.router;
export const mergeRouters = t.mergeRouters;

// ============================================================================
// 导出配置和管理器
// ============================================================================

export { config as trpcConfig, cacheManager };

// ============================================================================
// 工具函数
// ============================================================================

/**
 * 创建缓存键
 */
export const createCacheKey = (
  prefix: string,
  ...parts: (string | number)[]
): string => {
  return `${prefix}:${parts.join(":")}`;
};

/**
 * 获取tRPC统计信息
 */
export const getTRPCStats = () => {
  return {
    config,
    cache: cacheManager.getStats(),
    rateLimit: {
      activeClients: rateLimitMap.size,
    },
  };
};

/**
 * 重置tRPC统计信息
 */
export const resetTRPCStats = async () => {
  await cacheManager.clear();
  rateLimitMap.clear();
};
