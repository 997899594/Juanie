import { boolean, index, integer, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'

export const promptTemplates = pgTable(
  'prompt_templates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    name: text('name').notNull(),
    category: text('category').notNull(), // 'code-review', 'config-gen', 'troubleshooting', 'general'
    template: text('template').notNull(),
    variables: jsonb('variables').$type<string[]>().notNull().default([]),
    usageCount: integer('usage_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('prompt_templates_org_idx').on(table.organizationId),
    index('prompt_templates_category_idx').on(table.category),
    index('prompt_templates_usage_idx').on(table.usageCount),
  ],
)

export type PromptTemplate = typeof promptTemplates.$inferSelect
export type NewPromptTemplate = typeof promptTemplates.$inferInsert
