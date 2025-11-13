import { REDIS } from '@juanie/core-tokens'
import type { OnModuleInit } from '@nestjs/common'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Worker } from 'bullmq'
import type Redis from 'ioredis'

@Injectable()
export class PipelineWorker implements OnModuleInit {
  private worker!: Worker

  constructor(
    private config: ConfigService,
    @Inject(REDIS) private redis: Redis, // Dragonfly (Redis 兼容)
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.worker = new Worker(
      'pipeline',
      async (job) => {
        // 提取 runId 到外层作用域
        const { runId, config } = job.data

        console.log(`🚀 Processing pipeline job: ${job.id}`)
        console.log(`Pipeline ID: ${job.data.pipelineId}`)
        console.log(`Run ID: ${runId}`)

        try {
          // 执行 Pipeline 的各个阶段

          // 发布开始状态
          await this.publishStatus(runId, 'running', 0)

          for (const [index, stage] of config.stages.entries()) {
            const progress = Math.round(((index + 1) / config.stages.length) * 100)
            await job.updateProgress(progress)

            console.log(`📦 Executing stage: ${stage.name}`)

            // 执行阶段
            await this.executeStage(stage, runId)

            // 发布进度更新
            await this.publishStatus(runId, 'running', progress)

            console.log(`✅ Stage completed: ${stage.name}`)
          }

          // 发布完成状态
          await this.publishStatus(runId, 'success', 100)
          await this.publishLog(runId, '🎉 Pipeline completed successfully!')

          return { success: true, runId }
        } catch (error) {
          console.error(`❌ Pipeline failed:`, error)

          // 发布失败状态
          await this.publishStatus(runId, 'failed', 0)
          await this.publishLog(runId, `❌ Pipeline failed: ${error}`)

          throw error
        }
      },
      {
        connection: {
          url: redisUrl,
          // Worker 需要独立的连接，避免与 Queue 冲突
          maxRetriesPerRequest: null,
        },
        concurrency: 5, // 同时处理 5 个任务
      },
    )

    this.worker.on('completed', (job) => {
      console.log(`✅ Pipeline job ${job.id} completed`)
    })

    this.worker.on('failed', (job, err) => {
      console.error(`❌ Pipeline job ${job?.id} failed:`, err)
    })

    console.log('🔧 Pipeline Worker started')
  }

  private async executeStage(stage: any, runId: string) {
    // 发布日志到 Redis（供 SSE 订阅）
    await this.publishLog(runId, `[${stage.name}] Starting...`)
    await this.publishLog(runId, `[${stage.name}] Command: ${stage.command}`)

    // 这里实际执行命令
    // 可以使用 child_process 或者调用 K3s API
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await this.publishLog(runId, `[${stage.name}] Completed successfully`)
  }

  private async publishLog(runId: string, message: string) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      message,
    }
    // 发布到 Dragonfly (Redis Pub/Sub)
    await this.redis.publish(`logs:${runId}`, JSON.stringify(logEntry))
  }

  private async publishStatus(runId: string, status: string, progress?: number) {
    const statusUpdate = {
      status,
      progress,
      timestamp: new Date().toISOString(),
    }
    // 发布状态更新到 Dragonfly
    await this.redis.publish(`run:${runId}:status`, JSON.stringify(statusUpdate))
  }

  async onModuleDestroy() {
    await this.worker.close()
  }
}
