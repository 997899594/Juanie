import { Injectable, Logger } from '@nestjs/common'
import type { FastifyReply } from 'fastify'
import { EventBusService } from './event-bus.service'
import { SseService } from './sse.service'
import type { SSEEvent } from './types'

/**
 * SSE 连接管理器
 * 负责管理所有 SSE 连接和事件分发
 */
@Injectable()
export class SSEManagerService {
  private readonly logger = new Logger(SSEManagerService.name)
  private connections = new Map<string, Set<{ reply: FastifyReply; stream: any }>>()

  constructor(
    private eventBus: EventBusService,
    private sseService: SseService,
  ) {}

  /**
   * 创建 SSE 连接
   * @param channel 订阅的频道，如 "job:123" 或 "project:abc"
   * @param reply Fastify 响应对象
   * @param onClose 连接关闭回调
   */
  async createConnection(
    channel: string,
    reply: FastifyReply,
    onClose?: () => void,
  ): Promise<void> {
    const stream = this.sseService.createStream(reply)

    // 添加到连接池
    if (!this.connections.has(channel)) {
      this.connections.set(channel, new Set())
    }
    const connection = { reply, stream }
    this.connections.get(channel)!.add(connection)

    this.logger.debug(`New SSE connection for channel: ${channel}`)

    // 事件处理器
    const eventHandler = (event: SSEEvent) => {
      try {
        stream.send({
          id: `${event.channel}-${event.timestamp}`,
          event: event.type,
          data: event.data,
        })
      } catch (error) {
        this.logger.error(`Failed to send event to client:`, error)
        this.closeConnection(channel, connection)
      }
    }

    // 订阅事件总线
    await this.eventBus.subscribe(channel, eventHandler)

    // 发送连接成功消息
    stream.send({
      event: 'connected',
      data: { channel, timestamp: Date.now() },
    })

    // 处理连接关闭
    const cleanup = async () => {
      await this.eventBus.unsubscribe(channel, eventHandler)
      this.closeConnection(channel, connection)
      onClose?.()
    }

    reply.raw.on('close', cleanup)
    reply.raw.on('error', cleanup)
  }

  /**
   * 关闭连接
   */
  private closeConnection(channel: string, connection: { reply: FastifyReply; stream: any }): void {
    const channelConnections = this.connections.get(channel)
    if (!channelConnections) return

    channelConnections.delete(connection)
    connection.stream.close()

    if (channelConnections.size === 0) {
      this.connections.delete(channel)
      this.logger.debug(`All connections closed for channel: ${channel}`)
    }
  }

  /**
   * 获取频道的连接数
   */
  getConnectionCount(channel: string): number {
    return this.connections.get(channel)?.size || 0
  }

  /**
   * 获取所有活跃频道
   */
  getActiveChannels(): string[] {
    return Array.from(this.connections.keys())
  }
}
