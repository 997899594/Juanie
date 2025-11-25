import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'

/**
 * Git 凭证表
 * 存储长期有效的 Git 访问凭证
 */
export const gitCredentials = pgTable('git_credentials', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // 凭证类型
  type: text('type').notNull(), // 'gitlab_project_token', 'gitlab_deploy_token', 'github_deploy_key'

  // GitLab Project Access Token
  gitlabTokenId: text('gitlab_token_id'), // GitLab token ID（用于撤销）
  gitlabProjectId: text('gitlab_project_id'), // GitLab 项目 ID

  // GitHub Deploy Key
  githubKeyId: text('github_key_id'), // GitHub key ID（用于撤销）
  githubRepoFullName: text('github_repo_full_name'), // owner/repo

  // 通用字段
  token: text('token').notNull(), // 加密存储的 token 或私钥
  scopes: jsonb('scopes').$type<string[]>(), // 权限范围
  expiresAt: timestamp('expires_at'), // null = 永不过期
  revokedAt: timestamp('revoked_at'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export type GitCredential = typeof gitCredentials.$inferSelect
export type NewGitCredential = typeof gitCredentials.$inferInsert
