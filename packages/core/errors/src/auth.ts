import { AppError } from './base'

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid credentials', 'INVALID_CREDENTIALS', 401, false)
  }

  getUserMessage(): string {
    return '用户名或密码错误'
  }
}

export class TokenExpiredError extends AppError {
  constructor() {
    super('Token expired', 'TOKEN_EXPIRED', 401, false)
  }

  getUserMessage(): string {
    return '登录已过期，请重新登录'
  }
}

export class TokenInvalidError extends AppError {
  constructor() {
    super('Token invalid', 'TOKEN_INVALID', 401, false)
  }

  getUserMessage(): string {
    return '无效的登录凭证'
  }
}

export class OAuthError extends AppError {
  constructor(provider: string, reason: string) {
    super(`OAuth ${provider} error: ${reason}`, 'OAUTH_ERROR', 400, false, { provider, reason })
  }

  getUserMessage(): string {
    const provider = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `${provider} 授权失败`
  }
}

export class InvalidStateError extends AppError {
  constructor(provider: string) {
    super(`Invalid OAuth state for ${provider}`, 'INVALID_STATE', 400, false, { provider })
  }

  getUserMessage(): string {
    return 'OAuth 状态验证失败，请重试'
  }
}
