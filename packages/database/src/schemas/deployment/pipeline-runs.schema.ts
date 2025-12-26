import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { pipelines } from '../deployment/pipelines.schema'
import { projects } from '../project/projects.schema'

export const pipelineRuns = pgTable(
  'pipeline_runs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => pipelines.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id),

    // 触发信息
    trigger: text('trigger').notNull(), // 'push', 'pr', 'schedule', 'manual'
    commitHash: text('commit_hash').notNull(),
    branch: text('branch').notNull(),

    // 执行状态
    status: text('status').notNull().default('pending'), // 'pending', 'running', 'success', 'failed', 'cancelled'
    startedAt: timestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    duration: integer('duration'), // 秒

    // 日志
    logsUrl: text('logs_url'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('pipeline_runs_pipeline_idx').on(table.pipelineId),
    index('pipeline_runs_status_idx').on(table.status),
    index('pipeline_runs_created_idx').on(table.createdAt),
  ],
)

export type PipelineRun = typeof pipelineRuns.$inferSelect
export type NewPipelineRun = typeof pipelineRuns.$inferInsert
