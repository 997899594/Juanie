import { relations, sql } from 'drizzle-orm';
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import type { DatabaseCapability } from '@/lib/databases/capabilities';
import type { ReleaseRecapRecord } from '@/lib/releases/recap-record';

// ============================================
// Enums
// ============================================

export const gitProviderTypes = ['github', 'gitlab', 'gitlab-self-hosted'] as const;
export type GitProviderType = (typeof gitProviderTypes)[number];

export const serviceTypes = ['web', 'worker', 'cron'] as const;
export type ServiceType = (typeof serviceTypes)[number];

export const databaseTypes = ['postgresql', 'mysql', 'redis', 'mongodb'] as const;
export type DatabaseType = (typeof databaseTypes)[number];

export const databasePlans = ['starter', 'standard', 'premium'] as const;
export type DatabasePlan = (typeof databasePlans)[number];

export const databaseScopes = ['project', 'service'] as const;
export type DatabaseScope = (typeof databaseScopes)[number];

export const databaseRoles = ['primary', 'readonly', 'cache', 'queue', 'analytics'] as const;
export type DatabaseRole = (typeof databaseRoles)[number];

export const projectStatuses = ['initializing', 'active', 'failed', 'archived'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const releaseStatuses = [
  'queued',
  'planning',
  'migration_pre_running',
  'awaiting_approval',
  'awaiting_external_completion',
  'migration_pre_failed',
  'deploying',
  'awaiting_rollout',
  'verifying',
  'verification_failed',
  'migration_post_running',
  'degraded',
  'succeeded',
  'failed',
  'canceled',
] as const;
export type ReleaseStatus = (typeof releaseStatuses)[number];

export const deploymentStatuses = [
  'queued',
  'migration_pending',
  'migration_running',
  'migration_failed',
  'building',
  'deploying',
  'awaiting_rollout',
  'verification_failed',
  'running',
  'canceled',
  'failed',
  'rolled_back',
] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

export const migrationTools = ['drizzle', 'prisma', 'knex', 'typeorm', 'sql', 'custom'] as const;
export type MigrationTool = (typeof migrationTools)[number];

export const migrationPhases = ['preDeploy', 'postDeploy', 'manual'] as const;
export type MigrationPhase = (typeof migrationPhases)[number];

export const migrationExecutionModes = ['automatic', 'manual_platform', 'external'] as const;
export type MigrationExecutionMode = (typeof migrationExecutionModes)[number];

export const migrationRunStatuses = [
  'queued',
  'awaiting_approval',
  'awaiting_external_completion',
  'planning',
  'running',
  'success',
  'failed',
  'canceled',
  'skipped',
] as const;
export type MigrationRunStatus = (typeof migrationRunStatuses)[number];

export const migrationRunnerTypes = ['k8s_job', 'ci_job', 'worker'] as const;
export type MigrationRunnerType = (typeof migrationRunnerTypes)[number];

export const migrationLockStrategies = ['platform', 'db_advisory'] as const;
export type MigrationLockStrategy = (typeof migrationLockStrategies)[number];

export const migrationCompatibilities = ['backward_compatible', 'breaking'] as const;
export type MigrationCompatibility = (typeof migrationCompatibilities)[number];

export const migrationApprovalPolicies = ['auto', 'manual_in_production'] as const;
export type MigrationApprovalPolicy = (typeof migrationApprovalPolicies)[number];

export const initStepStatuses = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export type InitStepStatus = (typeof initStepStatuses)[number];

export const environmentDeploymentStrategies = [
  'rolling',
  'controlled',
  'canary',
  'blue_green',
] as const;
export type EnvironmentDeploymentStrategy = (typeof environmentDeploymentStrategies)[number];
export const environmentDatabaseStrategies = ['direct', 'inherit', 'isolated_clone'] as const;
export type EnvironmentDatabaseStrategy = (typeof environmentDatabaseStrategies)[number];
export const environmentSchemaStateStatuses = [
  'aligned',
  'aligned_untracked',
  'drifted',
  'unmanaged',
  'blocked',
] as const;
export type EnvironmentSchemaStateStatus = (typeof environmentSchemaStateStatuses)[number];

export const aiPlans = ['free', 'pro', 'scale', 'enterprise'] as const;
export type AIPlan = (typeof aiPlans)[number];

export const aiPluginRunStatuses = ['succeeded', 'failed'] as const;
export type AIPluginRunStatus = (typeof aiPluginRunStatuses)[number];

export const teamRoles = ['owner', 'admin', 'member'] as const;
export type TeamRole = (typeof teamRoles)[number];

export const integrationCapabilities = ['read_repo', 'write_repo', 'write_workflow'] as const;
export type IntegrationCapability = (typeof integrationCapabilities)[number];
export const integrationAuthModes = ['personal', 'service'] as const;
export type IntegrationAuthMode = (typeof integrationAuthModes)[number];

export const gitProviderTypeEnum = pgEnum('gitProviderType', gitProviderTypes);
export const serviceTypeEnum = pgEnum('serviceType', serviceTypes);
export const databaseTypeEnum = pgEnum('databaseType', databaseTypes);
export const databasePlanEnum = pgEnum('databasePlan', databasePlans);
export const databaseScopeEnum = pgEnum('databaseScope', databaseScopes);
export const databaseRoleEnum = pgEnum('databaseRole', databaseRoles);
export const projectStatusEnum = pgEnum('projectStatus', projectStatuses);
export const releaseStatusEnum = pgEnum('releaseStatus', releaseStatuses);
export const deploymentStatusEnum = pgEnum('deploymentStatus', deploymentStatuses);
export const initStepStatusEnum = pgEnum('initStepStatus', initStepStatuses);
export const teamRoleEnum = pgEnum('teamRole', teamRoles);
export const integrationCapabilityEnum = pgEnum('integrationCapability', integrationCapabilities);
export const integrationAuthModeEnum = pgEnum('integrationAuthMode', integrationAuthModes);
export const aiPlanEnum = pgEnum('aiPlan', aiPlans);
export const migrationToolEnum = pgEnum('migrationTool', migrationTools);
export const migrationPhaseEnum = pgEnum('migrationPhase', migrationPhases);
export const migrationExecutionModeEnum = pgEnum('migrationExecutionMode', migrationExecutionModes);
export const migrationRunStatusEnum = pgEnum('migrationRunStatus', migrationRunStatuses);
export const migrationRunnerTypeEnum = pgEnum('migrationRunnerType', migrationRunnerTypes);
export const migrationLockStrategyEnum = pgEnum('migrationLockStrategy', migrationLockStrategies);
export const migrationCompatibilityEnum = pgEnum(
  'migrationCompatibility',
  migrationCompatibilities
);
export const migrationApprovalPolicyEnum = pgEnum(
  'migrationApprovalPolicy',
  migrationApprovalPolicies
);
export const environmentDeploymentStrategyEnum = pgEnum(
  'environmentDeploymentStrategy',
  environmentDeploymentStrategies
);
export const environmentDatabaseStrategyEnum = pgEnum(
  'environmentDatabaseStrategy',
  environmentDatabaseStrategies
);
export const environmentSchemaStateStatusEnum = pgEnum(
  'environmentSchemaStateStatus',
  environmentSchemaStateStatuses
);
export const aiPluginRunStatusEnum = pgEnum('aiPluginRunStatus', aiPluginRunStatuses);

// ============================================
// Auth Tables (NextAuth)
// ============================================

export const users = pgTable('user', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const accounts = pgTable('account', {
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
});

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

// ============================================
// Git Provider Tables
// ============================================

export const gitProviders = pgTable(
  'gitProvider',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    type: gitProviderTypeEnum('type').notNull(),
    name: varchar('name', { length: 255 }).notNull(),

    serverUrl: varchar('serverUrl', { length: 500 }),
    clientId: varchar('clientId', { length: 255 }),
    clientSecret: varchar('clientSecret', { length: 255 }),

    accessToken: text('accessToken'),
    refreshToken: text('refreshToken'),
    tokenExpiresAt: timestamp('tokenExpiresAt'),

    externalUserId: varchar('externalUserId', { length: 255 }),
    username: varchar('username', { length: 255 }),
    avatarUrl: varchar('avatarUrl', { length: 500 }),

    isActive: boolean('isActive').default(true),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('gitProvider_userId_idx').on(table.userId),
    typeIdx: index('gitProvider_type_idx').on(table.type),
  })
);

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
    accessToken: text('accessToken').notNull(),
    refreshToken: text('refreshToken'),
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
  })
);

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

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    teamIdIdx: index('project_teamId_idx').on(table.teamId),
    slugIdx: index('project_slug_idx').on(table.slug),
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
    branch: varchar('branch', { length: 100 }),
    tagPattern: varchar('tagPattern', { length: 100 }),
    isPreview: boolean('isPreview').default(false),
    previewPrNumber: integer('previewPrNumber'),
    expiresAt: timestamp('expiresAt'),
    baseEnvironmentId: uuid('baseEnvironmentId').references((): AnyPgColumn => environments.id, {
      onDelete: 'set null',
    }),
    databaseStrategy: environmentDatabaseStrategyEnum('databaseStrategy')
      .default('direct')
      .notNull(),

    autoDeploy: boolean('autoDeploy').default(true).notNull(),
    isProduction: boolean('isProduction').default(false).notNull(),
    deploymentStrategy: environmentDeploymentStrategyEnum('deploymentStrategy')
      .default('rolling')
      .notNull(),

    namespace: varchar('namespace', { length: 100 }),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environment_projectId_idx').on(table.projectId),
    previewIdx: index('environment_preview_idx').on(table.projectId, table.isPreview),
    previewPrIdx: index('environment_preview_pr_idx').on(table.projectId, table.previewPrNumber),
    baseEnvironmentIdx: index('environment_base_env_idx').on(table.baseEnvironmentId),
  })
);

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

    tool: migrationToolEnum('tool').notNull(),
    phase: migrationPhaseEnum('phase').notNull().default('preDeploy'),
    executionMode: migrationExecutionModeEnum('executionMode').notNull(),

    workingDirectory: varchar('workingDirectory', { length: 500 }).notNull(),
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
    uniqueBinding: unique('migrationSpecification_service_env_db_unique').on(
      table.serviceId,
      table.environmentId,
      table.databaseId
    ),
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
    deploymentId: uuid('deploymentId').references(() => deployments.id, { onDelete: 'set null' }),

    triggeredBy: varchar('triggeredBy', { length: 20 }).notNull(),
    triggeredByUserId: uuid('triggeredByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }),
    sourceCommitMessage: text('sourceCommitMessage'),

    status: migrationRunStatusEnum('status').notNull().default('queued'),
    runnerType: migrationRunnerTypeEnum('runnerType').notNull().default('worker'),
    lockKey: varchar('lockKey', { length: 255 }).notNull(),

    startedAt: timestamp('startedAt'),
    finishedAt: timestamp('finishedAt'),
    durationMs: integer('durationMs'),

    appliedCount: integer('appliedCount'),
    logExcerpt: text('logExcerpt'),
    logsUrl: text('logsUrl'),

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
    hostnameIdx: index('domain_hostname_idx').on(table.hostname),
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

    referenceType: varchar('referenceType', { length: 50 }),
    referenceId: uuid('referenceId'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environmentVariable_projectId_idx').on(table.projectId),
  })
);

// ============================================
// Release Tables
// ============================================

export const releases = pgTable(
  'release',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),

    sourceRepository: varchar('sourceRepository', { length: 255 }).notNull(),
    sourceRef: varchar('sourceRef', { length: 255 }).notNull(),
    sourceCommitSha: varchar('sourceCommitSha', { length: 100 }),
    configCommitSha: varchar('configCommitSha', { length: 100 }),
    status: releaseStatusEnum('status').notNull().default('queued'),
    triggeredBy: varchar('triggeredBy', { length: 20 }).notNull().default('api'),
    triggeredByUserId: uuid('triggeredByUserId').references(() => users.id, {
      onDelete: 'set null',
    }),
    summary: text('summary'),
    recap: jsonb('recap').$type<ReleaseRecapRecord | null>(),
    errorMessage: text('errorMessage'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('release_projectId_idx').on(table.projectId),
    environmentIdIdx: index('release_environmentId_idx').on(table.environmentId),
    statusIdx: index('release_status_idx').on(table.status),
    sourceRepoIdx: index('release_sourceRepository_idx').on(table.sourceRepository),
  })
);

export const releaseArtifacts = pgTable(
  'releaseArtifact',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    releaseId: uuid('releaseId')
      .notNull()
      .references(() => releases.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),

    imageUrl: varchar('imageUrl', { length: 500 }).notNull(),
    imageDigest: varchar('imageDigest', { length: 255 }),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    releaseIdIdx: index('releaseArtifact_releaseId_idx').on(table.releaseId),
    serviceIdIdx: index('releaseArtifact_serviceId_idx').on(table.serviceId),
    releaseServiceUnique: unique('releaseArtifact_release_service_unique').on(
      table.releaseId,
      table.serviceId
    ),
  })
);

// ============================================
// Deployment Tables
// ============================================

export const deployments = pgTable(
  'deployment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    releaseId: uuid('releaseId').references(() => releases.id, { onDelete: 'set null' }),
    projectId: uuid('projectId')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environmentId')
      .notNull()
      .references(() => environments.id, { onDelete: 'cascade' }),
    serviceId: uuid('serviceId').references(() => services.id, { onDelete: 'set null' }),

    version: varchar('version', { length: 100 }),
    status: deploymentStatusEnum('status').notNull().default('queued'),

    commitSha: varchar('commitSha', { length: 100 }),
    commitMessage: text('commitMessage'),
    branch: varchar('branch', { length: 100 }),

    imageUrl: varchar('imageUrl', { length: 500 }),
    buildLogs: text('buildLogs'),
    errorMessage: text('errorMessage'),

    deployedById: uuid('deployedById').references(() => users.id, { onDelete: 'set null' }),
    deployedAt: timestamp('deployedAt'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    releaseIdIdx: index('deployment_releaseId_idx').on(table.releaseId),
    projectIdIdx: index('deployment_projectId_idx').on(table.projectId),
    statusIdx: index('deployment_status_idx').on(table.status),
  })
);

// ============================================
// Deployment Log Tables
// ============================================

export const deploymentLogs = pgTable(
  'deploymentLog',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    deploymentId: uuid('deploymentId')
      .notNull()
      .references(() => deployments.id, { onDelete: 'cascade' }),
    level: varchar('level', { length: 10 }).notNull().default('info'),
    message: text('message').notNull(),
    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    deploymentIdIdx: index('deploymentLog_deploymentId_idx').on(table.deploymentId),
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

// ============================================
// Relations
// ============================================

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  gitProviders: many(gitProviders),
  teamMemberships: many(teamMembers),
  teamIntegrationBindings: many(teamIntegrationBindings),
  aiPluginInstallations: many(aiPluginInstallations),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const gitProvidersRelations = relations(gitProviders, ({ one, many }) => ({
  user: one(users, {
    fields: [gitProviders.userId],
    references: [users.id],
  }),
  repositories: many(repositories),
}));

export const repositoriesRelations = relations(repositories, ({ one, many }) => ({
  provider: one(gitProviders, {
    fields: [repositories.providerId],
    references: [gitProviders.id],
  }),
  projects: many(projects),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  projects: many(projects),
  invitations: many(teamInvitations),
  integrationBindings: many(teamIntegrationBindings),
  auditLogs: many(auditLogs),
  aiPluginInstallations: many(aiPluginInstallations),
  aiEntitlements: many(aiEntitlements),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
}));

export const teamInvitationsRelations = relations(teamInvitations, ({ one }) => ({
  team: one(teams, {
    fields: [teamInvitations.teamId],
    references: [teams.id],
  }),
}));

export const teamIntegrationBindingsRelations = relations(teamIntegrationBindings, ({ one }) => ({
  team: one(teams, {
    fields: [teamIntegrationBindings.teamId],
    references: [teams.id],
  }),
  integrationIdentity: one(integrationIdentities, {
    fields: [teamIntegrationBindings.integrationIdentityId],
    references: [integrationIdentities.id],
  }),
  createdByUser: one(users, {
    fields: [teamIntegrationBindings.createdByUserId],
    references: [users.id],
  }),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  team: one(teams, {
    fields: [projects.teamId],
    references: [teams.id],
  }),
  repository: one(repositories, {
    fields: [projects.repositoryId],
    references: [repositories.id],
  }),
  services: many(services),
  environments: many(environments),
  databases: many(databases),
  domains: many(domains),
  environmentVariables: many(environmentVariables),
  releases: many(releases),
  deployments: many(deployments),
  initSteps: many(projectInitSteps),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
}));

export const projectInitStepsRelations = relations(projectInitSteps, ({ one }) => ({
  project: one(projects, {
    fields: [projectInitSteps.projectId],
    references: [projects.id],
  }),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  project: one(projects, {
    fields: [services.projectId],
    references: [projects.id],
  }),
  domains: many(domains),
  deployments: many(deployments),
  environmentVariables: many(environmentVariables),
  databases: many(databases),
  releaseArtifacts: many(releaseArtifacts),
  migrationSpecifications: many(migrationSpecifications),
  migrationRuns: many(migrationRuns),
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
  baseEnvironment: one(environments, {
    fields: [environments.baseEnvironmentId],
    references: [environments.id],
    relationName: 'environment_inheritance',
  }),
  derivedEnvironments: many(environments, {
    relationName: 'environment_inheritance',
  }),
  domains: many(domains),
  releases: many(releases),
  deployments: many(deployments),
  environmentVariables: many(environmentVariables),
  databases: many(databases),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
}));

export const databasesRelations = relations(databases, ({ one, many }) => ({
  project: one(projects, {
    fields: [databases.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [databases.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [databases.serviceId],
    references: [services.id],
  }),
  sourceDatabase: one(databases, {
    fields: [databases.sourceDatabaseId],
    references: [databases.id],
    relationName: 'database_clone',
  }),
  derivedDatabases: many(databases, {
    relationName: 'database_clone',
  }),
  migrations: many(databaseMigrations),
  schemaState: one(environmentSchemaStates, {
    fields: [databases.id],
    references: [environmentSchemaStates.databaseId],
  }),
  migrationSpecifications: many(migrationSpecifications),
  migrationRuns: many(migrationRuns),
}));

export const migrationSpecificationsRelations = relations(
  migrationSpecifications,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [migrationSpecifications.projectId],
      references: [projects.id],
    }),
    service: one(services, {
      fields: [migrationSpecifications.serviceId],
      references: [services.id],
    }),
    environment: one(environments, {
      fields: [migrationSpecifications.environmentId],
      references: [environments.id],
    }),
    database: one(databases, {
      fields: [migrationSpecifications.databaseId],
      references: [databases.id],
    }),
    runs: many(migrationRuns),
  })
);

export const migrationRunsRelations = relations(migrationRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [migrationRuns.projectId],
    references: [projects.id],
  }),
  service: one(services, {
    fields: [migrationRuns.serviceId],
    references: [services.id],
  }),
  environment: one(environments, {
    fields: [migrationRuns.environmentId],
    references: [environments.id],
  }),
  database: one(databases, {
    fields: [migrationRuns.databaseId],
    references: [databases.id],
  }),
  specification: one(migrationSpecifications, {
    fields: [migrationRuns.specificationId],
    references: [migrationSpecifications.id],
  }),
  release: one(releases, {
    fields: [migrationRuns.releaseId],
    references: [releases.id],
  }),
  deployment: one(deployments, {
    fields: [migrationRuns.deploymentId],
    references: [deployments.id],
  }),
  triggeredByUser: one(users, {
    fields: [migrationRuns.triggeredByUserId],
    references: [users.id],
  }),
  items: many(migrationRunItems),
}));

export const migrationRunItemsRelations = relations(migrationRunItems, ({ one }) => ({
  migrationRun: one(migrationRuns, {
    fields: [migrationRunItems.migrationRunId],
    references: [migrationRuns.id],
  }),
}));

export const databaseMigrationsRelations = relations(databaseMigrations, ({ one }) => ({
  database: one(databases, {
    fields: [databaseMigrations.databaseId],
    references: [databases.id],
  }),
}));

export const environmentSchemaStatesRelations = relations(environmentSchemaStates, ({ one }) => ({
  project: one(projects, {
    fields: [environmentSchemaStates.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [environmentSchemaStates.environmentId],
    references: [environments.id],
  }),
  database: one(databases, {
    fields: [environmentSchemaStates.databaseId],
    references: [databases.id],
  }),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  project: one(projects, {
    fields: [domains.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [domains.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [domains.serviceId],
    references: [services.id],
  }),
}));

export const environmentVariablesRelations = relations(environmentVariables, ({ one }) => ({
  project: one(projects, {
    fields: [environmentVariables.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [environmentVariables.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [environmentVariables.serviceId],
    references: [services.id],
  }),
}));

export const releasesRelations = relations(releases, ({ one, many }) => ({
  project: one(projects, {
    fields: [releases.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [releases.environmentId],
    references: [environments.id],
  }),
  triggeredByUser: one(users, {
    fields: [releases.triggeredByUserId],
    references: [users.id],
  }),
  artifacts: many(releaseArtifacts),
  deployments: many(deployments),
  migrationRuns: many(migrationRuns),
  aiPluginRuns: many(aiPluginRuns),
  aiPluginSnapshots: many(aiPluginSnapshots),
}));

export const releaseArtifactsRelations = relations(releaseArtifacts, ({ one }) => ({
  release: one(releases, {
    fields: [releaseArtifacts.releaseId],
    references: [releases.id],
  }),
  service: one(services, {
    fields: [releaseArtifacts.serviceId],
    references: [services.id],
  }),
}));

export const deploymentsRelations = relations(deployments, ({ one, many }) => ({
  release: one(releases, {
    fields: [deployments.releaseId],
    references: [releases.id],
  }),
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [deployments.environmentId],
    references: [environments.id],
  }),
  service: one(services, {
    fields: [deployments.serviceId],
    references: [services.id],
  }),
  deployedBy: one(users, {
    fields: [deployments.deployedById],
    references: [users.id],
  }),
  logs: many(deploymentLogs),
}));

export const deploymentLogsRelations = relations(deploymentLogs, ({ one }) => ({
  deployment: one(deployments, {
    fields: [deploymentLogs.deploymentId],
    references: [deployments.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  team: one(teams, {
    fields: [auditLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [auditLogs.userId],
    references: [users.id],
  }),
}));

export const aiPluginInstallationsRelations = relations(aiPluginInstallations, ({ one }) => ({
  team: one(teams, {
    fields: [aiPluginInstallations.teamId],
    references: [teams.id],
  }),
  installedByUser: one(users, {
    fields: [aiPluginInstallations.installedByUserId],
    references: [users.id],
  }),
}));

export const aiEntitlementsRelations = relations(aiEntitlements, ({ one }) => ({
  team: one(teams, {
    fields: [aiEntitlements.teamId],
    references: [teams.id],
  }),
}));

export const aiPluginSnapshotsRelations = relations(aiPluginSnapshots, ({ one }) => ({
  team: one(teams, {
    fields: [aiPluginSnapshots.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [aiPluginSnapshots.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [aiPluginSnapshots.environmentId],
    references: [environments.id],
  }),
  release: one(releases, {
    fields: [aiPluginSnapshots.releaseId],
    references: [releases.id],
  }),
}));

export const aiPluginRunsRelations = relations(aiPluginRuns, ({ one }) => ({
  team: one(teams, {
    fields: [aiPluginRuns.teamId],
    references: [teams.id],
  }),
  project: one(projects, {
    fields: [aiPluginRuns.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [aiPluginRuns.environmentId],
    references: [environments.id],
  }),
  release: one(releases, {
    fields: [aiPluginRuns.releaseId],
    references: [releases.id],
  }),
}));
