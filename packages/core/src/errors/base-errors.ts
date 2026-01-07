/**
 * Core 层错误处理
 *
 * 提供统一的错误类和工厂方法
 */

import { TRPCError } from '@trpc/server'

/**
 * 应用基础错误类
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message)
    this.name = this.constructor.name
  }

  /** 获取用户友好的错误消息 */
  getUserMessage(): string {
    return this.message
  }

  toTRPCError(): TRPCError {
    const codeMap: Record<number, TRPCError['code']> = {
      400: 'BAD_REQUEST',
      401: 'UNAUTHORIZED',
      403: 'FORBIDDEN',
      404: 'NOT_FOUND',
      409: 'CONFLICT',
      500: 'INTERNAL_SERVER_ERROR',
    }

    return new TRPCError({
      code: codeMap[this.statusCode] ?? 'INTERNAL_SERVER_ERROR',
      message: this.message,
      cause: this,
    })
  }
}

/**
 * BaseError 别名（向后兼容）
 * @deprecated 请使用 AppError
 */
export { AppError as BaseError }

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} with id ${id} not found` : `${resource} not found`,
      'NOT_FOUND',
      404,
      false,
      { resource, id },
    )
  }

  override getUserMessage(): string {
    return `${this.context?.resource ?? '资源'}不存在`
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(`Validation failed for ${field}: ${message}`, 'VALIDATION_ERROR', 400, false, { field })
  }

  override getUserMessage(): string {
    return `字段 ${this.context?.field} 验证失败`
  }
}

/**
 * 未授权错误
 */
export class UnauthorizedError extends AppError {
  constructor(reason?: string) {
    super(reason ?? 'Unauthorized', 'UNAUTHORIZED', 401, false)
  }

  override getUserMessage(): string {
    return '请先登录'
  }
}

/**
 * 禁止访问错误
 */
export class ForbiddenError extends AppError {
  constructor(resource: string, action: string) {
    super(`Forbidden: cannot ${action} ${resource}`, 'FORBIDDEN', 403, false, { resource, action })
  }

  override getUserMessage(): string {
    return '没有权限执行此操作'
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends AppError {
  constructor(resource: string, reason: string) {
    super(`Conflict: ${resource} - ${reason}`, 'CONFLICT', 409, false, { resource, reason })
  }

  override getUserMessage(): string {
    return `${this.context?.resource ?? '资源'}已存在`
  }
}

/**
 * 操作失败错误
 */
export class OperationFailedError extends AppError {
  constructor(operation: string, reason: string, retryable: boolean = false) {
    super(`Operation ${operation} failed: ${reason}`, 'OPERATION_FAILED', 500, retryable, {
      operation,
    })
  }

  override getUserMessage(): string {
    return `操作失败: ${this.context?.operation}`
  }
}

/**
 * AI 超时错误
 */
export class AITimeoutError extends AppError {
  constructor(message: string) {
    super(message, 'AI_TIMEOUT', 504, true, { type: 'timeout' })
  }

  override getUserMessage(): string {
    return 'AI 请求超时，请稍后重试'
  }
}

/**
 * AI 推理错误
 */
export class AIInferenceError extends AppError {
  constructor(message: string, retryable: boolean = true) {
    super(message, 'AI_INFERENCE_FAILED', 500, retryable, { type: 'inference' })
  }

  override getUserMessage(): string {
    return 'AI 服务暂时不可用，请稍后重试'
  }
}

/**
 * AI 配置错误
 */
export class AIConfigError extends AppError {
  constructor(message: string) {
    super(message, 'AI_CONFIG_ERROR', 400, false, { type: 'config' })
  }

  override getUserMessage(): string {
    return 'AI 配置错误'
  }
}

/**
 * AI 限流错误
 */
export class AIRateLimitError extends AppError {
  constructor(message: string) {
    super(message, 'AI_RATE_LIMIT', 429, true, { type: 'rate_limit' })
  }

  override getUserMessage(): string {
    return 'AI 请求过于频繁，请稍后重试'
  }
}

/**
 * 错误工厂
 */
export class ErrorFactory {
  static notFound(resource: string, id?: string) {
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

  /** AI 相关错误工厂 */
  static ai = {
    inferenceFailed(message: string, retryable = true) {
      return new AIInferenceError(message, retryable)
    },
    configError(message: string) {
      return new AIConfigError(message)
    },
    rateLimitExceeded(message: string) {
      return new AIRateLimitError(message)
    },
    timeout(message: string) {
      return new AITimeoutError(message)
    },
  }
}

/**
 * 服务错误处理辅助函数
 */
export function handleServiceError(error: unknown): never {
  if (error instanceof AppError) {
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
