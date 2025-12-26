import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'
import { projects } from '../project/projects.schema'

export const aiUsage = pgTable(
  'ai_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    projectId: uuid('project_id').references(() => projects.id),
    provider: text('provider').notNull(), // 'anthropic', 'openai', 'zhipu', 'qwen', 'ollama'
    model: text('model').notNull(),
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    totalTokens: integer('total_tokens').notNull(),
    cost: integer('cost').notNull(), // 以分为单位
    cached: boolean('cached').notNull().default(false),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
  },
  (table) => [
    index('ai_usage_user_idx').on(table.userId),
    index('ai_usage_project_idx').on(table.projectId),
    index('ai_usage_timestamp_idx').on(table.timestamp),
    index('ai_usage_provider_model_idx').on(table.provider, table.model),
  ],
)

export type AIUsage = typeof aiUsage.$inferSelect
export type NewAIUsage = typeof aiUsage.$inferInsert
