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
import { projects } from '../project/projects.schema'

// ✅ 使用 Drizzle pgEnum 定义枚举类型
export const environmentTypeEnum = pgEnum('environment_type', [
  'development',
  'staging',
  'production',
  'testing',
])
export const environmentStatusEnum = pgEnum('environment_status', ['active', 'inactive', 'error'])

export const environments = pgTable(
  'environments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: environmentTypeEnum('type').notNull(),
    description: text('description'), // 环境描述
    status: environmentStatusEnum('status').notNull().default('active'),
    healthCheckUrl: text('health_check_url'), // 健康检查 URL

    // 注意：GitOps 配置通过 gitops_resources 表的 environmentId 外键关联
    // 不需要在这里添加 gitopsResourceId，避免循环依赖

    // 环境配置（JSONB）- 包含 GitOps 配置
    config: jsonb('config')
      .$type<{
        cloudProvider?: 'aws' | 'gcp' | 'azure'
        region?: string
        approvalRequired: boolean
        minApprovals: number
        gitops?: {
          enabled: boolean
          autoSync: boolean
          gitBranch: string
          gitPath: string
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
