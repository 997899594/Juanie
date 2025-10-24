/**
 * 🚀 Juanie AI - tRPC服务器配置
 * 整合智能缓存、速率限制和边缘计算优化
 */

import { EventEmitter2 } from "@nestjs/event-emitter";
import { JwtService } from "@nestjs/jwt";
import { createHTTPServer } from "@trpc/server/adapters/standalone";
import { applyWSSHandler } from "@trpc/server/adapters/ws";
import cors from "cors";
import ws from "ws";
import { QuantumCryptoService } from "../core/quantum-crypto";
import { AuthService } from "../security/auth.service";
import { ZeroTrustService } from "../security/zero-trust.service";
import {
  createCacheMiddleware,
  EdgeCacheManager,
} from "./middleware/cache.middleware";
import {
  createRateLimitMiddleware,
  IntelligentRateLimiter,
  MemoryRateLimitStore,
} from "./middleware/rate-limit.middleware";
import { type AppRouter, appRouter } from "./routers";
import { IntelligentCacheManager, trpcConfig } from "./trpc.config";
import ContextCreator from "./trpc.context";

// ============================================================================
// 服务器配置
// ============================================================================

export interface ServerConfig {
  port: number;
  host: string;
  cors: {
    origin: string | string[] | boolean;
    credentials: boolean;
    methods: string[];
    allowedHeaders: string[];
  };
  websocket: {
    enabled: boolean;
    port: number;
  };
  ssl: {
    enabled: boolean;
    cert?: string;
    key?: string;
  };
  monitoring: {
    enabled: boolean;
    metricsPath: string;
    healthPath: string;
  };
  edge: {
    enabled: boolean;
    regions: string[];
    autoRoute: boolean;
  };
}

const defaultServerConfig: ServerConfig = {
  port: parseInt(process.env.TRPC_PORT || "4000"),
  host: process.env.TRPC_HOST || "0.0.0.0",
  cors: {
    origin: process.env.CORS_ORIGIN?.split(",") || ["http://localhost:3000"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  },
  websocket: {
    enabled: process.env.WEBSOCKET_ENABLED === "true",
    port: parseInt(process.env.WEBSOCKET_PORT || "4001"),
  },
  ssl: {
    enabled: process.env.SSL_ENABLED === "true",
    cert: process.env.SSL_CERT_PATH,
    key: process.env.SSL_KEY_PATH,
  },
  monitoring: {
    enabled: process.env.MONITORING_ENABLED !== "false",
    metricsPath: "/metrics",
    healthPath: "/health",
  },
  edge: {
    enabled: process.env.EDGE_ENABLED === "true",
    regions: process.env.EDGE_REGIONS?.split(",") || ["us-east-1"],
    autoRoute: process.env.EDGE_AUTO_ROUTE === "true",
  },
};

// ============================================================================
// 服务器类
// ============================================================================

export class TRPCServer {
  private config: ServerConfig;
  private httpServer: any;
  private wsServer: any;
  private cacheManager: EdgeCacheManager;
  private rateLimiter: IntelligentRateLimiter;
  private services: {
    zeroTrust: ZeroTrustService;
    auth: AuthService;
    quantumCrypto: QuantumCryptoService;
  };

  constructor(config: Partial<ServerConfig> = {}) {
    this.config = { ...defaultServerConfig, ...config };

    // 初始化服务
    this.initializeServices();

    // 初始化缓存和速率限制
    this.initializeMiddleware();
  }

  /**
   * 初始化核心服务
   */
  private initializeServices(): void {
    // 初始化服务
    this.services = {
      zeroTrust: new ZeroTrustService(new EventEmitter2()),
      auth: new AuthService(
        new JwtService({}),
        new EventEmitter2(),
        {} as any,
        {} as any
      ),
      quantumCrypto: new QuantumCryptoService(),
    };
  }

  /**
   * 初始化中间件
   */
  private initializeMiddleware(): void {
    // 初始化智能缓存
    const baseCacheManager = new IntelligentCacheManager(trpcConfig.cache);
    this.cacheManager = new EdgeCacheManager(baseCacheManager);

    // 初始化速率限制
    const rateLimitStore = new MemoryRateLimitStore();
    this.rateLimiter = new IntelligentRateLimiter(
      trpcConfig.rateLimit,
      rateLimitStore
    );
  }

  /**
   * 创建HTTP服务器
   */
  private createHTTPServer() {
    const cacheMiddleware = createCacheMiddleware({
      cacheManager: this.cacheManager,
      defaultConfig: {
        ttl: 300,
        strategy: "lru",
        compress: true,
      },
    });

    const rateLimitMiddleware = createRateLimitMiddleware({
      rateLimiter: this.rateLimiter,
      keyGenerator: (ctx) => {
        return this.rateLimiter.generateKey(
          "user",
          ctx.user?.sub || ctx.ip || "anonymous"
        );
      },
      skipIf: (ctx) => {
        // 跳过健康检查和管理员用户
        return ctx.path?.startsWith("/health") || ctx.user?.role === "admin";
      },
    });

    // 创建上下文创建器实例
    const contextCreator = new ContextCreator({
      ...this.services,
      cache: this.cacheManager,
      rateLimiter: this.rateLimiter,
    });

    this.httpServer = createHTTPServer({
      middleware: cors(this.config.cors),
      router: appRouter,
      createContext: (opts) => contextCreator.createContext(opts),
      onError: ({ error, path, input, ctx }) => {
        console.error("tRPC Error:", {
          error: error.message,
          path,
          input,
          user: (ctx as any)?.user?.sub,
          timestamp: new Date().toISOString(),
        });

        // 记录到监控系统
        if (this.config.monitoring.enabled) {
          this.recordError(error, path, ctx);
        }
      },
      batching: {
        enabled: trpcConfig.enableBatching,
      },
    });
  }

  /**
   * 创建WebSocket服务器
   */
  private createWebSocketServer() {
    if (!this.config.websocket.enabled) return;

    const wss = new ws.Server({
      port: this.config.websocket.port,
    });

    this.wsServer = applyWSSHandler({
      wss,
      router: appRouter,
      createContext: (opts) => {
        const contextCreator = new ContextCreator({
          ...this.services,
          cache: this.cacheManager,
          rateLimiter: this.rateLimiter,
        });
        return contextCreator.createContext(opts);
      },
      onError: ({ error, path, input, ctx }) => {
        console.error("tRPC WebSocket Error:", {
          error: error.message,
          path,
          input,
          user: (ctx as any)?.user?.sub,
          timestamp: new Date().toISOString(),
        });
      },
    });

    console.log(
      `🚀 WebSocket server listening on port ${this.config.websocket.port}`
    );
  }

  /**
   * 启动服务器
   */
  async start(): Promise<void> {
    try {
      // 初始化服务
      await this.initializeAsyncServices();

      // 创建服务器
      this.createHTTPServer();
      this.createWebSocketServer();

      // 启动HTTP服务器
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(
          this.config.port,
          this.config.host,
          (err?: Error) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          }
        );
      });

      console.log(
        `🚀 tRPC server listening on http://${this.config.host}:${this.config.port}`
      );

      // 启动监控
      if (this.config.monitoring.enabled) {
        this.startMonitoring();
      }

      // 启动边缘计算
      if (this.config.edge.enabled) {
        this.startEdgeComputing();
      }

      // 预热缓存
      await this.warmupCache();

      console.log("✅ tRPC server started successfully");
    } catch (error) {
      console.error("❌ Failed to start tRPC server:", error);
      throw error;
    }
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    try {
      // 停止HTTP服务器
      if (this.httpServer) {
        await new Promise<void>((resolve) => {
          this.httpServer.close(() => resolve());
        });
      }

      // 停止WebSocket服务器
      if (this.wsServer) {
        this.wsServer.close();
      }

      // 清理资源
      this.rateLimiter.destroy();
      await this.cacheManager.clear();

      console.log("✅ tRPC server stopped successfully");
    } catch (error) {
      console.error("❌ Failed to stop tRPC server:", error);
      throw error;
    }
  }

  /**
   * 初始化异步服务
   */
  private async initializeAsyncServices(): Promise<void> {
    try {
      // 初始化零信任服务
      await this.services.zeroTrust.initialize();

      // 加载默认策略
      await this.services.zeroTrust.loadDefaultPolicies();

      console.log("✅ Async services initialized");
    } catch (error) {
      console.error("❌ Failed to initialize async services:", error);
      throw error;
    }
  }

  /**
   * 启动监控
   */
  private startMonitoring(): void {
    // 健康检查端点
    this.httpServer.get(
      this.config.monitoring.healthPath,
      (req: any, res: any) => {
        res.json({
          status: "healthy",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          cache: this.cacheManager.getStats(),
          rateLimit: this.rateLimiter.getStats(),
        });
      }
    );

    // 指标端点
    this.httpServer.get(
      this.config.monitoring.metricsPath,
      async (req: any, res: any) => {
        const metrics = await this.collectMetrics();
        res.setHeader("Content-Type", "text/plain");
        res.send(metrics);
      }
    );

    console.log(
      `📊 Monitoring enabled on ${this.config.monitoring.healthPath} and ${this.config.monitoring.metricsPath}`
    );
  }

  /**
   * 启动边缘计算
   */
  private startEdgeComputing(): void {
    // 实现边缘节点路由逻辑
    console.log(
      `🌐 Edge computing enabled for regions: ${this.config.edge.regions.join(
        ", "
      )}`
    );

    // 这里可以实现：
    // 1. 地理位置检测
    // 2. 最近节点路由
    // 3. 负载均衡
    // 4. 故障转移
  }

  /**
   * 预热缓存
   */
  private async warmupCache(): Promise<void> {
    try {
      // 预热常用数据
      const warmupKeys = [
        {
          key: "health:status",
          value: { status: "healthy" },
          config: { ttl: 60 },
        },
        {
          key: "config:app",
          value: { version: "1.0.0" },
          config: { ttl: 3600 },
        },
      ];

      await this.cacheManager.warmup(warmupKeys);
      console.log("🔥 Cache warmed up");
    } catch (error) {
      console.error("❌ Cache warmup failed:", error);
    }
  }

  /**
   * 收集指标
   */
  private async collectMetrics(): Promise<string> {
    const cacheStats = this.cacheManager.getStats();
    const rateLimitStats = await this.rateLimiter.getStats();

    return `
# HELP trpc_requests_total Total number of tRPC requests
# TYPE trpc_requests_total counter
trpc_requests_total ${rateLimitStats.totalRequests}

# HELP trpc_requests_blocked_total Total number of blocked requests
# TYPE trpc_requests_blocked_total counter
trpc_requests_blocked_total ${rateLimitStats.blockedRequests}

# HELP trpc_cache_hits_total Total number of cache hits
# TYPE trpc_cache_hits_total counter
trpc_cache_hits_total ${cacheStats.hits}

# HELP trpc_cache_misses_total Total number of cache misses
# TYPE trpc_cache_misses_total counter
trpc_cache_misses_total ${cacheStats.misses}

# HELP trpc_cache_hit_rate Cache hit rate
# TYPE trpc_cache_hit_rate gauge
trpc_cache_hit_rate ${cacheStats.hitRate}

# HELP nodejs_memory_usage_bytes Node.js memory usage
# TYPE nodejs_memory_usage_bytes gauge
nodejs_memory_usage_bytes{type="rss"} ${process.memoryUsage().rss}
nodejs_memory_usage_bytes{type="heapTotal"} ${process.memoryUsage().heapTotal}
nodejs_memory_usage_bytes{type="heapUsed"} ${process.memoryUsage().heapUsed}
    `.trim();
  }

  /**
   * 记录错误
   */
  private recordError(error: Error, path?: string, ctx?: any): void {
    // 这里可以集成错误监控服务
    // 如 Sentry, DataDog, New Relic 等
    console.error("Error recorded:", {
      message: error.message,
      stack: error.stack,
      path,
      user: ctx?.user?.sub,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * 获取服务器状态
   */
  getStatus() {
    return {
      config: this.config,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cache: this.cacheManager.getStats(),
      rateLimit: this.rateLimiter.getStats(),
    };
  }

  /**
   * 获取缓存管理器
   */
  getCacheManager(): EdgeCacheManager {
    return this.cacheManager;
  }

  /**
   * 获取速率限制器
   */
  getRateLimiter(): IntelligentRateLimiter {
    return this.rateLimiter;
  }
}

// ============================================================================
// 服务器工厂函数
// ============================================================================

/**
 * 创建tRPC服务器实例
 */
export function createTRPCServer(config?: Partial<ServerConfig>): TRPCServer {
  return new TRPCServer(config);
}

/**
 * 创建开发服务器
 */
export function createDevServer(): TRPCServer {
  return new TRPCServer({
    cors: {
      origin: true,
      credentials: true,
      methods: ["GET", "POST", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    },
    websocket: {
      enabled: true,
      port: 4001,
    },
    monitoring: {
      enabled: true,
      metricsPath: "/metrics",
      healthPath: "/health",
    },
  });
}

/**
 * 创建生产服务器
 */
export function createProdServer(): TRPCServer {
  return new TRPCServer({
    cors: {
      origin: process.env.CORS_ORIGIN?.split(",") || false,
      credentials: true,
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
    },
    ssl: {
      enabled: true,
      cert: process.env.SSL_CERT_PATH,
      key: process.env.SSL_KEY_PATH,
    },
    edge: {
      enabled: true,
      regions: process.env.EDGE_REGIONS?.split(",") || ["us-east-1"],
      autoRoute: true,
    },
  });
}

// ============================================================================
// 导出类型
// ============================================================================

export type { AppRouter };
export { appRouter };
