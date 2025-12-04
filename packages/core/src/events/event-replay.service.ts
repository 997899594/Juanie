import { Logger } from '@juanie/core/logger'
import { REDIS } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import type { Redis } from 'ioredis'
import { EventPublisher } from './event-publisher.service'
import type { BaseEvent } from './event-types'

/**
 * 事件重放服务
 *
 * 职责：
 * - 获取资源的历史事件
 * - 重放指定事件
 * - 事件查询和过滤
 */
@Injectable()
export class EventReplayService {
  private readonly logger = new Logger(EventReplayService.name)

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * 获取资源的所有事件
   */
  async getEvents(
    resourceId: string,
    options?: {
      from?: number
      to?: number
      limit?: number
      offset?: number
    },
  ): Promise<BaseEvent<unknown>[]> {
    const from = options?.from ?? 0
    const to = options?.to ?? Date.now()
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100

    try {
      const key = `events:${resourceId}`

      // 从 Redis Sorted Set 获取事件
      const events = await this.redis.zrangebyscore(key, from, to, 'LIMIT', offset, limit)

      return events.map((e) => JSON.parse(e) as BaseEvent<unknown>)
    } catch (error) {
      this.logger.error(`Failed to get events for resource ${resourceId}:`, error)
      return []
    }
  }

  /**
   * 获取单个事件
   */
  async getEvent(resourceId: string, eventId: string): Promise<BaseEvent<unknown> | null> {
    const events = await this.getEvents(resourceId, { limit: 1000 })
    return events.find((e) => e.id === eventId) ?? null
  }

  /**
   * 获取事件数量
   */
  async getEventCount(resourceId: string): Promise<number> {
    try {
      const key = `events:${resourceId}`
      return await this.redis.zcard(key)
    } catch (error) {
      this.logger.error(`Failed to get event count for resource ${resourceId}:`, error)
      return 0
    }
  }

  /**
   * 按事件类型过滤
   */
  async getEventsByType(
    resourceId: string,
    eventType: string,
    options?: {
      from?: number
      to?: number
      limit?: number
    },
  ): Promise<BaseEvent<unknown>[]> {
    const allEvents = await this.getEvents(resourceId, options)
    return allEvents.filter((e) => e.type === eventType)
  }

  /**
   * 重放事件
   *
   * 注意：只能重放领域事件和实时事件
   * 集成事件需要提供 queue 参数
   */
  async replay(
    resourceId: string,
    eventId: string,
    options?: {
      queue?: any // BullMQ Queue
    },
  ): Promise<void> {
    const event = await this.getEvent(resourceId, eventId)

    if (!event) {
      throw new Error(`Event ${eventId} not found for resource ${resourceId}`)
    }

    this.logger.log(`Replaying event ${eventId} for resource ${resourceId}`)

    // 使用 EventPublisher 重新发布事件
    await this.eventPublisher.publish(event as any, {
      queue: options?.queue,
    })
  }

  /**
   * 批量重放事件
   */
  async replayBatch(
    resourceId: string,
    eventIds: string[],
    options?: {
      queue?: any
    },
  ): Promise<{
    success: number
    failed: number
    errors: Array<{ eventId: string; error: string }>
  }> {
    const result = {
      success: 0,
      failed: 0,
      errors: [] as Array<{ eventId: string; error: string }>,
    }

    for (const eventId of eventIds) {
      try {
        await this.replay(resourceId, eventId, options)
        result.success++
      } catch (error: any) {
        result.failed++
        result.errors.push({
          eventId,
          error: error.message,
        })
      }
    }

    return result
  }

  /**
   * 清理过期事件
   */
  async cleanup(resourceId: string, olderThan: number): Promise<number> {
    try {
      const key = `events:${resourceId}`

      // 删除指定时间之前的事件
      const removed = await this.redis.zremrangebyscore(key, 0, olderThan)

      this.logger.log(`Cleaned up ${removed} events for resource ${resourceId}`)

      return removed
    } catch (error) {
      this.logger.error(`Failed to cleanup events for resource ${resourceId}:`, error)
      return 0
    }
  }

  /**
   * 删除资源的所有事件
   */
  async deleteAll(resourceId: string): Promise<void> {
    try {
      const key = `events:${resourceId}`
      await this.redis.del(key)

      this.logger.log(`Deleted all events for resource ${resourceId}`)
    } catch (error) {
      this.logger.error(`Failed to delete events for resource ${resourceId}:`, error)
    }
  }
}
