import { jsonb, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'

export const repositories = pgTable(
  'repositories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'github', 'gitlab'
    fullName: text('full_name').notNull(), // 'owner/repo'
    cloneUrl: text('clone_url').notNull(),
    defaultBranch: text('default_branch').default('main'),

    // 同步状态
    lastSyncAt: timestamp('last_sync_at'),
    status: text('status').default('pending'), // 'pending', 'syncing', 'success', 'failed'

    // GitOps 配置（JSONB）
    // 注意：Flux 运行时状态已移至 gitops_resources 表
    gitopsConfig: jsonb('gitops_config').$type<{
      enabled: boolean
      fluxNamespace: string
      fluxResourceName: string
      syncInterval: string // '1m', '5m'
      secretRef?: string // K8s Secret 名称
      timeout?: string
    }>(),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('repos_project_fullname_unique').on(table.projectId, table.fullName)],
)

export type Repository = typeof repositories.$inferSelect
export type NewRepository = typeof repositories.$inferInsert
