import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'

/**
 * 会话表 - 管理用户登录会话
 *
 * 设计原则：
 * - 双存储：Redis（快速访问）+ Database（持久化和管理）
 * - 安全性：记录 IP、User Agent、设备信息
 * - 可管理：支持查看和撤销会话
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: text('session_id').notNull().unique(), // Redis key
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Session 信息
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    deviceInfo: jsonb('device_info').$type<{
      browser?: string
      os?: string
      device?: string
    }>(),

    // 状态
    status: text('status').notNull().default('active'), // 'active' | 'expired' | 'revoked'

    // 时间戳
    createdAt: timestamp('created_at').notNull().defaultNow(),
    lastActivityAt: timestamp('last_activity_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at').notNull(),
  },
  (table) => [
    index('sessions_user_idx').on(table.userId),
    index('sessions_status_idx').on(table.status),
    index('sessions_session_id_idx').on(table.sessionId),
  ],
)

export type Session = typeof sessions.$inferSelect
export type NewSession = typeof sessions.$inferInsert
