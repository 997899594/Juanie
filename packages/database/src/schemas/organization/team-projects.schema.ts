import { pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { teams } from '../organization/teams.schema'
import { projects } from '../project/projects.schema'

export const teamProjects = pgTable(
  'team_projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    // ✅ 删除 role 字段 - 权限通过团队成员角色计算
    // team owner/maintainer → project maintainer
    // team member → project developer
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_projects_unique').on(table.teamId, table.projectId)],
)

export type TeamProject = typeof teamProjects.$inferSelect
export type NewTeamProject = typeof teamProjects.$inferInsert
