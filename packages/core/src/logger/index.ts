/**
 * 统一的 Logger 导出
 *
 * 提供兼容 @nestjs/common Logger 接口的 Pino Logger 包装器
 * 这样所有服务的日志都会使用 Pino（结构化 JSON）
 */

import { Logger as PinoLogger } from 'nestjs-pino'
import pino from 'pino'

/**
 * Logger 包装器
 *
 * 兼容 @nestjs/common 的 Logger 接口，但使用 Pino 作为底层实现
 *
 * 使用方式：
 *
 * import { Logger } from '@juanie/core/logger'
 *
 * @Injectable()
 * export class MyService {
 *   private readonly logger = new Logger(MyService.name)
 *
 *   someMethod() {
 *     this.logger.log('Message')
 *     this.logger.error('Error', error)
 *   }
 * }
 */
export class Logger {
  private readonly pinoLogger: pino.Logger
  private context?: string

  constructor(context?: string) {
    this.context = context

    // 创建 Pino logger 实例
    this.pinoLogger = pino({
      level: process.env.LOG_LEVEL || 'info',
      transport:
        process.env.NODE_ENV !== 'production'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
                singleLine: false,
                messageFormat: '{context} {msg}',
              },
            }
          : undefined,
    })
  }

  /**
   * 设置日志上下文
   */
  setContext(context: string) {
    this.context = context
  }

  /**
   * 记录普通日志
   */
  log(message: unknown, ...optionalParams: unknown[]) {
    this.pinoLogger.info(
      { context: this.context, ...this.parseOptionalParams(optionalParams) },
      this.formatMessage(message),
    )
  }

  /**
   * 记录错误日志
   */
  error(message: unknown, ...optionalParams: unknown[]) {
    const [error, context] = this.parseErrorParams(optionalParams)

    this.pinoLogger.error(
      {
        context: context || this.context,
        err: error,
      },
      this.formatMessage(message),
    )
  }

  /**
   * 记录警告日志
   */
  warn(message: unknown, ...optionalParams: unknown[]) {
    this.pinoLogger.warn(
      { context: this.context, ...this.parseOptionalParams(optionalParams) },
      this.formatMessage(message),
    )
  }

  /**
   * 记录调试日志
   */
  debug(message: unknown, ...optionalParams: unknown[]) {
    this.pinoLogger.debug(
      { context: this.context, ...this.parseOptionalParams(optionalParams) },
      this.formatMessage(message),
    )
  }

  /**
   * 记录详细日志
   */
  verbose(message: unknown, ...optionalParams: unknown[]) {
    this.pinoLogger.trace(
      { context: this.context, ...this.parseOptionalParams(optionalParams) },
      this.formatMessage(message),
    )
  }

  /**
   * 格式化消息
   */
  private formatMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message
    }

    if (message instanceof Error) {
      return message.message
    }

    if (typeof message === 'object' && message !== null) {
      return JSON.stringify(message)
    }

    return String(message)
  }

  /**
   * 解析可选参数
   */
  private parseOptionalParams(params: unknown[]): Record<string, unknown> {
    if (params.length === 0) {
      return {}
    }

    // 如果最后一个参数是字符串，可能是 context
    const lastParam = params[params.length - 1]
    if (typeof lastParam === 'string') {
      return { additionalContext: lastParam }
    }

    // 如果是对象，直接返回
    if (typeof lastParam === 'object' && lastParam !== null) {
      return lastParam as Record<string, unknown>
    }

    return {}
  }

  /**
   * 解析错误参数
   */
  private parseErrorParams(params: unknown[]): [Error | undefined, string | undefined] {
    let error: Error | undefined
    let context: string | undefined

    for (const param of params) {
      if (param instanceof Error) {
        error = param
      } else if (typeof param === 'string') {
        context = param
      }
    }

    return [error, context]
  }
}

/**
 * 导出 PinoLogger 用于依赖注入
 *
 * 使用方式（推荐用于 NestJS 服务）：
 *
 * @Injectable()
 * export class MyService {
 *   constructor(private readonly logger: PinoLogger) {
 *     this.logger.setContext(MyService.name)
 *   }
 * }
 */
export { PinoLogger }
