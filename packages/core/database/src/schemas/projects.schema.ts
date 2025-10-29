import { index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { organizations } from './organizations.schema'

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    description: text('description'),
    logoUrl: text('logo_url'), // 项目 Logo URL
    visibility: text('visibility').notNull().default('private'), // 'public', 'private', 'internal'
    status: text('status').notNull().default('active'), // 'active', 'inactive', 'archived'

    // 项目配置（JSONB）
    config: jsonb('config')
      .$type<{
        defaultBranch: string
        enableCiCd: boolean
        enableAi: boolean
      }>()
      .default({ defaultBranch: 'main', enableCiCd: true, enableAi: true }),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('projects_org_slug_unique').on(table.organizationId, table.slug),
    index('projects_status_idx').on(table.status),
    index('projects_deleted_idx').on(table.deletedAt),
  ],
)

export type Project = typeof projects.$inferSelect
export type NewProject = typeof projects.$inferInsert
