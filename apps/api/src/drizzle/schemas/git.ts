import {
  boolean,
  index,
  integer,
  json,
  pgTable,
  text,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { auditFields, baseFields } from './base'
import {
  branchStatusEnum,
  gitEventTypeEnum,
  gitProviderEnum,
  mergeRequestStatusEnum,
} from './enums'
import { projects } from './projects'
import { users } from './users'

// Git仓库表
export const gitRepositories = pgTable(
  'git_repositories',
  {
    ...baseFields,
    ...auditFields,
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    provider: gitProviderEnum('provider').notNull(),
    repoUrl: text('repo_url').notNull(),
    repoId: text('repo_id').notNull(),
    repoName: text('repo_name').notNull(),
    defaultBranch: text('default_branch').default('main').notNull(),
    accessToken: text('access_token'), // 应该加密存储
    webhookUrl: text('webhook_url'),
    webhookSecret: text('webhook_secret'),
    config: json('config').$type<GitRepoConfig>().default({}).notNull(),
    isActive: boolean('is_active').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at'),
  },
  (table) => ({
    providerRepoIdx: index('git_repositories_provider_repo_idx').on(table.provider, table.repoId),
    projectIdx: index('git_repositories_project_idx').on(table.projectId),
  }),
)

// Git分支表
export const gitBranches = pgTable(
  'git_branches',
  {
    ...baseFields,
    repositoryId: text('repository_id')
      .notNull()
      .references(() => gitRepositories.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    sha: text('sha').notNull(),
    status: branchStatusEnum('status').default('ACTIVE').notNull(),
    isProtected: boolean('is_protected').default(false).notNull(),
    isDefault: boolean('is_default').default(false).notNull(),
    lastCommit: json('last_commit').$type<GitCommit>(),
    ahead: integer('ahead').default(0).notNull(),
    behind: integer('behind').default(0).notNull(),
  },
  (table) => ({
    repoNameIdx: unique('git_branches_repo_name_unique').on(table.repositoryId, table.name),
    statusIdx: index('git_branches_status_idx').on(table.status),
  }),
)

// 合并请求表
export const mergeRequests = pgTable(
  'merge_requests',
  {
    ...baseFields,
    repositoryId: text('repository_id')
      .notNull()
      .references(() => gitRepositories.id, { onDelete: 'cascade' }),
    mrId: integer('mr_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    sourceBranch: text('source_branch').notNull(),
    targetBranch: text('target_branch').notNull(),
    status: mergeRequestStatusEnum('status').default('OPEN').notNull(),
    authorId: text('author_id').references(() => users.id),
    assigneeId: text('assignee_id').references(() => users.id),
    reviewers: json('reviewers').$type<string[]>().default([]).notNull(),
    labels: json('labels').$type<string[]>().default([]).notNull(),
    conflicts: boolean('has_conflicts').default(false).notNull(),
    mergeable: boolean('is_mergeable').default(true).notNull(),
    mergedAt: timestamp('merged_at'),
    closedAt: timestamp('closed_at'),
  },
  (table) => ({
    repoMrIdx: unique('merge_requests_repo_mr_unique').on(table.repositoryId, table.mrId),
    statusIdx: index('merge_requests_status_idx').on(table.status),
    authorIdx: index('merge_requests_author_idx').on(table.authorId),
  }),
)

// Git事件表 (Webhook事件)
export const gitEvents = pgTable(
  'git_events',
  {
    ...baseFields,
    repositoryId: text('repository_id')
      .notNull()
      .references(() => gitRepositories.id, { onDelete: 'cascade' }),
    eventType: gitEventTypeEnum('event_type').notNull(),
    eventId: text('event_id'), // 外部事件ID，用于去重
    payload: json('payload').notNull(),
    processed: boolean('processed').default(false).notNull(),
    processedAt: timestamp('processed_at'),
    error: text('error'),
  },
  (table) => ({
    typeIdx: index('git_events_type_idx').on(table.eventType),
    processedIdx: index('git_events_processed_idx').on(table.processed),
    repoEventIdx: index('git_events_repo_event_idx').on(table.repositoryId, table.eventId),
  }),
)

// Git提交表
export const gitCommits = pgTable(
  'git_commits',
  {
    ...baseFields,
    repositoryId: text('repository_id')
      .notNull()
      .references(() => gitRepositories.id, { onDelete: 'cascade' }),
    sha: text('sha').notNull(),
    message: text('message').notNull(),
    author: json('author').$type<GitAuthor>().notNull(),
    committer: json('committer').$type<GitAuthor>().notNull(),
    parentShas: json('parent_shas').$type<string[]>().default([]).notNull(),
    stats: json('stats').$type<GitCommitStats>(),
    files: json('files').$type<GitFileChange[]>().default([]).notNull(),
    branchName: text('branch_name'),
  },
  (table) => ({
    repoShaIdx: unique('git_commits_repo_sha_unique').on(table.repositoryId, table.sha),
    branchIdx: index('git_commits_branch_idx').on(table.branchName),
  }),
)

// 类型定义
export interface GitRepoConfig {
  autoSync?: boolean
  syncInterval?: number
  protectedBranches?: string[]
  webhookEvents?: string[]
  cicd?: {
    enabled?: boolean
    provider?: string
    config?: Record<string, any>
  }
}

export interface GitCommit {
  sha: string
  message: string
  author: GitAuthor
  date: string
  url?: string
}

export interface GitAuthor {
  name: string
  email: string
  date?: string
  username?: string
}

export interface GitCommitStats {
  additions: number
  deletions: number
  total: number
}

export interface GitFileChange {
  filename: string
  status: 'added' | 'modified' | 'removed' | 'renamed'
  additions: number
  deletions: number
  changes: number
  patch?: string
}

// 导出类型
export type GitRepository = typeof gitRepositories.$inferSelect
export type NewGitRepository = typeof gitRepositories.$inferInsert
export type GitBranch = typeof gitBranches.$inferSelect
export type NewGitBranch = typeof gitBranches.$inferInsert
export type MergeRequest = typeof mergeRequests.$inferSelect
export type NewMergeRequest = typeof mergeRequests.$inferInsert
export type GitEvent = typeof gitEvents.$inferSelect
export type NewGitEvent = typeof gitEvents.$inferInsert
export type GitCommitRecord = typeof gitCommits.$inferSelect
export type NewGitCommitRecord = typeof gitCommits.$inferInsert
