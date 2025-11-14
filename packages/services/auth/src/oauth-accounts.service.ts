import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DATABASE } from '@juanie/core-tokens'
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
        createdAt: schema.oauthAccounts.createdAt,
        // 不返回 accessToken 和 refreshToken（安全考虑）
      })
      .from(schema.oauthAccounts)
      .where(eq(schema.oauthAccounts.userId, userId))
  }

  /**
   * 获取用户指定提供商的 OAuth 账户（包含 token）
   * 仅用于后端服务间调用
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

    return account || null
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
