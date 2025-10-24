import { pgTable, serial, integer, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';

// 枚举定义
export const RepositoryProviderEnum = z.enum(['github', 'gitlab', 'bitbucket']);
export const SyncStatusEnum = z.enum(['pending', 'syncing', 'success', 'failed']);

export const repositories = pgTable('repositories', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  
  // 仓库信息
  provider: text('provider').notNull(), // 'github', 'gitlab', 'bitbucket'
  providerId: text('provider_id').notNull(),
  name: text('name').notNull(),
  fullName: text('full_name').notNull(),
  cloneUrl: text('clone_url').notNull(),
  webUrl: text('web_url').notNull(),
  
  // 分支管理
  defaultBranch: text('default_branch').default('main'),
  protectedBranches: jsonb('protected_branches').default([]),
  branchProtectionRules: jsonb('branch_protection_rules').default({}),
  
  // 仓库配置
  isPrivate: boolean('is_private').default(true),
  isArchived: boolean('is_archived').default(false),
  isTemplate: boolean('is_template').default(false),
  
  // 自动化配置
  autoMergeEnabled: boolean('auto_merge_enabled').default(false),
  autoDeleteBranches: boolean('auto_delete_branches').default(true),
  requireCodeReview: boolean('require_code_review').default(true),
  requireStatusChecks: boolean('require_status_checks').default(true),
  
  // 同步状态
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: text('sync_status').default('pending'), // 'pending', 'syncing', 'success', 'failed'
  syncError: text('sync_error'),
  
  // 统计信息
  starsCount: integer('stars_count').default(0),
  forksCount: integer('forks_count').default(0),
  issuesCount: integer('issues_count').default(0),
  pullRequestsCount: integer('pull_requests_count').default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const repositoriesProjectIdx = index('repositories_project_idx').on(repositories.projectId);
export const repositoriesProviderIdx = index('repositories_provider_idx').on(repositories.provider);
export const repositoriesSyncStatusIdx = index('repositories_sync_status_idx').on(repositories.syncStatus);
export const repositoriesProviderIdIdx = index('repositories_provider_id_idx').on(repositories.provider, repositories.providerId);

// Relations
export const repositoriesRelations = relations(repositories, ({ one }) => ({
  project: one(projects, {
    fields: [repositories.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertRepositorySchema = createInsertSchema(repositories);

export const selectRepositorySchema = createSelectSchema(repositories);

export const updateRepositorySchema = insertRepositorySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Repository = typeof repositories.$inferSelect;
export type NewRepository = typeof repositories.$inferInsert;
export type UpdateRepository = z.infer<typeof updateRepositorySchema>;
export type RepositoryProvider = z.infer<typeof RepositoryProviderEnum>;
export type SyncStatus = z.infer<typeof SyncStatusEnum>;