import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const providers = ['github', 'gitlab', 'email'] as const;
export type Provider = (typeof providers)[number];

export const teamRoles = ['owner', 'admin', 'member'] as const;
export type TeamRole = (typeof teamRoles)[number];

export const projectRoles = ['owner', 'maintainer', 'developer', 'viewer'] as const;
export type ProjectRole = (typeof projectRoles)[number];

export const projectStatuses = ['initializing', 'active', 'archived', 'failed'] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const deploymentStatuses = [
  'pending',
  'deploying',
  'syncing',
  'deployed',
  'failed',
  'rolled_back',
] as const;
export type DeploymentStatus = (typeof deploymentStatuses)[number];

export const environmentNames = ['development', 'staging', 'production'] as const;
export type EnvironmentName = (typeof environmentNames)[number];

export const providerEnum = pgEnum('provider', providers);
export const teamRoleEnum = pgEnum('teamRole', teamRoles);
export const projectRoleEnum = pgEnum('projectRole', projectRoles);
export const projectStatusEnum = pgEnum('projectStatus', projectStatuses);
export const deploymentStatusEnum = pgEnum('deploymentStatus', deploymentStatuses);
export const environmentNameEnum = pgEnum('environmentName', environmentNames);

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

export const teams = pgTable('team', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull().unique(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const teamMembers = pgTable('teamMember', {
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
});

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

export const clusters = pgTable('cluster', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  apiServer: varchar('apiServer', { length: 500 }).notNull(),
  kubeconfig: text('kubeconfig').notNull(),
  defaultNamespacePrefix: varchar('defaultNamespacePrefix', { length: 50 }).default('juanie'),
  isDefault: boolean('isDefault').default(false),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const projects = pgTable('project', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('teamId')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 255 }).notNull(),
  description: text('description'),
  gitRepository: varchar('gitRepository', { length: 500 }),
  gitBranch: varchar('gitBranch', { length: 100 }).default('main'),
  gitopsRepo: varchar('gitopsRepo', { length: 500 }),
  clusterId: uuid('clusterId').references(() => clusters.id),
  status: projectStatusEnum('status').default('initializing'),
  templateId: varchar('templateId', { length: 100 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const projectMembers = pgTable('projectMember', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  userId: uuid('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  role: projectRoleEnum('role').notNull().default('viewer'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const environments = pgTable('environment', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: environmentNameEnum('name').notNull(),
  order: integer('order').notNull(),
  namespace: varchar('namespace', { length: 100 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const gitConnections = pgTable('gitConnection', {
  id: uuid('id').defaultRandom().primaryKey(),
  teamId: uuid('teamId')
    .notNull()
    .references(() => teams.id, { onDelete: 'cascade' }),
  provider: providerEnum('provider').notNull(),
  accessToken: text('accessToken').notNull(),
  refreshToken: text('refreshToken'),
  webhookSecret: varchar('webhookSecret', { length: 255 }),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const deployments = pgTable('deployment', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  environmentId: uuid('environmentId')
    .notNull()
    .references(() => environments.id, { onDelete: 'cascade' }),
  version: varchar('version', { length: 100 }),
  status: deploymentStatusEnum('status').default('pending'),
  commitSha: varchar('commitSha', { length: 100 }),
  commitMessage: text('commitMessage'),
  deployedById: uuid('deployedById').references(() => users.id),
  deployedAt: timestamp('deployedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const pipelines = pgTable('pipeline', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  yaml: text('yaml').notNull(),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const pipelineRuns = pgTable('pipelineRun', {
  id: uuid('id').defaultRandom().primaryKey(),
  pipelineId: uuid('pipelineId')
    .notNull()
    .references(() => pipelines.id, { onDelete: 'cascade' }),
  status: deploymentStatusEnum('status').default('pending'),
  commitSha: varchar('commitSha', { length: 100 }),
  startedAt: timestamp('startedAt'),
  finishedAt: timestamp('finishedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
});

export const auditLogs = pgTable('auditLog', {
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
});

export const webhooks = pgTable('webhook', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  url: varchar('url', { length: 500 }).notNull(),
  events: text('events').array(),
  secret: varchar('secret', { length: 255 }),
  active: boolean('active').default(true),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});

export const projectInitializationSteps = pgTable('projectInitializationStep', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('projectId')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  step: varchar('step', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  progress: integer('progress').default(0),
  error: text('error'),
  metadata: jsonb('metadata'),
  startedAt: timestamp('startedAt'),
  completedAt: timestamp('completedAt'),
  createdAt: timestamp('createdAt').defaultNow().notNull(),
  updatedAt: timestamp('updatedAt').defaultNow().notNull(),
});
