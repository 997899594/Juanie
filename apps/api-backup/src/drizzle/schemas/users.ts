import { boolean, json, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { auditFields, baseFields, metadataFields } from './base'
import { roleEnum } from './enums'

export const users = pgTable('users', {
  ...baseFields,
  email: text('email').unique().notNull(),
  // 移除passwordHash，改用更安全的认证方式
  name: text('name').notNull(),
  avatar: text('avatar'),
  role: roleEnum('role').default('LEARNER').notNull(),
  preferences: json('preferences').$type<UserPreferences>().default({}).notNull(),
  ...metadataFields,
  isActive: boolean('is_active').default(true).notNull(),
  isEmailVerified: boolean('is_email_verified').default(false).notNull(),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true, mode: 'date' }),
  emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true, mode: 'date' }),
  // 添加安全字段
  twoFactorEnabled: boolean('two_factor_enabled').default(false).notNull(),
  twoFactorSecret: text('two_factor_secret'), // 加密存储
})

// 用户凭据表 (分离敏感信息)
export const userCredentials = pgTable('user_credentials', {
  ...baseFields,
  userId: text('user_id')
    .unique()
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  // 使用Argon2id哈希的密码
  passwordHash: text('password_hash'),
  // 密码重置令牌
  resetToken: text('reset_token'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at', { withTimezone: true, mode: 'date' }),
  // 邮箱验证令牌
  verificationToken: text('verification_token'),
  verificationTokenExpiresAt: timestamp('verification_token_expires_at', {
    withTimezone: true,
    mode: 'date',
  }),
})

export const oauthAccounts = pgTable('oauth_accounts', {
  ...baseFields,
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  providerUserId: text('provider_user_id').notNull(),
  accessToken: text('access_token'), // 应该加密存储
  refreshToken: text('refresh_token'), // 应该加密存储
  expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }),
  profile: json('profile').default({}).notNull(),
})

// 类型定义
export interface UserPreferences {
  theme?: 'light' | 'dark' | 'system'
  language?: string
  timezone?: string
  notifications?: {
    email?: boolean
    push?: boolean
    desktop?: boolean
    marketing?: boolean
  }
  privacy?: {
    profileVisibility?: 'public' | 'private' | 'friends'
    activityVisibility?: 'public' | 'private'
  }
}

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type UserCredential = typeof userCredentials.$inferSelect
export type NewUserCredential = typeof userCredentials.$inferInsert
export type OAuthAccount = typeof oauthAccounts.$inferSelect
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert
