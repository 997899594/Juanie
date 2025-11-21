import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'

export const environments = pgTable(
  'environments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'development', 'staging', 'production', 'testing'
    description: text('description'), // 环境描述
    status: text('status').notNull().default('active'), // 'active', 'inactive', 'error'
    healthCheckUrl: text('health_check_url'), // 健康检查 URL

    // 环境配置（JSONB）
    config: jsonb('config')
      .$type<{
        cloudProvider?: 'aws' | 'gcp' | 'azure'
        region?: string
        approvalRequired: boolean
        minApprovals: number
        // GitOps 配置
        gitops?: {
          enabled: boolean
          autoSync: boolean // 是否自动同步
          gitBranch: string // 对应的 Git 分支
          gitPath: string // K8s 配置路径
          syncInterval: string
        }
      }>()
      .default({ approvalRequired: false, minApprovals: 1 }),

    // 环境权限（JSONB 数组）
    permissions: jsonb('permissions')
      .$type<
        Array<{
          subjectType: 'user' | 'team'
          subjectId: string
          permission: 'read' | 'deploy' | 'admin'
        }>
      >()
      .default([]),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('envs_project_name_unique').on(table.projectId, table.name),
    index('envs_type_idx').on(table.type),
    index('envs_deleted_idx').on(table.deletedAt),
  ],
)

export type Environment = typeof environments.$inferSelect
export type NewEnvironment = typeof environments.$inferInsert
