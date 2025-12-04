import { pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { projects } from './projects.schema'
import { teams } from './teams.schema'

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
    role: text('role').notNull().default('contributor'), // 'owner', 'maintainer', 'contributor'
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_projects_unique').on(table.teamId, table.projectId)],
)

export type TeamProject = typeof teamProjects.$inferSelect
export type NewTeamProject = typeof teamProjects.$inferInsert
