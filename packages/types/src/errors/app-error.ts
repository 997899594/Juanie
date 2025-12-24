import { ErrorCode, ErrorCodeToHttpStatus, ErrorMessages } from './error-codes'

/**
 * 应用错误类
 * 统一的错误处理基类
 */
export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly httpStatus: number
  public readonly details?: unknown
  public readonly timestamp: Date

  constructor(code: ErrorCode, message?: string, details?: unknown, httpStatus?: number) {
    // 如果没有提供 message，使用默认消息
    const errorMessage = message || ErrorMessages[code] || '未知错误'
    super(errorMessage)

    this.name = 'AppError'
    this.code = code
    this.httpStatus = httpStatus || ErrorCodeToHttpStatus[code] || 500
    this.details = details
    this.timestamp = new Date()

    // 保持正确的堆栈跟踪
    Error.captureStackTrace(this, this.constructor)
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    }
  }

  /**
   * 转换为响应格式
   */
  toResponse() {
    return {
      success: false,
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: this.timestamp.toISOString(),
      },
    }
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_ERROR, message, details, 400)
    this.name = 'ValidationError'
  }
}

/**
 * 未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, details?: unknown) {
    super(ErrorCode.NOT_FOUND, `${resource}不存在`, details, 404)
    this.name = 'NotFoundError'
  }
}

/**
 * 未授权错误
 */
export class UnauthorizedError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.UNAUTHORIZED, message, details, 401)
    this.name = 'UnauthorizedError'
  }
}

/**
 * 禁止访问错误
 */
export class ForbiddenError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.FORBIDDEN, message, details, 403)
    this.name = 'ForbiddenError'
  }
}

/**
 * 冲突错误
 */
export class ConflictError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.CONFLICT, message, details, 409)
    this.name = 'ConflictError'
  }
}

/**
 * 内部服务器错误
 */
export class InternalError extends AppError {
  constructor(message?: string, details?: unknown) {
    super(ErrorCode.INTERNAL_ERROR, message, details, 500)
    this.name = 'InternalError'
  }
}

/**
 * 服务不可用错误
 */
export class ServiceUnavailableError extends AppError {
  constructor(service: string, details?: unknown) {
    super(ErrorCode.SERVICE_UNAVAILABLE, `${service}服务不可用`, details, 503)
    this.name = 'ServiceUnavailableError'
  }
}

/**
 * 错误工厂函数
 */
export class ErrorFactory {
  /**
   * 创建用户相关错误
   */
  static user = {
    notFound: (details?: unknown) => new AppError(ErrorCode.USER_NOT_FOUND, undefined, details),
    alreadyExists: (details?: unknown) =>
      new AppError(ErrorCode.USER_ALREADY_EXISTS, undefined, details),
    emailExists: (details?: unknown) =>
      new AppError(ErrorCode.USER_EMAIL_ALREADY_EXISTS, undefined, details),
    invalidEmail: (details?: unknown) =>
      new AppError(ErrorCode.USER_INVALID_EMAIL, undefined, details),
  }

  /**
   * 创建组织相关错误
   */
  static org = {
    notFound: (details?: unknown) => new AppError(ErrorCode.ORG_NOT_FOUND, undefined, details),
    alreadyExists: (details?: unknown) =>
      new AppError(ErrorCode.ORG_ALREADY_EXISTS, undefined, details),
    slugExists: (details?: unknown) =>
      new AppError(ErrorCode.ORG_SLUG_ALREADY_EXISTS, undefined, details),
    notMember: (details?: unknown) => new AppError(ErrorCode.ORG_NOT_MEMBER, undefined, details),
    insufficientRole: (details?: unknown) =>
      new AppError(ErrorCode.ORG_INSUFFICIENT_ROLE, undefined, details),
    memberAlreadyExists: (details?: unknown) =>
      new AppError(ErrorCode.ORG_MEMBER_ALREADY_EXISTS, undefined, details),
  }

  /**
   * 创建项目相关错误
   */
  static project = {
    notFound: (details?: unknown) => new AppError(ErrorCode.PROJECT_NOT_FOUND, undefined, details),
    alreadyExists: (details?: unknown) =>
      new AppError(ErrorCode.PROJECT_ALREADY_EXISTS, undefined, details),
    slugExists: (details?: unknown) =>
      new AppError(ErrorCode.PROJECT_SLUG_ALREADY_EXISTS, undefined, details),
    notMember: (details?: unknown) =>
      new AppError(ErrorCode.PROJECT_NOT_MEMBER, undefined, details),
    insufficientRole: (details?: unknown) =>
      new AppError(ErrorCode.PROJECT_INSUFFICIENT_ROLE, undefined, details),
    initializationFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.PROJECT_INITIALIZATION_FAILED, message, details),
    templateNotFound: (details?: unknown) =>
      new AppError(ErrorCode.PROJECT_TEMPLATE_NOT_FOUND, undefined, details),
    templateInvalid: (details?: unknown) =>
      new AppError(ErrorCode.PROJECT_TEMPLATE_INVALID, undefined, details),
  }

  /**
   * 创建仓库相关错误
   */
  static repo = {
    notFound: (details?: unknown) => new AppError(ErrorCode.REPO_NOT_FOUND, undefined, details),
    alreadyExists: (details?: unknown) =>
      new AppError(ErrorCode.REPO_ALREADY_EXISTS, undefined, details),
    creationFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.REPO_CREATION_FAILED, message, details),
    accessDenied: (details?: unknown) =>
      new AppError(ErrorCode.REPO_ACCESS_DENIED, undefined, details),
    syncFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.REPO_SYNC_FAILED, message, details),
  }

  /**
   * 创建部署相关错误
   */
  static deploy = {
    notFound: (details?: unknown) => new AppError(ErrorCode.DEPLOY_NOT_FOUND, undefined, details),
    alreadyRunning: (details?: unknown) =>
      new AppError(ErrorCode.DEPLOY_ALREADY_RUNNING, undefined, details),
    failed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.DEPLOY_FAILED, message, details),
    approvalRequired: (details?: unknown) =>
      new AppError(ErrorCode.DEPLOY_APPROVAL_REQUIRED, undefined, details),
    approvalRejected: (details?: unknown) =>
      new AppError(ErrorCode.DEPLOY_APPROVAL_REJECTED, undefined, details),
  }

  /**
   * 创建 GitOps 相关错误
   */
  static gitops = {
    resourceNotFound: (details?: unknown) =>
      new AppError(ErrorCode.GITOPS_RESOURCE_NOT_FOUND, undefined, details),
    syncFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.GITOPS_SYNC_FAILED, message, details),
    k8sConnectionFailed: (details?: unknown) =>
      new AppError(ErrorCode.GITOPS_K8S_CONNECTION_FAILED, undefined, details),
    fluxNotInstalled: (details?: unknown) =>
      new AppError(ErrorCode.GITOPS_FLUX_NOT_INSTALLED, undefined, details),
    invalidManifest: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.GITOPS_INVALID_MANIFEST, message, details),
    applyFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.GITOPS_APPLY_FAILED, message, details),
    credentialNotFound: (details?: unknown) =>
      new AppError(ErrorCode.GITOPS_CREDENTIAL_NOT_FOUND, undefined, details),
  }

  /**
   * 创建 AI 相关错误
   */
  static ai = {
    serviceUnavailable: (details?: unknown) =>
      new AppError(ErrorCode.AI_SERVICE_UNAVAILABLE, undefined, details),
    modelNotFound: (details?: unknown) =>
      new AppError(ErrorCode.AI_MODEL_NOT_FOUND, undefined, details),
    inferenceFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.AI_INFERENCE_FAILED, message, details),
    invalidInput: (details?: unknown) =>
      new AppError(ErrorCode.AI_INVALID_INPUT, undefined, details),
    timeout: (details?: unknown) => new AppError(ErrorCode.AI_TIMEOUT, undefined, details),
    codeReviewFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.AI_CODE_REVIEW_FAILED, message, details),
  }

  /**
   * 创建认证相关错误
   */
  static auth = {
    invalidCredentials: (details?: unknown) =>
      new AppError(ErrorCode.AUTH_INVALID_CREDENTIALS, undefined, details),
    tokenExpired: (details?: unknown) =>
      new AppError(ErrorCode.AUTH_TOKEN_EXPIRED, undefined, details),
    tokenInvalid: (details?: unknown) =>
      new AppError(ErrorCode.AUTH_TOKEN_INVALID, undefined, details),
    insufficientPermissions: (details?: unknown) =>
      new AppError(ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS, undefined, details),
    accountLocked: (details?: unknown) =>
      new AppError(ErrorCode.AUTH_ACCOUNT_LOCKED, undefined, details),
    oauthFailed: (provider: string, details?: unknown) =>
      new AppError(ErrorCode.AUTH_OAUTH_FAILED, `${provider} OAuth 认证失败`, details),
  }

  /**
   * 创建数据库相关错误
   */
  static db = {
    connectionFailed: (details?: unknown) =>
      new AppError(ErrorCode.DB_CONNECTION_FAILED, undefined, details),
    queryFailed: (message?: string, details?: unknown) =>
      new AppError(ErrorCode.DB_QUERY_FAILED, message, details),
    transactionFailed: (details?: unknown) =>
      new AppError(ErrorCode.DB_TRANSACTION_FAILED, undefined, details),
    uniqueViolation: (field: string, details?: unknown) =>
      new AppError(ErrorCode.DB_UNIQUE_VIOLATION, `${field}已存在`, details),
  }
}
