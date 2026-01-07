/**
 * 项目初始化错误处理
 *
 * ✅ 重构后：直接使用 SDK 错误类型，仅在添加业务上下文时包装
 *
 * Requirements: 14.1, 14.3, 14.4
 */

import { GitbeakerRequestError } from '@gitbeaker/requester-utils'
import { BaseError } from '@juanie/core/errors'
import { RequestError } from '@octokit/request-error'

/**
 * 初始化操作错误
 * 仅在需要添加业务上下文时使用
 *
 * ✅ 保留原始 SDK 错误信息
 */
export class InitializationOperationError extends BaseError {
  constructor(
    step: string,
    projectId: string,
    public override readonly cause?: Error,
  ) {
    super(
      `Initialization step '${step}' failed: ${cause?.message || 'Unknown error'}`,
      'INITIALIZATION_OPERATION_FAILED',
      500,
      true, // 默认可重试
      {
        step,
        projectId,
        originalError: cause?.message,
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
    const step = this.context?.step || 'unknown'

    // ✅ 根据 SDK 错误类型提供友好消息
    if (this.cause instanceof RequestError || this.cause instanceof GitbeakerRequestError) {
      const status =
        this.cause instanceof RequestError ? this.cause.status : this.cause.cause?.response?.status

      switch (status) {
        case 401:
          return 'Git 认证失败，请重新连接账户'
        case 403:
          if (this.cause.message.includes('rate limit')) {
            return 'Git API 调用频率超限，请稍后重试'
          }
          return 'Git Token 权限不足，请检查权限配置'
        case 404:
          return 'Git 资源不存在，请检查配置'
        case 409:
        case 422:
          return 'Git 资源冲突，可能已存在同名资源'
        default:
          break
      }
    }

    // 根据步骤提供友好消息
    switch (step) {
      case 'resolve_credentials':
        return 'Git 凭证解析失败，请检查 OAuth 连接'
      case 'create_repository':
        return 'Git 仓库创建失败，请检查权限和配额'
      case 'push_template':
        return '模板代码推送失败，请检查仓库权限'
      case 'create_db_records':
        return '数据库记录创建失败，请重试'
      case 'setup_gitops':
        return 'GitOps 设置失败，请检查 Flux 安装'
      case 'finalize':
        return '项目初始化完成失败，请重试'
      default:
        return '项目初始化失败，请重试'
    }
  }
}

/**
 * 模板渲染错误
 * 用于模板相关错误
 */
export class TemplateRenderError extends BaseError {
  constructor(
    templateId: string,
    public override readonly cause?: Error,
  ) {
    super(
      `Template rendering failed for ${templateId}: ${cause?.message || 'Unknown error'}`,
      'TEMPLATE_RENDER_FAILED',
      500,
      false, // 模板错误通常不应重试
      {
        templateId,
        originalError: cause?.message,
      },
    )
  }

  override getUserMessage(): string {
    return '模板渲染失败，请检查模板配置'
  }
}

/**
 * ✅ 判断初始化错误是否应该重试
 *
 * @param error - 错误对象
 * @param attemptCount - 当前尝试次数
 * @param maxAttempts - 最大尝试次数
 * @returns 是否应该重试
 */
export function shouldRetryInitializationError(
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

  // 数据库错误可以重试
  if (error.message.includes('database') || error.message.includes('connection')) {
    return true
  }

  // 模板错误不应重试
  if (error.message.includes('template')) {
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
 * ✅ 获取初始化错误的重试延迟
 *
 * @param error - 错误对象
 * @returns 延迟时间（毫秒），0 表示不应重试
 */
export function getRetryDelay(error: Error): number {
  // ✅ GitHub 速率限制
  if (error instanceof RequestError && error.status === 403) {
    if (error.message.includes('rate limit')) {
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

  // 数据库错误
  if (error.message.includes('database') || error.message.includes('connection')) {
    return 3000 // 3 秒
  }

  return 0 // 不应重试
}
