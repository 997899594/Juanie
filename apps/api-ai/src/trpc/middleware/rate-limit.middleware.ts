/**
 * 🚀 Juanie AI - 智能速率限制中间件
 * 实现自适应速率限制和边缘计算优化
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';

// ============================================================================
// 速率限制配置和类型定义
// ============================================================================

export const RateLimitConfigSchema = z.object({
  windowMs: z.number().min(1000).default(60000), // 1分钟窗口
  maxRequests: z.number().min(1).default(100),
  keyGenerator: z.enum(['ip', 'user', 'organization', 'custom']).default('user'),
  skipSuccessfulRequests: z.boolean().default(false),
  skipFailedRequests: z.boolean().default(false),
  message: z.string().default('Too many requests'),
  standardHeaders: z.boolean().default(true),
  legacyHeaders: z.boolean().default(false),
  store: z.enum(['memory', 'redis', 'distributed']).default('memory'),
  onLimitReached: z.function().optional(),
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
  retryAfter?: number;
}

export interface RateLimitStats {
  totalRequests: number;
  blockedRequests: number;
  blockRate: number;
  topClients: Array<{
    key: string;
    requests: number;
    blocked: number;
  }>;
  windowStats: Array<{
    timestamp: Date;
    requests: number;
    blocked: number;
  }>;
}

// ============================================================================
// 速率限制存储接口
// ============================================================================

export interface RateLimitStore {
  get(key: string): Promise<RateLimitRecord | null>;
  set(key: string, record: RateLimitRecord): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  getStats(): Promise<RateLimitStats>;
}

export interface RateLimitRecord {
  count: number;
  resetTime: number;
  firstRequest: number;
}

// ============================================================================
// 内存存储实现
// ============================================================================

export class MemoryRateLimitStore implements RateLimitStore {
  private store: Map<string, RateLimitRecord>;
  private stats: RateLimitStats;
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    this.store = new Map();
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      blockRate: 0,
      topClients: [],
      windowStats: [],
    };

    // 定期清理过期记录
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000); // 每分钟清理一次
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    const record = this.store.get(key);
    if (!record) return null;

    // 检查是否过期
    if (Date.now() > record.resetTime) {
      this.store.delete(key);
      return null;
    }

    return record;
  }

  async set(key: string, record: RateLimitRecord): Promise<void> {
    this.store.set(key, record);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  async clear(): Promise<void> {
    this.store.clear();
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      blockRate: 0,
      topClients: [],
      windowStats: [],
    };
  }

  async getStats(): Promise<RateLimitStats> {
    return { ...this.stats };
  }

  updateStats(key: string, blocked: boolean): void {
    this.stats.totalRequests++;
    if (blocked) {
      this.stats.blockedRequests++;
    }
    this.stats.blockRate = this.stats.blockedRequests / this.stats.totalRequests;

    // 更新客户端统计
    const clientIndex = this.stats.topClients.findIndex(c => c.key === key);
    if (clientIndex >= 0) {
      this.stats.topClients[clientIndex].requests++;
      if (blocked) {
        this.stats.topClients[clientIndex].blocked++;
      }
    } else {
      this.stats.topClients.push({
        key,
        requests: 1,
        blocked: blocked ? 1 : 0,
      });
    }

    // 保持前10个客户端
    this.stats.topClients.sort((a, b) => b.requests - a.requests);
    this.stats.topClients = this.stats.topClients.slice(0, 10);

    // 更新窗口统计
    const now = new Date();
    const currentWindow = this.stats.windowStats.find(w => 
      w.timestamp.getTime() === Math.floor(now.getTime() / 60000) * 60000
    );

    if (currentWindow) {
      currentWindow.requests++;
      if (blocked) {
        currentWindow.blocked++;
      }
    } else {
      this.stats.windowStats.push({
        timestamp: new Date(Math.floor(now.getTime() / 60000) * 60000),
        requests: 1,
        blocked: blocked ? 1 : 0,
      });
    }

    // 保持最近24小时的窗口统计
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.stats.windowStats = this.stats.windowStats.filter(w => w.timestamp > cutoff);
  }

  private cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (now > record.resetTime) {
        this.store.delete(key);
      }
    }
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================================
// 分布式存储实现（Redis）
// ============================================================================

export class RedisRateLimitStore implements RateLimitStore {
  private redis: any; // Redis客户端
  private stats: RateLimitStats;

  constructor(redisClient: any) {
    this.redis = redisClient;
    this.stats = {
      totalRequests: 0,
      blockedRequests: 0,
      blockRate: 0,
      topClients: [],
      windowStats: [],
    };
  }

  async get(key: string): Promise<RateLimitRecord | null> {
    try {
      const data = await this.redis.get(`ratelimit:${key}`);
      if (!data) return null;

      const record = JSON.parse(data) as RateLimitRecord;
      
      // 检查是否过期
      if (Date.now() > record.resetTime) {
        await this.delete(key);
        return null;
      }

      return record;
    } catch (error) {
      console.error('Redis rate limit get error:', error);
      return null;
    }
  }

  async set(key: string, record: RateLimitRecord): Promise<void> {
    try {
      const ttl = Math.ceil((record.resetTime - Date.now()) / 1000);
      await this.redis.setex(`ratelimit:${key}`, ttl, JSON.stringify(record));
    } catch (error) {
      console.error('Redis rate limit set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(`ratelimit:${key}`);
    } catch (error) {
      console.error('Redis rate limit delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      const keys = await this.redis.keys('ratelimit:*');
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Redis rate limit clear error:', error);
    }
  }

  async getStats(): Promise<RateLimitStats> {
    return { ...this.stats };
  }

  updateStats(key: string, blocked: boolean): void {
    // 实现与内存存储相同的统计逻辑
    this.stats.totalRequests++;
    if (blocked) {
      this.stats.blockedRequests++;
    }
    this.stats.blockRate = this.stats.blockedRequests / this.stats.totalRequests;
  }
}

// ============================================================================
// 智能速率限制管理器
// ============================================================================

export class IntelligentRateLimiter {
  private store: RateLimitStore;
  private config: RateLimitConfig;
  private adaptiveConfig: Map<string, Partial<RateLimitConfig>>;

  constructor(config: Partial<RateLimitConfig> = {}, store?: RateLimitStore) {
    this.config = RateLimitConfigSchema.parse(config);
    this.store = store || new MemoryRateLimitStore();
    this.adaptiveConfig = new Map();
  }

  /**
   * 生成速率限制键
   */
  generateKey(
    type: string,
    identifier: string,
    procedure?: string
  ): string {
    return `${type}:${identifier}${procedure ? `:${procedure}` : ''}`;
  }

  /**
   * 检查速率限制
   */
  async checkLimit(
    key: string,
    config?: Partial<RateLimitConfig>
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const effectiveConfig = { ...this.config, ...config };
    const now = Date.now();
    const windowStart = now - effectiveConfig.windowMs;

    try {
      let record = await this.store.get(key);

      if (!record || record.resetTime <= now) {
        // 创建新记录
        record = {
          count: 1,
          resetTime: now + effectiveConfig.windowMs,
          firstRequest: now,
        };
        await this.store.set(key, record);

        const info: RateLimitInfo = {
          limit: effectiveConfig.maxRequests,
          remaining: effectiveConfig.maxRequests - 1,
          reset: new Date(record.resetTime),
        };

        this.updateStats(key, false);
        return { allowed: true, info };
      }

      // 更新计数
      record.count++;
      await this.store.set(key, record);

      const remaining = Math.max(0, effectiveConfig.maxRequests - record.count);
      const info: RateLimitInfo = {
        limit: effectiveConfig.maxRequests,
        remaining,
        reset: new Date(record.resetTime),
      };

      if (record.count > effectiveConfig.maxRequests) {
        info.retryAfter = Math.ceil((record.resetTime - now) / 1000);
        this.updateStats(key, true);
        return { allowed: false, info };
      }

      this.updateStats(key, false);
      return { allowed: true, info };
    } catch (error) {
      console.error('Rate limit check error:', error);
      // 出错时允许请求通过
      return {
        allowed: true,
        info: {
          limit: effectiveConfig.maxRequests,
          remaining: effectiveConfig.maxRequests,
          reset: new Date(now + effectiveConfig.windowMs),
        },
      };
    }
  }

  /**
   * 自适应速率限制
   */
  async adaptiveLimit(
    key: string,
    baseConfig?: Partial<RateLimitConfig>
  ): Promise<{ allowed: boolean; info: RateLimitInfo }> {
    const stats = await this.store.getStats();
    const adaptiveConfig = this.getAdaptiveConfig(key, stats);
    const config = { ...baseConfig, ...adaptiveConfig };

    return this.checkLimit(key, config);
  }

  /**
   * 获取自适应配置
   */
  private getAdaptiveConfig(
    key: string,
    stats: RateLimitStats
  ): Partial<RateLimitConfig> {
    let config = this.adaptiveConfig.get(key) || {};

    // 基于系统负载调整限制
    if (stats.blockRate > 0.1) { // 阻塞率超过10%
      config.maxRequests = Math.max(10, (config.maxRequests || this.config.maxRequests) * 0.8);
    } else if (stats.blockRate < 0.01) { // 阻塞率低于1%
      config.maxRequests = Math.min(1000, (config.maxRequests || this.config.maxRequests) * 1.2);
    }

    // 基于时间模式调整
    const hour = new Date().getHours();
    if (hour >= 9 && hour <= 17) { // 工作时间
      config.maxRequests = (config.maxRequests || this.config.maxRequests) * 1.5;
    }

    this.adaptiveConfig.set(key, config);
    return config;
  }

  /**
   * 重置速率限制
   */
  async resetLimit(key: string): Promise<void> {
    await this.store.delete(key);
  }

  /**
   * 获取统计信息
   */
  async getStats(): Promise<RateLimitStats> {
    return this.store.getStats();
  }

  /**
   * 更新统计信息
   */
  private updateStats(key: string, blocked: boolean): void {
    if (this.store instanceof MemoryRateLimitStore || this.store instanceof RedisRateLimitStore) {
      this.store.updateStats(key, blocked);
    }
  }

  /**
   * 清理资源
   */
  destroy(): void {
    if (this.store instanceof MemoryRateLimitStore) {
      this.store.destroy();
    }
  }
}

// ============================================================================
// 速率限制中间件
// ============================================================================

export interface RateLimitMiddlewareOptions {
  rateLimiter: IntelligentRateLimiter;
  keyGenerator?: (ctx: any) => string;
  skipIf?: (ctx: any) => boolean;
  onLimitReached?: (ctx: any, info: RateLimitInfo) => void;
}

/**
 * 创建速率限制中间件
 */
export function createRateLimitMiddleware(options: RateLimitMiddlewareOptions) {
  const { rateLimiter, keyGenerator, skipIf, onLimitReached } = options;

  return function rateLimitMiddleware<T extends Record<string, any>>(
    config?: Partial<RateLimitConfig>
  ) {
    return async function middleware(params: {
      path: string;
      type: 'query' | 'mutation' | 'subscription';
      input: any;
      ctx: T;
      next: () => Promise<any>;
    }) {
      const { path, ctx, next } = params;

      // 检查是否跳过速率限制
      if (skipIf && skipIf(ctx)) {
        return next();
      }

      try {
        // 生成限制键
        const key = keyGenerator 
          ? keyGenerator(ctx)
          : rateLimiter.generateKey(
              'user',
              (ctx as any).user?.sub || (ctx as any).ip || 'anonymous',
              path
            );

        // 检查速率限制
        const { allowed, info } = await rateLimiter.adaptiveLimit(key, config);

        if (!allowed) {
          // 调用限制回调
          if (onLimitReached) {
            onLimitReached(ctx, info);
          }

          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: config?.message || 'Too many requests',
            cause: {
              retryAfter: info.retryAfter,
              limit: info.limit,
              remaining: info.remaining,
              reset: info.reset,
            },
          });
        }

        // 添加速率限制头信息到上下文
        if ((ctx as any).res) {
          const res = (ctx as any).res;
          res.setHeader('X-RateLimit-Limit', info.limit.toString());
          res.setHeader('X-RateLimit-Remaining', info.remaining.toString());
          res.setHeader('X-RateLimit-Reset', Math.ceil(info.reset.getTime() / 1000).toString());
        }

        return next();
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Rate limit middleware error:', error);
        // 出错时允许请求通过
        return next();
      }
    };
  };
}

// ============================================================================
// 速率限制装饰器
// ============================================================================

export interface RateLimitOptions extends Partial<RateLimitConfig> {
  key?: string;
  adaptive?: boolean;
}

/**
 * 速率限制装饰器
 */
export function RateLimit(options: RateLimitOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [input, ctx] = args;
      
      const rateLimiter = ctx.services?.rateLimiter as IntelligentRateLimiter;
      if (!rateLimiter) {
        return originalMethod.apply(this, args);
      }

      try {
        // 生成限制键
        const key = options.key || 
          rateLimiter.generateKey(
            'user',
            ctx.user?.sub || ctx.ip || 'anonymous',
            `${target.constructor.name}.${propertyKey}`
          );

        // 检查速率限制
        const { allowed, info } = options.adaptive
          ? await rateLimiter.adaptiveLimit(key, options)
          : await rateLimiter.checkLimit(key, options);

        if (!allowed) {
          throw new TRPCError({
            code: 'TOO_MANY_REQUESTS',
            message: options.message || 'Too many requests',
            cause: {
              retryAfter: info.retryAfter,
              limit: info.limit,
              remaining: info.remaining,
              reset: info.reset,
            },
          });
        }

        return originalMethod.apply(this, args);
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        
        console.error('Rate limit decorator error:', error);
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

// ============================================================================
// 导出
// ============================================================================

// 所有导出已在类和函数定义时完成，无需重复导出