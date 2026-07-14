import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { releases } from '@/lib/db/schema/delivery';
import {
  aiPlanEnum,
  aiPluginRunStatusEnum,
  aiTaskKindEnum,
  aiTaskStatusEnum,
} from '@/lib/db/schema/enums';
import { users } from '@/lib/db/schema/identity';
import { environments, projects } from '@/lib/db/schema/projects';
import { teams } from '@/lib/db/schema/teams';

// ============================================
// AI Plugin Platform
// ============================================

export const aiPluginInstallations = pgTable(
  'aiPluginInstallation',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    pluginId: varchar('pluginId', { length: 100 }).notNull(),
    isEnabled: boolean('isEnabled').notNull().default(true),
    installedByUserId: uuid('installedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    config: jsonb('config'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('aiPluginInstallation_teamId_idx').on(table.teamId),
    pluginIdIdx: index('aiPluginInstallation_pluginId_idx').on(table.pluginId),
    teamPluginUnique: unique('aiPluginInstallation_team_plugin_unique').on(
      table.teamId,
      table.pluginId
    ),
  })
);

export const aiEntitlements = pgTable(
  'aiEntitlement',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    pluginId: varchar('pluginId', { length: 100 }).notNull().default('*'),
    plan: aiPlanEnum('plan').notNull().default('free'),
    isEnabled: boolean('isEnabled').notNull().default(true),
    startsAt: timestamp('startsAt'),
    endsAt: timestamp('endsAt'),
    metadata: jsonb('metadata'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('aiEntitlement_teamId_idx').on(table.teamId),
    pluginIdIdx: index('aiEntitlement_pluginId_idx').on(table.pluginId),
    planIdx: index('aiEntitlement_plan_idx').on(table.plan),
    teamPluginUnique: unique('aiEntitlement_team_plugin_unique').on(table.teamId, table.pluginId),
  })
);

export const aiTokenBudgets = pgTable(
  'aiTokenBudget',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    periodStart: timestamp('periodStart').notNull(),
    limitTokens: integer('limitTokens').notNull(),
    consumedTokens: integer('consumedTokens').notNull().default(0),
    reservedTokens: integer('reservedTokens').notNull().default(0),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamPeriodUnique: unique('aiTokenBudget_team_period_unique').on(
      table.teamId,
      table.periodStart
    ),
  })
);

export const aiTokenReservations = pgTable(
  'aiTokenReservation',
  {
    id: uuid('id').primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    periodStart: timestamp('periodStart').notNull(),
    reservedTokens: integer('reservedTokens').notNull(),
    consumedTokens: integer('consumedTokens'),
    status: varchar('status', { length: 20 }).notNull().default('pending'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    settledAt: timestamp('settledAt'),
  },
  (table) => ({
    teamPeriodIdx: index('aiTokenReservation_team_period_idx').on(table.teamId, table.periodStart),
  })
);

export const aiPluginSnapshots = pgTable(
  'aiPluginSnapshot',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pluginId: varchar('pluginId', { length: 100 }).notNull(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId').references(() => projects.id, { onDelete: 'set null' }),
    environmentId: uuid('environmentId').references(() => environments.id, {
      onDelete: 'set null',
    }),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    resourceType: varchar('resourceType', { length: 50 }).notNull(),
    resourceId: uuid('resourceId').notNull(),
    schemaVersion: varchar('schemaVersion', { length: 100 }).notNull(),
    inputHash: varchar('inputHash', { length: 64 }).notNull(),
    provider: varchar('provider', { length: 100 }),
    model: varchar('model', { length: 255 }),
    degradedReason: varchar('degradedReason', { length: 100 }),
    output: jsonb('output').notNull(),
    generatedAt: timestamp('generatedAt').defaultNow().notNull(),
    lastAccessedAt: timestamp('lastAccessedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('aiPluginSnapshot_teamId_idx').on(table.teamId),
    projectIdIdx: index('aiPluginSnapshot_projectId_idx').on(table.projectId),
    releaseIdIdx: index('aiPluginSnapshot_releaseId_idx').on(table.releaseId),
    resourceLookupIdx: index('aiPluginSnapshot_resource_lookup_idx').on(
      table.pluginId,
      table.resourceType,
      table.resourceId,
      table.generatedAt
    ),
    schemaInputUnique: unique('aiPluginSnapshot_schema_input_unique').on(
      table.pluginId,
      table.resourceType,
      table.resourceId,
      table.schemaVersion,
      table.inputHash
    ),
  })
);

export const aiPluginRuns = pgTable(
  'aiPluginRun',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pluginId: varchar('pluginId', { length: 100 }).notNull(),
    skillId: varchar('skillId', { length: 100 }),
    actorUserId: uuid('actorUserId').references(() => users.id, { onDelete: 'set null' }),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId').references(() => projects.id, { onDelete: 'set null' }),
    environmentId: uuid('environmentId').references(() => environments.id, {
      onDelete: 'set null',
    }),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    resourceType: varchar('resourceType', { length: 50 }).notNull(),
    resourceId: uuid('resourceId').notNull(),
    provider: varchar('provider', { length: 100 }),
    model: varchar('model', { length: 255 }),
    promptKey: varchar('promptKey', { length: 100 }),
    promptVersion: varchar('promptVersion', { length: 50 }),
    outputSchema: varchar('outputSchema', { length: 100 }),
    toolCalls: jsonb('toolCalls')
      .$type<
        Array<{
          toolId: string;
          scope: string;
          riskLevel: string;
          reason: string | null;
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    inputTokens: integer('inputTokens'),
    outputTokens: integer('outputTokens'),
    totalTokens: integer('totalTokens'),
    inputHash: varchar('inputHash', { length: 64 }),
    status: aiPluginRunStatusEnum('status').notNull().default('succeeded'),
    latencyMs: integer('latencyMs'),
    degradedReason: varchar('degradedReason', { length: 100 }),
    errorMessage: text('errorMessage'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('aiPluginRun_teamId_idx').on(table.teamId),
    projectIdIdx: index('aiPluginRun_projectId_idx').on(table.projectId),
    releaseIdIdx: index('aiPluginRun_releaseId_idx').on(table.releaseId),
    pluginIdIdx: index('aiPluginRun_pluginId_idx').on(table.pluginId),
    createdAtIdx: index('aiPluginRun_createdAt_idx').on(table.createdAt),
  })
);

export const aiTasks = pgTable(
  'aiTask',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    kind: aiTaskKindEnum('kind').notNull(),
    status: aiTaskStatusEnum('status').notNull().default('queued'),
    title: varchar('title', { length: 255 }).notNull(),
    actorUserId: uuid('actorUserId').references(() => users.id, { onDelete: 'set null' }),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId').references(() => projects.id, { onDelete: 'set null' }),
    environmentId: uuid('environmentId').references(() => environments.id, {
      onDelete: 'set null',
    }),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    inputSummary: text('inputSummary').notNull(),
    resultSummary: text('resultSummary'),
    provider: varchar('provider', { length: 100 }),
    model: varchar('model', { length: 255 }),
    inputTokens: integer('inputTokens'),
    outputTokens: integer('outputTokens'),
    totalTokens: integer('totalTokens'),
    errorMessage: text('errorMessage'),
    dispatchAttemptCount: integer('dispatchAttemptCount').notNull().default(0),
    lastDispatchedAt: timestamp('lastDispatchedAt'),
    leaseToken: uuid('leaseToken'),
    leaseExpiresAt: timestamp('leaseExpiresAt'),
    heartbeatAt: timestamp('heartbeatAt'),
    startedAt: timestamp('startedAt'),
    completedAt: timestamp('completedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('aiTask_teamId_idx').on(table.teamId),
    projectIdIdx: index('aiTask_projectId_idx').on(table.projectId),
    environmentIdIdx: index('aiTask_environmentId_idx').on(table.environmentId),
    releaseIdIdx: index('aiTask_releaseId_idx').on(table.releaseId),
    createdAtIdx: index('aiTask_createdAt_idx').on(table.createdAt),
    kindStatusIdx: index('aiTask_kind_status_idx').on(table.kind, table.status),
    recoveryIdx: index('aiTask_recovery_idx').on(
      table.status,
      table.leaseExpiresAt,
      table.createdAt
    ),
  })
);
