import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify'
import type { Queue } from 'bullmq'
import { AppModule } from './app.module'
import { setupBullBoard } from './modules/queue/bullboard.adapter'
import { DEPLOYMENT_QUEUE, PIPELINE_QUEUE } from './modules/queue/queue.module'
import { setupObservability } from './observability/tracing'
import { setupTrpc } from './trpc/trpc.adapter'
import { TrpcRouter } from './trpc/trpc.router'

// 启动 OpenTelemetry（必须在应用启动前）
const otelSdk = setupObservability()

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  )

  // 启用 CORS
  app.enableCors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })

  // 设置 tRPC
  const trpcRouter = app.get(TrpcRouter)
  await setupTrpc(app.getHttpAdapter().getInstance(), trpcRouter)

  // 设置 BullBoard (任务监控面板)
  const pipelineQueue = app.get<Queue>(PIPELINE_QUEUE)
  const deploymentQueue = app.get<Queue>(DEPLOYMENT_QUEUE)
  const serverAdapter = setupBullBoard(pipelineQueue, deploymentQueue)

  app.getHttpAdapter().getInstance().register(serverAdapter.registerPlugin(), {
    prefix: '/admin/queues',
  })

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

  const port = process.env.PORT || 3001
  await app.listen(port, '0.0.0.0')

  console.log(`🚀 Server running on http://localhost:${port}`)
  console.log(`📡 tRPC endpoint: http://localhost:${port}/trpc`)
  console.log(`📊 BullBoard: http://localhost:${port}/admin/queues`)
}

bootstrap().catch((error) => {
  console.error('❌ 应用启动失败:', error)
  process.exit(1)
})
