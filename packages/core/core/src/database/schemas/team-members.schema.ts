import { pgTable, uuid, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { teams } from './teams.schema';
import { users } from './users.schema';

export const teamMembers = pgTable('team_members', {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // 'owner', 'maintainer', 'member'
    joinedAt: timestamp('joined_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('team_members_unique').on(table.teamId, table.userId),
]);

export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
