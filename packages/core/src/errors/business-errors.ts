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
