import { boolean, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { projects } from '../project/projects.schema'

export const pipelines = pgTable(
  'pipelines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),

    // Pipeline 配置（JSONB）
    config: jsonb('config').$type<{
      triggers: {
        onPush: boolean
        onPr: boolean
        onSchedule: boolean
        schedule?: string
      }
      stages: Array<{
        name: string
        type: 'build' | 'test' | 'deploy'
        command: string
        timeout: number
      }>
    }>(),

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('pipelines_project_name_unique').on(table.projectId, table.name)],
)

export type Pipeline = typeof pipelines.$inferSelect
export type NewPipeline = typeof pipelines.$inferInsert
