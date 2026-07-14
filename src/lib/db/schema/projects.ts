import { sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import {
  deliveryRuleKindEnum,
  deploymentStatusEnum,
  environmentDatabaseStrategyEnum,
  environmentDeliveryModeEnum,
  environmentDeploymentRuntimeEnum,
  environmentDeploymentStrategyEnum,
  environmentKindEnum,
  initStepStatusEnum,
  projectStatusEnum,
  promotionFlowStrategyEnum,
  serviceTypeEnum,
} from '@/lib/db/schema/enums';
import { repositories } from '@/lib/db/schema/identity';
import { teams } from '@/lib/db/schema/teams';

// ============================================
// Project Tables
// ============================================

export const projects = pgTable(
  'project',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('teamId')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    repositoryId: uuid('repositoryId').references(() => repositories.id),

    name: varchar('name', { length: 255 }).notNull(),
    slug: varchar('slug', { length: 255 }).notNull(),
    description: text('description'),

    framework: varchar('framework', { length: 100 }),
    productionBranch: varchar('productionBranch', { length: 100 }).default('main'),
    autoDeploy: boolean('autoDeploy').default(true),

    configJson: jsonb('configJson'),
    configUpdatedAt: timestamp('configUpdatedAt'),

    status: projectStatusEnum('status').default('initializing'),
    statusMessage: text('statusMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('project_teamId_idx').on(table.teamId),
    slugIdx: uniqueIndex('project_slug_idx').on(table.slug),
    statusIdx: index('project_status_idx').on(table.status),
  })
);

export const projectInitSteps = pgTable(
  'projectInitStep',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    step: varchar('step', { length: 100 }).notNull(),
    status: initStepStatusEnum('status').notNull().default('pending'),
    message: text('message'),
    progress: integer('progress').default(0),
    errorCode: varchar('errorCode', { length: 100 }),
    error: text('error'),

    startedAt: timestamp('startedAt'),
    completedAt: timestamp('completedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('projectInitStep_projectId_idx').on(table.projectId),
    projectStepUnique: unique('projectInitStep_project_step_unique').on(
      table.projectId,
      table.step
    ),
  })
);

// ============================================
// Service Tables
// ============================================

export const services = pgTable(
  'service',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 255 }).notNull(),
    type: serviceTypeEnum('type').notNull(),

    buildCommand: varchar('buildCommand', { length: 500 }),
    dockerfile: text('dockerfile'),
    dockerContext: varchar('dockerContext', { length: 255 }),

    startCommand: varchar('startCommand', { length: 500 }),
    port: integer('port'),
    replicas: integer('replicas').default(1),

    healthcheckPath: varchar('healthcheckPath', { length: 255 }),
    healthcheckInterval: integer('healthcheckInterval').default(30),

    cronSchedule: varchar('cronSchedule', { length: 100 }),

    cpuRequest: varchar('cpuRequest', { length: 50 }).default('100m'),
    cpuLimit: varchar('cpuLimit', { length: 50 }).default('500m'),
    memoryRequest: varchar('memoryRequest', { length: 50 }).default('256Mi'),
    memoryLimit: varchar('memoryLimit', { length: 50 }).default('512Mi'),

    autoscaling: jsonb('autoscaling'),

    isPublic: boolean('isPublic').default(true),
    internalDomain: varchar('internalDomain', { length: 255 }),

    status: varchar('status', { length: 50 }).default('pending'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('service_projectId_idx').on(table.projectId),
    projectNameUnique: unique('service_project_name_unique').on(table.projectId, table.name),
  })
);

// ============================================
// Environment Tables
// ============================================

export const environments = pgTable(
  'environment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),

    name: varchar('name', { length: 100 }).notNull(),
    kind: environmentKindEnum('kind').default('persistent').notNull(),
    deliveryMode: environmentDeliveryModeEnum('deliveryMode').default('direct').notNull(),
    branch: varchar('branch', { length: 100 }),
    tagPattern: varchar('tagPattern', { length: 100 }),
    isPreview: boolean('isPreview').default(false),
    previewPrNumber: integer('previewPrNumber'),
    expiresAt: timestamp('expiresAt'),
    baseEnvironmentId: uuid('baseEnvironmentId').references((): AnyPgColumn => environments.id, {
      onDelete: 'set null',
    }),
    previewBuildStatus: deploymentStatusEnum('previewBuildStatus'),
    previewBuildSourceRef: varchar('previewBuildSourceRef', { length: 255 }),
    previewBuildSourceCommitSha: varchar('previewBuildSourceCommitSha', { length: 100 }),
    previewBuildStartedAt: timestamp('previewBuildStartedAt'),
    databaseStrategy: environmentDatabaseStrategyEnum('databaseStrategy')
      .default('direct')
      .notNull(),

    autoDeploy: boolean('autoDeploy').default(true).notNull(),
    isProduction: boolean('isProduction').default(false).notNull(),
    deploymentStrategy: environmentDeploymentStrategyEnum('deploymentStrategy')
      .default('rolling')
      .notNull(),
    deploymentRuntime: environmentDeploymentRuntimeEnum('deploymentRuntime')
      .default('native_k8s')
      .notNull(),
    autoSleepEnabled: boolean('autoSleepEnabled').default(true).notNull(),
    idleSleepMinutes: integer('idleSleepMinutes'),
    lastRuntimeActivityAt: timestamp('lastRuntimeActivityAt').defaultNow().notNull(),
    lastRuntimeSleptAt: timestamp('lastRuntimeSleptAt'),

    namespace: varchar('namespace', { length: 100 }),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environment_projectId_idx').on(table.projectId),
    previewIdx: index('environment_preview_idx').on(table.projectId, table.isPreview),
    previewPrIdx: index('environment_preview_pr_idx').on(table.projectId, table.previewPrNumber),
    baseEnvironmentIdx: index('environment_base_env_idx').on(table.baseEnvironmentId),
    idleSleepIdx: index('environment_idle_sleep_idx').on(
      table.autoSleepEnabled,
      table.kind,
      table.lastRuntimeActivityAt
    ),
    projectNameUnique: unique('environment_project_name_unique').on(table.projectId, table.name),
    previewPrUnique: uniqueIndex('environment_project_preview_pr_unique')
      .on(table.projectId, table.previewPrNumber)
      .where(sql`${table.previewPrNumber} is not null`),
  })
);

export const deliveryRules = pgTable(
  'deliveryRule',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId').references(() => environments.id, {
      onDelete: 'cascade',
    }),
    kind: deliveryRuleKindEnum('kind').notNull(),
    pattern: varchar('pattern', { length: 255 }),
    isActive: boolean('isActive').default(true).notNull(),
    priority: integer('priority').default(100).notNull(),
    autoCreateEnvironment: boolean('autoCreateEnvironment').default(false).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('deliveryRule_projectId_idx').on(table.projectId),
    environmentIdIdx: index('deliveryRule_environmentId_idx').on(table.environmentId),
    kindPriorityIdx: index('deliveryRule_kind_priority_idx').on(
      table.projectId,
      table.kind,
      table.priority
    ),
  })
);

export const promotionFlows = pgTable(
  'promotionFlow',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceEnvironmentId: uuid('sourceEnvironmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    targetEnvironmentId: uuid('targetEnvironmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    requiresApproval: boolean('requiresApproval').default(true).notNull(),
    strategy: promotionFlowStrategyEnum('strategy').default('reuse_release_artifacts').notNull(),
    isActive: boolean('isActive').default(true).notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('promotionFlow_projectId_idx').on(table.projectId),
    sourceEnvironmentIdIdx: index('promotionFlow_sourceEnvironmentId_idx').on(
      table.sourceEnvironmentId
    ),
    targetEnvironmentIdIdx: index('promotionFlow_targetEnvironmentId_idx').on(
      table.targetEnvironmentId
    ),
    sourceTargetUnique: unique('promotionFlow_source_target_unique').on(
      table.projectId,
      table.sourceEnvironmentId,
      table.targetEnvironmentId
    ),
  })
);
