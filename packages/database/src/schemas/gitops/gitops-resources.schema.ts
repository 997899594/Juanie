import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { environments } from '../deployment/environments.schema'
import { projects } from '../project/projects.schema'
import { repositories } from '../repository/repositories.schema'

export const gitopsResources = pgTable(
  'gitops_resources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repository_id')
      .notNull()
      .references(() => repositories.id, { onDelete: 'cascade' }),

    // 资源类型和标识
    type: text('type').notNull(), // 'kustomization' | 'helm'
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
    status: text('status').notNull().default('pending'), // 'pending', 'ready', 'reconciling', 'failed'
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
