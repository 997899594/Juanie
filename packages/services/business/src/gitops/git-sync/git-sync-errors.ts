/**
 * Git 同步错误处理
 *
 * ✅ 重构后：直接使用 SDK 错误类型，仅在添加业务上下文时包装
 *
 * Requirements: 14.1, 14.3, 14.4
 */

import { GitbeakerRequestError } from '@gitbeaker/requester-utils'
import { BaseError } from '@juanie/core/errors'
import type { GitProvider } from '@juanie/types'
// ✅ 导入 SDK 错误类型
import { RequestError } from '@octokit/request-error'

/**
 * Git 同步操作错误
 * 仅在需要添加业务上下文时使用
 *
 * ✅ 保留原始 SDK 错误信息
 */
export class GitSyncOperationError extends BaseError {
  constructor(
    operation: string,
    provider: GitProvider,
    public override readonly cause: Error,
  ) {
    super(
      `Git sync ${operation} failed: ${cause.message}`,
      'GIT_SYNC_OPERATION_FAILED',
      500,
      true, // 默认可重试
      {
        operation,
        provider,
        originalError: cause.message,
        // ✅ 保留 SDK 错误的关键信息
        ...(cause instanceof RequestError && {
          status: cause.status,
          requestUrl: cause.request?.url,
        }),
        ...(cause instanceof GitbeakerRequestError && {
          status: cause.cause?.response?.status,
        }),
      },
    )
  }

  override getUserMessage(): string {
    const providerName = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'

    // ✅ 根据 SDK 错误类型提供友好消息
    if (this.cause instanceof RequestError) {
      switch (this.cause.status) {
        case 401:
          return `${providerName} 认证失败，请重新连接账户`
        case 403:
          if (this.cause.message.includes('rate limit')) {
            return `${providerName} API 调用频率超限，请稍后重试`
          }
          return `${providerName} Token 权限不足，请检查权限配置`
        case 404:
          return '资源不存在，请检查配置'
        case 409:
        case 422:
          return '资源冲突，可能已存在同名资源'
        default:
          return `${providerName} 操作失败，请重试`
      }
    }

    if (this.cause instanceof GitbeakerRequestError) {
      const status = this.cause.cause?.response?.status
      switch (status) {
        case 401:
          return `${providerName} 认证失败，请重新连接账户`
        case 403:
          return `${providerName} Token 权限不足，请检查权限配置`
        case 404:
          return '资源不存在，请检查配置'
        case 409:
        case 422:
          return '资源冲突，可能已存在同名资源'
        default:
          return `${providerName} 操作失败，请重试`
      }
    }

    return `Git 同步失败，请重试`
  }
}

/**
 * ✅ 判断 SDK 错误是否应该重试
 *
 * @param error - SDK 错误对象
 * @param attemptCount - 当前尝试次数
 * @param maxAttempts - 最大尝试次数
 * @returns 是否应该重试
 */
export function shouldRetryGitError(
  error: Error,
  attemptCount: number,
  maxAttempts: number = 3,
): boolean {
  // 超过最大尝试次数
  if (attemptCount >= maxAttempts) {
    return false
  }

  // ✅ GitHub SDK 错误
  if (error instanceof RequestError) {
    // 不应重试的状态码
    if ([401, 403, 404, 422].includes(error.status)) {
      // 例外：速率限制可以重试
      if (error.status === 403 && error.message.includes('rate limit')) {
        return true
      }
      return false
    }
    // 5xx 错误可以重试
    return error.status >= 500
  }

  // ✅ GitLab SDK 错误
  if (error instanceof GitbeakerRequestError) {
    const status = error.cause?.response?.status
    if (!status) return false

    // 不应重试的状态码
    if ([401, 403, 404, 422].includes(status)) {
      return false
    }
    // 5xx 错误可以重试
    return status >= 500
  }

  // 网络错误可以重试
  if (
    'code' in error &&
    (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')
  ) {
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

/**
 * ✅ 获取 SDK 错误的重试延迟
 *
 * @param error - SDK 错误对象
 * @returns 延迟时间（毫秒），0 表示不应重试
 */
export function getRetryDelay(error: Error): number {
  // ✅ GitHub 速率限制
  if (error instanceof RequestError && error.status === 403) {
    if (error.message.includes('rate limit')) {
      // 尝试从响应头获取重置时间
      const resetHeader = error.response?.headers?.['x-ratelimit-reset']
      if (resetHeader) {
        const resetTime = Number.parseInt(resetHeader, 10) * 1000
        const now = Date.now()
        return Math.max(0, resetTime - now)
      }
      return 60000 // 默认 1 分钟
    }
  }

  // ✅ GitLab 速率限制
  if (error instanceof GitbeakerRequestError) {
    const status = error.cause?.response?.status
    if (status === 429) {
      // GitLab 速率限制
      return 60000 // 1 分钟
    }
  }

  // 网络错误
  if (
    'code' in error &&
    (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND')
  ) {
    return 5000 // 5 秒
  }

  // 5xx 错误
  if (error instanceof RequestError && error.status >= 500) {
    return 2000 // 2 秒
  }
  if (error instanceof GitbeakerRequestError) {
    const status = error.cause?.response?.status
    if (status && status >= 500) {
      return 2000 // 2 秒
    }
  }

  return 0 // 不应重试
}
