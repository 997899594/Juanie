import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'
import { organizations } from '../organization/organizations.schema'
import { projects } from '../project/projects.schema'

/**
 * Git 同步日志表 - 现代化版本
 *
 * 记录所有 Git 平台同步操作的详细日志，包括成功和失败的操作
 *
 * 设计理念：
 * 1. 完整记录所有同步操作（不仅仅是错误）
 * 2. 支持重试机制和调试
 * 3. 提供审计追踪
 * 4. 支持错误管理和解决流程
 * 5. 使用 PostgreSQL 枚举类型提升性能和类型安全
 * 6. 添加索引优化查询性能
 */

// 枚举类型定义 - 使用 PostgreSQL 原生枚举
export const gitSyncTypeEnum = pgEnum('git_sync_type', ['project', 'member', 'organization'])
export const gitSyncActionEnum = pgEnum('git_sync_action', [
  'create',
  'update',
  'delete',
  'sync',
  'add',
  'remove',
])
export const gitProviderEnum = pgEnum('git_provider', ['github', 'gitlab'])
export const gitResourceTypeEnum = pgEnum('git_resource_type', [
  'repository',
  'organization',
  'user',
  'team',
  'member',
])
export const gitSyncStatusEnum = pgEnum('git_sync_status', [
  'pending',
  'processing',
  'success',
  'failed',
  'retrying',
])
export const gitSyncErrorTypeEnum = pgEnum('git_sync_error_type', [
  'authentication',
  'authorization',
  'network',
  'rate_limit',
  'conflict',
  'permission',
  'not_found',
  'validation',
  'timeout',
  'unknown',
])

/**
 * Metadata 类型定义 - 结构化的元数据
 */
export interface GitSyncLogMetadata {
  // 重试相关
  attemptCount?: number
  lastAttemptAt?: string // ISO 8601 格式
  maxRetries?: number
  nextRetryAt?: string

  // Git API 相关
  gitApiResponse?: Record<string, any>
  gitApiStatusCode?: number
  gitApiEndpoint?: string
  gitApiMethod?: string

  // 请求上下文
  userAgent?: string
  ipAddress?: string
  triggeredBy?: 'user' | 'system' | 'webhook' | 'scheduler'
  triggeredByUserId?: string

  // 工作空间相关
  workspaceType?: 'personal' | 'team'
  workspaceId?: string

  // 权限相关
  permissions?: string[]
  systemRole?: string // 系统中的角色
  gitPermission?: string // Git 平台的权限
  expectedGitPermission?: string

  // 冲突解决相关
  gitLogin?: string
  gitUserId?: string
  conflictType?: 'role_mismatch' | 'permission_mismatch' | 'user_not_found' | 'duplicate'
  conflictDetails?: Record<string, any>

  // 性能追踪
  duration?: number // 毫秒
  startedAt?: string
  completedAt?: string

  // 额外上下文
  [key: string]: any
}

export const gitSyncLogs = pgTable(
  'git_sync_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // 同步类型和操作 - 使用枚举类型
    syncType: gitSyncTypeEnum('sync_type').notNull(),
    action: gitSyncActionEnum('action').notNull(),

    // 关联实体（支持多种关联）
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    organizationId: uuid('organization_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),

    // Git 平台信息 - 使用枚举类型
    provider: gitProviderEnum('provider').notNull(),
    gitResourceId: text('git_resource_id'), // Git 平台的资源 ID
    gitResourceUrl: text('git_resource_url'), // Git 平台的资源 URL
    gitResourceType: gitResourceTypeEnum('git_resource_type'), // 资源类型

    // 同步状态 - 使用枚举类型
    status: gitSyncStatusEnum('status').notNull().default('pending'),
    error: text('error'), // 用户友好的错误消息
    errorType: gitSyncErrorTypeEnum('error_type'), // 错误类型
    errorStack: text('error_stack'), // 完整的错误堆栈（仅开发环境）

    // 错误管理
    requiresResolution: boolean('requires_resolution').notNull().default(false),
    resolved: boolean('resolved').notNull().default(false),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    resolvedBy: uuid('resolved_by').references(() => users.id, { onDelete: 'set null' }),
    resolutionNotes: text('resolution_notes'),

    // 重试计数 - 独立字段便于查询
    attemptCount: integer('attempt_count').notNull().default(0),

    // 元数据 - 结构化的 JSONB
    metadata: jsonb('metadata').$type<GitSyncLogMetadata>(),

    // 时间戳 - 使用 timezone
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    // 索引优化 - 提升查询性能
    projectIdIdx: index('git_sync_logs_project_id_idx').on(table.projectId),
    userIdIdx: index('git_sync_logs_user_id_idx').on(table.userId),
    organizationIdIdx: index('git_sync_logs_organization_id_idx').on(table.organizationId),
    statusIdx: index('git_sync_logs_status_idx').on(table.status),
    providerIdx: index('git_sync_logs_provider_idx').on(table.provider),
    createdAtIdx: index('git_sync_logs_created_at_idx').on(table.createdAt),

    // 复合索引 - 常见查询模式
    projectStatusIdx: index('git_sync_logs_project_status_idx').on(table.projectId, table.status),
    statusCreatedIdx: index('git_sync_logs_status_created_idx').on(table.status, table.createdAt),
    requiresResolutionIdx: index('git_sync_logs_requires_resolution_idx').on(
      table.requiresResolution,
      table.resolved,
    ),
  }),
)
