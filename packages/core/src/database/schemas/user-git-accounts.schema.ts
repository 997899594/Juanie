import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const userGitAccounts = pgTable(
  'user_git_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'github' | 'gitlab'

    // Git 平台用户信息
    gitUserId: text('git_user_id').notNull(),
    gitUsername: text('git_username').notNull(),
    gitEmail: text('git_email'),
    gitAvatarUrl: text('git_avatar_url'),

    // OAuth 凭证（加密存储）
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenExpiresAt: timestamp('token_expires_at'),

    // 同步状态
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastSyncAt: timestamp('last_sync_at'),
    syncStatus: text('sync_status').notNull().default('active'), // 'active' | 'expired' | 'revoked'

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('user_git_accounts_user_provider_unique').on(table.userId, table.provider),
    index('user_git_accounts_git_user_id_idx').on(table.gitUserId),
    index('user_git_accounts_sync_status_idx').on(table.syncStatus),
  ],
)

export type UserGitAccount = typeof userGitAccounts.$inferSelect
export type NewUserGitAccount = typeof userGitAccounts.$inferInsert
