import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'
import { projects } from './projects.schema'

export const securityPolicies = pgTable(
  'security_policies',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),

    name: text('name').notNull(),
    type: text('type').notNull(), // 'access-control', 'network', 'data-protection', 'compliance'
    status: text('status').notNull().default('active'), // 'active', 'inactive'

    // 规则定义（JSONB）
    rules: jsonb('rules').$type<{
      conditions: Array<{ field: string; operator: string; value: any }>
      actions: Array<{ type: 'block' | 'warn' | 'log'; message: string }>
    }>(),

    isEnforced: boolean('is_enforced').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('policies_org_idx').on(table.organizationId),
    index('policies_project_idx').on(table.projectId),
  ],
)

export type SecurityPolicy = typeof securityPolicies.$inferSelect
export type NewSecurityPolicy = typeof securityPolicies.$inferInsert
