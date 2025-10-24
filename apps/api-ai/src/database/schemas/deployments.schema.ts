import { pgTable, serial, integer, text, timestamp, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';
import { users } from './users.schema';

// 枚举定义
export const DeploymentStatusEnum = z.enum(['pending', 'running', 'success', 'failed', 'cancelled', 'rolled_back']);
export const DeploymentStrategyEnum = z.enum(['rolling', 'blue_green', 'canary', 'recreate', 'a_b_testing']);
export const RollbackStrategyEnum = z.enum(['automatic', 'manual', 'conditional']);

export const deployments = pgTable('deployments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').notNull().references(() => projects.id),
  environmentId: integer('environment_id').notNull().references(() => environments.id),
  pipelineRunId: integer('pipeline_run_id'),
  version: text('version').notNull(),
  commitHash: text('commit_hash').notNull(),
  commitMessage: text('commit_message'),
  branch: text('branch').notNull(),
  deploymentStrategy: text('deployment_strategy').default('rolling'), // 'rolling', 'blue_green', 'canary', 'recreate', 'a_b_testing'
  rollbackStrategy: text('rollback_strategy').default('manual'), // 'automatic', 'manual', 'conditional'
  status: text('status').default('pending'), // 'pending', 'running', 'success', 'failed', 'cancelled', 'rolled_back'
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  deployedBy: integer('deployed_by').references(() => users.id),
  approvedBy: integer('approved_by').references(() => users.id),
  successProbability: decimal('success_probability', { precision: 3, scale: 2 }),
  riskAssessment: jsonb('risk_assessment').default({}),
  performancePrediction: jsonb('performance_prediction').default({}),
  performanceMetrics: jsonb('performance_metrics').default({}),
  errorRate: decimal('error_rate', { precision: 5, scale: 4 }),
  responseTimeP95: integer('response_time_p95'),
  deploymentCost: decimal('deployment_cost', { precision: 10, scale: 2 }),
  resourceUsage: jsonb('resource_usage').default({}),
  carbonFootprint: decimal('carbon_footprint', { precision: 8, scale: 3 }),
  rollbackReason: text('rollback_reason'),
  rolledBackAt: timestamp('rolled_back_at'),
  rollbackDuration: integer('rollback_duration'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const deploymentsProjectIdx = index('deployments_project_idx').on(deployments.projectId);
export const deploymentsEnvironmentIdx = index('deployments_environment_idx').on(deployments.environmentId);
export const deploymentsStatusIdx = index('deployments_status_idx').on(deployments.status);
export const deploymentsDeployedByIdx = index('deployments_deployed_by_idx').on(deployments.deployedBy);

// Relations
export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, {
    fields: [deployments.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [deployments.environmentId],
    references: [environments.id],
  }),
  deployedByUser: one(users, {
    fields: [deployments.deployedBy],
    references: [users.id],
  }),
  approvedByUser: one(users, {
    fields: [deployments.approvedBy],
    references: [users.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertDeploymentSchema = createInsertSchema(deployments);

export const selectDeploymentSchema = createSelectSchema(deployments);

export const updateDeploymentSchema = insertDeploymentSchema.partial().omit({
  id: true,
  createdAt: true,
});

export type Deployment = typeof deployments.$inferSelect;
export type NewDeployment = typeof deployments.$inferInsert;
export type UpdateDeployment = z.infer<typeof updateDeploymentSchema>;
export type DeploymentStatus = z.infer<typeof DeploymentStatusEnum>;
export type DeploymentStrategy = z.infer<typeof DeploymentStrategyEnum>;
export type RollbackStrategy = z.infer<typeof RollbackStrategyEnum>;