import { Injectable } from '@nestjs/common'

export interface LogContext {
  userId?: string
  requestId?: string
  operation?: string
  duration?: number
  [key: string]: any
}

/**
 * 现代化日志服务
 * 提供结构化日志记录
 */
@Injectable()
export class LoggerService {
  private formatLog(level: string, message: string, context?: LogContext) {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context,
    }
  }

  info(message: string, context?: LogContext) {
    console.log(JSON.stringify(this.formatLog('info', message, context)))
  }

  error(message: string, context?: LogContext) {
    console.error(JSON.stringify(this.formatLog('error', message, context)))
  }

  warn(message: string, context?: LogContext) {
    console.warn(JSON.stringify(this.formatLog('warn', message, context)))
  }

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV === 'development') {
      console.debug(JSON.stringify(this.formatLog('debug', message, context)))
    }
  }
}
