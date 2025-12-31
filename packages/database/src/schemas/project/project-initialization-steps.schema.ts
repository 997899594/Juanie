import { index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'

/**
 * 项目初始化步骤表
 *
 * 用途：追踪项目初始化过程中每个步骤的详细状态
 *
 * 设计原则：
 * 1. 每个步骤一条记录（主步骤 + 子步骤）
 * 2. 支持子步骤（通过 parent_step 字段）
 * 3. 记录详细的时间和错误信息
 * 4. 用于刷新页面后恢复进度显示
 * 5. 用于审计和性能分析
 *
 * 与 projects 表的关系：
 * - projects.status: 项目整体状态（聚合）
 * - projects.initializationError: 总体错误信息（快速查询）
 * - steps.status: 每个步骤的详细状态
 * - steps.error: 每个步骤的具体错误
 */
export const projectInitializationSteps = pgTable(
  'project_initialization_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // 步骤信息
    step: text('step').notNull(), // 步骤标识符：resolve_credentials, create_repository, render_template
    parentStep: text('parent_step'), // 父步骤（用于子步骤）：push_template -> render_template
    displayName: text('display_name').notNull(), // 显示名称：解析凭证、创建仓库、渲染模板
    sequence: integer('sequence').notNull(), // 执行顺序：1, 2, 3...（用于排序）

    // 状态信息
    status: text('status').notNull().default('pending'), // pending, running, completed, failed, skipped
    progress: integer('progress').notNull().default(0), // 步骤进度百分比：0-100

    // 时间信息（用于性能分析）
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    duration: integer('duration'), // 耗时（毫秒）

    // 错误信息（步骤级别）
    error: text('error'), // 错误消息（用户可见）
    errorStack: text('error_stack'), // 错误堆栈（开发调试）

    // 元数据（JSONB，灵活存储）
    metadata: jsonb('metadata').$type<{
      filesCount?: number // 推送的文件数量
      repositoryUrl?: string // 创建的仓库 URL
      templateName?: string // 使用的模板名称
      [key: string]: any // 其他自定义数据
    }>(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    // 性能优化索引
    index('project_initialization_steps_project_id_idx').on(table.projectId),
    index('project_initialization_steps_project_step_idx').on(table.projectId, table.step),
    index('project_initialization_steps_status_idx').on(table.status),
    index('project_initialization_steps_sequence_idx').on(table.projectId, table.sequence),
  ],
)

export type ProjectInitializationStep = typeof projectInitializationSteps.$inferSelect
export type NewProjectInitializationStep = typeof projectInitializationSteps.$inferInsert
