import { TRPCError } from '@trpc/server'
import { BusinessError } from './business-errors'

/**
 * 统一错误处理函数
 *
 * 将各种错误类型转换为 TRPCError
 */
export function handleServiceError(error: unknown): never {
  // 如果已经是 TRPCError，直接抛出
  if (error instanceof TRPCError) {
    throw error
  }

  // 如果是业务错误，转换为 TRPCError
  if (error instanceof BusinessError) {
    throw error.toTRPCError()
  }

  // 如果是标准 Error，包装为 INTERNAL_SERVER_ERROR
  if (error instanceof Error) {
    console.error('Unexpected error:', error)
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: '服务器内部错误，请稍后重试',
      cause: error,
    })
  }

  // 未知错误类型
  console.error('Unknown error type:', error)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误，请稍后重试',
  })
}

/**
 * 异步错误处理包装器
 *
 * 用于包装 async 函数，自动处理错误
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<any>>(
  fn: T,
): (...args: Parameters<T>) => Promise<ReturnType<T>> {
  return async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    try {
      return await fn(...args)
    } catch (error) {
      handleServiceError(error)
    }
  }
}
