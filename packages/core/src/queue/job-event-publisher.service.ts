import type { OnModuleInit } from '@nestjs/common'
import { Injectable } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { QueueEvents as BullMQQueueEvents } from 'bullmq'
import { Logger } from '../logger'
import { EventBusService } from '../sse'

/**
 * 任务事件发布器
 * 监听 BullMQ 事件并发布到事件总线
 */
@Injectable()
export class JobEventPublisher implements OnModuleInit {
  constructor(
    private eventBus: EventBusService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(JobEventPublisher.name)
  }

  /**
   * 注册队列事件监听
   */
  registerQueue(queue: Queue, queueName: string): void {
    this.logger.info(`Registering event publisher for queue: ${queueName}`)

    // 创建 QueueEvents 来监听事件
    const queueEvents = new BullMQQueueEvents(queueName, {
      connection: queue.opts.connection,
    })

    // 监听进度更新
    queueEvents.on('progress', async ({ jobId, data }) => {
      try {
        const job = await queue.getJob(jobId)
        if (!job) return

        const eventData = {
          jobId,
          progress: typeof data === 'number' ? data : (job.progress as number) || 0,
          state: await job.getState(),
          logs: [], // BullMQ v5 不再支持 getLog，需要自定义日志系统
        }

        // 发布到 job channel
        await this.eventBus.publish({
          type: 'job.progress',
          channel: `job:${jobId}`,
          data: eventData,
          timestamp: Date.now(),
        })

        // 如果 job data 中有 projectId，同时发布到 project channel
        if (job.data?.projectId) {
          await this.eventBus.publish({
            type: 'job.progress',
            channel: `project:${job.data.projectId}`,
            data: eventData,
            timestamp: Date.now(),
          })
        }
      } catch (error) {
        this.logger.error(`Failed to publish progress event:`, error)
      }
    })

    // 监听任务完成
    queueEvents.on('completed', async ({ jobId, returnvalue }) => {
      try {
        const job = await queue.getJob(jobId)
        const eventData = {
          jobId,
          result: returnvalue,
        }

        await this.eventBus.publish({
          type: 'job.completed',
          channel: `job:${jobId}`,
          data: eventData,
          timestamp: Date.now(),
        })

        // 如果 job data 中有 projectId，同时发布到 project channel
        if (job?.data?.projectId) {
          await this.eventBus.publish({
            type: 'job.completed',
            channel: `project:${job.data.projectId}`,
            data: eventData,
            timestamp: Date.now(),
          })
        }
      } catch (error) {
        this.logger.error(`Failed to publish completed event:`, error)
      }
    })

    // 监听任务失败
    queueEvents.on('failed', async ({ jobId, failedReason }) => {
      try {
        const job = await queue.getJob(jobId)
        const eventData = {
          jobId,
          error: failedReason || 'Unknown error',
        }

        await this.eventBus.publish({
          type: 'job.failed',
          channel: `job:${jobId}`,
          data: eventData,
          timestamp: Date.now(),
        })

        // 如果 job data 中有 projectId，同时发布到 project channel
        if (job?.data?.projectId) {
          await this.eventBus.publish({
            type: 'job.failed',
            channel: `project:${job.data.projectId}`,
            data: eventData,
            timestamp: Date.now(),
          })
        }
      } catch (error) {
        this.logger.error(`Failed to publish failed event:`, error)
      }
    })
  }

  onModuleInit() {
    this.logger.info('JobEventPublisher initialized')
  }
}
