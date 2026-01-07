/**
 * 部署服务错误处理
 *
 * ✅ 重构后：直接使用 SDK 错误类型，仅在添加业务上下文时包装
 *
 * Requirements: 14.1, 14.3, 14.4
 */

import { BaseError } from '@juanie/core/errors'

/**
 * 部署操作错误
 * 仅在需要添加业务上下文时使用
 *
 * ✅ 保留原始错误信息
 */
export class DeploymentOperationError extends BaseError {
  constructor(
    operation: string,
    deploymentId: string,
    public override readonly cause?: Error,
  ) {
    super(
      `Deployment ${operation} failed: ${cause?.message || 'Unknown error'}`,
      'DEPLOYMENT_OPERATION_FAILED',
      500,
      true, // 默认可重试
      {
        operation,
        deploymentId,
        originalError: cause?.message,
      },
    )
  }

  override getUserMessage(): string {
    const operation = this.context?.operation || 'operation'

    // 根据操作类型提供友好消息
    switch (operation) {
      case 'create':
        return '创建部署失败，请重试'
      case 'approve':
        return '批准部署失败，请重试'
      case 'reject':
        return '拒绝部署失败，请重试'
      case 'rollback':
        return '回滚部署失败，请重试'
      case 'gitops':
        return 'GitOps 部署失败，请检查 Git 仓库配置'
      default:
        return '部署操作失败，请重试'
    }
  }
}

/**
 * GitOps 操作错误
 * 用于 GitOps 相关错误
 */
export class GitOpsOperationError extends BaseError {
  constructor(
    operation: string,
    projectId: string,
    public override readonly cause?: Error,
  ) {
    super(
      `GitOps ${operation} failed: ${cause?.message || 'Unknown error'}`,
      'GITOPS_OPERATION_FAILED',
      500,
      true,
      {
        operation,
        projectId,
        originalError: cause?.message,
      },
    )
  }

  override getUserMessage(): string {
    const operation = this.context?.operation || 'operation'

    switch (operation) {
      case 'commit':
        return 'Git 提交失败，请检查仓库权限'
      case 'reconcile':
        return 'Flux 协调失败，请检查 Kubernetes 集群状态'
      case 'setup':
        return 'GitOps 设置失败，请检查 Flux 安装'
      default:
        return 'GitOps 操作失败，请重试'
    }
  }
}

/**
 * 权限错误
 * 用于权限检查失败
 */
export class DeploymentPermissionError extends BaseError {
  constructor(userId: string, operation: string, resourceId: string) {
    super(
      `User ${userId} does not have permission to ${operation} resource ${resourceId}`,
      'DEPLOYMENT_PERMISSION_DENIED',
      403,
      false, // 权限错误不应重试
      {
        userId,
        operation,
        resourceId,
      },
    )
  }

  override getUserMessage(): string {
    const operation = this.context?.operation || 'perform this operation'
    return `没有权限${operation}，请联系管理员`
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
export function shouldRetryDeploymentError(
  error: Error,
  attemptCount: number,
  maxAttempts: number = 3,
): boolean {
  // 超过最大尝试次数
  if (attemptCount >= maxAttempts) {
    return false
  }

  // 权限错误不应重试
  if (error.message.includes('permission') || error.message.includes('unauthorized')) {
    return false
  }

  // 业务逻辑错误不应重试
  if (error.message.includes('not found') || error.message.includes('already exists')) {
    return false
  }

  // 数据库连接错误可以重试
  if (error.message.includes('ECONNREFUSED') || error.message.includes('ETIMEDOUT')) {
    return true
  }

  // Kubernetes API 错误可以重试
  if (error.message.includes('connection refused') || error.message.includes('timeout')) {
    return true
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
  baseDelay: number = 2000,
  maxDelay: number = 60000,
): number {
  // 指数退避：baseDelay * 2^attemptCount
  const delay = baseDelay * 2 ** attemptCount

  // 添加随机抖动（±20%）避免惊群效应
  const jitter = delay * 0.2 * (Math.random() * 2 - 1)

  return Math.min(delay + jitter, maxDelay)
}
