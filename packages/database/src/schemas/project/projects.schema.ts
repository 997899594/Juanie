import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core'
import { organizations } from '../organization/organizations.schema'
import { projectTemplates } from '../project/project-templates.schema'
export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'), // 项目 Logo URL
    visibility: text('visibility').notNull().default('private'), // 'public', 'private', 'internal'

    // 项目状态：'initializing', 'active', 'inactive', 'archived', 'failed'
    status: text('status').notNull().default('active'),

    // 初始化状态（简化版）
    initializationJobId: varchar('initialization_job_id', { length: 255 }), // BullMQ 任务 ID
    initializationStartedAt: timestamp('initialization_started_at', { withTimezone: true }),
    initializationCompletedAt: timestamp('initialization_completed_at', { withTimezone: true }),
    initializationError: text('initialization_error'), // 初始化失败的错误信息

    // 模板信息
    templateId: uuid('template_id').references(() => projectTemplates.id, { onDelete: 'set null' }), // 使用的模板 ID
    templateConfig: jsonb('template_config'), // 模板配置

    // 健康度信息
    healthScore: integer('health_score'), // 0-100
    healthStatus: text('health_status'), // 'healthy', 'warning', 'critical'
    lastHealthCheck: timestamp('last_health_check'),

    // 注意：Git 仓库信息已移至 repositories 表，通过关联查询获取

    // 项目配置（JSONB）
    config: jsonb('config')
      .$type<{
        defaultBranch: string
        enableCiCd: boolean
        enableAi: boolean
        // 资源配额
        quota?: {
          maxEnvironments: number
          maxRepositories: number
          maxPods: number
          maxCpu: string
          maxMemory: string
        }
      }>()
      .default({ defaultBranch: 'main', enableCiCd: true, enableAi: true }),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    // 部分唯一索引：只对未删除的项目生效
    uniqueIndex('projects_org_slug_unique')
      .on(table.organizationId, table.slug)
      .where(sql`deleted_at IS NULL`),

    // 性能优化索引
    index('idx_projects_organization_id')
      .on(table.organizationId)
      .where(sql`deleted_at IS NULL`),
    index('idx_projects_status').on(table.status).where(sql`deleted_at IS NULL`),
    index('idx_projects_org_status')
      .on(table.organizationId, table.status)
      .where(sql`deleted_at IS NULL`),

    // 原有索引
    index('projects_deleted_idx').on(table.deletedAt),
    index('projects_template_idx').on(table.templateId),
    index('projects_health_status_idx').on(table.healthStatus),
  ],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
