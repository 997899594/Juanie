/**
 * Business 层业务错误
 *
 * 包含项目、部署、环境、GitOps 等核心业务错误
 */

import { BaseError, ConflictError, NotFoundError } from '@juanie/core/errors'

// 重新导出 Core 层的基础错误类，供 Business 层内部使用
export {
  BaseError,
  ConflictError,
  NotFoundError,
  OperationFailedError,
  ValidationError,
} from '@juanie/core/errors'

// ==================== 项目相关错误 ====================

export class ProjectNotFoundError extends BaseError {
  constructor(projectId: string) {
    super('Project not found', 'PROJECT_NOT_FOUND', 404, false, { projectId })
  }

  getUserMessage(): string {
    return '项目不存在或已被删除'
  }
}

export class ProjectAlreadyExistsError extends BaseError {
  constructor(name: string, organizationId: string) {
    super(`Project with name "${name}" already exists`, 'PROJECT_ALREADY_EXISTS', 409, false, {
      name,
      organizationId,
    })
  }

  getUserMessage(): string {
    return `项目名称 "${this.context?.name}" 已存在`
  }
}

export class ProjectInitializationError extends BaseError {
  constructor(
    projectId: string,
    reason: string,
    public readonly step?: string,
    retryable: boolean = false,
  ) {
    super(
      `Failed to initialize project ${projectId}: ${reason}`,
      'PROJECT_INIT_FAILED',
      500,
      retryable,
      { projectId, reason, step },
    )
  }

  getUserMessage(): string {
    const stepMsg = this.step ? ` (步骤: ${this.step})` : ''
    return `项目初始化失败${stepMsg}，请重试或联系管理员`
  }
}

export class ProjectCreationFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to create project: ${cause.message}`, 'CREATING_PROJECT', false)
  }

  override getUserMessage(): string {
    return '创建项目失败，请检查项目名称和配置'
  }
}

export class TemplateLoadFailedError extends ProjectInitializationError {
  constructor(projectId: string, templateId: string, cause: Error) {
    super(
      projectId,
      `Failed to load template ${templateId}: ${cause.message}`,
      'LOADING_TEMPLATE',
      true,
    )
  }

  override getUserMessage(): string {
    return '加载模板失败，请稍后重试'
  }
}

export class EnvironmentCreationFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(
      projectId,
      `Failed to create environments: ${cause.message}`,
      'CREATING_ENVIRONMENTS',
      true,
    )
  }

  override getUserMessage(): string {
    return '创建环境失败，请稍后重试'
  }
}

export class RepositorySetupFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to setup repository: ${cause.message}`, 'SETTING_UP_REPOSITORY', true)
  }

  override getUserMessage(): string {
    return '设置仓库失败，请检查 Git 配置'
  }
}

export class FinalizationFailedError extends ProjectInitializationError {
  constructor(projectId: string, cause: Error) {
    super(projectId, `Failed to finalize project: ${cause.message}`, 'FINALIZING', false)
  }

  override getUserMessage(): string {
    return '完成项目初始化失败，请联系管理员'
  }
}

// ==================== 环境相关错误 ====================

export class EnvironmentNotFoundError extends NotFoundError {
  constructor(environmentId: string) {
    super('Environment', environmentId)
  }

  override getUserMessage(): string {
    return '环境不存在'
  }
}

// ==================== GitOps 相关错误 ====================

export class GitOpsSetupError extends BaseError {
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

// ==================== 资源相关错误 ====================

export class ResourceNotFoundError extends NotFoundError {
  override getUserMessage(): string {
    return `${this.context?.resource} 不存在`
  }
}

export class ResourceConflictError extends ConflictError {
  override getUserMessage(): string {
    return `操作冲突: ${this.context?.reason}`
  }
}

// ==================== 存储相关错误 ====================

export class StorageError extends BaseError {
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

// ==================== 配额相关错误 ====================

export class QuotaExceededError extends BaseError {
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
