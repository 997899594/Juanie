import { AppError } from './base'

export class GitConnectionNotFoundError extends AppError {
  constructor(provider: string, userId?: string) {
    super(
      `Git connection for ${provider} not found`,
      'GIT_CONNECTION_NOT_FOUND',
      404,
      false,
      { provider, userId },
    )
  }

  getUserMessage(): string {
    const provider = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `未找到 ${provider} 账号连接，请先连接账号`
  }
}

export class GitConnectionInvalidError extends AppError {
  constructor(provider: string, reason: string) {
    super(
      `Git connection for ${provider} is invalid: ${reason}`,
      'GIT_CONNECTION_INVALID',
      400,
      false,
      { provider, reason },
    )
  }

  getUserMessage(): string {
    const provider = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `${provider} 连接无效，请重新连接`
  }
}

export class TokenDecryptionError extends AppError {
  constructor(provider: string) {
    super(`Failed to decrypt tokens for ${provider}`, 'TOKEN_DECRYPTION_FAILED', 500, false, {
      provider,
    })
  }

  getUserMessage(): string {
    return 'Token 解密失败，请重新连接账号'
  }
}

export class TokenRefreshError extends AppError {
  constructor(provider: string, reason: string) {
    super(`Failed to refresh token for ${provider}: ${reason}`, 'TOKEN_REFRESH_FAILED', 500, true, {
      provider,
      reason,
    })
  }

  getUserMessage(): string {
    const provider = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `${provider} Token 刷新失败，请重新连接账号`
  }
}

export class GitSyncFailedError extends AppError {
  constructor(operation: string, reason: string) {
    super(`Git sync failed: ${operation} - ${reason}`, 'GIT_SYNC_FAILED', 500, true, {
      operation,
      reason,
    })
  }

  getUserMessage(): string {
    return `Git 同步失败: ${this.context?.reason}`
  }
}

export class EncryptionKeyMissingError extends AppError {
  constructor() {
    super('Encryption key is not configured', 'ENCRYPTION_KEY_MISSING', 500, false)
  }

  getUserMessage(): string {
    return '系统配置错误，请联系管理员'
  }
}
