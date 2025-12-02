import { relations } from 'drizzle-orm'
import { boolean, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'
import { projects } from './projects.schema'
import { users } from './users.schema'

/**
 * Git 同步日志表
 * 记录所有 Git 平台同步操作的详细日志，包括成功和失败的操作
 *
 * 设计理念：
 * 1. 完整记录所有同步操作（不仅仅是错误）
 * 2. 支持重试机制和调试
 * 3. 提供审计追踪
 * 4. 支持错误管理和解决流程
 */
export const gitSyncLogs = pgTable('git_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 同步类型和操作
  syncType: text('sync_type').notNull(), // 'project' | 'member' | 'organization'
  action: text('action').notNull(), // 'create' | 'update' | 'delete' | 'sync'

  // 关联实体（支持多种关联）
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),

  // Git 平台信息
  provider: text('provider').notNull(), // 'github' | 'gitlab'
  gitResourceId: text('git_resource_id'), // Git 平台的资源 ID（如 repo ID, user ID）
  gitResourceUrl: text('git_resource_url'), // Git 平台的资源 URL
  gitResourceType: text('git_resource_type'), // 'repository' | 'organization' | 'user' | 'team'

  // 同步状态
  status: text('status').notNull(), // 'pending' | 'success' | 'failed'
  error: text('error'), // 用户友好的错误消息
  errorType: text('error_type'), // 'authentication' | 'network' | 'rate_limit' | 'conflict' | 'permission' | 'not_found' | 'unknown'
  errorStack: text('error_stack'), // 完整的错误堆栈（用于调试）

  // 错误管理（用于需要人工介入的错误）
  requiresResolution: boolean('requires_resolution').default(false), // 是否需要人工解决
  resolved: boolean('resolved').default(false), // 是否已解决
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
  resolutionNotes: text('resolution_notes'), // 解决方案说明

  // 元数据（用于调试、审计和重试）
  metadata: jsonb('metadata').$type<{
    attemptCount?: number // 重试次数
    lastAttemptAt?: Date // 最后尝试时间
    gitApiResponse?: any // Git API 响应（用于调试）
    gitApiStatusCode?: number // HTTP 状态码
    userAgent?: string // 用户代理
    ipAddress?: string // IP 地址
    triggeredBy?: string // 触发来源（'user' | 'system' | 'webhook'）
    workspaceType?: 'personal' | 'team' // 工作空间类型
    permissions?: string[] // 相关权限
  }>(),

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'), // 操作完成时间（成功或失败）
})

export const gitSyncLogsRelations = relations(gitSyncLogs, ({ one }) => ({
  organization: one(organizations, {
    fields: [gitSyncLogs.organizationId],
    references: [organizations.id],
  }),
  project: one(projects, {
    fields: [gitSyncLogs.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [gitSyncLogs.userId],
    references: [users.id],
  }),
  resolvedByUser: one(users, {
    fields: [gitSyncLogs.resolvedBy],
    references: [users.id],
  }),
}))
