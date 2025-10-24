import { pgTable, serial, integer, text, timestamp, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';

// 枚举定义
export const OptimizationTypeEnum = z.enum(['rightsizing', 'scheduling', 'auto_scaling', 'spot_instances']);
export const OptimizationStatusEnum = z.enum(['pending', 'approved', 'implemented', 'rejected']);

export const resourceOptimization = pgTable('resource_optimization', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  environmentId: integer('environment_id').references(() => environments.id),
  
  // 优化类型
  optimizationType: text('optimization_type').notNull(), // 'rightsizing', 'scheduling', 'auto_scaling', 'spot_instances'
  
  // 当前状态
  currentConfiguration: jsonb('current_configuration').notNull(),
  currentCost: decimal('current_cost', { precision: 10, scale: 2 }),
  currentPerformance: jsonb('current_performance').default({}),
  
  // 推荐配置
  recommendedConfiguration: jsonb('recommended_configuration').notNull(),
  estimatedCost: decimal('estimated_cost', { precision: 10, scale: 2 }),
  estimatedPerformance: jsonb('estimated_performance').default({}),
  
  // 节省预估
  costSavings: decimal('cost_savings', { precision: 10, scale: 2 }),
  performanceImpact: jsonb('performance_impact').default({}),
  riskAssessment: jsonb('risk_assessment').default({}),
  
  // AI分析
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }).notNull(),
  aiReasoning: text('ai_reasoning'),
  
  // 实施状态
  status: text('status').default('pending'), // 'pending', 'approved', 'implemented', 'rejected'
  implementedAt: timestamp('implemented_at'),
  actualSavings: decimal('actual_savings', { precision: 10, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
});

// Indexes
export const resourceOptimizationProjectIdx = index('resource_optimization_project_idx').on(resourceOptimization.projectId);
export const resourceOptimizationEnvironmentIdx = index('resource_optimization_environment_idx').on(resourceOptimization.environmentId);
export const resourceOptimizationTypeIdx = index('resource_optimization_type_idx').on(resourceOptimization.optimizationType);
export const resourceOptimizationStatusIdx = index('resource_optimization_status_idx').on(resourceOptimization.status);
export const resourceOptimizationExpiresIdx = index('resource_optimization_expires_idx').on(resourceOptimization.expiresAt);

// Relations
export const resourceOptimizationRelations = relations(resourceOptimization, ({ one }) => ({
  project: one(projects, {
    fields: [resourceOptimization.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [resourceOptimization.environmentId],
    references: [environments.id],
  }),
}));

// Zod Schemas
export const insertResourceOptimizationSchema = createInsertSchema(resourceOptimization);

export const selectResourceOptimizationSchema = createSelectSchema(resourceOptimization);

export const updateResourceOptimizationSchema = insertResourceOptimizationSchema.partial().omit({
  id: true,
  createdAt: true,
});

export type ResourceOptimization = typeof resourceOptimization.$inferSelect;
export type NewResourceOptimization = typeof resourceOptimization.$inferInsert;
export type UpdateResourceOptimization = z.infer<typeof updateResourceOptimizationSchema>;
export type OptimizationType = z.infer<typeof OptimizationTypeEnum>;
export type OptimizationStatus = z.infer<typeof OptimizationStatusEnum>;