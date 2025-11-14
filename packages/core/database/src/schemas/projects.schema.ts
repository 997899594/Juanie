import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'
import { projectTemplates } from './project-templates.schema'

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

    // 初始化状态
    initializationStatus: jsonb('initialization_status').$type<{
      step: string // 当前步骤
      progress: number // 0-100
      error?: string // 错误信息
      completedSteps: string[] // 已完成的步骤
    }>(),

    // 模板信息
    templateId: uuid('template_id').references(() => projectTemplates.id, { onDelete: 'set null' }), // 使用的模板 ID
    templateConfig: jsonb('template_config'), // 模板配置

    // 健康度信息
    healthScore: integer('health_score'), // 0-100
    healthStatus: text('health_status'), // 'healthy', 'warning', 'critical'
    lastHealthCheck: timestamp('last_health_check'),

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
    uniqueIndex('projects_org_slug_unique').on(table.organizationId, table.slug),
    index('projects_status_idx').on(table.status),
    index('projects_deleted_idx').on(table.deletedAt),
    index('projects_template_idx').on(table.templateId),
    index('projects_health_status_idx').on(table.healthStatus),
  ],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
