import { boolean, index, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { baseFields } from './base'
import { users } from './users'

// 现代化Session表 - 替代JWT的安全方案
export const sessions = pgTable(
  'sessions',
  {
    ...baseFields,
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Session令牌 (使用crypto.randomBytes生成)
    token: text('token').unique().notNull(),
    // Session过期时间
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    // 用户代理信息
    userAgent: text('user_agent'),
    // IP地址
    ipAddress: text('ip_address'),
    // 设备信息
    deviceInfo: text('device_info'),
    // 是否活跃
    isActive: boolean('is_active').default(true).notNull(),
    // 最后活跃时间
    lastActiveAt: timestamp('last_active_at', { withTimezone: true, mode: 'date' })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    // 索引优化
    userIdIdx: index('sessions_user_id_idx').on(table.userId),
    tokenIdx: index('sessions_token_idx').on(table.token),
    expiresAtIdx: index('sessions_expires_at_idx').on(table.expiresAt),
    activeIdx: index('sessions_active_idx').on(table.isActive),
  }),
)

// 刷新令牌表 (用于长期认证)
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    ...baseFields,
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    token: text('token').unique().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    isRevoked: boolean('is_revoked').default(false).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
  },
  (table) => ({
    sessionIdIdx: index('refresh_tokens_session_id_idx').on(table.sessionId),
    tokenIdx: index('refresh_tokens_token_idx').on(table.token),
  }),
)

// 类型定义
export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
export type RefreshToken = typeof refreshTokens.$inferSelect
export type NewRefreshToken = typeof refreshTokens.$inferInsert
