import { Injectable, NestMiddleware } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: FastifyRequest['raw'], res: FastifyReply['raw'], next: () => void) {
    const startTime = Date.now()
    const { method, url } = req

    res.on('finish', () => {
      const duration = Date.now() - startTime
      const { statusCode } = res

      // 结构化日志
      const logData = {
        method,
        url,
        statusCode,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      }

      // 根据状态码选择日志级别
      if (statusCode >= 500) {
        console.error('HTTP Error:', logData)
      } else if (statusCode >= 400) {
        console.warn('HTTP Warning:', logData)
      } else {
        console.log('HTTP Request:', logData)
      }
    })

    next()
  }
}
