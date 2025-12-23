import type { GitConnection } from '@juanie/core/database'
import { GitConnectionsService } from '@juanie/service-foundation'
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
    private readonly gitConnection: GitConnection,
    private readonly gitConnectionsService: GitConnectionsService,
  ) {
    this.provider = this.gitConnection.provider as GitProvider
  }

  async getAccessToken(): Promise<string> {
    // 自动刷新过期的 token（GitLab）并解密
    const connection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
      this.gitConnection.userId,
      this.gitConnection.provider as 'github' | 'gitlab',
      this.gitConnection.serverUrl,
    )

    if (!connection?.accessToken) {
      throw new Error(`Git connection not found or token missing`)
    }

    return connection.accessToken
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
      if (this.gitConnection.provider === 'github') {
        const response = await fetch('https://api.github.com/user', {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        })
        return response.ok
      } else {
        const gitlabUrl = this.gitConnection.serverUrl || 'https://gitlab.com'
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
    // GitLab token 自动刷新由 GitConnectionsService 处理
    if (this.gitConnection.provider === 'gitlab' && this.gitConnection.refreshToken) {
      // 调用 GitConnectionsService 的 refreshGitLabToken 方法
      await this.gitConnectionsService.refreshGitLabToken(
        this.gitConnection.userId,
        'gitlab',
        this.gitConnection.serverUrl,
      )
    }
  }

  getScopes(): string[] {
    return this.gitConnection.provider === 'github'
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
      expiresAt: this.gitConnection.expiresAt || undefined,
      createdAt: this.gitConnection.createdAt,
      updatedAt: this.gitConnection.updatedAt,
      isValid: true,
      lastValidatedAt: undefined,
    }
  }

  getUsername(): string {
    return this.gitConnection.provider === 'github' ? 'x-access-token' : 'oauth2'
  }
}
