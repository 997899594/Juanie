import { relations } from 'drizzle-orm';
import {
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

export const projectStatuses = ['initializing', 'active', 'failed', 'archived'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const deploymentStatuses = [
  'queued',
  'building',
  'deploying',
  'running',
  'failed',
  'rolled_back',
] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

export const initStepStatuses = ['pending', 'running', 'completed', 'failed', 'skipped'] as const;
export type InitStepStatus = (typeof initStepStatuses)[number];

export const teamRoles = ['owner', 'admin', 'member'] as const;
export type TeamRole = (typeof teamRoles)[number];

export const gitProviderTypeEnum = pgEnum('gitProviderType', gitProviderTypes);
export const serviceTypeEnum = pgEnum('serviceType', serviceTypes);
export const databaseTypeEnum = pgEnum('databaseType', databaseTypes);
export const databasePlanEnum = pgEnum('databasePlan', databasePlans);
export const projectStatusEnum = pgEnum('projectStatus', projectStatuses);
export const deploymentStatusEnum = pgEnum('deploymentStatus', deploymentStatuses);
export const initStepStatusEnum = pgEnum('initStepStatus', initStepStatuses);
export const teamRoleEnum = pgEnum('teamRole', teamRoles);

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
      .references(() => gitProviders.id, { onDelete: 'cascade' }),

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
  email: varchar('email', { length: 255 }).notNull(),
  role: teamRoleEnum('role').notNull().default('member'),
  token: varchar('token', { length: 255 }).notNull().unique(),
  expires: timestamp('expires').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

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
    memoryRequest: varchar('memoryRequest', { length: 50 }).default('128Mi'),
    memoryLimit: varchar('memoryLimit', { length: 50 }).default('256Mi'),

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
    isPreview: boolean('isPreview').default(false),
    previewPrNumber: integer('previewPrNumber'),

    namespace: varchar('namespace', { length: 100 }),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
    updatedAt: timestamp('updatedAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('environment_projectId_idx').on(table.projectId),
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

    name: varchar('name', { length: 255 }).notNull(),
    type: databaseTypeEnum('type').notNull(),
    plan: databasePlanEnum('plan').notNull().default('starter'),

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
// Deployment Tables
// ============================================

export const deployments = pgTable(
  'deployment',
  {
    id: uuid('id').defaultRandom().primaryKey(),
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

    deployedById: uuid('deployedById').references(() => users.id, { onDelete: 'set null' }),
    deployedAt: timestamp('deployedAt'),

    createdAt: timestamp('createdAt').defaultNow().notNull(),
  },
  (table) => ({
    projectIdIdx: index('deployment_projectId_idx').on(table.projectId),
    statusIdx: index('deployment_status_idx').on(table.status),
  })
);

// ============================================
// Webhook Tables
// ============================================

export const webhooks = pgTable('webhook', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),

  // Git 平台返回的 webhook ID，用于删除
  externalId: varchar('externalId', { length: 255 }),
  // Webhook 类型：git-push, manual 等
  type: varchar('type', { length: 50 }).default('git-push'),

  url: varchar('url', { length: 500 }).notNull(),
  events: text('events').array().notNull(),
  secret: varchar('secret', { length: 255 }),
  active: boolean('active').default(true),

  lastTriggeredAt: timestamp('lastTriggeredAt'),

  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

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
// Relations
// ============================================

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  gitProviders: many(gitProviders),
  teamMemberships: many(teamMembers),
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
  auditLogs: many(auditLogs),
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
  deployments: many(deployments),
  webhooks: many(webhooks),
  initSteps: many(projectInitSteps),
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
}));

export const environmentsRelations = relations(environments, ({ one, many }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
  domains: many(domains),
  deployments: many(deployments),
  environmentVariables: many(environmentVariables),
}));

export const databasesRelations = relations(databases, ({ one }) => ({
  project: one(projects, {
    fields: [databases.projectId],
    references: [projects.id],
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

export const deploymentsRelations = relations(deployments, ({ one }) => ({
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
}));

export const webhooksRelations = relations(webhooks, ({ one }) => ({
  project: one(projects, {
    fields: [webhooks.projectId],
    references: [projects.id],
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
