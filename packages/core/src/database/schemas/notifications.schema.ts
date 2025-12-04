import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),

    type: text('type').notNull(), // 'deployment_success', 'approval_request', 'cost_alert'
    title: text('title').notNull(),
    content: text('content').notNull(),

    // 关联资源
    resourceType: text('resource_type'),
    resourceId: uuid('resource_id'),

    // 状态
    status: text('status').notNull().default('unread'), // 'unread', 'read'
    readAt: timestamp('read_at'),

    priority: text('priority').notNull().default('normal'), // 'low', 'normal', 'high', 'urgent'
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('notifs_user_idx').on(table.userId),
    index('notifs_status_idx').on(table.status),
    index('notifs_created_idx').on(table.createdAt),
  ],
)

export type Notification = typeof notifications.$inferSelect
export type NewNotification = typeof notifications.$inferInsert
