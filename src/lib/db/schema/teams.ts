import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  pgTable,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { integrationAuthModeEnum, teamRoleEnum } from '@/lib/db/schema/enums';
import { integrationIdentities, users } from '@/lib/db/schema/identity';

// ============================================
// Team Tables
// ============================================

export const teams = pgTable('team', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const teamMembers = pgTable(
  'teamMember',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('teamMember_teamId_idx').on(table.teamId),
    userIdIdx: index('teamMember_userId_idx').on(table.userId),
    teamUserUnique: unique('teamMember_team_user_unique').on(table.teamId, table.userId),
  })
);

export const teamInvitations = pgTable('teamInvitation', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('teamId')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }),
  role: teamRoleEnum('role').notNull().default('member'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const teamIntegrationBindings = pgTable(
  'teamIntegrationBinding',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    integrationIdentityId: uuid('integrationIdentityId')
      .notNull()
      .references(() => integrationIdentities.id, { onDelete: 'cascade' }),
    createdByUserId: uuid('createdByUserId').references(() => users.id, { onDelete: 'set null' }),
    authMode: integrationAuthModeEnum('authMode').notNull().default('personal'),
    label: varchar('label', { length: 255 }),
    isDefault: boolean('isDefault').notNull().default(false),
    revokedAt: timestamp('revokedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('teamIntegrationBinding_teamId_idx').on(table.teamId),
    identityIdIdx: index('teamIntegrationBinding_identityId_idx').on(table.integrationIdentityId),
    defaultIdx: index('teamIntegrationBinding_default_idx').on(table.teamId, table.isDefault),
    revokedAtIdx: index('teamIntegrationBinding_revokedAt_idx').on(table.revokedAt),
    activeIdentityUnique: uniqueIndex('teamIntegrationBinding_active_identity_unique')
      .on(table.teamId, table.integrationIdentityId)
      .where(sql`${table.revokedAt} is null`),
    activeDefaultUnique: uniqueIndex('teamIntegrationBinding_active_default_unique')
      .on(table.teamId)
      .where(sql`${table.revokedAt} is null and ${table.isDefault} = true`),
  })
);
