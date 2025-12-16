import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import Redis from 'ioredis'
import { Logger } from '../logger'
import type { SSEEvent } from './types'

/**
 * 事件总线 - 基于 Redis Pub/Sub
 * 负责在不同服务之间传递事件
 */
@Injectable()
export class EventBusService {
  private publisher: Redis
  private subscriber: Redis
  private handlers = new Map<string, Set<(event: SSEEvent) => void>>()

  constructor(
    private config: ConfigService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(EventBusService.name)
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.publisher = new Redis(redisUrl)
    this.subscriber = new Redis(redisUrl)

    this.subscriber.on('message', (channel, message) => {
      try {
        const event: SSEEvent = JSON.parse(message)
        this.handleEvent(channel, event)
      } catch (error) {
        this.logger.error(`Failed to parse event from channel ${channel}:`, error)
      }
    })

    this.logger.info('EventBus initialized')
  }

  /**
   * 发布事件（简化版，直接发布到 Redis）
   */
  async publish(event: SSEEvent): Promise<void> {
    await this.publisher.publish(event.channel, JSON.stringify(event))
  }

  /**
   * 订阅频道
   */
  async subscribe(channel: string, handler: (event: SSEEvent) => void): Promise<void> {
    if (!this.handlers.has(channel)) {
      this.handlers.set(channel, new Set())
      await this.subscriber.subscribe(channel)
      this.logger.debug(`Subscribed to channel: ${channel}`)
    }

    this.handlers.get(channel)!.add(handler)
  }

  /**
   * 取消订阅
   */
  async unsubscribe(channel: string, handler: (event: SSEEvent) => void): Promise<void> {
    const channelHandlers = this.handlers.get(channel)
    if (!channelHandlers) return

    channelHandlers.delete(handler)

    if (channelHandlers.size === 0) {
      this.handlers.delete(channel)
      await this.subscriber.unsubscribe(channel)
      this.logger.debug(`Unsubscribed from channel: ${channel}`)
    }
  }

  /**
   * 处理接收到的事件
   */
  private handleEvent(channel: string, event: SSEEvent): void {
    const handlers = this.handlers.get(channel)
    if (!handlers) return

    handlers.forEach((handler) => {
      try {
        handler(event)
      } catch (error) {
        this.logger.error(`Handler error for channel ${channel}:`, error)
      }
    })
  }

  /**
   * 清理资源
   */
  async onModuleDestroy() {
    try {
      await this.publisher.quit()
    } catch (error) {
      // 忽略关闭时的错误
      this.logger.debug('Publisher quit error (ignored)', error)
    }

    try {
      await this.subscriber.quit()
    } catch (error) {
      // 忽略关闭时的错误
      this.logger.debug('Subscriber quit error (ignored)', error)
    }

    this.logger.info('EventBus destroyed')
  }
}
