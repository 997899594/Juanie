import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { environments } from '../deployment/environments.schema'
import { projects } from '../project/projects.schema'
import { repositories } from '../repository/repositories.schema'

// ✅ 使用 Drizzle pgEnum 定义枚举类型
export const gitopsResourceTypeEnum = pgEnum('gitops_resource_type', [
  'kustomization',
  'helm',
  'git-repository', // Flux GitRepository 资源
  'helm-release', // Flux HelmRelease 资源
])
export const gitopsResourceStatusEnum = pgEnum('gitops_resource_status', [
  'pending',
  'ready',
  'reconciling',
  'failed',
])

export const gitopsResources = pgTable(
  'gitops_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id').references(() => environments.id, {
      onDelete: 'cascade',
    }), // ✅ 可选：GitRepository 不属于特定环境
    repositoryId: uuid('repository_id').references(() => repositories.id, { onDelete: 'cascade' }), // ✅ 可选：某些资源可能不关联仓库

    // 资源类型和标识
    type: gitopsResourceTypeEnum('type').notNull(),
    name: text('name').notNull(),
    namespace: text('namespace').notNull(),

    // 配置（JSONB 存储所有配置）
    config: jsonb('config').$type<{
      // Kustomization 配置
      path?: string
      prune?: boolean
      healthChecks?: Array<{
        apiVersion: string
        kind: string
        name: string
        namespace?: string
      }>
      dependsOn?: Array<{
        name: string
        namespace?: string
      }>
      interval?: string
      timeout?: string
      retryInterval?: string

      // Helm 配置
      chartName?: string
      chartVersion?: string
      sourceType?: 'GitRepository' | 'HelmRepository'
      values?: Record<string, any>
      valuesFrom?: Array<{
        kind: string
        name: string
        valuesKey?: string
      }>
      install?: {
        remediation?: { retries: number }
        createNamespace?: boolean
      }
      upgrade?: {
        remediation?: { retries: number; remediateLastFailure: boolean }
        cleanupOnFail?: boolean
      }
    }>(),

    // 状态
    status: gitopsResourceStatusEnum('status').notNull().default('pending'),
    statusReason: text('status_reason'), // 状态原因（简短描述）
    statusMessage: text('status_message'), // 详细状态消息
    lastAppliedRevision: text('last_applied_revision'),
    lastAttemptedRevision: text('last_attempted_revision'),
    errorMessage: text('error_message'),

    // 状态时间戳
    lastStatusUpdateAt: timestamp('last_status_update_at', { withTimezone: true }), // 最后状态更新时间
    lastAppliedAt: timestamp('last_applied_at', { withTimezone: true }), // 最后成功应用时间
    lastAttemptedAt: timestamp('last_attempted_at', { withTimezone: true }), // 最后尝试时间

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('gitops_resources_project_env_name_unique').on(
      table.projectId,
      table.environmentId,
      table.name,
    ),
    index('gitops_resources_project_idx').on(table.projectId),
    index('gitops_resources_env_idx').on(table.environmentId),
    index('gitops_resources_repo_idx').on(table.repositoryId),
    index('gitops_resources_status_idx').on(table.status),
    index('gitops_resources_deleted_idx').on(table.deletedAt),
  ],
)

export type GitOpsResource = typeof gitopsResources.$inferSelect
export type NewGitOpsResource = typeof gitopsResources.$inferInsert
