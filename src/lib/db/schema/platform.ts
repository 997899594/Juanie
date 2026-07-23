import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from '@/lib/db/schema/identity';
import { environments, projects, services } from '@/lib/db/schema/projects';
import { teams } from '@/lib/db/schema/teams';

// ============================================
// Domain Tables
// ============================================

export const domains = pgTable(
  'domain',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId').references(() => environments.id, {
      onDelete: 'set null',
    }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    hostname: varchar('hostname', { length: 255 }).notNull(),
    isCustom: boolean('isCustom').default(false),

    isVerified: boolean('isVerified').default(false),
    verificationCode: varchar('verificationCode', { length: 100 }),

    tlsEnabled: boolean('tlsEnabled').default(true),
    tlsCertArn: varchar('tlsCertArn', { length: 255 }),

    lbIpAddress: varchar('lbIpAddress', { length: 50 }),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('domain_projectId_idx').on(table.projectId),
    hostnameIdx: uniqueIndex('domain_hostname_idx').on(table.hostname),
  })
);

// ============================================
// Environment Variables
// ============================================

export const environmentVariables = pgTable(
  'environmentVariable',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId').references(() => environments.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'cascade' }),

    key: varchar('key', { length: 255 }).notNull(),
    value: text('value'), // 普通变量明文存储；isSecret=true 时为 null
    isSecret: boolean('isSecret').default(false),

    // 注入类型：build-time（构建时注入）或 runtime（运行时注入）
    injectionType: varchar('injectionType', { length: 20 }).default('runtime'),

    // AES-256-GCM 加密字段（isSecret=true 时使用）
    encryptedValue: text('encryptedValue'), // 加密后的值（hex）
    iv: varchar('iv', { length: 64 }), // 初始化向量（hex，12字节→24字符）
    authTag: varchar('authTag', { length: 64 }), // GCM 认证标签（hex，16字节→32字符）
    encryptionKeyVersion: integer('encryptionKeyVersion'),

    referenceType: varchar('referenceType', { length: 50 }),
    referenceId: uuid('referenceId'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environmentVariable_projectId_idx').on(table.projectId),
    secretEnvelopeRequired: check(
      'environmentVariable_secret_envelope_required',
      sql`${table.isSecret} is not true or (${table.value} is null and ${table.encryptedValue} is not null and ${table.iv} is not null and ${table.authTag} is not null)`
    ),
  })
);

// ============================================
// Project Templates
// ============================================

export const projectTemplates = pgTable('projectTemplate', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  displayName: varchar('displayName', { length: 255 }).notNull(),
  description: text('description'),

  framework: varchar('framework', { length: 100 }),
  language: varchar('language', { length: 50 }),

  dockerfile: text('dockerfile').notNull(),
  configYaml: text('configYaml').notNull(),
  files: jsonb('files'),

  isOfficial: boolean('isOfficial').default(true),
  sortOrder: integer('sortOrder').default(0),

  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

// ============================================
// Audit Logs
// ============================================

export const auditLogs = pgTable(
  'auditLog',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('userId').references(() => users.id, { onDelete: 'set null' }),

    action: varchar('action', { length: 100 }).notNull(),
    resourceType: varchar('resourceType', { length: 100 }).notNull(),
    resourceId: uuid('resourceId'),

    metadata: jsonb('metadata'),
    ipAddress: varchar('ipAddress', { length: 50 }),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('auditLog_teamId_idx').on(table.teamId),
    createdAtIdx: index('auditLog_createdAt_idx').on(table.createdAt),
  })
);
