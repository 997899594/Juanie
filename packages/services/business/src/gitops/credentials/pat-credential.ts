import type { CredentialMetadata, GitProvider } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import type { GitCredential } from './git-credential.interface'

/**
 * Personal Access Token 凭证实现
 * 使用用户提供的 PAT
 */
@Injectable()
export class PATCredential implements GitCredential {
  readonly type = 'pat' as const

  constructor(
    public readonly id: string,
    public readonly provider: GitProvider,
    private readonly token: string,
    private readonly scopes: string[],
    private readonly expiresAt?: Date,
  ) {}

  async getAccessToken(): Promise<string> {
    // 检查是否过期
    if (this.expiresAt && this.expiresAt < new Date()) {
      throw new Error('PAT has expired')
    }

    return this.token
  }

  async validate(): Promise<boolean> {
    try {
      const token = await this.getAccessToken()
      return await this.validateWithGitAPI(token)
    } catch {
      return false
    }
  }

  private async validateWithGitAPI(token: string): Promise<boolean> {
    try {
      if (this.provider === 'github') {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })
        return response.ok
      } else if (this.provider === 'gitlab') {
        const response = await fetch('https://gitlab.com/api/v4/user', {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        return response.ok
      }
      return false
    } catch {
      return false
    }
  }

  getScopes(): string[] {
    return this.scopes
  }

  hasPermission(permission: string): boolean {
    return this.scopes.includes(permission)
  }

  getMetadata(): CredentialMetadata {
    return {
      id: this.id,
      type: this.type,
      provider: this.provider,
      scopes: this.scopes,
      expiresAt: this.expiresAt,
      createdAt: new Date(),
      updatedAt: new Date(),
      isValid: true,
      lastValidatedAt: undefined,
    }
  }

  getUsername(): string {
    return this.provider === 'github' ? 'x-access-token' : 'oauth2'
  }
}
