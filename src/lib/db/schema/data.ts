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
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { DatabaseCapability } from '@/lib/databases/capabilities';
import { deployments, releases } from '@/lib/db/schema/delivery';
import type { MigrationSpecificationSnapshot } from '@/lib/db/schema/enums';
import {
  atlasExecutionStatusEnum,
  databasePlanEnum,
  databaseRoleEnum,
  databaseRuntimeEnum,
  databaseScopeEnum,
  databaseTypeEnum,
  environmentSchemaStateStatusEnum,
  migrationApprovalPolicyEnum,
  migrationCompatibilityEnum,
  migrationExecutionModeEnum,
  migrationLockStrategyEnum,
  migrationPhaseEnum,
  migrationReleaseStageEnum,
  migrationRunnerTypeEnum,
  migrationRunStatusEnum,
  migrationToolEnum,
  releaseMigrationPlanStatusEnum,
  schemaRepairPlanKindEnum,
  schemaRepairPlanStatusEnum,
  schemaRepairReviewStateEnum,
} from '@/lib/db/schema/enums';
import { users } from '@/lib/db/schema/identity';
import { environments, projects, services } from '@/lib/db/schema/projects';
import type { MigrationFilePreviewSnapshot } from '@/lib/migrations/file-preview-types';
import type { ReleaseMigrationPlanSnapshot } from '@/lib/migrations/release-plan-types';

// ============================================
// Database Tables (Managed Databases)
// ============================================

export const databases = pgTable(
  'database',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId').references(() => environments.id, {
      onDelete: 'set null',
    }),
    sourceDatabaseId: uuid('sourceDatabaseId').references((): AnyPgColumn => databases.id, {
      onDelete: 'set null',
    }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    name: varchar('name', { length: 255 }).notNull(),
    type: databaseTypeEnum('type').notNull(),
    plan: databasePlanEnum('plan').notNull().default('starter'),
    provisionType: varchar('provisionType', { length: 20 }).notNull().default('shared'),
    runtime: databaseRuntimeEnum('runtime'),
    scope: databaseScopeEnum('scope').notNull().default('project'),
    role: databaseRoleEnum('role').notNull().default('primary'),
    capabilities: jsonb('capabilities')
      .$type<DatabaseCapability[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),

    connectionString: text('connectionString'),
    host: varchar('host', { length: 255 }),
    port: integer('port'),
    databaseName: varchar('databaseName', { length: 255 }),
    username: varchar('username', { length: 255 }),
    password: varchar('password', { length: 255 }),

    namespace: varchar('namespace', { length: 100 }),
    serviceName: varchar('serviceName', { length: 255 }),

    status: varchar('status', { length: 50 }).default('pending'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('database_projectId_idx').on(table.projectId),
    environmentIdIdx: index('database_environmentId_idx').on(table.environmentId),
    sourceDatabaseIdIdx: index('database_sourceDatabaseId_idx').on(table.sourceDatabaseId),
    environmentSourceUnique: unique('database_environment_source_unique').on(
      table.environmentId,
      table.sourceDatabaseId
    ),
  })
);

export const migrationSpecifications = pgTable(
  'migrationSpecification',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),

    source: migrationToolEnum('source').notNull().default('custom'),
    tool: migrationToolEnum('tool').notNull(),
    phase: migrationPhaseEnum('phase').notNull().default('preDeploy'),
    executionMode: migrationExecutionModeEnum('executionMode').notNull(),
    releaseStage: migrationReleaseStageEnum('releaseStage').notNull().default('standard'),
    stageOrder: integer('stageOrder').notNull().default(0),
    targetVersion: varchar('targetVersion', { length: 100 }),
    baselineVersion: varchar('baselineVersion', { length: 100 }),

    sourceConfigPath: varchar('sourceConfigPath', { length: 500 }),
    migrationPath: varchar('migrationPath', { length: 500 }),
    command: text('command').notNull(),
    lockStrategy: migrationLockStrategyEnum('lockStrategy').notNull().default('platform'),
    compatibility: migrationCompatibilityEnum('compatibility')
      .notNull()
      .default('backward_compatible'),
    approvalPolicy: migrationApprovalPolicyEnum('approvalPolicy').notNull().default('auto'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('migrationSpecification_projectId_idx').on(table.projectId),
    serviceIdIdx: index('migrationSpecification_serviceId_idx').on(table.serviceId),
    environmentIdIdx: index('migrationSpecification_environmentId_idx').on(table.environmentId),
    databaseIdIdx: index('migrationSpecification_databaseId_idx').on(table.databaseId),
    uniqueBindingStage: unique('migrationSpecification_service_env_db_stage_unique').on(
      table.serviceId,
      table.environmentId,
      table.databaseId,
      table.releaseStage
    ),
  })
);

export const releaseMigrationPlans = pgTable(
  'releaseMigrationPlan',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    releaseId: uuid('releaseId')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }).notNull(),
    digest: varchar('digest', { length: 64 }).notNull(),
    snapshot: jsonb('snapshot').$type<ReleaseMigrationPlanSnapshot>().notNull(),
    status: releaseMigrationPlanStatusEnum('status').notNull(),
    requiresApproval: boolean('requiresApproval').notNull(),
    approvedDigest: varchar('approvedDigest', { length: 64 }),
    approvedByUserId: uuid('approvedByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    approvedAt: timestamp('approvedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    releaseUnique: unique('releaseMigrationPlan_release_unique').on(table.releaseId),
    projectIdIdx: index('releaseMigrationPlan_projectId_idx').on(table.projectId),
    environmentIdIdx: index('releaseMigrationPlan_environmentId_idx').on(table.environmentId),
    statusIdx: index('releaseMigrationPlan_status_idx').on(table.status),
  })
);

export const migrationRuns = pgTable(
  'migrationRun',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),
    specificationId: uuid('specificationId')
      .notNull()
      .references(() => migrationSpecifications.id, { onDelete: 'cascade' }),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    releaseMigrationPlanId: uuid('releaseMigrationPlanId').references(
      () => releaseMigrationPlans.id,
      { onDelete: 'restrict' }
    ),
    deploymentId: uuid('deploymentId').references(() => deployments.id, { onDelete: 'set null' }),

    triggeredBy: varchar('triggeredBy', { length: 20 }).notNull(),
    triggeredByUserId: uuid('triggeredByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }),
    sourceCommitMessage: text('sourceCommitMessage'),

    releaseStage: migrationReleaseStageEnum('releaseStage').notNull().default('standard'),
    stageOrder: integer('stageOrder').notNull().default(0),
    targetVersion: varchar('targetVersion', { length: 100 }),
    baselineVersion: varchar('baselineVersion', { length: 100 }),
    specificationSnapshot: jsonb('specificationSnapshot')
      .$type<MigrationSpecificationSnapshot>()
      .notNull(),

    status: migrationRunStatusEnum('status').notNull().default('queued'),
    runnerType: migrationRunnerTypeEnum('runnerType').notNull().default('worker'),
    jobName: varchar('jobName', { length: 255 }),
    lockKey: varchar('lockKey', { length: 255 }).notNull(),

    startedAt: timestamp('startedAt'),
    finishedAt: timestamp('finishedAt'),
    durationMs: integer('durationMs'),

    appliedCount: integer('appliedCount'),
    logExcerpt: text('logExcerpt'),
    logsUrl: text('logsUrl'),
    filePreview: jsonb('filePreview').$type<MigrationFilePreviewSnapshot | null>(),

    errorCode: varchar('errorCode', { length: 100 }),
    errorMessage: text('errorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('migrationRun_projectId_idx').on(table.projectId),
    serviceIdIdx: index('migrationRun_serviceId_idx').on(table.serviceId),
    environmentIdIdx: index('migrationRun_environmentId_idx').on(table.environmentId),
    databaseIdIdx: index('migrationRun_databaseId_idx').on(table.databaseId),
    releaseIdIdx: index('migrationRun_releaseId_idx').on(table.releaseId),
    releaseMigrationPlanIdIdx: index('migrationRun_releaseMigrationPlanId_idx').on(
      table.releaseMigrationPlanId
    ),
    deploymentIdIdx: index('migrationRun_deploymentId_idx').on(table.deploymentId),
    statusIdx: index('migrationRun_status_idx').on(table.status),
  })
);

export const migrationRunItems = pgTable(
  'migrationRunItem',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    migrationRunId: uuid('migrationRunId')
      .notNull()
      .references(() => migrationRuns.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 255 }).notNull(),
    checksum: varchar('checksum', { length: 64 }),
    status: migrationRunStatusEnum('status').notNull().default('queued'),
    startedAt: timestamp('startedAt'),
    finishedAt: timestamp('finishedAt'),
    output: text('output'),
    error: text('error'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    migrationRunIdIdx: index('migrationRunItem_run_id_idx').on(table.migrationRunId),
  })
);

export const databaseMigrations = pgTable(
  'databaseMigration',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),

    filename: varchar('filename', { length: 255 }).notNull(),
    checksum: varchar('checksum', { length: 64 }).notNull(),

    status: varchar('status', { length: 20 }).notNull().default('pending'),
    output: text('output'),
    error: text('error'),

    executedAt: timestamp('executedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    databaseIdIdx: index('databaseMigration_databaseId_idx').on(table.databaseId),
    uniqueFilename: unique('databaseMigration_databaseId_filename_unique').on(
      table.databaseId,
      table.filename
    ),
  })
);

export const environmentSchemaStates = pgTable(
  'environmentSchemaState',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),

    status: environmentSchemaStateStatusEnum('status').notNull().default('unmanaged'),
    expectedVersion: varchar('expectedVersion', { length: 255 }),
    actualVersion: varchar('actualVersion', { length: 255 }),
    expectedChecksum: varchar('expectedChecksum', { length: 64 }),
    actualChecksum: varchar('actualChecksum', { length: 64 }),
    sourceRef: varchar('sourceRef', { length: 500 }),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }),
    hasLedger: boolean('hasLedger').notNull().default(false),
    hasUserTables: boolean('hasUserTables').notNull().default(false),
    summary: text('summary'),
    lastInspectedAt: timestamp('lastInspectedAt'),
    lastErrorCode: varchar('lastErrorCode', { length: 100 }),
    lastErrorMessage: text('lastErrorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environmentSchemaState_projectId_idx').on(table.projectId),
    environmentIdIdx: index('environmentSchemaState_environmentId_idx').on(table.environmentId),
    databaseIdIdx: index('environmentSchemaState_databaseId_idx').on(table.databaseId),
    uniqueDatabase: unique('environmentSchemaState_database_unique').on(table.databaseId),
  })
);

export const environmentSchemaStateRevisions = pgTable(
  'environmentSchemaStateRevision',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),

    sourceKey: varchar('sourceKey', { length: 700 }).notNull(),
    sourceRef: varchar('sourceRef', { length: 500 }),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }),
    status: environmentSchemaStateStatusEnum('status').notNull(),
    expectedVersion: varchar('expectedVersion', { length: 255 }),
    actualVersion: varchar('actualVersion', { length: 255 }),
    expectedChecksum: varchar('expectedChecksum', { length: 64 }),
    actualChecksum: varchar('actualChecksum', { length: 64 }),
    hasLedger: boolean('hasLedger').notNull().default(false),
    hasUserTables: boolean('hasUserTables').notNull().default(false),
    summary: text('summary'),
    inspectedAt: timestamp('inspectedAt').notNull(),
    lastErrorCode: varchar('lastErrorCode', { length: 100 }),
    lastErrorMessage: text('lastErrorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environmentSchemaStateRevision_projectId_idx').on(table.projectId),
    environmentIdIdx: index('environmentSchemaStateRevision_environmentId_idx').on(
      table.environmentId
    ),
    databaseIdIdx: index('environmentSchemaStateRevision_databaseId_idx').on(table.databaseId),
    sourceKeyIdx: index('environmentSchemaStateRevision_sourceKey_idx').on(
      table.databaseId,
      table.sourceKey
    ),
    sourceCommitIdx: index('environmentSchemaStateRevision_sourceCommit_idx').on(
      table.databaseId,
      table.sourceCommitSha
    ),
    sourceRefIdx: index('environmentSchemaStateRevision_sourceRef_idx').on(
      table.databaseId,
      table.sourceRef
    ),
    uniqueRevision: unique('environmentSchemaStateRevision_database_revision_unique').on(
      table.databaseId,
      table.sourceKey
    ),
  })
);

export const schemaRepairPlans = pgTable(
  'schemaRepairPlan',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),
    stateStatus: environmentSchemaStateStatusEnum('stateStatus').notNull(),
    kind: schemaRepairPlanKindEnum('kind').notNull(),
    status: schemaRepairPlanStatusEnum('status').notNull().default('draft'),
    title: varchar('title', { length: 255 }).notNull(),
    summary: text('summary').notNull(),
    riskLevel: varchar('riskLevel', { length: 20 }).notNull(),
    expectedVersion: varchar('expectedVersion', { length: 255 }),
    actualVersion: varchar('actualVersion', { length: 255 }),
    nextActionLabel: text('nextActionLabel'),
    steps: jsonb('steps').notNull(),
    generatedFiles: jsonb('generatedFiles'),
    branchName: varchar('branchName', { length: 255 }),
    reviewNumber: integer('reviewNumber'),
    reviewUrl: text('reviewUrl'),
    reviewState: schemaRepairReviewStateEnum('reviewState').default('unknown'),
    reviewStateLabel: varchar('reviewStateLabel', { length: 50 }),
    reviewSyncedAt: timestamp('reviewSyncedAt'),
    atlasExecutionStatus: atlasExecutionStatusEnum('atlasExecutionStatus').default('idle'),
    atlasExecutionLog: text('atlasExecutionLog'),
    atlasExecutionStartedAt: timestamp('atlasExecutionStartedAt'),
    atlasExecutionFinishedAt: timestamp('atlasExecutionFinishedAt'),
    errorMessage: text('errorMessage'),
    createdByUserId: uuid('createdByUserId').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('schemaRepairPlan_projectId_idx').on(table.projectId),
    environmentIdIdx: index('schemaRepairPlan_environmentId_idx').on(table.environmentId),
    databaseIdIdx: index('schemaRepairPlan_databaseId_idx').on(table.databaseId),
    createdAtIdx: index('schemaRepairPlan_createdAt_idx').on(table.createdAt),
  })
);

export const schemaRepairAtlasRuns = pgTable(
  'schemaRepairAtlasRun',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('planId')
      .notNull()
      .references(() => schemaRepairPlans.id, { onDelete: 'cascade' }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    databaseId: uuid('databaseId')
      .notNull()
      .references(() => databases.id, { onDelete: 'cascade' }),
    status: atlasExecutionStatusEnum('status').notNull().default('idle'),
    exitCode: integer('exitCode'),
    generatedFiles: jsonb('generatedFiles'),
    artifactFiles: jsonb('artifactFiles'),
    diffSummary: jsonb('diffSummary'),
    commitSha: varchar('commitSha', { length: 100 }),
    jobName: varchar('jobName', { length: 255 }),
    log: text('log'),
    errorMessage: text('errorMessage'),
    startedAt: timestamp('startedAt'),
    finishedAt: timestamp('finishedAt'),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    planIdIdx: index('schemaRepairAtlasRun_planId_idx').on(table.planId),
    projectIdIdx: index('schemaRepairAtlasRun_projectId_idx').on(table.projectId),
    databaseIdIdx: index('schemaRepairAtlasRun_databaseId_idx').on(table.databaseId),
    createdAtIdx: index('schemaRepairAtlasRun_createdAt_idx').on(table.createdAt),
  })
);
