/**
 * Foundation 层错误
 * 
 * ✅ 重构完成：所有错误定义已移至 @juanie/core-errors
 * 这个文件只做重新导出，保持向后兼容
 * 
 * 未来可以删除这个文件，直接从 @juanie/core-errors 导入
 */

// ✅ 从 Core 层导入所有错误
export {
  // 基础
  AppError,
  // 通用
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  OperationFailedError,
  // 认证
  InvalidCredentialsError,
  TokenExpiredError,
  TokenInvalidError,
  OAuthError,
  InvalidStateError,
  // GitOps
  GitConnectionNotFoundError,
  GitConnectionInvalidError,
  TokenDecryptionError,
  TokenRefreshError,
  GitSyncFailedError,
  EncryptionKeyMissingError,
  // 组织
  OrganizationNotFoundError,
  OrganizationMemberAlreadyExistsError,
  NotOrganizationMemberError,
  CannotRemoveOwnerError,
  // 团队
  TeamNotFoundError,
  TeamMemberAlreadyExistsError,
  TeamMemberNotFoundError,
  NotTeamMemberError,
  // 通知
  NotificationNotFoundError,
  // 存储
  StorageError,
  // 权限
  PermissionDeniedError,
} from '@juanie/core-errors'

// ✅ 为了向后兼容，重新导出 BaseError（已废弃，请使用 AppError）
export { AppError as BaseError } from '@juanie/core-errors'
