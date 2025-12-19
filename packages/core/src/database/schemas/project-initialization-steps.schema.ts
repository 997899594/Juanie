import { index, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'

/**
 * 项目初始化步骤表
 * 记录项目初始化过程中每个步骤的详细状态
 */
export const projectInitializationSteps = pgTable(
  'project_initialization_steps',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // 步骤信息
    step: varchar('step', { length: 100 }).notNull(), // 步骤名称，如 'CREATING_PROJECT', 'LOADING_TEMPLATE'
    status: varchar('status', { length: 50 }).notNull().default('pending'), // 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
    progress: varchar('progress', { length: 10 }).default('0'), // 进度百分比，如 '0', '50', '100'

    // 错误信息
    error: text('error'), // 错误消息
    errorStack: text('error_stack'), // 错误堆栈

    // 时间戳
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    // 索引优化查询
    projectIdIdx: index('project_initialization_steps_project_id_idx').on(table.projectId),
    projectStepIdx: index('project_initialization_steps_project_step_idx').on(
      table.projectId,
      table.step,
    ),
    statusIdx: index('project_initialization_steps_status_idx').on(table.status),
  }),
)

// 类型导出
export type ProjectInitializationStep = typeof projectInitializationSteps.$inferSelect
export type NewProjectInitializationStep = typeof projectInitializationSteps.$inferInsert
