import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
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
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('oauth_provider_account_unique').on(table.provider, table.providerAccountId),
    index('oauth_user_idx').on(table.userId),
  ],
)

export type OAuthAccount = typeof oauthAccounts.$inferSelect
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert
