import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'
import { users } from './users.schema'

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    projectId: uuid('project_id').references(() => projects.id),
    title: text('title'),
    messages: jsonb('messages')
      .$type<
        Array<{
          role: 'system' | 'user' | 'assistant' | 'function'
          content: string
          name?: string
          functionCall?: {
            name: string
            arguments: string
          }
        }>
      >()
      .notNull()
      .default([]),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('ai_conversations_user_idx').on(table.userId),
    index('ai_conversations_project_idx').on(table.projectId),
    index('ai_conversations_created_idx').on(table.createdAt),
  ],
)

export type AIConversation = typeof aiConversations.$inferSelect
export type NewAIConversation = typeof aiConversations.$inferInsert
