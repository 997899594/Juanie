/**
 * Foundation 层业务错误
 *
 * 包含认证、用户、组织、团队等基础业务错误
 */

import { BaseError } from '@juanie/core/errors'

// 重新导出 Core 层的基础错误类，供 Foundation 层内部使用
export { BaseError, OperationFailedError, ValidationError } from '@juanie/core/errors'

// ==================== Git 连接相关错误 ====================

export class GitConnectionNotFoundError extends BaseError {
  constructor(provider: string, userId?: string) {
    super(`GitConnection ${provider} not found`, 'GIT_CONNECTION_NOT_FOUND', 404, false, {
      provider,
      userId,
    })
  }

  getUserMessage(): string {
    const providerName = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `未找到 ${providerName} OAuth 连接。请前往"设置 > 账户连接"页面连接您的 ${providerName} 账户。`
  }
}

export class GitConnectionInvalidError extends BaseError {
  constructor(provider: string, reason: string) {
    super(
      `Git connection invalid for ${provider}: ${reason}`,
      'GIT_CONNECTION_INVALID',
      400,
      false,
      { provider, reason },
    )
  }

  getUserMessage(): string {
    const providerName = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `${providerName} 访问令牌无效，请重新连接账户`
  }
}

export class TokenDecryptionError extends BaseError {
  constructor(provider: string) {
    super(`Failed to decrypt tokens for ${provider}`, 'TOKEN_DECRYPTION_FAILED', 500, false, {
      provider,
    })
  }

  getUserMessage(): string {
    return '令牌解密失败，请重新连接账户'
  }
}

export class TokenRefreshError extends BaseError {
  constructor(provider: string, reason: string) {
    super(`Failed to refresh token for ${provider}: ${reason}`, 'TOKEN_REFRESH_FAILED', 500, true, {
      provider,
      reason,
    })
  }

  getUserMessage(): string {
    const providerName = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `${providerName} 令牌刷新失败，请重新连接账户`
  }
}

// ==================== OAuth 相关错误 ====================

export class OAuthError extends BaseError {
  constructor(provider: string, reason: string) {
    super(`OAuth ${provider} error: ${reason}`, 'OAUTH_ERROR', 400, false, { provider, reason })
  }

  getUserMessage(): string {
    return `${this.context?.provider} 授权失败: ${this.context?.reason}`
  }
}

export class InvalidStateError extends BaseError {
  constructor(provider: string) {
    super(`Invalid OAuth state for ${provider}`, 'INVALID_STATE', 400, false, { provider })
  }

  getUserMessage(): string {
    return '授权状态无效或已过期，请重新授权'
  }
}

// ==================== 加密相关错误 ====================

export class EncryptionKeyMissingError extends BaseError {
  constructor() {
    super('Encryption key is not configured', 'ENCRYPTION_KEY_MISSING', 500, false)
  }

  getUserMessage(): string {
    return '系统配置错误，请联系管理员'
  }
}

// ==================== 组织相关错误 ====================

export class OrganizationNotFoundError extends BaseError {
  constructor(organizationId: string) {
    super('Organization not found', 'ORGANIZATION_NOT_FOUND', 404, false, { organizationId })
  }

  getUserMessage(): string {
    return '组织不存在'
  }
}

export class OrganizationMemberAlreadyExistsError extends BaseError {
  constructor(organizationId: string, userId: string) {
    super(
      `User ${userId} is already a member of organization ${organizationId}`,
      'ORGANIZATION_MEMBER_ALREADY_EXISTS',
      409,
      false,
      { organizationId, userId },
    )
  }

  getUserMessage(): string {
    return '用户已经是组织成员'
  }
}

export class NotOrganizationMemberError extends BaseError {
  constructor(organizationId: string, userId?: string) {
    super(
      `User is not a member of organization ${organizationId}`,
      'NOT_ORGANIZATION_MEMBER',
      403,
      false,
      { organizationId, userId },
    )
  }

  getUserMessage(): string {
    return '您不是该组织的成员'
  }
}

export class CannotRemoveOwnerError extends BaseError {
  constructor(organizationId: string) {
    super(
      `Cannot remove owner from organization ${organizationId}`,
      'CANNOT_REMOVE_OWNER',
      403,
      false,
      { organizationId },
    )
  }

  getUserMessage(): string {
    return '不能移除组织所有者'
  }
}

// ==================== 团队相关错误 ====================

export class TeamNotFoundError extends BaseError {
  constructor(teamId: string) {
    super('Team not found', 'TEAM_NOT_FOUND', 404, false, { teamId })
  }

  getUserMessage(): string {
    return '团队不存在'
  }
}

export class TeamMemberAlreadyExistsError extends BaseError {
  constructor(teamId: string, userId: string) {
    super(
      `User ${userId} is already a member of team ${teamId}`,
      'TEAM_MEMBER_ALREADY_EXISTS',
      409,
      false,
      { teamId, userId },
    )
  }

  getUserMessage(): string {
    return '用户已经是团队成员'
  }
}

export class TeamMemberNotFoundError extends BaseError {
  constructor(teamId: string, userId: string) {
    super(`User ${userId} is not a member of team ${teamId}`, 'TEAM_MEMBER_NOT_FOUND', 404, false, {
      teamId,
      userId,
    })
  }

  getUserMessage(): string {
    return '用户不是团队成员'
  }
}

export class NotTeamMemberError extends BaseError {
  constructor(teamId: string, userId?: string) {
    super(`User is not a member of team ${teamId}`, 'NOT_TEAM_MEMBER', 403, false, {
      teamId,
      userId,
    })
  }

  getUserMessage(): string {
    return '您不是该团队的成员'
  }
}

// ==================== 通知相关错误 ====================

export class NotificationNotFoundError extends BaseError {
  constructor(notificationId: string) {
    super('Notification not found', 'NOTIFICATION_NOT_FOUND', 404, false, { notificationId })
  }

  getUserMessage(): string {
    return '通知不存在'
  }
}

// ==================== 权限相关错误 ====================

export class PermissionDeniedError extends BaseError {
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
