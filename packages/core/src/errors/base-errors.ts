import { TRPCError } from '@trpc/server'
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc'

/**
 * 基础错误类
 * Core 层只提供基础错误类型，不包含业务概念
 */
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * 获取用户友好的错误消息
   */
  abstract getUserMessage(): string

  /**
   * 转换为 TRPCError
   */
  toTRPCError(): TRPCError {
    return new TRPCError({
      code: this.getTRPCCode(),
      message: this.getUserMessage(),
      cause: this,
    })
  }

  private getTRPCCode(): TRPC_ERROR_CODE_KEY {
    if (this.statusCode === 404) return 'NOT_FOUND'
    if (this.statusCode === 403) return 'FORBIDDEN'
    if (this.statusCode === 401) return 'UNAUTHORIZED'
    if (this.statusCode === 409) return 'CONFLICT'
    if (this.statusCode >= 500) return 'INTERNAL_SERVER_ERROR'
    return 'BAD_REQUEST'
  }
}

/**
 * 资源未找到错误
 */
export class NotFoundError extends BaseError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 'NOT_FOUND', 404, false, { resource, id })
  }

  getUserMessage(): string {
    return `${this.context?.resource} 不存在`
  }
}

/**
 * 验证错误
 */
export class ValidationError extends BaseError {
  constructor(field: string, message: string) {
    super(`Validation failed: ${field} - ${message}`, 'VALIDATION_ERROR', 400, false, {
      field,
      message,
    })
  }

  getUserMessage(): string {
    return `${this.context?.field}: ${this.context?.message}`
  }
}

/**
 * 未授权错误
 */
export class UnauthorizedError extends BaseError {
  constructor(reason?: string) {
    super(`Unauthorized: ${reason || 'Authentication required'}`, 'UNAUTHORIZED', 401, false, {
      reason,
    })
  }

  getUserMessage(): string {
    return '请先登录'
  }
}

/**
 * 权限拒绝错误
 */
export class ForbiddenError extends BaseError {
  constructor(resource: string, action: string) {
    super(`Permission denied: ${action} on ${resource}`, 'FORBIDDEN', 403, false, {
      resource,
      action,
    })
  }

  getUserMessage(): string {
    return '您没有权限执行此操作'
  }
}

/**
 * 资源冲突错误
 */
export class ConflictError extends BaseError {
  constructor(resource: string, reason: string) {
    super(`Resource conflict: ${resource} - ${reason}`, 'CONFLICT', 409, false, {
      resource,
      reason,
    })
  }

  getUserMessage(): string {
    return `操作冲突: ${this.context?.reason}`
  }
}

/**
 * 操作失败错误
 */
export class OperationFailedError extends BaseError {
  constructor(operation: string, reason: string, retryable: boolean = false) {
    super(`Operation ${operation} failed: ${reason}`, 'OPERATION_FAILED', 500, retryable, {
      operation,
      reason,
    })
  }

  getUserMessage(): string {
    return `操作失败: ${this.context?.reason}`
  }
}

/**
 * 错误工厂 - 用于创建标准错误
 */
export class ErrorFactory {
  static notFound(resource: string, id: string): NotFoundError {
    return new NotFoundError(resource, id)
  }

  static validation(field: string, message: string): ValidationError {
    return new ValidationError(field, message)
  }

  static unauthorized(reason?: string): UnauthorizedError {
    return new UnauthorizedError(reason)
  }

  static forbidden(resource: string, action: string): ForbiddenError {
    return new ForbiddenError(resource, action)
  }

  static conflict(resource: string, reason: string): ConflictError {
    return new ConflictError(resource, reason)
  }

  static operationFailed(
    operation: string,
    reason: string,
    retryable = false,
  ): OperationFailedError {
    return new OperationFailedError(operation, reason, retryable)
  }
}

/**
 * 错误处理辅助函数
 */
export function handleServiceError(error: unknown): never {
  if (error instanceof BaseError) {
    throw error.toTRPCError()
  }

  if (error instanceof Error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error.message,
      cause: error,
    })
  }

  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'An unknown error occurred',
  })
}
