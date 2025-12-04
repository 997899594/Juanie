import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class OAuthAccountsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 获取用户的所有 OAuth 账户
   */
  @Trace('oauth-accounts.list')
  async listUserAccounts(userId: string) {
    return await this.db
      .select({
        id: schema.oauthAccounts.id,
        provider: schema.oauthAccounts.provider,
        providerAccountId: schema.oauthAccounts.providerAccountId,
        status: schema.oauthAccounts.status,
        expiresAt: schema.oauthAccounts.expiresAt,
        createdAt: schema.oauthAccounts.createdAt,
        // 不返回 accessToken 和 refreshToken（安全考虑）
      })
      .from(schema.oauthAccounts)
      .where(eq(schema.oauthAccounts.userId, userId))
  }

  /**
   * 获取用户指定提供商的 OAuth 账户（包含 token）
   * 仅用于后端服务间调用
   * 自动刷新过期的 GitLab token
   */
  @Trace('oauth-accounts.getByProvider')
  async getAccountByProvider(userId: string, provider: 'github' | 'gitlab') {
    const [account] = await this.db
      .select()
      .from(schema.oauthAccounts)
      .where(
        and(eq(schema.oauthAccounts.userId, userId), eq(schema.oauthAccounts.provider, provider)),
      )
      .limit(1)

    if (!account) return null

    // GitLab token 过期自动刷新
    if (
      provider === 'gitlab' &&
      account.refreshToken &&
      account.expiresAt &&
      new Date(account.expiresAt) < new Date()
    ) {
      return await this.refreshGitLabToken(account)
    }

    return account
  }

  /**
   * 刷新 GitLab access token
   */
  @Trace('oauth-accounts.refreshGitLabToken')
  private async refreshGitLabToken(account: typeof schema.oauthAccounts.$inferSelect) {
    const gitlabUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com'
    const response = await fetch(`${gitlabUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'refresh_token',
        refresh_token: account.refreshToken,
        client_id: process.env.GITLAB_CLIENT_ID,
        client_secret: process.env.GITLAB_CLIENT_SECRET,
      }),
    })

    if (!response.ok) {
      // 刷新失败，标记为过期
      await this.db
        .update(schema.oauthAccounts)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(schema.oauthAccounts.id, account.id))

      throw new Error('GitLab token 刷新失败')
    }

    interface GitLabTokenResponse {
      access_token: string
      refresh_token: string
      expires_in: number
    }

    const data = (await response.json()) as GitLabTokenResponse

    // 更新 token
    const [updated] = await this.db
      .update(schema.oauthAccounts)
      .set({
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: new Date(Date.now() + data.expires_in * 1000),
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.oauthAccounts.id, account.id))
      .returning()

    return updated!
  }

  /**
   * 检查用户是否已连接指定提供商
   */
  @Trace('oauth-accounts.hasProvider')
  async hasProvider(userId: string, provider: 'github' | 'gitlab'): Promise<boolean> {
    const account = await this.getAccountByProvider(userId, provider)
    return !!account
  }

  /**
   * 标记 OAuth 账户为失效状态
   */
  @Trace('oauth-accounts.markAsExpired')
  async markAsExpired(userId: string, provider: 'github' | 'gitlab') {
    await this.db
      .update(schema.oauthAccounts)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(
        and(eq(schema.oauthAccounts.userId, userId), eq(schema.oauthAccounts.provider, provider)),
      )
  }

  /**
   * 删除 OAuth 账户连接
   */
  @Trace('oauth-accounts.disconnect')
  async disconnect(userId: string, provider: 'github' | 'gitlab') {
    await this.db
      .delete(schema.oauthAccounts)
      .where(
        and(eq(schema.oauthAccounts.userId, userId), eq(schema.oauthAccounts.provider, provider)),
      )

    return { success: true }
  }
}
