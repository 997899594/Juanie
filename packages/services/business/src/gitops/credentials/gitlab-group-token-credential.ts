import type { GitCredential, GitProvider } from './git-credential.interface'

/**
 * GitLab Group Access Token 凭证
 *
 * 使用 GitLab Group Token 进行认证，提供组级别的访问控制
 *
 * 优势：
 * - 不依赖个人账户
 * - 组级别的权限管理
 * - 支持多个项目共享
 * - 更好的审计追踪
 */
export class GitLabGroupTokenCredential implements GitCredential {
  readonly type = 'gitlab_group' as const
  readonly provider: GitProvider = 'gitlab'

  constructor(
    public readonly id: string,
    private readonly groupId: string,
    private readonly token: string,
    private readonly scopes: string[],
    public readonly expiresAt?: Date,
  ) {}

  /**
   * 获取访问 token
   */
  async getAccessToken(): Promise<string> {
    return this.token
  }

  /**
   * 验证凭证是否有效
   */
  async validate(): Promise<boolean> {
    try {
      // 验证 token 是否可以访问组信息
      const response = await fetch(`https://gitlab.com/api/v4/groups/${this.groupId}`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      })

      if (!response.ok) {
        return false
      }

      // 验证 token 的权限范围
      const tokenInfo = await this.getTokenInfo()
      if (!tokenInfo) {
        return false
      }

      // 检查必需的权限
      const requiredScopes = ['api', 'write_repository']
      const hasRequiredScopes = requiredScopes.every((scope) => tokenInfo.scopes.includes(scope))

      return hasRequiredScopes
    } catch (error) {
      return false
    }
  }

  /**
   * GitLab Group Token 不支持自动刷新
   * 需要手动重新创建
   */
  async refresh(): Promise<void> {
    throw new Error(
      'GitLab Group Token cannot be refreshed automatically. Please create a new token.',
    )
  }

  /**
   * 检查凭证是否过期
   */
  isExpired(): boolean {
    if (!this.expiresAt) {
      return false
    }
    return new Date() > this.expiresAt
  }

  /**
   * 获取 token 信息
   */
  private async getTokenInfo(): Promise<{ scopes: string[] } | null> {
    try {
      const response = await fetch('https://gitlab.com/api/v4/personal_access_tokens/self', {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      })

      if (!response.ok) {
        return null
      }

      return (await response.json()) as { scopes: string[] }
    } catch (error) {
      return null
    }
  }

  /**
   * 检查 token 是否有特定权限
   */
  async hasScope(scope: string): Promise<boolean> {
    const tokenInfo = await this.getTokenInfo()
    if (!tokenInfo) {
      return false
    }
    return tokenInfo.scopes.includes(scope)
  }

  /**
   * 获取组信息
   */
  async getGroupInfo(): Promise<any> {
    const response = await fetch(`https://gitlab.com/api/v4/groups/${this.groupId}`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Failed to get group info: ${response.statusText}`)
    }

    return await response.json()
  }

  /**
   * 获取权限范围
   */
  getScopes(): string[] {
    return this.scopes
  }

  /**
   * 检查是否有特定权限
   */
  hasPermission(permission: string): boolean {
    return this.scopes.includes(permission)
  }

  /**
   * 获取凭证元数据
   */
  getMetadata(): import('@juanie/types').CredentialMetadata {
    return {
      id: this.id,
      type: 'gitlab_group',
      provider: this.provider,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: this.expiresAt,
      scopes: this.scopes,
      isValid: !this.isExpired(),
      lastValidatedAt: new Date(),
    }
  }
}
