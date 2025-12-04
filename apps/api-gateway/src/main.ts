import cookie from '@fastify/cookie'
import csrf from '@fastify/csrf-protection'
import rateLimit from '@fastify/rate-limit'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { Logger } from 'nestjs-pino'
import Redis from 'ioredis'
import { AppModule } from './app.module'
import { setupObservability } from './observability'
import { setupTrpc } from './trpc/trpc.adapter'
import { TrpcRouter } from './trpc/trpc.router'

// 开发环境禁用 TLS 证书验证（用于 K3s 自签名证书）
if (process.env.NODE_ENV === 'development' || process.env.K3S_SKIP_TLS_VERIFY === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
  // 启动时会通过 Pino 输出警告
}

// 启动 OpenTelemetry（必须在应用启动前）
const otelSdk = setupObservability()

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({ logger: true })
  const fastify = fastifyAdapter.getInstance()

  // 临时 logger（在 NestJS app 创建前）
  const tempLogger = {
    log: (msg: string) => console.log(`[Bootstrap] ${msg}`),
    warn: (msg: string) => console.warn(`[Bootstrap] ${msg}`),
    error: (msg: string, err?: any) => console.error(`[Bootstrap] ${msg}`, err),
  }

  // CORS 配置（统一在这里配置）
  await fastify.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN || 'http://localhost:1997',
    credentials: true,
  })

  // Rate Limiting - 防止 DDoS 攻击
  const rateLimitConfig: any = {
    max: 100, // 每个时间窗口最多 100 个请求
    timeWindow: '1 minute', // 时间窗口 1 分钟
    cache: 10000, // 缓存 10000 个 IP
    allowList: ['127.0.0.1'], // 白名单
  }

  // 如果配置了 Redis，使用 Redis 存储（生产环境推荐）
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })

      // 测试连接
      await redis.connect()
      tempLogger.log('✅ Redis 连接成功，启用分布式限流')

      rateLimitConfig.redis = redis
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      tempLogger.warn(`⚠️ Redis 连接失败，使用内存限流: ${errorMessage}`)
    }
  }

  await fastify.register(rateLimit, rateLimitConfig)

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
    bufferLogs: true, // 缓冲日志直到 Logger 准备好
  })

  // 使用 Pino Logger 替换默认 Logger
  const logger = app.get(Logger)
  app.useLogger(logger)

  // 输出 TLS 警告（使用 Pino）
  if (process.env.NODE_ENV === 'development' || process.env.K3S_SKIP_TLS_VERIFY === 'true') {
    logger.warn('⚠️  已禁用 TLS 证书验证（开发环境）')
  }

  // Cookie 插件
  await fastify.register(cookie, {
    secret: process.env.COOKIE_SECRET || 'juanie-secret',
  })

  // CSRF 保护（生产环境启用）
  if (process.env.NODE_ENV === 'production') {
    await fastify.register(csrf, {
      cookieOpts: { signed: true },
    })
  }

  // 设置 tRPC（包括 WebSocket）
  const trpcRouter = app.get(TrpcRouter)
  await setupTrpc(fastifyAdapter.getInstance(), trpcRouter)

  // 优雅关闭
  app.enableShutdownHooks()

  // 监听关闭信号
  const signals = ['SIGTERM', 'SIGINT']
  signals.forEach((signal) => {
    process.on(signal, async () => {
      logger.log(`📡 收到 ${signal} 信号，开始优雅关闭...`)

      // 关闭 NestJS 应用
      await app.close()

      // 关闭 OpenTelemetry
      await otelSdk.shutdown()
      logger.log('✅ 应用已安全关闭')

      process.exit(0)
    })
  })

  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')

  logger.log(`🚀 API Gateway running on http://localhost:${port}`)
  logger.log(`📊 Health check: http://localhost:${port}/health`)
  logger.log(`🔌 tRPC endpoint: http://localhost:${port}/trpc`)

  if (process.env.NODE_ENV !== 'production') {
    logger.log(`🎛️  tRPC Panel: http://localhost:${port}/panel`)
  }
}

bootstrap().catch((error) => {
  console.error('❌ 应用启动失败:', error)
  process.exit(1)
})
