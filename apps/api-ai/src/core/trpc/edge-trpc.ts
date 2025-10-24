import { initTRPC, TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { observable } from '@trpc/server/observable';
import superjson from 'superjson';

// 边缘上下文Schema
export const EdgeContextSchema = z.object({
  userId: z.string().optional(),
  organizationId: z.string().optional(),
  projectId: z.string().optional(),
  sessionId: z.string(),
  userAgent: z.string().optional(),
  ip: z.string().optional(),
  region: z.string().optional(),
  edge: z.object({
    nodeId: z.string(),
    location: z.string(),
    latency: z.number(),
  }).optional(),
  permissions: z.array(z.string()).default([]),
  metadata: z.record(z.any()).default({}),
});

export type EdgeContext = z.infer<typeof EdgeContextSchema>;

// 缓存策略Schema
export const CacheStrategySchema = z.object({
  type: z.enum(['memory', 'redis', 'edge', 'hybrid']),
  ttl: z.number().default(300), // 5分钟
  tags: z.array(z.string()).default([]),
  invalidateOn: z.array(z.string()).default([]),
  compression: z.boolean().default(true),
  encryption: z.boolean().default(false),
});

export type CacheStrategy = z.infer<typeof CacheStrategySchema>;

// 实时订阅配置Schema
export const SubscriptionConfigSchema = z.object({
  channel: z.string(),
  filters: z.record(z.any()).optional(),
  throttle: z.number().default(100), // 100ms
  batchSize: z.number().default(10),
  maxConnections: z.number().default(1000),
});

export type SubscriptionConfig = z.infer<typeof SubscriptionConfigSchema>;

// 边缘缓存管理器
@Injectable()
export class EdgeCacheManager {
  private readonly logger = new Logger(EdgeCacheManager.name);
  private memoryCache = new Map<string, { data: any; expires: number; tags: string[] }>();
  private redisClient: any;
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {
    this.initializeRedis();
  }

  private async initializeRedis(): Promise<void> {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (redisUrl) {
        const { Redis } = await import('ioredis');
        this.redisClient = new Redis(redisUrl);
        this.logger.log('Redis cache initialized');
      }
    } catch (error) {
      this.logger.warn('Redis not available, using memory cache only:', error);
    }
  }

  async get<T>(key: string, strategy: CacheStrategy): Promise<T | null> {
    try {
      let data: any = null;

      // 尝试从内存缓存获取
      if (strategy.type === 'memory' || strategy.type === 'hybrid') {
        const cached = this.memoryCache.get(key);
        if (cached && cached.expires > Date.now()) {
          this.cacheHits++;
          return strategy.compression ? this.decompress(cached.data) : cached.data;
        }
      }

      // 尝试从Redis获取
      if ((strategy.type === 'redis' || strategy.type === 'hybrid') && this.redisClient) {
        const cached = await this.redisClient.get(key);
        if (cached) {
          data = JSON.parse(cached);
          this.cacheHits++;
          
          // 同步到内存缓存
          if (strategy.type === 'hybrid') {
            this.memoryCache.set(key, {
              data: strategy.compression ? this.compress(data) : data,
              expires: Date.now() + strategy.ttl * 1000,
              tags: strategy.tags,
            });
          }
          
          return data;
        }
      }

      this.cacheMisses++;
      return null;
    } catch (error) {
      this.logger.error(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set<T>(key: string, data: T, strategy: CacheStrategy): Promise<void> {
    try {
      const expires = Date.now() + strategy.ttl * 1000;
      const processedData = strategy.compression ? this.compress(data) : data;

      // 存储到内存缓存
      if (strategy.type === 'memory' || strategy.type === 'hybrid') {
        this.memoryCache.set(key, {
          data: processedData,
          expires,
          tags: strategy.tags,
        });
      }

      // 存储到Redis
      if ((strategy.type === 'redis' || strategy.type === 'hybrid') && this.redisClient) {
        await this.redisClient.setex(key, strategy.ttl, JSON.stringify(data));
      }

      // 发布缓存事件
      await this.eventEmitter.emitAsync('cache.set', {
        key,
        strategy: strategy.type,
        ttl: strategy.ttl,
        tags: strategy.tags,
      });
    } catch (error) {
      this.logger.error(`Cache set error for key ${key}:`, error);
    }
  }

  async invalidate(pattern: string): Promise<void> {
    try {
      // 清理内存缓存
      for (const [key] of this.memoryCache) {
        if (key.includes(pattern)) {
          this.memoryCache.delete(key);
        }
      }

      // 清理Redis缓存
      if (this.redisClient) {
        const keys = await this.redisClient.keys(`*${pattern}*`);
        if (keys.length > 0) {
          await this.redisClient.del(...keys);
        }
      }

      await this.eventEmitter.emitAsync('cache.invalidated', { pattern });
      this.logger.debug(`Cache invalidated for pattern: ${pattern}`);
    } catch (error) {
      this.logger.error(`Cache invalidation error for pattern ${pattern}:`, error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      // 清理内存缓存中带有指定标签的项
      for (const [key, cached] of this.memoryCache) {
        if (cached.tags.some(tag => tags.includes(tag))) {
          this.memoryCache.delete(key);
        }
      }

      await this.eventEmitter.emitAsync('cache.invalidated.tags', { tags });
      this.logger.debug(`Cache invalidated for tags: ${tags.join(', ')}`);
    } catch (error) {
      this.logger.error(`Cache tag invalidation error:`, error);
    }
  }

  private compress(data: any): any {
    // 简单的压缩实现，实际项目中可以使用更高效的压缩算法
    return JSON.stringify(data);
  }

  private decompress(data: any): any {
    return typeof data === 'string' ? JSON.parse(data) : data;
  }

  getStats() {
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      hitRate: this.cacheHits / (this.cacheHits + this.cacheMisses) || 0,
      memoryEntries: this.memoryCache.size,
      redisConnected: !!this.redisClient,
    };
  }
}

// 实时订阅管理器
@Injectable()
export class RealtimeSubscriptionManager {
  private readonly logger = new Logger(RealtimeSubscriptionManager.name);
  private subscriptions = new Map<string, Set<any>>();
  private connectionCount = 0;

  constructor(private eventEmitter: EventEmitter2) {
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    // 监听各种业务事件并广播给订阅者
    this.eventEmitter.on('**', (event: string, data: any) => {
      this.broadcast(event, data);
    });
  }

  subscribe(channel: string, observer: any, config: SubscriptionConfig): () => void {
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }

    const subscribers = this.subscriptions.get(channel)!;
    
    // 检查连接数限制
    if (subscribers.size >= config.maxConnections) {
      throw new TRPCError({
        code: 'TOO_MANY_REQUESTS',
        message: `Too many connections for channel: ${channel}`,
      });
    }

    subscribers.add(observer);
    this.connectionCount++;

    this.logger.debug(`New subscription to channel: ${channel} (total: ${subscribers.size})`);

    // 返回取消订阅函数
    return () => {
      subscribers.delete(observer);
      this.connectionCount--;
      
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
      
      this.logger.debug(`Unsubscribed from channel: ${channel}`);
    };
  }

  private broadcast(event: string, data: any): void {
    // 广播到匹配的频道
    for (const [channel, subscribers] of this.subscriptions) {
      if (this.matchesChannel(event, channel)) {
        for (const observer of subscribers) {
          try {
            observer.next({ event, data, timestamp: new Date() });
          } catch (error) {
            this.logger.error(`Error broadcasting to subscriber:`, error);
            subscribers.delete(observer);
          }
        }
      }
    }
  }

  private matchesChannel(event: string, channel: string): boolean {
    // 支持通配符匹配
    if (channel === '*') return true;
    if (channel.endsWith('*')) {
      return event.startsWith(channel.slice(0, -1));
    }
    return event === channel;
  }

  getStats() {
    return {
      totalConnections: this.connectionCount,
      activeChannels: this.subscriptions.size,
      channelStats: Array.from(this.subscriptions.entries()).map(([channel, subscribers]) => ({
        channel,
        subscribers: subscribers.size,
      })),
    };
  }
}

// 边缘路由器
@Injectable()
export class EdgeRouter {
  private readonly logger = new Logger(EdgeRouter.name);
  private routes = new Map<string, any>();
  private middleware: Array<(ctx: EdgeContext, next: () => Promise<any>) => Promise<any>> = [];

  constructor(
    private cacheManager: EdgeCacheManager,
    private subscriptionManager: RealtimeSubscriptionManager,
  ) {}

  use(middleware: (ctx: EdgeContext, next: () => Promise<any>) => Promise<any>): void {
    this.middleware.push(middleware);
  }

  route(path: string, handler: any): void {
    this.routes.set(path, handler);
  }

  async execute(path: string, input: any, ctx: EdgeContext): Promise<any> {
    const handler = this.routes.get(path);
    if (!handler) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `Route not found: ${path}`,
      });
    }

    // 执行中间件链
    let index = 0;
    const next = async (): Promise<any> => {
      if (index < this.middleware.length) {
        const middleware = this.middleware[index++];
        return await middleware(ctx, next);
      } else {
        return await handler(input, ctx);
      }
    };

    return await next();
  }
}

// tRPC边缘实例创建器
export function createEdgeTRPC() {
  return initTRPC.context<EdgeContext>().create({
    transformer: superjson,
    errorFormatter({ shape, error }) {
      return {
        ...shape,
        data: {
          ...shape.data,
          zodError: error.cause instanceof z.ZodError ? error.cause.flatten() : null,
        },
      };
    },
  });
}

// 缓存中间件
export function createCacheMiddleware(cacheManager: EdgeCacheManager) {
  return function cacheMiddleware(strategy: CacheStrategy) {
    return async function(opts: any) {
      const { path, input, ctx, next } = opts;
      
      // 生成缓存键
      const cacheKey = `trpc:${path}:${JSON.stringify(input)}:${ctx.userId || 'anonymous'}`;
      
      // 尝试从缓存获取
      const cached = await cacheManager.get(cacheKey, strategy);
      if (cached !== null) {
        return cached;
      }
      
      // 执行实际处理
      const result = await next();
      
      // 缓存结果
      await cacheManager.set(cacheKey, result, strategy);
      
      return result;
    };
  };
}

// 实时订阅中间件
export function createSubscriptionMiddleware(subscriptionManager: RealtimeSubscriptionManager) {
  return function subscriptionMiddleware(config: SubscriptionConfig) {
    return function(opts: any) {
      const { ctx } = opts;
      
      return observable<any>((observer) => {
        // 创建订阅
        const unsubscribe = subscriptionManager.subscribe(
          config.channel,
          observer,
          config
        );
        
        // 返回清理函数
        return unsubscribe;
      });
    };
  };
}

// 权限验证中间件
export function createAuthMiddleware() {
  return async function authMiddleware(opts: any) {
    const { ctx, next } = opts;
    
    if (!ctx.userId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }
    
    return next();
  };
}

// 速率限制中间件
export function createRateLimitMiddleware() {
  const requests = new Map<string, { count: number; resetTime: number }>();
  
  return function rateLimitMiddleware(limit: number, windowMs: number) {
    return async function(opts: any) {
      const { ctx, next } = opts;
      const key = ctx.userId || ctx.ip || 'anonymous';
      const now = Date.now();
      
      let userRequests = requests.get(key);
      if (!userRequests || now > userRequests.resetTime) {
        userRequests = { count: 0, resetTime: now + windowMs };
        requests.set(key, userRequests);
      }
      
      if (userRequests.count >= limit) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded',
        });
      }
      
      userRequests.count++;
      return next();
    };
  };
}

// 边缘计算中间件
export function createEdgeComputeMiddleware() {
  return async function edgeComputeMiddleware(opts: any) {
    const { ctx, next } = opts;
    
    // 添加边缘计算上下文
    if (ctx.edge) {
      // 记录边缘节点信息
      console.log(`Processing on edge node: ${ctx.edge.nodeId} (${ctx.edge.location})`);
    }
    
    const startTime = Date.now();
    const result = await next();
    const duration = Date.now() - startTime;
    
    // 添加性能指标
    return {
      ...result,
      _meta: {
        processingTime: duration,
        edgeNode: ctx.edge?.nodeId,
        region: ctx.edge?.location,
      },
    };
  };
}

// 智能路由中间件
export function createSmartRoutingMiddleware() {
  return async function smartRoutingMiddleware(opts: any) {
    const { ctx, path, next } = opts;
    
    // 基于用户位置和负载选择最优边缘节点
    const optimalNode = selectOptimalEdgeNode(ctx.region, path);
    
    if (optimalNode && optimalNode !== ctx.edge?.nodeId) {
      // 重定向到最优节点
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Redirecting to optimal edge node',
        cause: { redirectTo: optimalNode },
      });
    }
    
    return next();
  };
}

function selectOptimalEdgeNode(region?: string, path?: string): string | null {
  // 简化的边缘节点选择逻辑
  const edgeNodes = {
    'us-east': 'edge-us-east-1',
    'us-west': 'edge-us-west-1',
    'eu-west': 'edge-eu-west-1',
    'ap-southeast': 'edge-ap-southeast-1',
  };
  
  return region ? edgeNodes[region as keyof typeof edgeNodes] || null : null;
}

// 边缘tRPC服务
@Injectable()
export class EdgeTRPCService {
  private readonly logger = new Logger(EdgeTRPCService.name);
  private t = createEdgeTRPC();

  constructor(
    private cacheManager: EdgeCacheManager,
    private subscriptionManager: RealtimeSubscriptionManager,
    private edgeRouter: EdgeRouter,
  ) {
    this.setupMiddleware();
  }

  private setupMiddleware(): void {
    // 设置全局中间件
    this.edgeRouter.use(createEdgeComputeMiddleware());
    this.edgeRouter.use(createSmartRoutingMiddleware());
  }

  // 创建带缓存的过程
  createCachedProcedure(strategy: CacheStrategy) {
    return this.t.procedure
      .use(createCacheMiddleware(this.cacheManager)(strategy));
  }

  // 创建实时订阅过程
  createSubscriptionProcedure(config: SubscriptionConfig) {
    return this.t.procedure
      .subscription(createSubscriptionMiddleware(this.subscriptionManager)(config));
  }

  // 创建受保护的过程
  createProtectedProcedure() {
    return this.t.procedure
      .use(createAuthMiddleware());
  }

  // 创建限流过程
  createRateLimitedProcedure(limit: number, windowMs: number) {
    return this.t.procedure
      .use(createRateLimitMiddleware()(limit, windowMs));
  }

  // 获取tRPC实例
  getTRPC() {
    return this.t;
  }

  // 获取统计信息
  getStats() {
    return {
      cache: this.cacheManager.getStats(),
      subscriptions: this.subscriptionManager.getStats(),
    };
  }
}