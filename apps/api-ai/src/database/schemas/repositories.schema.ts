import { pgTable, uuid, integer, text, timestamp, jsonb, boolean, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { z } from 'zod'
import { projects } from './projects.schema'

// 枚举定义
export const RepositoryProviderEnum = z.enum(['github', 'gitlab', 'bitbucket'])
export const SyncStatusEnum = z.enum(['pending', 'syncing', 'success', 'failed'])
export const RepositoryProviderPgEnum = pgEnum('repository_provider', ['github', 'gitlab', 'bitbucket'])
export const SyncStatusPgEnum = pgEnum('repository_sync_status', ['pending', 'syncing', 'success', 'failed'])

export const repositories = pgTable('repositories', {
  id: uuid('id').primaryKey().defaultRandom(), // 仓库唯一ID
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }), // 所属项目ID
  // 基本信息
  provider: RepositoryProviderPgEnum('provider').notNull(), // 仓库提供商：github/gitlab/bitbucket
  providerId: text('provider_id').notNull(), // 提供商侧仓库ID
  name: text('name').notNull(), // 仓库名
  fullName: text('full_name').notNull(), // 全名（组织/仓库）
  cloneUrl: text('clone_url').notNull(), // 克隆地址
  webUrl: text('web_url').notNull(), // Web 访问地址
  description: text('description'), // 仓库描述
  defaultBranch: text('default_branch').default('main'), // 默认分支
  // 分支保护配置
  protectedBranchNames: text('protected_branch_names'), // 受保护分支名称（逗号分隔）
  mainBranchProtected: boolean('main_branch_protected').default(true), // 主分支是否受保护
  // 审批配置
  requireApprovalCount: integer('require_approval_count').default(1), // 需要审批数量
  requireLinearHistory: boolean('require_linear_history').default(false), // 需要线性历史
  allowForcePushes: boolean('allow_force_pushes').default(false), // 允许强制推送
  allowDeletions: boolean('allow_deletions').default(false), // 允许删除
  // 仓库配置
  isPrivate: boolean('is_private').default(true), // 是否私有
  isArchived: boolean('is_archived').default(false), // 是否归档
  isTemplate: boolean('is_template').default(false), // 是否模板仓库
  // 自动化配置
  autoMergeEnabled: boolean('auto_merge_enabled').default(false), // 是否启用自动合并
  autoDeleteBranches: boolean('auto_delete_branches').default(true), // 合并后自动删除分支
  requireCodeReview: boolean('require_code_review').default(true), // 需要代码评审
  requireStatusChecks: boolean('require_status_checks').default(true), // 需要状态检查
  // 同步状态
  lastSyncAt: timestamp('last_sync_at'), // 最近同步时间
  syncStatus: SyncStatusPgEnum('sync_status').default('pending'), // 同步状态：pending/syncing/success/failed
  syncError: text('sync_error'), // 同步错误信息
  // 统计信息
  starsCount: integer('stars_count').default(0), // Star 数
  forksCount: integer('forks_count').default(0), // Fork 数
  issuesCount: integer('issues_count').default(0), // Issue 数
  pullRequestsCount: integer('pull_requests_count').default(0), // PR 数
  createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // 更新时间
}, (table) => [
  index('repositories_project_idx').on(table.projectId),
  index('repositories_provider_idx').on(table.provider),
  index('repositories_sync_status_idx').on(table.syncStatus),
  index('repositories_provider_id_idx').on(table.provider, table.providerId),
  uniqueIndex('repositories_project_full_name_unique').on(table.projectId, table.fullName),
]);

// Relations
export const repositoriesRelations = relations(repositories, ({ one }) => ({
  project: one(projects, {
    fields: [repositories.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertRepositorySchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  provider: RepositoryProviderEnum,
  providerId: z.string(),
  name: z.string(),
  fullName: z.string(),
  cloneUrl: z.string().url(),
  webUrl: z.string().url(),
  defaultBranch: z.string().optional(),
  protectedBranchNames: z.string().optional(),
  mainBranchProtected: z.boolean().optional(),
  requireApprovalCount: z.number().int().min(0).optional(),
  requireLinearHistory: z.boolean().optional(),
  allowForcePushes: z.boolean().optional(),
  allowDeletions: z.boolean().optional(),
  isPrivate: z.boolean().optional(),
  isArchived: z.boolean().optional(),
  isTemplate: z.boolean().optional(),
  autoMergeEnabled: z.boolean().optional(),
  autoDeleteBranches: z.boolean().optional(),
  requireCodeReview: z.boolean().optional(),
  requireStatusChecks: z.boolean().optional(),
  lastSyncAt: z.date().optional(),
  syncStatus: SyncStatusEnum.optional(),
  syncError: z.string().optional(),
  starsCount: z.number().int().min(0).optional(),
  forksCount: z.number().int().min(0).optional(),
  issuesCount: z.number().int().min(0).optional(),
  pullRequestsCount: z.number().int().min(0).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectRepositorySchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  provider: z.string(),
  providerId: z.string(),
  name: z.string(),
  fullName: z.string(),
  cloneUrl: z.string(),
  webUrl: z.string(),
  defaultBranch: z.string(),
  protectedBranchNames: z.string().nullable(),
  mainBranchProtected: z.boolean(),
  requireApprovalCount: z.number().int(),
  requireLinearHistory: z.boolean(),
  allowForcePushes: z.boolean(),
  allowDeletions: z.boolean(),
  isPrivate: z.boolean(),
  isArchived: z.boolean(),
  isTemplate: z.boolean(),
  autoMergeEnabled: z.boolean(),
  autoDeleteBranches: z.boolean(),
  requireCodeReview: z.boolean(),
  requireStatusChecks: z.boolean(),
  lastSyncAt: z.date().nullable(),
  syncStatus: z.string(),
  syncError: z.string().nullable(),
  starsCount: z.number().int(),
  forksCount: z.number().int(),
  issuesCount: z.number().int(),
  pullRequestsCount: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateRepositorySchema = selectRepositorySchema.pick({
  projectId: true,
  provider: true,
  providerId: true,
  name: true,
  fullName: true,
  cloneUrl: true,
  webUrl: true,
  defaultBranch: true,
  protectedBranchNames: true,
  mainBranchProtected: true,
  requireApprovalCount: true,
  requireLinearHistory: true,
  allowForcePushes: true,
  allowDeletions: true,
  isPrivate: true,
  isArchived: true,
  isTemplate: true,
  autoMergeEnabled: true,
  autoDeleteBranches: true,
  requireCodeReview: true,
  requireStatusChecks: true,
  lastSyncAt: true,
  syncStatus: true,
  syncError: true,
  starsCount: true,
  forksCount: true,
  issuesCount: true,
  pullRequestsCount: true,
}).partial();

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
export type UpdateRepository = z.infer<typeof updateRepositorySchema>;
export type RepositoryProvider = z.infer<typeof RepositoryProviderEnum>;
export type SyncStatus = z.infer<typeof SyncStatusEnum>;