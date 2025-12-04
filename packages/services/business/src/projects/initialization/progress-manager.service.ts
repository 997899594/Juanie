import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'

/**
 * 项目初始化进度管理器
 *
 * 职责：
 * 1. 管理初始化进度的唯一真相源（Redis）
 * 2. 保证进度单调递增
 * 3. 发布进度事件到 Redis Pub/Sub
 * 4. 提供进度查询接口
 *
 * 设计原则：
 * - 单一数据源：Redis 作为实时进度的唯一来源
 * - 单调性保证：进度只能增加，不能回退
 * - 事件驱动：通过 Redis Pub/Sub + SSE 通知前端
 */
@Injectable()
export class ProgressManagerService {
  private readonly logger = new Logger(ProgressManagerService.name)
  private readonly redis: Redis

  constructor(private readonly config: ConfigService) {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'
    this.redis = new Redis(redisUrl)
  }

  /**
   * 更新进度（保证单调递增）
   */
  async updateProgress(
    projectId: string,
    progress: number,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<boolean> {
    // 1. 获取当前进度
    const currentProgress = await this.getCurrentProgress(projectId)

    // 2. 检查单调性
    if (progress < currentProgress) {
      this.logger.warn(
        `Rejected progress regression for ${projectId}: ${progress}% < ${currentProgress}%`,
      )
      return false
    }

    // 3. 更新 Redis 中的进度
    const progressKey = `project:${projectId}:progress`
    await this.redis.set(
      progressKey,
      JSON.stringify({
        progress,
        message,
        metadata,
        timestamp: Date.now(),
      }),
      'EX',
      3600, // 1小时过期
    )

    // 4. 发布进度事件
    await this.publishProgressEvent(projectId, progress, message, metadata)

    this.logger.debug(
      `Progress updated for ${projectId}: ${currentProgress}% -> ${progress}% - ${message}`,
    )
    return true
  }

  /**
   * 获取当前进度
   */
  async getCurrentProgress(projectId: string): Promise<number> {
    const progressKey = `project:${projectId}:progress`
    const data = await this.redis.get(progressKey)

    if (!data) return 0

    try {
      const parsed = JSON.parse(data)
      return parsed.progress || 0
    } catch {
      return 0
    }
  }

  /**
   * 获取完整的进度信息
   */
  async getProgressInfo(projectId: string): Promise<{
    progress: number
    message: string
    metadata?: Record<string, any>
    timestamp: number
  } | null> {
    const progressKey = `project:${projectId}:progress`
    const data = await this.redis.get(progressKey)

    if (!data) return null

    try {
      return JSON.parse(data)
    } catch {
      return null
    }
  }

  /**
   * 标记初始化完成
   */
  async markCompleted(projectId: string): Promise<void> {
    await this.updateProgress(projectId, 100, '初始化完成')

    // 发布完成事件
    await this.redis.publish(
      `project:${projectId}`,
      JSON.stringify({
        type: 'initialization.completed',
        data: { projectId },
        timestamp: Date.now(),
      }),
    )

    // 清理进度数据（延迟清理，给前端时间接收）
    setTimeout(() => {
      this.redis.del(`project:${projectId}:progress`)
    }, 60000) // 1分钟后清理
  }

  /**
   * 标记初始化失败
   */
  async markFailed(projectId: string, error: string): Promise<void> {
    // 发布失败事件
    await this.redis.publish(
      `project:${projectId}`,
      JSON.stringify({
        type: 'initialization.failed',
        data: { projectId, error },
        timestamp: Date.now(),
      }),
    )

    // 清理进度数据
    setTimeout(() => {
      this.redis.del(`project:${projectId}:progress`)
    }, 60000)
  }

  /**
   * 重置进度（用于重新初始化）
   */
  async resetProgress(projectId: string): Promise<void> {
    await this.redis.del(`project:${projectId}:progress`)
    this.logger.log(`Progress reset for ${projectId}`)
  }

  /**
   * 发布进度事件到 Redis Pub/Sub
   */
  private async publishProgressEvent(
    projectId: string,
    progress: number,
    message: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const event = {
      type: 'initialization.progress',
      data: {
        projectId,
        progress,
        message,
        metadata,
      },
      timestamp: Date.now(),
    }

    await this.redis.publish(`project:${projectId}`, JSON.stringify(event))
  }
}
