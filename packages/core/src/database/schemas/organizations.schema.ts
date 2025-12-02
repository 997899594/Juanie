import { boolean, index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from './users.schema'

export const organizations = pgTable(
  'organizations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name'),
    logoUrl: text('logo_url'),

    // 工作空间类型 (personal | team)
    type: text('type', { enum: ['personal', 'team'] })
      .$type<'personal' | 'team'>()
      .notNull()
      .default('team'),

    // 个人工作空间的所有者
    ownerId: uuid('owner_id').references(() => users.id),

    // 配额限制（JSONB）
    quotas: jsonb('quotas')
      .$type<{
        maxProjects: number
        maxUsers: number
        maxStorageGb: number
      }>()
      .default({ maxProjects: 10, maxUsers: 50, maxStorageGb: 100 }),

    // 计费信息（JSONB）
    billing: jsonb('billing').$type<{
      plan: 'free' | 'pro' | 'enterprise'
      billingEmail?: string
    }>(),

    // Git 平台同步信息 (团队工作空间)
    gitProvider: text('git_provider', { enum: ['github', 'gitlab'] }).$type<'github' | 'gitlab'>(),
    gitOrgId: text('git_org_id'),
    gitOrgName: text('git_org_name'),
    gitOrgUrl: text('git_org_url'),
    gitSyncEnabled: boolean('git_sync_enabled').default(false),
    gitLastSyncAt: timestamp('git_last_sync_at'),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('orgs_slug_idx').on(table.slug),
    index('orgs_deleted_idx').on(table.deletedAt),
    index('orgs_git_provider_idx').on(table.gitProvider),
  ],
)

export type Organization = typeof organizations.$inferSelect
export type NewOrganization = typeof organizations.$inferInsert

// Relations
import { relations } from 'drizzle-orm'
import { organizationMembers } from './organization-members.schema'

export const organizationsRelations = relations(organizations, ({ one, many }) => ({
  owner: one(users, {
    fields: [organizations.ownerId],
    references: [users.id],
  }),
  members: many(organizationMembers),
}))
