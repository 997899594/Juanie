import { Injectable, Logger } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import type { InitializationContext, InitializationState } from './types'

/**
 * 进度追踪服务（精简版）
 *
 * 职责：
 * 1. 实时推送状态变化到 Redis Pub/Sub
 * 2. 推送详细的进度信息
 * 3. 推送当前正在执行的操作
 */
@Injectable()
export class ProgressTrackerService {
  private readonly logger = new Logger(ProgressTrackerService.name)
  private redis: Redis

  constructor(private config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'
    this.redis = new Redis(redisUrl)
  }

  /**
   * 推送状态变化（直接发布到 Redis）
   */
  async publishStateChange(context: InitializationContext, message?: string): Promise<void> {
    const event = {
      type: 'initialization.progress',
      data: {
        projectId: context.projectId,
        state: context.currentState,
        progress: context.progress,
        message: message || this.getStateMessage(context.currentState),
      },
      timestamp: Date.now(),
    }

    // 推送到项目频道
    await this.redis.publish(`project:${context.projectId}`, JSON.stringify(event))

    this.logger.debug(`Progress published: ${context.currentState} (${context.progress}%)`)
  }

  /**
   * 推送详细操作
   */
  async publishDetailedProgress(
    context: InitializationContext,
    detail: {
      action: string
      subProgress?: number
      metadata?: Record<string, any>
    },
  ): Promise<void> {
    const event = {
      type: 'initialization.detail',
      data: {
        projectId: context.projectId,
        state: context.currentState,
        progress: context.progress,
        action: detail.action,
        subProgress: detail.subProgress,
        metadata: detail.metadata,
      },
      timestamp: Date.now(),
    }

    await this.redis.publish(`project:${context.projectId}`, JSON.stringify(event))

    this.logger.debug(`Detail published: ${detail.action}`)
  }

  /**
   * 推送错误
   */
  async publishError(context: InitializationContext, error: Error): Promise<void> {
    const event = {
      type: 'initialization.failed',
      data: {
        projectId: context.projectId,
        state: context.currentState,
        progress: context.progress,
        error: error.message,
      },
      timestamp: Date.now(),
    }

    await this.redis.publish(`project:${context.projectId}`, JSON.stringify(event))

    this.logger.error(`Error published: ${error.message}`)
  }

  /**
   * 推送完成
   */
  async publishCompleted(context: InitializationContext): Promise<void> {
    const event = {
      type: 'initialization.completed',
      data: {
        projectId: context.projectId,
        state: 'COMPLETED',
        progress: 100,
        message: '项目初始化完成',
        createdResources: {
          environments: context.environmentIds?.length || 0,
          repository: context.repositoryId ? 1 : 0,
          gitopsResources: context.gitopsResourceIds?.length || 0,
        },
      },
      timestamp: Date.now(),
    }

    await this.redis.publish(`project:${context.projectId}`, JSON.stringify(event))

    this.logger.log(`Completion published for project: ${context.projectId}`)
  }

  /**
   * 获取状态的友好消息
   */
  private getStateMessage(state: InitializationState): string {
    const messages: Record<InitializationState, string> = {
      IDLE: '准备开始...',
      CREATING_PROJECT: '正在创建项目记录...',
      LOADING_TEMPLATE: '正在加载项目模板...',
      RENDERING_TEMPLATE: '正在渲染模板文件...',
      CREATING_ENVIRONMENTS: '正在创建环境配置...',
      SETTING_UP_REPOSITORY: '正在设置 Git 仓库...',
      CREATING_GITOPS: '正在配置 GitOps 资源...',
      FINALIZING: '正在完成初始化...',
      COMPLETED: '初始化完成！',
      FAILED: '初始化失败',
    }

    return messages[state] || '处理中...'
  }
}
