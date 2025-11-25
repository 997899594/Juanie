import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'

export const aiAssistants = pgTable(
  'ai_assistants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),

    name: text('name').notNull(),
    type: text('type').notNull(), // 'code-reviewer', 'devops-engineer', 'cost-optimizer'

    // 模型配置（JSONB）
    modelConfig: jsonb('model_config').$type<{
      provider: 'ollama' | 'openai' | 'anthropic' | 'google'
      model: string
      temperature: number
    }>(),

    systemPrompt: text('system_prompt').notNull(),

    // 统计
    usageCount: integer('usage_count').notNull().default(0),
    averageRating: integer('average_rating').default(0), // 0-5

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('ai_org_idx').on(table.organizationId), index('ai_type_idx').on(table.type)],
)

export type AiAssistant = typeof aiAssistants.$inferSelect
export type NewAiAssistant = typeof aiAssistants.$inferInsert
