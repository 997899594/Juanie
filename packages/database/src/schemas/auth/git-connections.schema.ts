import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'

/**
 * Git 平台连接表 - 统一管理用户的 Git OAuth 认证
 *
 * 合并了原来的 oauth_accounts 和 user_git_accounts 表
 * 用途：
 * 1. 用户登录认证（OAuth）
 * 2. Git 集成（创建项目、同步代码等）
 *
 * 设计原则：
 * - 单一数据源：避免数据冗余和不一致
 * - 清晰职责：明确区分认证和集成用途
 * - 支持多服务器：支持 GitLab 私有部署
 */
export const gitConnections = pgTable(
  'git_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    // Git 平台信息
    provider: text('provider').notNull(), // 'github' | 'gitlab'
    providerAccountId: text('provider_account_id').notNull(), // Git 平台的用户 ID

    // Git 用户信息
    username: text('username').notNull(),
    email: text('email'),
    avatarUrl: text('avatar_url'),

    // OAuth 凭证（加密存储）
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    expiresAt: timestamp('expires_at'),

    // 状态管理
    status: text('status').notNull().default('active'), // 'active' | 'expired' | 'revoked'

    // 用途标识（可以同时用于多个目的）
    purpose: text('purpose').notNull().default('both'), // 'auth' | 'integration' | 'both'

    // Git 服务器配置（用于 GitLab 私有服务器）
    serverUrl: text('server_url').notNull(), // 例如: https://github.com, https://gitlab.company.com
    serverType: text('server_type').notNull().default('cloud'), // 'cloud' | 'self-hosted'

    // 元数据（扩展信息）
    metadata: jsonb('metadata').$type<{
      serverVersion?: string // GitLab 版本
      serverName?: string // 服务器名称（用于 UI 显示）
      scopes?: string[] // OAuth 权限范围
      [key: string]: any
    }>(),

    // 同步状态
    connectedAt: timestamp('connected_at').notNull().defaultNow(),
    lastSyncAt: timestamp('last_sync_at'),

    // 时间戳
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // 唯一约束：用户可以连接多个 GitLab 服务器，但每个服务器只能连接一次
    uniqueIndex('git_connections_user_provider_server_unique').on(
      table.userId,
      table.provider,
      table.serverUrl,
    ),

    // 性能索引
    index('git_connections_user_idx').on(table.userId),
    index('git_connections_provider_idx').on(table.provider),
    index('git_connections_status_idx').on(table.status),
    index('git_connections_provider_account_idx').on(table.providerAccountId),
  ],
)

export type GitConnection = typeof gitConnections.$inferSelect
export type NewGitConnection = typeof gitConnections.$inferInsert
