// 基础错误类
export { AppError } from './base'

// 通用错误
export {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  OperationFailedError,
} from './common'

// 用户相关
export { UserNotFoundError, UserEmailExistsError, UserInvalidEmailError } from './user'

// 组织相关
export {
  OrganizationNotFoundError,
  OrganizationMemberAlreadyExistsError,
  NotOrganizationMemberError,
  CannotRemoveOwnerError,
} from './organization'

// 团队相关
export {
  TeamNotFoundError,
  TeamMemberAlreadyExistsError,
  TeamMemberNotFoundError,
  NotTeamMemberError,
} from './team'

// 认证相关
export {
  InvalidCredentialsError,
  TokenExpiredError,
  TokenInvalidError,
  OAuthError,
  InvalidStateError,
} from './auth'

// GitOps 相关
export {
  GitConnectionNotFoundError,
  GitConnectionInvalidError,
  TokenDecryptionError,
  TokenRefreshError,
  GitSyncFailedError,
  EncryptionKeyMissingError,
} from './gitops'

// 通知相关
export { NotificationNotFoundError } from './notification'

// 存储相关
export { StorageError } from './storage'

// 权限相关
export { PermissionDeniedError } from './permission'
