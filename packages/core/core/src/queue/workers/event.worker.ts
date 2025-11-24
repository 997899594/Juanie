import { REDIS } from '@juanie/core/tokens'
import type {
  DeploymentCompletedEvent,
  EnvironmentUpdatedEvent,
  GitOpsSyncStatusEvent,
} from '@juanie/core-types'
import type { OnModuleInit } from '@nestjs/common'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { Worker } from 'bullmq'
import type Redis from 'ioredis'

/**
 * Event Worker
 *
 * 处理系统事件，实现事件驱动架构
 * Requirements: 11.3, 11.4, 11.5
 */
@Injectable()
export class EventWorker implements OnModuleInit {
  private readonly logger = new Logger(EventWorker.name)
  private worker!: Worker

  constructor(
    private config: ConfigService,
    @Inject(REDIS) private redis: Redis,
  ) {}

  onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.worker = new Worker(
      'deployment', // 使用 deployment queue 处理事件
      async (job) => {
        this.logger.log(`Processing event: ${job.name} (${job.id})`)

        try {
          // 根据事件类型分发到不同的处理器
          switch (job.name) {
            case 'deployment.completed':
              await this.handleDeploymentCompleted(job.data as DeploymentCompletedEvent)
              break

            case 'gitops.sync.status':
              await this.handleGitOpsSyncStatus(job.data as GitOpsSyncStatusEvent)
              break

            case 'environment.updated':
              await this.handleEnvironmentUpdated(job.data as EnvironmentUpdatedEvent)
              break

            case 'project.created':
            case 'project.initialized':
            case 'project.archived':
            case 'project.restored':
            case 'project.deleted':
              // 这些事件目前只记录日志，不需要特殊处理
              this.logger.log(`Project event: ${job.name}`)
              break

            default:
              this.logger.warn(`Unknown event type: ${job.name}`)
          }

          return { success: true }
        } catch (error) {
          this.logger.error(`Failed to process event ${job.name}:`, error)
          throw error
        }
      },
      {
        connection: {
          url: redisUrl,
          // Worker 需要独立的连接，避免与 Queue 冲突
          maxRetriesPerRequest: null,
        },
        concurrency: 10, // 同时处理 10 个事件
      },
    )

    this.worker.on('completed', (job) => {
      this.logger.log(`Event processed: ${job.name} (${job.id})`)
    })

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Event processing failed: ${job?.name} (${job?.id})`, err)
    })

    this.logger.log('Event Worker started')
  }

  /**
   * 处理部署完成事件
   *
   * 通过 Redis Pub/Sub 通知 ProjectOrchestrator
   */
  private async handleDeploymentCompleted(event: DeploymentCompletedEvent): Promise<void> {
    this.logger.log(`Handling deployment.completed event for deployment ${event.deploymentId}`)

    // 发布到 Redis Pub/Sub，让 ProjectOrchestrator 处理
    await this.redis.publish('events:deployment.completed', JSON.stringify(event))

    this.logger.log(`Published deployment.completed event to Redis Pub/Sub`)
  }

  /**
   * 处理 GitOps 同步状态事件
   *
   * 通过 Redis Pub/Sub 通知 ProjectOrchestrator
   */
  private async handleGitOpsSyncStatus(event: GitOpsSyncStatusEvent): Promise<void> {
    this.logger.log(`Handling gitops.sync.status event for resource ${event.resourceId}`)

    // 发布到 Redis Pub/Sub，让 ProjectOrchestrator 处理
    await this.redis.publish('events:gitops.sync.status', JSON.stringify(event))

    this.logger.log(`Published gitops.sync.status event to Redis Pub/Sub`)
  }

  /**
   * 处理环境更新事件
   *
   * 通过 Redis Pub/Sub 通知 ProjectOrchestrator
   */
  private async handleEnvironmentUpdated(event: EnvironmentUpdatedEvent): Promise<void> {
    this.logger.log(`Handling environment.updated event for environment ${event.environmentId}`)

    // 发布到 Redis Pub/Sub，让 ProjectOrchestrator 处理
    await this.redis.publish('events:environment.updated', JSON.stringify(event))

    this.logger.log(`Published environment.updated event to Redis Pub/Sub`)
  }

  async onModuleDestroy() {
    await this.worker.close()
    this.logger.log('Event Worker stopped')
  }
}
