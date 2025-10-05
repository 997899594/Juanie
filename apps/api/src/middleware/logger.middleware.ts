/**
 * 日志级别枚举
 */
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn',
  INFO = 'info',
  DEBUG = 'debug',
}

/**
 * 日志上下文接口
 */
export interface LogContext {
  userId?: string
  requestId?: string
  method?: string
  path?: string
  userAgent?: string
  ip?: string
  duration?: number
  statusCode?: number
  [key: string]: any
}

/**
 * 日志记录器类
 */
export class Logger {
  private static instance: Logger
  private readonly isDevelopment: boolean

  constructor() {
    this.isDevelopment = process.env.NODE_ENV === 'development'
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  /**
   * 格式化日志消息
   */
  private formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const contextStr = context ? ` | ${JSON.stringify(context)}` : ''

    if (this.isDevelopment) {
      const emoji = this.getLogEmoji(level)
      return `${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}${contextStr}`
    }

    return JSON.stringify({
      timestamp,
      level,
      message,
      ...context,
    })
  }

  /**
   * 获取日志级别对应的表情符号
   */
  private getLogEmoji(level: LogLevel): string {
    const emojiMap = {
      [LogLevel.ERROR]: '🚨',
      [LogLevel.WARN]: '⚠️',
      [LogLevel.INFO]: 'ℹ️',
      [LogLevel.DEBUG]: '🐛',
    }
    return emojiMap[level] || 'ℹ️'
  }

  /**
   * 记录错误日志
   */
  error(message: string, context?: LogContext): void {
    console.error(this.formatMessage(LogLevel.ERROR, message, context))
  }

  /**
   * 记录警告日志
   */
  warn(message: string, context?: LogContext): void {
    console.warn(this.formatMessage(LogLevel.WARN, message, context))
  }

  /**
   * 记录信息日志
   */
  info(message: string, context?: LogContext): void {
    console.info(this.formatMessage(LogLevel.INFO, message, context))
  }

  /**
   * 记录调试日志
   */
  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.debug(this.formatMessage(LogLevel.DEBUG, message, context))
    }
  }

  /**
   * 记录 API 请求日志
   */
  logApiRequest(context: {
    method: string
    path: string
    userId?: string
    duration: number
    statusCode?: number
    userAgent?: string
    ip?: string
  }): void {
    const { method, path, duration, statusCode } = context
    const status = statusCode ? (statusCode >= 400 ? '❌' : '✅') : '⏳'

    this.info(`${status} ${method} ${path} - ${duration}ms`, {
      ...context,
      type: 'api_request',
    })
  }

  /**
   * 记录数据库操作日志
   */
  logDatabaseOperation(operation: string, table?: string, duration?: number, success = true): void {
    const status = success ? '✅' : '❌'
    const message = `${status} DB ${operation}${table ? ` on ${table}` : ''}${duration ? ` - ${duration}ms` : ''}`

    this.debug(message, {
      type: 'database_operation',
      operation,
      table,
      duration,
      success,
    })
  }

  /**
   * 记录认证相关日志
   */
  logAuth(action: string, userId?: string, success = true, details?: Record<string, any>): void {
    const status = success ? '✅' : '❌'
    const message = `${status} Auth ${action}${userId ? ` for user ${userId}` : ''}`

    this.info(message, {
      type: 'authentication',
      action,
      userId,
      success,
      ...details,
    })
  }

  /**
   * 记录业务逻辑日志
   */
  logBusiness(action: string, context?: LogContext): void {
    this.info(`📋 Business: ${action}`, {
      type: 'business_logic',
      action,
      ...context,
    })
  }

  /**
   * 记录性能指标
   */
  logPerformance(metric: string, value: number, unit = 'ms', context?: LogContext): void {
    this.debug(`📊 Performance: ${metric} = ${value}${unit}`, {
      type: 'performance',
      metric,
      value,
      unit,
      ...context,
    })
  }

  /**
   * 记录系统事件
   */
  logSystem(event: string, context?: LogContext): void {
    this.info(`🔧 System: ${event}`, {
      type: 'system_event',
      event,
      ...context,
    })
  }
}

/**
 * 导出单例实例
 */
export const logger = Logger.getInstance()

/**
 * tRPC 日志中间件
 */
export function createLoggingMiddleware() {
  return async function loggingMiddleware(opts: any) {
    const start = Date.now()
    const { path, type, next } = opts

    try {
      const result = await next()
      const duration = Date.now() - start

      logger.logApiRequest({
        method: type,
        path,
        duration,
        statusCode: 200,
      })

      return result
    } catch (error) {
      const duration = Date.now() - start

      logger.logApiRequest({
        method: type,
        path,
        duration,
        statusCode: 500,
      })

      logger.error(`tRPC ${type} ${path} failed`, {
        error: error instanceof Error ? error.message : String(error),
        duration,
      })

      throw error
    }
  }
}

/**
 * 性能监控中间件
 */
export function createPerformanceMiddleware() {
  return async function performanceMiddleware(opts: any) {
    const start = Date.now()
    const startMemory = process.memoryUsage()
    const { next } = opts

    try {
      const result = await next()
      const duration = Date.now() - start
      const endMemory = process.memoryUsage()
      const memoryDelta = endMemory.heapUsed - startMemory.heapUsed

      // 记录慢查询（超过1秒）
      if (duration > 1000) {
        logger.warn(`Slow operation detected: ${opts.path}`, {
          duration,
          memoryDelta,
          type: 'slow_operation',
        })
      }

      // 记录内存使用异常（增长超过10MB）
      if (memoryDelta > 10 * 1024 * 1024) {
        logger.warn(`High memory usage detected: ${opts.path}`, {
          duration,
          memoryDelta,
          type: 'high_memory_usage',
        })
      }

      return result
    } catch (error) {
      const duration = Date.now() - start
      logger.logPerformance('failed_operation_duration', duration, 'ms', {
        path: opts.path,
        error: error instanceof Error ? error.message : String(error),
      })

      throw error
    }
  }
}
