import cookie from '@fastify/cookie'
import csrf from '@fastify/csrf-protection'
import rateLimit from '@fastify/rate-limit'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import Redis from 'ioredis'
import { AppModule } from './app.module'
import { setupObservability } from './observability'
import { setupTrpc } from './trpc/trpc.adapter'
import { TrpcRouter } from './trpc/trpc.router'

// 开发环境禁用 TLS 证书验证（用于 K3s 自签名证书）
if (process.env.NODE_ENV === 'development' || process.env.K3S_SKIP_TLS_VERIFY === 'true') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

// 捕获未处理的错误
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
  setTimeout(() => process.exit(1), 100)
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error)
  setTimeout(() => process.exit(1), 100)
})

// 启动 OpenTelemetry（必须在应用启动前）
const otelSdk = setupObservability()

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({
    logger: false,
    routerOptions: {
      maxParamLength: 500,
    },
  })
  const fastify = fastifyAdapter.getInstance()

  // CORS 配置
  await fastify.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGIN || 'http://localhost:1997',
    credentials: true,
  })

  // Rate Limiting
  const rateLimitConfig: any = {
    max: 100,
    timeWindow: '1 minute',
    cache: 10000,
    allowList: ['127.0.0.1'],
  }

  // 如果配置了 Redis，使用 Redis 存储
  if (process.env.REDIS_URL) {
    try {
      const redis = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: true,
      })
      await redis.connect()
      rateLimitConfig.redis = redis
    } catch {
      // Redis 连接失败，使用内存限流
    }
  }

  await fastify.register(rateLimit, rateLimitConfig)

  // 创建 NestJS 应用
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter, {
    bufferLogs: true, // 缓冲日志，等待 Pino 初始化
    logger: false, // 禁用 NestJS 默认日志，使用 Pino
    abortOnError: false,
  })

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

  // 设置 tRPC
  const trpcRouter = app.get(TrpcRouter)
  await setupTrpc(fastifyAdapter.getInstance(), trpcRouter)

  // 优雅关闭
  app.enableShutdownHooks()

  // 监听关闭信号
  const signals = ['SIGTERM', 'SIGINT']
  signals.forEach((signal) => {
    process.on(signal, async () => {
      await app.close()
      await otelSdk.shutdown()
      process.exit(0)
    })
  })

  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error)
  setTimeout(() => process.exit(1), 200)
})
