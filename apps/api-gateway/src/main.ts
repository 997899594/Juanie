import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { AppModule } from './app.module'
import { setupObservability } from './observability'
import { setupTrpc } from './trpc/trpc.adapter'
import { TrpcRouter } from './trpc/trpc.router'

// 启动 OpenTelemetry（必须在应用启动前）
const otelSdk = setupObservability()

async function bootstrap() {
  const fastifyAdapter = new FastifyAdapter({ logger: true })

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, fastifyAdapter)

  // CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  })

  // 设置 tRPC
  const trpcRouter = app.get(TrpcRouter)
  await setupTrpc(fastifyAdapter.getInstance(), trpcRouter)

  // 优雅关闭
  app.enableShutdownHooks()

  // 监听关闭信号
  const signals = ['SIGTERM', 'SIGINT']
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\n📡 收到 ${signal} 信号，开始优雅关闭...`)

      // 关闭 NestJS 应用
      await app.close()

      // 关闭 OpenTelemetry
      await otelSdk.shutdown()
      console.log('✅ 应用已安全关闭')

      process.exit(0)
    })
  })

  const port = process.env.PORT || 3000
  await app.listen(port, '0.0.0.0')

  console.log(`🚀 API Gateway running on http://localhost:${port}`)
  console.log(`📊 Health check: http://localhost:${port}/health`)
  console.log(`🔌 tRPC endpoint: http://localhost:${port}/trpc`)
}

bootstrap().catch((error) => {
  console.error('❌ 应用启动失败:', error)
  process.exit(1)
})
