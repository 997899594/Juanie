import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { users } from './users.schema';

export const projectMembers = pgTable('project_members', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('developer'), // 'owner', 'maintainer', 'developer', 'viewer'
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('project_members_unique').on(table.projectId, table.userId),
]);

export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;
