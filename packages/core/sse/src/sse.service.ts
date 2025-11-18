import { Injectable } from '@nestjs/common'
import type { FastifyReply } from 'fastify'

export interface SseEvent {
  id?: string
  event?: string
  data: any
  retry?: number
}

/**
 * SSE 服务 - 原生实现
 * 简单、可靠、无依赖
 */
@Injectable()
export class SseService {
  createStream(reply: FastifyReply) {
    // 设置 SSE 响应头
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || 'http://localhost:1997',
      'Access-Control-Allow-Credentials': 'true',
    })

    return {
      send: (event: SseEvent) => {
        const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
        let message = ''
        if (event.id) message += `id: ${event.id}\n`
        if (event.event) message += `event: ${event.event}\n`
        if (event.retry) message += `retry: ${event.retry}\n`
        message += `data: ${data}\n\n`
        reply.raw.write(message)
      },
      close: () => reply.raw.end(),
    }
  }

  sendEvent(reply: FastifyReply, event: SseEvent) {
    const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data)
    let message = ''
    if (event.id) message += `id: ${event.id}\n`
    if (event.event) message += `event: ${event.event}\n`
    if (event.retry) message += `retry: ${event.retry}\n`
    message += `data: ${data}\n\n`
    reply.raw.write(message)
  }
}
