import { DatabaseModule } from '@juanie/core-database/module'
import { SseModule } from '@juanie/core-sse'
import { AuthModule } from '@juanie/service-auth'
import { Global, Inject, Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { Queue } from 'bullmq'
import { JobEventPublisher } from './job-event-publisher.service'
import {
  DEPLOYMENT_QUEUE,
  PIPELINE_QUEUE,
  PROJECT_INITIALIZATION_QUEUE,
  REPOSITORY_QUEUE,
} from './tokens'
import { EventWorker } from './workers/event.worker'
import { PipelineWorker } from './workers/pipeline.worker'
import { ProjectInitializationWorker } from './workers/project-initialization.worker'
import { RepositoryWorker } from './workers/repository.worker'

@Global()
@Module({
  imports: [ConfigModule, DatabaseModule, AuthModule, SseModule],
  providers: [
    JobEventPublisher,
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
          },
        })
      },
    },
    PipelineWorker,
    EventWorker,
    RepositoryWorker,
    ProjectInitializationWorker, // 项目初始化 Worker
  ],
  exports: [PIPELINE_QUEUE, DEPLOYMENT_QUEUE, REPOSITORY_QUEUE, PROJECT_INITIALIZATION_QUEUE],
})
export class QueueModule {
  constructor(
    private jobEventPublisher: JobEventPublisher,
    @Inject(PIPELINE_QUEUE) pipelineQueue: Queue,
    @Inject(DEPLOYMENT_QUEUE) deploymentQueue: Queue,
    @Inject(REPOSITORY_QUEUE) repositoryQueue: Queue,
    @Inject(PROJECT_INITIALIZATION_QUEUE) projectInitQueue: Queue,
  ) {
    // 注册所有队列的事件发布器
    this.jobEventPublisher.registerQueue(pipelineQueue, 'pipeline')
    this.jobEventPublisher.registerQueue(deploymentQueue, 'deployment')
    this.jobEventPublisher.registerQueue(repositoryQueue, 'repository')
    this.jobEventPublisher.registerQueue(projectInitQueue, 'project-initialization')
  }
}
