import { Logger } from '@juanie/core/logger'
import { REDIS } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import type { Redis } from 'ioredis'
import { nanoid } from 'nanoid'
import type {
  AnyEvent,
  BaseEvent,
  DomainEventType,
  IntegrationEventType,
  RealtimeEventType,
} from './event-types'
import { DomainEvents, IntegrationEvents, RealtimeEvents } from './event-types'

/**
 * 统一事件发布器
 *
 * 职责：
 * - 发布领域事件（同步，NestJS EventEmitter）
 * - 发布集成事件（异步，BullMQ）
 * - 发布实时事件（推送，Redis Pub/Sub）
 * - 自动添加事件 ID 和时间戳
 * - 记录事件日志（可选）
 */
@Injectable()
export class EventPublisher {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    @Inject(REDIS) private readonly redis: Redis,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(EventPublisher.name)
  }

  /**
   * 发布领域事件（同步）
   * 使用 NestJS EventEmitter，应用内部同步处理
   */
  async publishDomain<T extends BaseEvent<unknown>>(
    event: Omit<T, 'id' | 'timestamp'>,
  ): Promise<void> {
    const fullEvent = this.enrichEvent(event) as T

    this.logger.debug(`Publishing domain event: ${event.type}`, {
      resourceId: event.resourceId,
      userId: event.userId,
    })

    // 使用 NestJS EventEmitter（同步）
    this.eventEmitter.emit(event.type, fullEvent)

    // 记录事件日志
    await this.logEvent(fullEvent)
  }

  /**
   * 发布集成事件（异步，持久化）
   * 使用 BullMQ，支持重试和持久化
   *
   * 注意：需要在调用处注入对应的 Queue
   */
  async publishIntegration<T extends BaseEvent<unknown>>(
    event: Omit<T, 'id' | 'timestamp'>,
    queue: Queue,
    options?: {
      attempts?: number
      backoff?: {
        type: 'exponential' | 'fixed'
        delay: number
      }
      delay?: number
    },
  ): Promise<void> {
    const fullEvent = this.enrichEvent(event) as T

    this.logger.debug(`Publishing integration event: ${event.type}`, {
      resourceId: event.resourceId,
      userId: event.userId,
    })

    // 添加到 BullMQ 队列
    await queue.add(
      event.type,
      fullEvent,
      options ?? {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      },
    )

    // 记录事件日志
    await this.logEvent(fullEvent)
  }

  /**
   * 发布实时事件（推送到前端）
   * 使用 Redis Pub/Sub，不需要持久化
   */
  async publishRealtime<T extends BaseEvent<unknown>>(
    event: Omit<T, 'id' | 'timestamp'>,
  ): Promise<void> {
    const fullEvent = this.enrichEvent(event) as T

    this.logger.debug(`Publishing realtime event: ${event.type}`, {
      resourceId: event.resourceId,
      userId: event.userId,
    })

    // 发布到 Redis Pub/Sub
    const channel = `realtime:${event.resourceId}`
    await this.redis.publish(channel, JSON.stringify(fullEvent))

    // 记录事件日志（可选，实时事件通常不需要持久化）
    // await this.logEvent(fullEvent)
  }

  /**
   * 智能发布 - 根据事件类型自动选择发布方式
   *
   * 注意：集成事件需要提供 queue 参数
   */
  async publish<T extends AnyEvent>(
    event: Omit<T, 'id' | 'timestamp'>,
    options?: {
      queue?: Queue
      queueOptions?: {
        attempts?: number
        backoff?: {
          type: 'exponential' | 'fixed'
          delay: number
        }
      }
    },
  ): Promise<void> {
    if (this.isDomainEvent(event.type)) {
      await this.publishDomain(event)
    } else if (this.isIntegrationEvent(event.type)) {
      if (!options?.queue) {
        throw new Error(`Integration event ${event.type} requires a queue parameter`)
      }
      await this.publishIntegration(event, options.queue, options.queueOptions)
    } else if (this.isRealtimeEvent(event.type)) {
      await this.publishRealtime(event)
    } else {
      this.logger.warn(`Unknown event type: ${event.type}, publishing as domain event`)
      await this.publishDomain(event)
    }
  }

  /**
   * 丰富事件数据 - 添加 ID 和时间戳
   */
  private enrichEvent<T extends BaseEvent<unknown>>(event: Omit<T, 'id' | 'timestamp'>): T {
    return {
      ...event,
      id: nanoid(),
      timestamp: Date.now(),
    } as T
  }

  /**
   * 记录事件日志到 Redis
   * 使用 Sorted Set 存储，按时间戳排序
   */
  private async logEvent(event: BaseEvent<unknown>): Promise<void> {
    try {
      const key = `events:${event.resourceId}`

      // 存储到 Redis Sorted Set
      await this.redis.zadd(key, event.timestamp, JSON.stringify(event))

      // 设置过期时间（30天）
      await this.redis.expire(key, 30 * 24 * 60 * 60)

      // 限制每个资源最多保留 1000 个事件
      const count = await this.redis.zcard(key)
      if (count > 1000) {
        // 删除最旧的事件
        await this.redis.zremrangebyrank(key, 0, count - 1000 - 1)
      }
    } catch (error) {
      this.logger.error('Failed to log event:', error)
      // 不抛出错误，避免影响事件发布
    }
  }

  /**
   * 判断是否为领域事件
   */
  private isDomainEvent(type: string): type is DomainEventType {
    return Object.values(DomainEvents).includes(type as DomainEventType)
  }

  /**
   * 判断是否为集成事件
   */
  private isIntegrationEvent(type: string): type is IntegrationEventType {
    return Object.values(IntegrationEvents).includes(type as IntegrationEventType)
  }

  /**
   * 判断是否为实时事件
   */
  private isRealtimeEvent(type: string): type is RealtimeEventType {
    return Object.values(RealtimeEvents).includes(type as RealtimeEventType)
  }
}
