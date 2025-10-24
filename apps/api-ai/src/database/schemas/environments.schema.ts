import { pgTable, serial, integer, text, timestamp, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';

// 枚举定义
export const EnvironmentTypeEnum = z.enum(['development', 'staging', 'production', 'testing', 'preview']);
export const CloudProviderEnum = z.enum(['aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel', 'netlify']);
export const EnvironmentStatusEnum = z.enum(['active', 'inactive', 'provisioning', 'error', 'maintenance']);
export const DataClassificationEnum = z.enum(['public', 'internal', 'confidential', 'restricted']);

export const environments = pgTable('environments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  name: text('name').notNull(),
  displayName: text('display_name'),
  description: text('description'),
  environmentType: text('environment_type').notNull(), // 'development', 'staging', 'production', 'testing', 'preview'
  cloudProvider: text('cloud_provider'), // 'aws', 'gcp', 'azure', 'digitalocean', 'heroku', 'vercel', 'netlify'
  region: text('region'),
  infrastructureConfig: jsonb('infrastructure_config').default({}),
  computeResources: jsonb('compute_resources').default({}),
  networkConfig: jsonb('network_config').default({}),
  status: text('status').default('active'), // 'active', 'inactive', 'provisioning', 'error', 'maintenance'
  healthCheckUrl: text('health_check_url'),
  lastHealthCheck: timestamp('last_health_check'),
  accessRestrictions: jsonb('access_restrictions').default({}),
  allowedUsers: jsonb('allowed_users').default([]),
  allowedTeams: jsonb('allowed_teams').default([]),
  resourceQuotas: jsonb('resource_quotas').default({}),
  costBudget: decimal('cost_budget', { precision: 10, scale: 2 }),
  autoScalingConfig: jsonb('auto_scaling_config').default({}),
  complianceRequirements: jsonb('compliance_requirements').default([]),
  securityPolicies: jsonb('security_policies').default({}),
  dataClassification: text('data_classification').default('internal'), // 'public', 'internal', 'confidential', 'restricted'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const environmentsProjectIdx = index('environments_project_idx').on(environments.projectId);
export const environmentsTypeIdx = index('environments_type_idx').on(environments.environmentType);
export const environmentsStatusIdx = index('environments_status_idx').on(environments.status);
export const environmentsProviderIdx = index('environments_provider_idx').on(environments.cloudProvider);

// Relations
export const environmentsRelations = relations(environments, ({ one }) => ({
  project: one(projects, {
    fields: [environments.projectId],
    references: [projects.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertEnvironmentSchema = createInsertSchema(environments);

export const selectEnvironmentSchema = createSelectSchema(environments);

export const updateEnvironmentSchema = selectEnvironmentSchema.pick({
  projectId: true,
  name: true,
  displayName: true,
  description: true,
  environmentType: true,
  cloudProvider: true,
  region: true,
  infrastructureConfig: true,
  computeResources: true,
  networkConfig: true,
  status: true,
  healthCheckUrl: true,
  lastHealthCheck: true,
  accessRestrictions: true,
  allowedUsers: true,
  allowedTeams: true,
  resourceQuotas: true,
  costBudget: true,
  autoScalingConfig: true,
  complianceRequirements: true,
  securityPolicies: true,
  dataClassification: true,
}).partial();

export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;
export type UpdateEnvironment = z.infer<typeof updateEnvironmentSchema>;
export type EnvironmentType = z.infer<typeof EnvironmentTypeEnum>;
export type CloudProvider = z.infer<typeof CloudProviderEnum>;
export type EnvironmentStatus = z.infer<typeof EnvironmentStatusEnum>;
export type DataClassification = z.infer<typeof DataClassificationEnum>;
