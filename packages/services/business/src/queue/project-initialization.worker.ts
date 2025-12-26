import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { Inject, Injectable } from '@nestjs/common'
import type { Job } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'
import type { InitializationContext } from '../projects/initialization/initialization.service'
import { ProjectInitializationService } from '../projects/initialization/initialization.service'

/**
 * 项目初始化 Worker（重构版 - 使用 BullMQ 内置功能）
 *
 * 职责：
 * 1. 处理队列任务（使用 @Processor 装饰器）
 * 2. 调用 ProjectInitializationService 执行初始化
 * 3. 使用 BullMQ 内置事件处理（@OnWorkerEvent）
 *
 * 所有业务逻辑都在 ProjectInitializationService 中
 * 所有进度追踪都使用 BullMQ 的 job.updateProgress()
 */
@Processor('project-initialization', {
  concurrency: 3,
  limiter: { max: 5, duration: 1000 },
})
@Injectable()
export class ProjectInitializationWorker extends WorkerHost {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly initializationService: ProjectInitializationService,
    private readonly logger: PinoLogger,
  ) {
    super()
    this.logger.setContext(ProjectInitializationWorker.name)
  }

  /**
   * 处理项目初始化任务
   *
   * 使用 BullMQ 的 process() 方法，由 @Processor 装饰器自动调用
   */
  async process(job: Job): Promise<{ success: boolean; projectId: string }> {
    const { projectId, userId, organizationId, repository } = job.data

    this.logger.info({ jobId: job.id, projectId }, 'Processing project initialization')

    // 获取环境信息
    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    // 构建初始化上下文
    const context: InitializationContext = {
      projectId,
      userId,
      organizationId,
      repository,
      environmentIds: environments.map((env) => env.id),
      job, // 传递 Job 实例用于进度追踪
    }

    // 调用初始化服务（所有业务逻辑都在这里）
    await this.initializationService.initialize(context)

    this.logger.info({ projectId }, 'Project initialization completed successfully')

    return {
      success: true,
      projectId,
    }
  }

  /**
   * 作业完成事件处理
   *
   * 使用 BullMQ 内置的 @OnWorkerEvent 装饰器
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    const { projectId } = job.data
    this.logger.info(
      {
        jobId: job.id,
        projectId,
        duration: Date.now() - job.timestamp,
      },
      'Job completed',
    )
  }

  /**
   * 作业失败事件处理
   *
   * 使用 BullMQ 内置的 @OnWorkerEvent 装饰器
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    if (!job) {
      this.logger.error({ error }, 'Job failed without job context')
      return
    }

    const { projectId } = job.data
    this.logger.error(
      {
        jobId: job.id,
        projectId,
        error: error.message,
        stack: error.stack,
        attemptsMade: job.attemptsMade,
      },
      'Job failed',
    )
  }

  /**
   * 作业进度更新事件处理
   *
   * 使用 BullMQ 内置的 @OnWorkerEvent 装饰器
   */
  @OnWorkerEvent('progress')
  onProgress(job: Job, progress: number | object) {
    const { projectId } = job.data
    this.logger.debug(
      {
        jobId: job.id,
        projectId,
        progress,
      },
      'Job progress updated',
    )
  }

  /**
   * Worker 激活事件处理
   */
  @OnWorkerEvent('active')
  onActive(job: Job) {
    const { projectId } = job.data
    this.logger.info(
      {
        jobId: job.id,
        projectId,
      },
      'Job started',
    )
  }
}
