/**
 * 项目服务错误处理
 *
 * ✅ 重构后：直接使用 SDK 错误类型，仅在添加业务上下文时包装
 *
 * Requirements: 14.1, 14.3, 14.4
 */

import { BaseError } from '@juanie/core/errors'

/**
 * 项目操作错误
 * 仅在需要添加业务上下文时使用
 *
 * ✅ 保留原始错误信息
 */
export class ProjectOperationError extends BaseError {
  constructor(
    operation: string,
    projectId: string,
    public override readonly cause?: Error,
  ) {
    super(
      `Project ${operation} failed: ${cause?.message || 'Unknown error'}`,
      'PROJECT_OPERATION_FAILED',
      500,
      true, // 默认可重试
      {
        operation,
        projectId,
        originalError: cause?.message,
      },
    )
  }

  override getUserMessage(): string {
    const operation = this.context?.operation || 'operation'

    // 根据操作类型提供友好消息
    switch (operation) {
      case 'create':
        return '创建项目失败，请重试'
      case 'update':
        return '更新项目失败，请重试'
      case 'delete':
        return '删除项目失败，请重试'
      case 'archive':
        return '归档项目失败，请重试'
      case 'restore':
        return '恢复项目失败，请重试'
      default:
        return '项目操作失败，请重试'
    }
  }
}

/**
 * 数据库操作错误
 * 用于包装数据库相关错误
 */
export class DatabaseOperationError extends BaseError {
  constructor(
    operation: string,
    table: string,
    public override readonly cause?: Error,
  ) {
    super(
      `Database ${operation} on ${table} failed: ${cause?.message || 'Unknown error'}`,
      'DATABASE_OPERATION_FAILED',
      500,
      true, // 数据库错误通常可重试
      {
        operation,
        table,
        originalError: cause?.message,
      },
    )
  }

  override getUserMessage(): string {
    return '数据库操作失败，请重试'
  }
}

/**
 * ✅ 判断错误是否应该重试
 *
 * @param error - 错误对象
 * @param attemptCount - 当前尝试次数
 * @param maxAttempts - 最大尝试次数
 * @returns 是否应该重试
 */
export function shouldRetryProjectError(
  error: Error,
  attemptCount: number,
  maxAttempts: number = 3,
): boolean {
  // 超过最大尝试次数
  if (attemptCount >= maxAttempts) {
    return false
  }

  // 数据库连接错误可以重试
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
    return true
  }

  // 数据库锁错误可以重试
  if (error.message.includes('deadlock') || error.message.includes('lock timeout')) {
    return true
  }

  // 业务逻辑错误不应重试
  if (error.message.includes('already exists') || error.message.includes('not found')) {
    return false
  }

  // 默认不重试
  return false
}

/**
 * ✅ 计算指数退避延迟
 *
 * @param attemptCount - 当前尝试次数
 * @param baseDelay - 基础延迟（毫秒）
 * @param maxDelay - 最大延迟（毫秒）
 * @returns 延迟时间（毫秒）
 */
export function calculateBackoffDelay(
  attemptCount: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
): number {
  // 指数退避：baseDelay * 2^attemptCount
  const delay = baseDelay * 2 ** attemptCount

  // 添加随机抖动（±20%）避免惊群效应
  const jitter = delay * 0.2 * (Math.random() * 2 - 1)

  return Math.min(delay + jitter, maxDelay)
}
