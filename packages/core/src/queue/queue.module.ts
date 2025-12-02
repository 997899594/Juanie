import { DatabaseModule } from '@juanie/core/database'
import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import {
  DEPLOYMENT_QUEUE,
  GIT_SYNC_QUEUE,
  PIPELINE_QUEUE,
  PROJECT_INITIALIZATION_QUEUE,
  REPOSITORY_QUEUE,
} from './tokens'
import { EventWorker } from './workers/event.worker'
import { PipelineWorker } from './workers/pipeline.worker'
import { RepositoryWorker } from './workers/repository.worker'

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule],
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
    {
      provide: REPOSITORY_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Queue('repository', {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
          },
        })
      },
    },
    {
      provide: PROJECT_INITIALIZATION_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Queue('project-initialization', {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 1000,
            },
            removeOnComplete: {
              age: 3600, // 保留 1 小时
              count: 100,
            },
            removeOnFail: {
              age: 86400, // 保留 24 小时
            },
          },
        })
      },
    },
    {
      provide: GIT_SYNC_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Queue('git-sync', {
          connection: {
            url: redisUrl,
            maxRetriesPerRequest: null,
            enableOfflineQueue: false,
          },
          defaultJobOptions: {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 2000, // 2 seconds initial delay
            },
            removeOnComplete: {
              age: 3600, // 保留 1 小时
              count: 100,
            },
            removeOnFail: {
              age: 86400, // 保留 24 小时
            },
          },
        })
      },
    },
    PipelineWorker,
    EventWorker,
    RepositoryWorker,
    // ProjectInitializationWorker 在 WorkersModule 中
  ],
  exports: [
    PIPELINE_QUEUE,
    DEPLOYMENT_QUEUE,
    REPOSITORY_QUEUE,
    PROJECT_INITIALIZATION_QUEUE,
    GIT_SYNC_QUEUE,
  ],
})
export class QueueModule {}
