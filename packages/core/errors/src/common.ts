import { AppError } from './base'

/**
 * 资源未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` ${id}` : ''} not found`,
      'NOT_FOUND',
      404,
      false,
      { resource, id },
    )
  }

  getUserMessage(): string {
    return `${this.context?.resource}不存在`
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
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
export class UnauthorizedError extends AppError {
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
export class ForbiddenError extends AppError {
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
export class ConflictError extends AppError {
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
export class OperationFailedError extends AppError {
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
