import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'

export const PIPELINE_QUEUE = 'PIPELINE_QUEUE'
export const DEPLOYMENT_QUEUE = 'DEPLOYMENT_QUEUE'

@Global()
@Module({
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
  ],
  exports: [PIPELINE_QUEUE, DEPLOYMENT_QUEUE],
})
export class QueueModule {}
