import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'
import { users } from './users.schema'

export const projectMembers = pgTable(
  'project_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('developer'), // 'owner', 'maintainer', 'developer', 'viewer'
    joinedAt: timestamp('joined_at').notNull().defaultNow(),

    // Git 同步状态 (用于个人工作空间的项目级协作)
    gitSyncStatus: text('git_sync_status').default('pending'), // 'pending' | 'synced' | 'failed'
    gitSyncedAt: timestamp('git_synced_at'),
    gitSyncError: text('git_sync_error'),
  },
  (table) => [
    uniqueIndex('project_members_unique').on(table.projectId, table.userId),

    // 性能优化索引
    index('idx_project_members_user_id').on(table.userId),
    index('idx_project_members_project_user').on(table.projectId, table.userId),
    index('idx_project_members_role').on(table.role),

    // 原有索引
    index('project_members_git_sync_status_idx').on(table.gitSyncStatus),
  ],
)

export type ProjectMember = typeof projectMembers.$inferSelect
export type NewProjectMember = typeof projectMembers.$inferInsert

// Relations
import { relations } from 'drizzle-orm'

export const projectMembersRelations = relations(projectMembers, ({ one }) => ({
  project: one(projects, {
    fields: [projectMembers.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [projectMembers.userId],
    references: [users.id],
  }),
}))
