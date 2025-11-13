import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { DEPLOYMENT_QUEUE, PIPELINE_QUEUE } from './tokens'
import { EventWorker } from './workers/event.worker'
import { PipelineWorker } from './workers/pipeline.worker'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PIPELINE_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Queue('pipeline', {
          connection: {
            url: redisUrl,
            // 每个 Queue 使用独立的连接，避免 subscriber mode 冲突
            maxRetriesPerRequest: null,
          },
        })
      },
    },
    {
      provide: DEPLOYMENT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Queue('deployment', {
          connection: {
            url: redisUrl,
            // 每个 Queue 使用独立的连接，避免 subscriber mode 冲突
            maxRetriesPerRequest: null,
          },
        })
      },
    },
    PipelineWorker, // Worker 会在模块初始化时自动启动
    EventWorker, // Event Worker 处理系统事件
  ],
  exports: [PIPELINE_QUEUE, DEPLOYMENT_QUEUE],
})
export class QueueModule {}
