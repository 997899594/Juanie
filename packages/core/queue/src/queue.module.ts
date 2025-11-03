import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { DEPLOYMENT_QUEUE, PIPELINE_QUEUE } from './tokens'
import { PipelineWorker } from './workers/pipeline.worker'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: PIPELINE_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL')!
        return new Queue('pipeline', {
          connection: {
            url: redisUrl,
          },
        })
      },
    },
    {
      provide: DEPLOYMENT_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL')!
        return new Queue('deployment', {
          connection: {
            url: redisUrl,
          },
        })
      },
    },
    PipelineWorker, // Worker 会在模块初始化时自动启动
  ],
  exports: [PIPELINE_QUEUE, DEPLOYMENT_QUEUE],
})
export class QueueModule {}
