import { TRPCError } from '@trpc/server'
import { BusinessError } from './business-errors'

/**
 * 日志记录器接口
 */
interface Logger {
  error(message: string, context?: any): void
  warn(message: string, context?: any): void
}

/**
 * 默认日志记录器（使用 console）
 */
const defaultLogger: Logger = {
  error: (message: string, context?: any) => {
    console.error(`[ERROR] ${message}`, context || '')
  },
  warn: (message: string, context?: any) => {
    console.warn(`[WARN] ${message}`, context || '')
  },
}

/**
 * 统一错误处理函数
 *
 * 将各种错误类型转换为 TRPCError，并记录详细日志
 *
 * @param error - 错误对象
 * @param logger - 可选的日志记录器
 * @param context - 可选的上下文信息（用于日志）
 */
export function handleServiceError(
  error: unknown,
  logger: Logger = defaultLogger,
  context?: Record<string, any>,
): never {
  // 如果已经是 TRPCError，记录并直接抛出
  if (error instanceof TRPCError) {
    logger.warn('TRPCError thrown', {
      code: error.code,
      message: error.message,
      context,
    })
    throw error
  }

  // 如果是业务错误，记录并转换为 TRPCError
  if (error instanceof BusinessError) {
    logger.warn('Business error occurred', {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
      retryable: error.retryable,
      errorContext: error.context,
      requestContext: context,
    })
    throw error.toTRPCError()
  }

  // 如果是标准 Error，记录详细信息并包装为 INTERNAL_SERVER_ERROR
  if (error instanceof Error) {
    logger.error('Unexpected error occurred', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      context,
    })
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误，请稍后重试',
      cause: error,
    })
  }

  // 未知错误类型
  logger.error('Unknown error type', {
    error: String(error),
    type: typeof error,
    context,
  })
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误，请稍后重试',
  })
}

/**
 * 异步错误处理包装器
 *
 * 用于包装 async 函数，自动处理错误
 *
 * @param fn - 要包装的异步函数
 * @param logger - 可选的日志记录器
 * @param getContext - 可选的上下文提取函数
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  logger?: Logger,
  getContext?: (...args: Parameters<T>) => Record<string, any>,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      const context = getContext ? getContext(...args) : undefined
      handleServiceError(error, logger, context)
    }
  }
}

/**
 * 导出 Logger 接口供外部使用
 * 重命名为 ErrorLogger 以避免与 core/logger 的 Logger 冲突
 */
export type { Logger as ErrorLogger }
