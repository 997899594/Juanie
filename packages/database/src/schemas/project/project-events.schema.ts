import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'
import { projects } from '../project/projects.schema'

export const projectEvents = pgTable(
  'project_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    // 事件信息
    eventType: text('event_type').notNull(),
    // 'project.created', 'project.initialized', 'project.archived', 'project.deleted',
    // 'deployment.completed', 'gitops.sync.status', 'environment.updated', etc.

    eventData: jsonb('event_data'), // 事件数据

    // 元数据
    triggeredBy: uuid('triggered_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('project_events_project_idx').on(table.projectId),
    index('project_events_type_idx').on(table.eventType),
    index('project_events_created_idx').on(table.createdAt),
    index('project_events_triggered_by_idx').on(table.triggeredBy),
  ],
)

export type ProjectEvent = typeof projectEvents.$inferSelect
export type NewProjectEvent = typeof projectEvents.$inferInsert
