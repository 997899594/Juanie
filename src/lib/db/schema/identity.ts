import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  gitProviderTypeEnum,
  integrationCapabilityEnum,
  platformRoleEnum,
} from '@/lib/db/schema/enums';

// ============================================
// Auth Tables (NextAuth)
// ============================================

export const users = pgTable('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  platformRole: platformRoleEnum('platformRole').notNull().default('user'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const accounts = pgTable(
  'account',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (table) => ({
    providerCredentialsAbsent: check(
      'account_provider_credentials_absent',
      sql`${table.access_token} is null and ${table.refresh_token} is null and ${table.id_token} is null`
    ),
  })
);

export const sessions = pgTable('session', {
  id: uuid('id').defaultRandom().primaryKey(),
  sessionToken: text('sessionToken').notNull().unique(),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verificationToken', {
  identifier: text('identifier').notNull(),
  token: text('token').notNull(),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const repositories = pgTable(
  'repository',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    providerId: uuid('providerId')
      .notNull()
      .references(() => integrationIdentities.id, { onDelete: 'cascade' }),

    externalId: varchar('externalId', { length: 255 }).notNull(),
    fullName: varchar('fullName', { length: 255 }).notNull(),
    name: varchar('name', { length: 255 }).notNull(),
    owner: varchar('owner', { length: 255 }).notNull(),

    cloneUrl: varchar('cloneUrl', { length: 500 }),
    sshUrl: varchar('sshUrl', { length: 500 }),
    webUrl: varchar('webUrl', { length: 500 }),

    defaultBranch: varchar('defaultBranch', { length: 100 }).default('main'),
    isPrivate: boolean('isPrivate').default(false),

    lastSyncAt: timestamp('lastSyncAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    providerIdIdx: index('repository_providerId_idx').on(table.providerId),
    fullNameIdx: index('repository_fullName_idx').on(table.fullName),
    providerExternalUnique: unique('repository_provider_external_unique').on(
      table.providerId,
      table.externalId
    ),
  })
);

export const integrationIdentities = pgTable(
  'integration_identity',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: gitProviderTypeEnum('provider').notNull(),
    externalUserId: varchar('externalUserId', { length: 255 }),
    username: varchar('username', { length: 255 }),
    serverUrl: varchar('serverUrl', { length: 500 }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('integration_identity_userId_idx').on(table.userId),
    providerIdx: index('integration_identity_provider_idx').on(table.provider),
  })
);

export const integrationGrants = pgTable(
  'integration_grant',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationIdentityId: uuid('integrationIdentityId')
      .notNull()
      .references(() => integrationIdentities.id, { onDelete: 'cascade' }),
    accessTokenEncrypted: text('accessTokenEncrypted'),
    accessTokenIv: varchar('accessTokenIv', { length: 64 }),
    accessTokenAuthTag: varchar('accessTokenAuthTag', { length: 64 }),
    refreshTokenEncrypted: text('refreshTokenEncrypted'),
    refreshTokenIv: varchar('refreshTokenIv', { length: 64 }),
    refreshTokenAuthTag: varchar('refreshTokenAuthTag', { length: 64 }),
    encryptionKeyVersion: integer('encryptionKeyVersion'),
    scopeRaw: text('scopeRaw'),
    expiresAt: timestamp('expiresAt'),
    revokedAt: timestamp('revokedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    identityIdIdx: index('integration_grant_identity_id_idx').on(table.integrationIdentityId),
    revokedAtIdx: index('integration_grant_revoked_at_idx').on(table.revokedAt),
  })
);

export const integrationCapabilitySnapshots = pgTable(
  'integration_capability_snapshot',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    integrationGrantId: uuid('integrationGrantId')
      .notNull()
      .references(() => integrationGrants.id, { onDelete: 'cascade' }),
    capability: integrationCapabilityEnum('capability').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    grantIdIdx: index('integration_capability_snapshot_grant_id_idx').on(table.integrationGrantId),
    capabilityIdx: index('integration_capability_snapshot_capability_idx').on(table.capability),
    grantCapabilityUnique: unique('integration_capability_snapshot_grant_capability_unique').on(
      table.integrationGrantId,
      table.capability
    ),
  })
);
