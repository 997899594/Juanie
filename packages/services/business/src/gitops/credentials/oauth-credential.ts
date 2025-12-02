import type { OAuthAccount } from '@juanie/core/database'
import { OAuthAccountsService } from '@juanie/service-foundation'
import type { CredentialMetadata, GitProvider } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import type { GitCredential } from './git-credential.interface'

/**
 * OAuth Token 凭证实现
 * 使用用户的 OAuth access token
 */
@Injectable()
export class OAuthCredential implements GitCredential {
  readonly type = 'oauth' as const
  readonly provider: GitProvider

  constructor(
    public readonly id: string,
    private readonly oauthAccount: OAuthAccount,
    private readonly oauthService: OAuthAccountsService,
  ) {
    this.provider = this.oauthAccount.provider as GitProvider
  }

  async getAccessToken(): Promise<string> {
    // 自动刷新过期的 token（GitLab）
    const account = await this.oauthService.getAccountByProvider(
      this.oauthAccount.userId,
      this.oauthAccount.provider as 'github' | 'gitlab',
    )

    if (!account?.accessToken) {
      throw new Error(`OAuth account not found or token missing`)
    }

    return account.accessToken
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
      if (this.oauthAccount.provider === 'github') {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })
        return response.ok
      } else {
        const gitlabUrl = this.oauthAccount.serverUrl || 'https://gitlab.com'
        const response = await fetch(`${gitlabUrl}/api/v4/user`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        return response.ok
      }
    } catch {
      return false
    }
  }

  async refresh(): Promise<void> {
    // GitLab token 自动刷新由 OAuthAccountsService 处理
    if (this.oauthAccount.provider === 'gitlab') {
      await this.oauthService.getAccountByProvider(
        this.oauthAccount.userId,
        this.oauthAccount.provider,
      )
    }
  }

  getScopes(): string[] {
    return this.oauthAccount.provider === 'github'
      ? ['repo', 'workflow', 'admin:repo_hook']
      : ['api', 'write_repository']
  }

  hasPermission(permission: string): boolean {
    const scopes = this.getScopes()
    return scopes.includes(permission)
  }

  getMetadata(): CredentialMetadata {
    return {
      id: this.id,
      type: this.type,
      provider: this.provider,
      scopes: this.getScopes(),
      expiresAt: this.oauthAccount.expiresAt || undefined,
      createdAt: this.oauthAccount.createdAt,
      updatedAt: this.oauthAccount.updatedAt,
      isValid: true,
      lastValidatedAt: undefined,
    }
  }

  getUsername(): string {
    return this.oauthAccount.provider === 'github' ? 'x-access-token' : 'oauth2'
  }
}
