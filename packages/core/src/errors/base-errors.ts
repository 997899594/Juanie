/**
 * Core 层错误
 * 
 * ✅ 重构完成：所有错误定义已移至 @juanie/core-errors
 * 这个文件只做重新导出，保持向后兼容
 * 
 * 未来可以删除这个文件，直接从 @juanie/core-errors 导入
 */

// ✅ 从新的错误包导入所有错误
export {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  OperationFailedError,
} from '@juanie/core-errors'

// ✅ 为了向后兼容，重新导出 BaseError（已废弃，请使用 AppError）
export { AppError as BaseError } from '@juanie/core-errors'

// ✅ 保留错误工厂（简化版）
export class ErrorFactory {
  static notFound(resource: string, id: string) {
    return new NotFoundError(resource, id)
  }

  static validation(field: string, message: string) {
    return new ValidationError(field, message)
  }

  static unauthorized(reason?: string) {
    return new UnauthorizedError(reason)
  }

  static forbidden(resource: string, action: string) {
    return new ForbiddenError(resource, action)
  }

  static conflict(resource: string, reason: string) {
    return new ConflictError(resource, reason)
  }

  static operationFailed(operation: string, reason: string, retryable = false) {
    return new OperationFailedError(operation, reason, retryable)
  }
}

// ✅ 保留错误处理辅助函数
export function handleServiceError(error: unknown): never {
  if (error instanceof AppError) {
    throw error.toTRPCError()
  }

  if (error instanceof Error) {
    const { TRPCError } = require('@trpc/server')
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    })
  }

  const { TRPCError } = require('@trpc/server')
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unknown error occurred',
  })
}
