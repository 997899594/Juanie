import { TRPCError } from '@trpc/server'
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc'

/**
 * 业务错误基类
 */
export abstract class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
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

// ==================== 项目相关错误 ====================

export class ProjectNotFoundError extends BusinessError {
  constructor(projectId: string) {
    super(`Project ${projectId} not found`, 'PROJECT_NOT_FOUND', 404, false, { projectId })
  }

  getUserMessage(): string {
    return '项目不存在或已被删除'
  }
}

export class ProjectAlreadyExistsError extends BusinessError {
  constructor(name: string, organizationId: string) {
    super(
      `Project with name "${name}" already exists in organization`,
      'PROJECT_ALREADY_EXISTS',
      409,
      false,
      { name, organizationId },
    )
  }

  getUserMessage(): string {
    return `项目名称 "${this.context?.name}" 已存在`
  }
}

export class ProjectInitializationError extends BusinessError {
  constructor(projectId: string, reason: string) {
    super(
      `Failed to initialize project ${projectId}: ${reason}`,
      'PROJECT_INIT_FAILED',
      500,
      true,
      { projectId, reason },
    )
  }

  getUserMessage(): string {
    return '项目初始化失败，请重试或联系管理员'
  }
}

// ==================== 权限相关错误 ====================

export class PermissionDeniedError extends BusinessError {
  constructor(resource: string, action: string) {
    super(`Permission denied: ${action} on ${resource}`, 'PERMISSION_DENIED', 403, false, {
      resource,
      action,
    })
  }

  getUserMessage(): string {
    return '您没有权限执行此操作'
  }
}

export class UnauthorizedError extends BusinessError {
  constructor(reason?: string) {
    super(`Unauthorized: ${reason || 'Authentication required'}`, 'UNAUTHORIZED', 401, false, {
      reason,
    })
  }

  getUserMessage(): string {
    return '请先登录'
  }
}

// ==================== 资源相关错误 ====================

export class ResourceNotFoundError extends BusinessError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 'RESOURCE_NOT_FOUND', 404, false, { resource, id })
  }

  getUserMessage(): string {
    return `${this.context?.resource} 不存在`
  }
}

export class ResourceConflictError extends BusinessError {
  constructor(resource: string, reason: string) {
    super(`Resource conflict: ${resource} - ${reason}`, 'RESOURCE_CONFLICT', 409, false, {
      resource,
      reason,
    })
  }

  getUserMessage(): string {
    return `操作冲突: ${this.context?.reason}`
  }
}

// ==================== 验证相关错误 ====================

export class ValidationError extends BusinessError {
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

// ==================== 组织相关错误 ====================

export class OrganizationNotFoundError extends BusinessError {
  constructor(organizationId: string) {
    super(`Organization ${organizationId} not found`, 'ORGANIZATION_NOT_FOUND', 404, false, {
      organizationId,
    })
  }

  getUserMessage(): string {
    return '组织不存在'
  }
}

// ==================== 环境相关错误 ====================

export class EnvironmentNotFoundError extends BusinessError {
  constructor(environmentId: string) {
    super(`Environment ${environmentId} not found`, 'ENVIRONMENT_NOT_FOUND', 404, false, {
      environmentId,
    })
  }

  getUserMessage(): string {
    return '环境不存在'
  }
}

// ==================== GitOps 相关错误 ====================

export class GitOpsSetupError extends BusinessError {
  constructor(projectId: string, reason: string) {
    super(
      `GitOps setup failed for project ${projectId}: ${reason}`,
      'GITOPS_SETUP_FAILED',
      500,
      true,
      {
        projectId,
        reason,
      },
    )
  }

  getUserMessage(): string {
    return 'GitOps 配置失败，请检查 Git 仓库设置'
  }
}

// ==================== 团队相关错误 ====================

export class TeamNotFoundError extends BusinessError {
  constructor(teamId: string) {
    super(`Team ${teamId} not found`, 'TEAM_NOT_FOUND', 404, false, { teamId })
  }

  getUserMessage(): string {
    return '团队不存在'
  }
}

export class TeamMemberAlreadyExistsError extends BusinessError {
  constructor(teamId: string, userId: string) {
    super(
      `User ${userId} is already a member of team ${teamId}`,
      'TEAM_MEMBER_EXISTS',
      409,
      false,
      { teamId, userId },
    )
  }

  getUserMessage(): string {
    return '用户已经是团队成员'
  }
}

// ==================== 通知相关错误 ====================

export class NotificationNotFoundError extends BusinessError {
  constructor(notificationId: string) {
    super(`Notification ${notificationId} not found`, 'NOTIFICATION_NOT_FOUND', 404, false, {
      notificationId,
    })
  }

  getUserMessage(): string {
    return '通知不存在'
  }
}

// ==================== 存储相关错误 ====================

export class StorageError extends BusinessError {
  constructor(operation: string, reason: string) {
    super(`Storage ${operation} failed: ${reason}`, 'STORAGE_ERROR', 500, true, {
      operation,
      reason,
    })
  }

  getUserMessage(): string {
    return '文件操作失败，请稍后重试'
  }
}

// ==================== OAuth 相关错误 ====================

export class OAuthError extends BusinessError {
  constructor(provider: string, reason: string) {
    super(`OAuth ${provider} error: ${reason}`, 'OAUTH_ERROR', 400, false, { provider, reason })
  }

  getUserMessage(): string {
    return `${this.context?.provider} 授权失败: ${this.context?.reason}`
  }
}

export class InvalidStateError extends BusinessError {
  constructor(provider: string) {
    super(`Invalid OAuth state for ${provider}`, 'INVALID_STATE', 400, false, { provider })
  }

  getUserMessage(): string {
    return '授权状态无效或已过期，请重新授权'
  }
}

// ==================== 配额相关错误 ====================

export class QuotaExceededError extends BusinessError {
  constructor(resource: string, limit: number, current: number) {
    super(`Quota exceeded for ${resource}: ${current}/${limit}`, 'QUOTA_EXCEEDED', 403, false, {
      resource,
      limit,
      current,
    })
  }

  getUserMessage(): string {
    return `${this.context?.resource} 配额已达上限 (${this.context?.current}/${this.context?.limit})`
  }
}
