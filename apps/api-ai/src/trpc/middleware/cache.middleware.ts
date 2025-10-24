/**
 * 🚀 Juanie AI - 智能缓存中间件
 * 实现边缘计算优化和智能缓存策略
 */

import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { createHash } from 'crypto';
import { IntelligentCacheManager } from '../trpc.config';

// ============================================================================
// 缓存配置和类型定义
// ============================================================================

export const CacheConfigSchema = z.object({
  ttl: z.number().min(0).default(300), // 5分钟默认TTL
  strategy: z.enum(['lru', 'lfu', 'fifo']).default('lru'),
  tags: z.array(z.string()).default([]),
  invalidateOn: z.array(z.string()).default([]),
  compress: z.boolean().default(true),
  distributed: z.boolean().default(false),
  region: z.string().optional(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
});

export type CacheConfig = z.infer<typeof CacheConfigSchema>;

export interface CacheMetadata {
  key: string;
  ttl: number;
  createdAt: Date;
  lastAccessed: Date;
  accessCount: number;
  size: number;
  tags: string[];
  region?: string;
  compressed: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  totalKeys: number;
  totalSize: number;
  evictions: number;
  regions: Record<string, number>;
}

// ============================================================================
// 边缘缓存管理器
// ============================================================================

export class EdgeCacheManager {
  private cacheManager: IntelligentCacheManager;
  private stats: CacheStats;
  private regions: Map<string, IntelligentCacheManager>;

  constructor(cacheManager: IntelligentCacheManager) {
    this.cacheManager = cacheManager;
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      totalKeys: 0,
      totalSize: 0,
      evictions: 0,
      regions: {},
    };
    this.regions = new Map();
  }

  /**
   * 获取区域缓存管理器
   */
  private getRegionCache(region?: string): IntelligentCacheManager {
    if (!region) return this.cacheManager;

    if (!this.regions.has(region)) {
      this.regions.set(region, new IntelligentCacheManager({
        maxSize: 1000,
        defaultTTL: 300,
        strategy: 'lru',
      }));
    }

    return this.regions.get(region)!;
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(
    procedure: string,
    input: any,
    userId?: string,
    organizationId?: string
  ): string {
    const keyData = {
      procedure,
      input: typeof input === 'object' ? JSON.stringify(input) : input,
      userId,
      organizationId,
    };

    return createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex')
      .substring(0, 32);
  }

  /**
   * 获取缓存数据
   */
  async get<T>(
    key: string,
    config: CacheConfig = {}
  ): Promise<T | null> {
    try {
      const cache = this.getRegionCache(config.region);
      const result = await cache.get<T>(key);

      if (result !== null) {
        this.stats.hits++;
        this.updateHitRate();
        return result;
      }

      this.stats.misses++;
      this.updateHitRate();
      return null;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * 设置缓存数据
   */
  async set<T>(
    key: string,
    value: T,
    config: CacheConfig = {}
  ): Promise<void> {
    try {
      const cache = this.getRegionCache(config.region);
      const parsedConfig = CacheConfigSchema.parse(config);

      await cache.set(key, value, parsedConfig.ttl);

      this.stats.totalKeys++;
      if (config.region) {
        this.stats.regions[config.region] = (this.stats.regions[config.region] || 0) + 1;
      }
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * 删除缓存数据
   */
  async delete(key: string, region?: string): Promise<void> {
    try {
      const cache = this.getRegionCache(region);
      await cache.delete(key);
      this.stats.totalKeys = Math.max(0, this.stats.totalKeys - 1);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * 按标签删除缓存
   */
  async deleteByTags(tags: string[]): Promise<void> {
    try {
      // 遍历所有区域缓存
      for (const [region, cache] of this.regions) {
        // 这里需要实现标签索引功能
        // 暂时清空整个区域缓存
        await cache.clear();
      }

      // 清空主缓存中匹配标签的项
      await this.cacheManager.clear();
    } catch (error) {
      console.error('Cache deleteByTags error:', error);
    }
  }

  /**
   * 清空缓存
   */
  async clear(region?: string): Promise<void> {
    try {
      if (region) {
        const cache = this.getRegionCache(region);
        await cache.clear();
        delete this.stats.regions[region];
      } else {
        await this.cacheManager.clear();
        this.regions.clear();
        this.stats = {
          hits: 0,
          misses: 0,
          hitRate: 0,
          totalKeys: 0,
          totalSize: 0,
          evictions: 0,
          regions: {},
        };
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * 更新命中率
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * 预热缓存
   */
  async warmup(keys: Array<{ key: string; value: any; config?: CacheConfig }>): Promise<void> {
    try {
      const promises = keys.map(({ key, value, config }) => 
        this.set(key, value, config)
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Cache warmup error:', error);
    }
  }

  /**
   * 获取缓存元数据
   */
  async getMetadata(key: string, region?: string): Promise<CacheMetadata | null> {
    try {
      const cache = this.getRegionCache(region);
      const stats = cache.getStats();
      
      // 这里需要扩展缓存管理器以支持元数据
      // 暂时返回基础信息
      return {
        key,
        ttl: 300,
        createdAt: new Date(),
        lastAccessed: new Date(),
        accessCount: 1,
        size: 0,
        tags: [],
        region,
        compressed: false,
      };
    } catch (error) {
      console.error('Cache getMetadata error:', error);
      return null;
    }
  }
}

// ============================================================================
// 缓存中间件
// ============================================================================

export interface CacheMiddlewareOptions {
  cacheManager: EdgeCacheManager;
  defaultConfig?: Partial<CacheConfig>;
  skipCache?: (input: any, ctx: any) => boolean;
  keyGenerator?: (procedure: string, input: any, ctx: any) => string;
}

/**
 * 创建缓存中间件
 */
export function createCacheMiddleware(options: CacheMiddlewareOptions) {
  const { cacheManager, defaultConfig = {}, skipCache, keyGenerator } = options;

  return function cacheMiddleware<T extends Record<string, any>>(opts: {
    config?: Partial<CacheConfig>;
  } = {}) {
    const config = { ...defaultConfig, ...opts.config };

    return async function middleware(params: {
      path: string;
      type: 'query' | 'mutation' | 'subscription';
      input: any;
      ctx: T;
      next: () => Promise<any>;
    }) {
      const { path, type, input, ctx, next } = params;

      // 只缓存查询操作
      if (type !== 'query') {
        return next();
      }

      // 检查是否跳过缓存
      if (skipCache && skipCache(input, ctx)) {
        return next();
      }

      try {
        // 生成缓存键
        const cacheKey = keyGenerator 
          ? keyGenerator(path, input, ctx)
          : cacheManager.generateCacheKey(
              path,
              input,
              (ctx as any).user?.sub,
              (ctx as any).user?.organizationId
            );

        // 尝试从缓存获取数据
        const cachedResult = await cacheManager.get(cacheKey, config);
        if (cachedResult !== null) {
          return cachedResult;
        }

        // 执行实际查询
        const result = await next();

        // 缓存结果
        if (result !== undefined && result !== null) {
          await cacheManager.set(cacheKey, result, config);
        }

        return result;
      } catch (error) {
        console.error('Cache middleware error:', error);
        // 缓存错误不应该影响正常流程
        return next();
      }
    };
  };
}

// ============================================================================
// 缓存装饰器
// ============================================================================

export interface CacheOptions extends Partial<CacheConfig> {
  key?: string;
  condition?: (input: any, ctx: any) => boolean;
}

/**
 * 缓存装饰器
 */
export function Cache(options: CacheOptions = {}) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const [input, ctx] = args;
      
      // 检查缓存条件
      if (options.condition && !options.condition(input, ctx)) {
        return originalMethod.apply(this, args);
      }

      const cacheManager = ctx.services?.cache as EdgeCacheManager;
      if (!cacheManager) {
        return originalMethod.apply(this, args);
      }

      try {
        // 生成缓存键
        const cacheKey = options.key || 
          cacheManager.generateCacheKey(
            `${target.constructor.name}.${propertyKey}`,
            input,
            ctx.user?.sub,
            ctx.user?.organizationId
          );

        // 尝试从缓存获取
        const cachedResult = await cacheManager.get(cacheKey, options);
        if (cachedResult !== null) {
          return cachedResult;
        }

        // 执行原方法
        const result = await originalMethod.apply(this, args);

        // 缓存结果
        if (result !== undefined && result !== null) {
          await cacheManager.set(cacheKey, result, options);
        }

        return result;
      } catch (error) {
        console.error('Cache decorator error:', error);
        return originalMethod.apply(this, args);
      }
    };

    return descriptor;
  };
}

// ============================================================================
// 缓存失效策略
// ============================================================================

export class CacheInvalidationManager {
  private cacheManager: EdgeCacheManager;
  private tagIndex: Map<string, Set<string>>;

  constructor(cacheManager: EdgeCacheManager) {
    this.cacheManager = cacheManager;
    this.tagIndex = new Map();
  }

  /**
   * 注册缓存标签
   */
  registerTag(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });
  }

  /**
   * 按标签失效缓存
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    const keysToInvalidate = new Set<string>();

    tags.forEach(tag => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.forEach(key => keysToInvalidate.add(key));
      }
    });

    const promises = Array.from(keysToInvalidate).map(key => 
      this.cacheManager.delete(key)
    );

    await Promise.all(promises);

    // 清理标签索引
    tags.forEach(tag => {
      this.tagIndex.delete(tag);
    });
  }

  /**
   * 按模式失效缓存
   */
  async invalidateByPattern(pattern: RegExp): Promise<void> {
    // 这里需要实现模式匹配的缓存失效
    // 暂时清空所有缓存
    await this.cacheManager.clear();
  }

  /**
   * 智能失效策略
   */
  async smartInvalidate(operation: string, entityType: string, entityId?: string): Promise<void> {
    const tagsToInvalidate: string[] = [];

    // 根据操作类型确定失效标签
    switch (operation) {
      case 'create':
        tagsToInvalidate.push(`${entityType}:list`);
        break;
      case 'update':
        tagsToInvalidate.push(`${entityType}:list`, `${entityType}:${entityId}`);
        break;
      case 'delete':
        tagsToInvalidate.push(`${entityType}:list`, `${entityType}:${entityId}`);
        break;
    }

    if (tagsToInvalidate.length > 0) {
      await this.invalidateByTags(tagsToInvalidate);
    }
  }
}

// ============================================================================
// 导出
// ============================================================================

// 所有导出已在类和函数定义时完成，无需重复导出