import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { gitConnections } from './git-connections.schema'
import { projects } from './projects.schema'
import { users } from './users.schema'

/**
 * 项目 Git 认证配置
 *
 * 支持多种认证方式：
 * 1. oauth: 使用用户的 OAuth token（默认，适合个人和小团队）
 * 2. project_token: 使用项目级别的 token（适合企业）
 * 3. service_account: 使用服务账户（未来支持）
 *
 * 设计原则：
 * - 向后兼容：默认使用 OAuth
 * - 灵活扩展：支持多种认证方式
 * - 安全优先：敏感信息加密存储
 */
export const projectGitAuth = pgTable('project_git_auth', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // 认证类型
  authType: text('auth_type').notNull().default('oauth'), // 'oauth' | 'project_token' | 'pat' | 'github_app' | 'gitlab_group_token'

  // OAuth 方式（关联到 gitConnections）
  // 优势：简单、快速、用户体验好
  // 劣势：绑定到个人账户、权限范围大
  oauthAccountId: uuid('oauth_account_id').references(() => gitConnections.id, {
    onDelete: 'set null',
  }),

  // Project Token 方式（用户提供的 Fine-grained PAT 或 Project Token）
  // 优势：权限细粒度、独立管理
  // 劣势：配置复杂、用户体验较差
  projectToken: text('project_token'), // 加密存储
  tokenScopes: jsonb('token_scopes').$type<string[]>(),
  tokenExpiresAt: timestamp('token_expires_at'),

  // PAT 方式（Personal Access Token）
  patToken: text('pat_token'), // 加密存储
  patProvider: text('pat_provider'), // 'github' | 'gitlab'
  patScopes: jsonb('pat_scopes').$type<string[]>(),
  patExpiresAt: timestamp('pat_expires_at'),

  // GitHub App 方式
  githubAppId: text('github_app_id'),
  githubInstallationId: text('github_installation_id'),
  githubPrivateKey: text('github_private_key'), // 加密存储

  // GitLab Group Token 方式
  gitlabGroupId: text('gitlab_group_id'),
  gitlabGroupToken: text('gitlab_group_token'), // 加密存储
  gitlabGroupScopes: jsonb('gitlab_group_scopes').$type<string[]>(),

  // Service Account 方式（未来支持）
  // 优势：企业级、审计友好、不依赖个人账户
  // 劣势：实现复杂
  serviceAccountId: uuid('service_account_id'),
  serviceAccountConfig: jsonb('service_account_config').$type<{
    // GitHub App
    githubApp?: {
      appId: string
      installationId: string
      privateKey: string // 加密存储
    }
    // GitLab Group Token
    gitlabGroup?: {
      groupId: string
      accessToken: string // 加密存储
    }
  }>(),

  // 元数据
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),

  // 健康状态
  lastValidatedAt: timestamp('last_validated_at'),
  validationStatus: text('validation_status').default('unknown'), // 'valid' | 'invalid' | 'expired' | 'unknown'
  validationError: text('validation_error'),
  healthCheckFailures: text('health_check_failures').default('0'),
})

export type ProjectGitAuth = typeof projectGitAuth.$inferSelect
export type NewProjectGitAuth = typeof projectGitAuth.$inferInsert
