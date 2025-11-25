import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { teams } from './teams.schema';
import { projects } from './projects.schema';

export const teamProjects = pgTable('team_projects', {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('contributor'), // 'owner', 'maintainer', 'contributor'
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('team_projects_unique').on(table.teamId, table.projectId),
]);

export type TeamProject = typeof teamProjects.$inferSelect;
export type NewTeamProject = typeof teamProjects.$inferInsert;
