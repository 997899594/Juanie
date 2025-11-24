import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const oauthAccounts = pgTable(
  'oauth_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'github', 'gitlab'
    providerAccountId: text('provider_account_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),
    status: text('status').notNull().default('active'), // 'active', 'expired', 'revoked'

    // Git 服务器配置（用于 GitLab 私有服务器）
    serverUrl: text('server_url').notNull(), // 例如: https://gitlab.company.com
    serverType: text('server_type').notNull().default('cloud'), // 'cloud' | 'self-hosted'

    // 元数据
    metadata: jsonb('metadata').$type<{
      username?: string
      email?: string
      avatarUrl?: string
      serverVersion?: string // GitLab 版本
      serverName?: string // 服务器名称（用于 UI 显示）
    }>(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    // 用户可以连接多个 GitLab 服务器，但每个服务器只能连接一次
    uniqueIndex('oauth_accounts_user_id_provider_server_url_unique').on(
      table.userId,
      table.provider,
      table.serverUrl,
    ),
    index('oauth_user_idx').on(table.userId),
  ],
)

export type OAuthAccount = typeof oauthAccounts.$inferSelect
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert
