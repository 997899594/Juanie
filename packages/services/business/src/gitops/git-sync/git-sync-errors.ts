/**
 * Git 同步错误分类和处理
 *
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

import type { GitProvider } from '@juanie/types'

/**
 * Git 同步错误类型
 */
export enum GitSyncErrorType {
  /** 认证错误 - Token 无效或过期 */
  AUTHENTICATION = 'authentication',
  /** 网络错误 - 连接失败或超时 */
  NETWORK = 'network',
  /** 速率限制 - API 调用超过限制 */
  RATE_LIMIT = 'rate_limit',
  /** 资源冲突 - 资源已存在或名称冲突 */
  CONFLICT = 'conflict',
  /** 权限不足 - Token 权限范围不够 */
  PERMISSION = 'permission',
  /** 资源不存在 - 仓库或用户不存在 */
  NOT_FOUND = 'not_found',
  /** 未知错误 */
  UNKNOWN = 'unknown',
}

/**
 * Git 同步错误基类
 */
export class GitSyncError extends Error {
  constructor(
    message: string,
    public readonly type: GitSyncErrorType,
    public readonly provider: GitProvider,
    public readonly retryable: boolean = false,
    public readonly statusCode?: number,
    public readonly originalError?: Error,
  ) {
    super(message)
    this.name = 'GitSyncError'
  }

  /**
   * 获取用户友好的错误消息
   */
  getUserMessage(): string {
    switch (this.type) {
      case GitSyncErrorType.AUTHENTICATION:
        return `${this.provider === 'github' ? 'GitHub' : 'GitLab'} 认证失败，请重新连接账户`
      case GitSyncErrorType.NETWORK:
        return '网络连接失败，请检查网络后重试'
      case GitSyncErrorType.RATE_LIMIT:
        return `${this.provider === 'github' ? 'GitHub' : 'GitLab'} API 调用频率超限，请稍后重试`
      case GitSyncErrorType.CONFLICT:
        return '资源冲突，可能已存在同名资源'
      case GitSyncErrorType.PERMISSION:
        return `${this.provider === 'github' ? 'GitHub' : 'GitLab'} Token 权限不足，请检查权限配置`
      case GitSyncErrorType.NOT_FOUND:
        return '资源不存在，请检查配置'
      default:
        return this.message || '同步失败，请重试'
    }
  }

  /**
   * 获取建议的重试延迟（毫秒）
   */
  getRetryDelay(): number {
    switch (this.type) {
      case GitSyncErrorType.RATE_LIMIT:
        return 60000 // 1 分钟
      case GitSyncErrorType.NETWORK:
        return 5000 // 5 秒
      case GitSyncErrorType.AUTHENTICATION:
      case GitSyncErrorType.PERMISSION:
        return 0 // 不应该自动重试
      default:
        return 2000 // 2 秒
    }
  }
}

/**
 * 认证错误
 */
export class GitAuthenticationError extends GitSyncError {
  constructor(provider: GitProvider, reason: string, statusCode?: number) {
    super(
      `Git authentication failed: ${reason}`,
      GitSyncErrorType.AUTHENTICATION,
      provider,
      false, // 认证错误不应自动重试
      statusCode,
    )
    this.name = 'GitAuthenticationError'
  }
}

/**
 * 网络错误
 */
export class GitNetworkError extends GitSyncError {
  constructor(provider: GitProvider, message: string, originalError?: Error) {
    super(
      `Git API network error: ${message}`,
      GitSyncErrorType.NETWORK,
      provider,
      true, // 网络错误可以重试
      undefined,
      originalError,
    )
    this.name = 'GitNetworkError'
  }
}

/**
 * 速率限制错误
 */
export class GitRateLimitError extends GitSyncError {
  constructor(
    provider: GitProvider,
    public readonly resetAt: Date,
    statusCode?: number,
  ) {
    super(
      `Git API rate limit exceeded, resets at ${resetAt.toISOString()}`,
      GitSyncErrorType.RATE_LIMIT,
      provider,
      true, // 速率限制可以重试
      statusCode,
    )
    this.name = 'GitRateLimitError'
  }

  /**
   * 获取重试延迟（直到速率限制重置）
   */
  override getRetryDelay(): number {
    const now = Date.now()
    const resetTime = this.resetAt.getTime()
    return Math.max(0, resetTime - now)
  }
}

/**
 * 资源冲突错误
 */
export class GitConflictError extends GitSyncError {
  constructor(
    provider: GitProvider,
    public readonly resourceType: string,
    public readonly resourceName: string,
  ) {
    super(
      `Git resource conflict: ${resourceType} "${resourceName}" already exists`,
      GitSyncErrorType.CONFLICT,
      provider,
      false, // 冲突错误通常不应自动重试
      409,
    )
    this.name = 'GitConflictError'
  }
}

/**
 * 权限不足错误
 */
export class GitPermissionError extends GitSyncError {
  constructor(provider: GitProvider, requiredScopes: string[]) {
    super(
      `Git token has insufficient permissions. Required scopes: ${requiredScopes.join(', ')}`,
      GitSyncErrorType.PERMISSION,
      provider,
      false, // 权限错误不应自动重试
      403,
    )
    this.name = 'GitPermissionError'
  }
}

/**
 * 资源不存在错误
 */
export class GitNotFoundError extends GitSyncError {
  constructor(
    provider: GitProvider,
    public readonly resourceType: string,
    public readonly resourceId: string,
  ) {
    super(
      `Git resource not found: ${resourceType} "${resourceId}"`,
      GitSyncErrorType.NOT_FOUND,
      provider,
      false, // 资源不存在通常不应重试
      404,
    )
    this.name = 'GitNotFoundError'
  }
}

/**
 * 从 HTTP 响应分类错误
 *
 * @param provider - Git 提供商
 * @param statusCode - HTTP 状态码
 * @param responseBody - 响应体
 * @param originalError - 原始错误
 * @returns 分类后的错误
 */
export function classifyGitError(
  provider: GitProvider,
  statusCode: number,
  responseBody?: any,
  originalError?: Error,
): GitSyncError {
  // 认证错误
  if (statusCode === 401) {
    return new GitAuthenticationError(provider, 'Invalid or expired token', statusCode)
  }

  // 权限错误
  if (statusCode === 403) {
    // 检查是否是速率限制
    if (
      responseBody?.message?.includes('rate limit') ||
      responseBody?.message?.includes('API rate limit')
    ) {
      const resetAt = responseBody.reset_at
        ? new Date(responseBody.reset_at * 1000)
        : new Date(Date.now() + 60000) // 默认 1 分钟后
      return new GitRateLimitError(provider, resetAt, statusCode)
    }

    const requiredScopes = extractRequiredScopes(responseBody)
    return new GitPermissionError(provider, requiredScopes)
  }

  // 资源不存在
  if (statusCode === 404) {
    return new GitNotFoundError(provider, 'resource', 'unknown')
  }

  // 资源冲突
  if (statusCode === 409 || statusCode === 422) {
    const resourceType = extractResourceType(responseBody)
    const resourceName = extractResourceName(responseBody)
    return new GitConflictError(provider, resourceType, resourceName)
  }

  // 网络错误（5xx）
  if (statusCode >= 500) {
    return new GitNetworkError(provider, `Server error: ${statusCode}`, originalError)
  }

  // 未知错误
  return new GitSyncError(
    `Git API error: ${statusCode} - ${JSON.stringify(responseBody)}`,
    GitSyncErrorType.UNKNOWN,
    provider,
    true, // 未知错误可以尝试重试
    statusCode,
    originalError,
  )
}

/**
 * 从错误对象分类错误
 *
 * @param provider - Git 提供商
 * @param error - 错误对象
 * @returns 分类后的错误
 */
export function classifyError(provider: GitProvider, error: any): GitSyncError {
  // 如果已经是 GitSyncError，直接返回
  if (error instanceof GitSyncError) {
    return error
  }

  // 网络错误
  if (
    error.code === 'ECONNREFUSED' ||
    error.code === 'ETIMEDOUT' ||
    error.code === 'ENOTFOUND' ||
    error.message?.includes('network') ||
    error.message?.includes('timeout')
  ) {
    return new GitNetworkError(provider, error.message || 'Network error', error)
  }

  // 尝试从 HTTP 响应分类
  if (error.response) {
    return classifyGitError(provider, error.response.status, error.response.data, error)
  }

  // 默认未知错误
  return new GitSyncError(
    error.message || 'Unknown error',
    GitSyncErrorType.UNKNOWN,
    provider,
    true,
    undefined,
    error,
  )
}

/**
 * 从响应体提取所需权限范围
 */
function extractRequiredScopes(responseBody: any): string[] {
  if (!responseBody) return []

  // GitHub 格式
  if (responseBody.message?.includes('scope')) {
    const match = responseBody.message.match(/scopes?: ([^.]+)/)
    if (match) {
      return match[1].split(',').map((s: string) => s.trim())
    }
  }

  // GitLab 格式
  if (responseBody.error_description) {
    return [responseBody.error_description]
  }

  return ['repo', 'admin:org', 'user'] // 默认所需权限
}

/**
 * 从响应体提取资源类型
 */
function extractResourceType(responseBody: any): string {
  if (responseBody?.errors) {
    const firstError = Array.isArray(responseBody.errors)
      ? responseBody.errors[0]
      : responseBody.errors
    if (firstError?.resource) {
      return firstError.resource
    }
  }
  return 'resource'
}

/**
 * 从响应体提取资源名称
 */
function extractResourceName(responseBody: any): string {
  if (responseBody?.errors) {
    const firstError = Array.isArray(responseBody.errors)
      ? responseBody.errors[0]
      : responseBody.errors
    if (firstError?.field) {
      return firstError.field
    }
  }
  if (responseBody?.message) {
    // 尝试从消息中提取名称
    const match = responseBody.message.match(/"([^"]+)"/)
    if (match) {
      return match[1]
    }
  }
  return 'unknown'
}

/**
 * 判断错误是否应该重试
 *
 * @param error - 错误对象
 * @param attemptCount - 当前尝试次数
 * @param maxAttempts - 最大尝试次数
 * @returns 是否应该重试
 */
export function shouldRetry(
  error: GitSyncError,
  attemptCount: number,
  maxAttempts: number = 3,
): boolean {
  // 超过最大尝试次数
  if (attemptCount >= maxAttempts) {
    return false
  }

  // 检查错误是否可重试
  return error.retryable
}

/**
 * 计算指数退避延迟
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

// ============================================================================
// Git 同步错误服务
// ============================================================================

import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * 同步日志记录输入
 */
export interface RecordSyncLogInput {
  syncType: 'project' | 'member' | 'organization'
  action: 'create' | 'update' | 'delete' | 'sync' | 'add' | 'remove'
  provider: 'github' | 'gitlab'
  organizationId?: string
  projectId?: string
  userId?: string
  gitResourceId?: string
  gitResourceUrl?: string
  gitResourceType?: 'repository' | 'organization' | 'user' | 'team' | 'member'
  status: 'pending' | 'success' | 'failed'
  error?: string
  errorType?:
    | 'authentication'
    | 'network'
    | 'rate_limit'
    | 'conflict'
    | 'permission'
    | 'not_found'
    | 'unknown'
  errorStack?: string
  requiresResolution?: boolean
  metadata?: {
    attemptCount?: number
    lastAttemptAt?: string // ISO 8601 format
    gitApiResponse?: any
    gitApiStatusCode?: number
    userAgent?: string
    ipAddress?: string
    triggeredBy?: 'user' | 'system' | 'webhook'
    workspaceType?: 'personal' | 'team'
    permissions?: string[]
    [key: string]: any // Allow additional properties
  }
}

/**
 * 查询同步日志输入
 */
export interface GetSyncLogsInput {
  syncType?: 'project' | 'member' | 'organization'
  action?: 'create' | 'update' | 'delete' | 'sync' | 'add' | 'remove'
  provider?: 'github' | 'gitlab'
  organizationId?: string
  projectId?: string
  userId?: string
  status?: 'pending' | 'success' | 'failed'
  requiresResolution?: boolean
  resolved?: boolean
}

/**
 * Git 同步日志服务
 *
 * 功能：
 * 1. 记录所有同步操作（成功和失败）
 * 2. 支持错误分类和管理
 * 3. 提供重试机制支持
 * 4. 支持错误解决流程
 * 5. 提供审计追踪
 */
@Injectable()
export class GitSyncErrorService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(GitSyncErrorService.name)
  }

  /**
   * 记录同步日志
   * 用于记录所有同步操作，包括成功和失败
   */
  async recordSyncLog(input: RecordSyncLogInput): Promise<string> {
    try {
      await this.db.insert(schema.gitSyncLogs).values({
        syncType: input.syncType,
        action: input.action,
        provider: input.provider,
        organizationId: input.organizationId,
        projectId: input.projectId,
        userId: input.userId,
        gitResourceId: input.gitResourceId,
        gitResourceUrl: input.gitResourceUrl,
        gitResourceType: input.gitResourceType,
        status: input.status,
        error: input.error,
        errorType: input.errorType,
        errorStack: input.errorStack,
        requiresResolution: input.requiresResolution || false,
        resolved: false,
        metadata: input.metadata as any,
        createdAt: new Date(),
        completedAt: input.status !== 'pending' ? new Date() : undefined,
      })

      const [inserted] = await this.db
        .select({ id: schema.gitSyncLogs.id })
        .from(schema.gitSyncLogs)
        .orderBy(schema.gitSyncLogs.createdAt)
        .limit(1)

      const id = inserted?.id || crypto.randomUUID()

      this.logger.info(`Recorded sync log: ${input.syncType}/${input.action} - ${input.status}`)
      return id
    } catch (error) {
      this.logger.error('Failed to record sync log:', error)
      throw error
    }
  }

  /**
   * 更新同步日志状态
   * 用于更新正在进行的同步操作
   */
  async updateSyncLog(
    logId: string,
    update: {
      status?: 'pending' | 'success' | 'failed'
      error?: string
      errorType?:
        | 'authentication'
        | 'authorization'
        | 'network'
        | 'rate_limit'
        | 'conflict'
        | 'permission'
        | 'not_found'
        | 'validation'
        | 'timeout'
        | 'unknown'
      errorStack?: string
      requiresResolution?: boolean
      metadata?: any
    },
  ): Promise<void> {
    await this.db
      .update(schema.gitSyncLogs)
      .set({
        status: update.status,
        error: update.error,
        errorType: update.errorType,
        errorStack: update.errorStack,
        requiresResolution: update.requiresResolution,
        metadata: update.metadata as any,
        completedAt: update.status !== 'pending' ? new Date() : undefined,
      })
      .where(eq(schema.gitSyncLogs.id, logId))

    this.logger.info(`Updated sync log ${logId}: ${update.status}`)
  }

  /**
   * 记录同步错误（便捷方法）
   * 自动设置 status 为 failed
   */
  async recordError(input: Omit<RecordSyncLogInput, 'status'>): Promise<string> {
    // 根据错误类型判断是否需要人工解决
    const requiresResolution =
      input.requiresResolution ?? this.shouldRequireResolution(input.errorType)

    return this.recordSyncLog({
      ...input,
      status: 'failed',
      requiresResolution,
    })
  }

  /**
   * 记录成功的同步操作（便捷方法）
   */
  async recordSuccess(
    input: Omit<RecordSyncLogInput, 'status' | 'error' | 'errorType' | 'errorStack'>,
  ): Promise<string> {
    return this.recordSyncLog({
      ...input,
      status: 'success',
    })
  }

  /**
   * 开始同步操作（便捷方法）
   * 返回 logId，用于后续更新状态
   */
  async startSync(input: Omit<RecordSyncLogInput, 'status'>): Promise<string> {
    return this.recordSyncLog({
      ...input,
      status: 'pending',
    })
  }

  /**
   * 完成同步操作（便捷方法）
   */
  async completeSync(
    logId: string,
    success: boolean,
    error?: string,
    errorType?:
      | 'authentication'
      | 'authorization'
      | 'network'
      | 'rate_limit'
      | 'conflict'
      | 'permission'
      | 'not_found'
      | 'validation'
      | 'timeout'
      | 'unknown',
  ): Promise<void> {
    await this.updateSyncLog(logId, {
      status: success ? 'success' : 'failed',
      error,
      errorType,
      requiresResolution: !success && this.shouldRequireResolution(errorType),
    })
  }

  /**
   * 获取失败的同步日志数量
   */
  async getErrorCount(input: GetSyncLogsInput): Promise<number> {
    const conditions = [eq(schema.gitSyncLogs.status, 'failed')]

    if (input.syncType) {
      conditions.push(eq(schema.gitSyncLogs.syncType, input.syncType))
    }
    if (input.action) {
      conditions.push(eq(schema.gitSyncLogs.action, input.action))
    }
    if (input.provider) {
      conditions.push(eq(schema.gitSyncLogs.provider, input.provider))
    }
    if (input.organizationId) {
      conditions.push(eq(schema.gitSyncLogs.organizationId, input.organizationId))
    }
    if (input.projectId) {
      conditions.push(eq(schema.gitSyncLogs.projectId, input.projectId))
    }
    if (input.userId) {
      conditions.push(eq(schema.gitSyncLogs.userId, input.userId))
    }
    if (input.requiresResolution !== undefined) {
      conditions.push(eq(schema.gitSyncLogs.requiresResolution, input.requiresResolution))
    }
    if (input.resolved !== undefined) {
      conditions.push(eq(schema.gitSyncLogs.resolved, input.resolved))
    }

    const result = await this.db.query.gitSyncLogs.findMany({
      where: and(...conditions),
    })

    return result.length
  }

  /**
   * 获取最近的同步日志
   */
  async getRecentLogs(input: GetSyncLogsInput, limit: number = 10) {
    const conditions = []

    if (input.syncType) {
      conditions.push(eq(schema.gitSyncLogs.syncType, input.syncType))
    }
    if (input.action) {
      conditions.push(eq(schema.gitSyncLogs.action, input.action))
    }
    if (input.provider) {
      conditions.push(eq(schema.gitSyncLogs.provider, input.provider))
    }
    if (input.organizationId) {
      conditions.push(eq(schema.gitSyncLogs.organizationId, input.organizationId))
    }
    if (input.projectId) {
      conditions.push(eq(schema.gitSyncLogs.projectId, input.projectId))
    }
    if (input.userId) {
      conditions.push(eq(schema.gitSyncLogs.userId, input.userId))
    }
    if (input.status) {
      conditions.push(eq(schema.gitSyncLogs.status, input.status))
    }
    if (input.requiresResolution !== undefined) {
      conditions.push(eq(schema.gitSyncLogs.requiresResolution, input.requiresResolution))
    }
    if (input.resolved !== undefined) {
      conditions.push(eq(schema.gitSyncLogs.resolved, input.resolved))
    }

    return await this.db.query.gitSyncLogs.findMany({
      where: conditions.length > 0 ? and(...conditions) : undefined,
      orderBy: [desc(schema.gitSyncLogs.createdAt)],
      limit,
    })
  }

  /**
   * 获取最近的错误日志
   */
  async getRecentErrors(input: GetSyncLogsInput, limit: number = 10) {
    return this.getRecentLogs({ ...input, status: 'failed' }, limit)
  }

  /**
   * 获取需要解决的错误
   */
  async getUnresolvedErrors(input: GetSyncLogsInput, limit: number = 10) {
    return this.getRecentLogs(
      {
        ...input,
        status: 'failed',
        requiresResolution: true,
        resolved: false,
      },
      limit,
    )
  }

  /**
   * 标记错误为已解决
   */
  async resolveError(logId: string, resolvedBy: string, resolutionNotes?: string): Promise<void> {
    await this.db
      .update(schema.gitSyncLogs)
      .set({
        resolved: true,
        resolvedAt: new Date(),
        resolvedBy,
        resolutionNotes,
      })
      .where(eq(schema.gitSyncLogs.id, logId))

    this.logger.info(`Resolved sync error ${logId} by ${resolvedBy}`)
  }

  /**
   * 获取同步统计信息
   */
  async getSyncStats(input: GetSyncLogsInput): Promise<{
    total: number
    success: number
    failed: number
    pending: number
    requiresResolution: number
    resolved: number
  }> {
    const logs = await this.getRecentLogs(input, 1000) // 获取最近 1000 条

    return {
      total: logs.length,
      success: logs.filter((l) => l.status === 'success').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      pending: logs.filter((l) => l.status === 'pending').length,
      requiresResolution: logs.filter((l) => l.requiresResolution && !l.resolved).length,
      resolved: logs.filter((l) => l.resolved).length,
    }
  }

  /**
   * 判断错误类型是否需要人工解决
   */
  private shouldRequireResolution(errorType?: string): boolean {
    // 认证错误和权限错误通常需要人工介入
    return errorType === 'authentication' || errorType === 'permission'
  }
}
