import { pgTable, serial, integer, text, timestamp, jsonb, decimal, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';

// 枚举定义
export const ExperimentStatusEnum = z.enum(['draft', 'running', 'completed', 'stopped']);

export const experiments = pgTable('experiments', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  featureFlagId: integer('feature_flag_id'), // 移除外键引用，因为 feature_flags 表不存在
  
  // 实验信息
  name: text('name').notNull(),
  hypothesis: text('hypothesis'),
  successMetrics: jsonb('success_metrics').default([]),
  
  // 实验配置
  trafficAllocation: decimal('traffic_allocation', { precision: 5, scale: 2 }).default('50.0'), // 百分比
  controlVariant: jsonb('control_variant').notNull(),
  testVariants: jsonb('test_variants').default([]),
  
  // 时间配置
  startDate: timestamp('start_date'),
  endDate: timestamp('end_date'),
  durationDays: integer('duration_days'),
  
  // 统计配置
  minimumSampleSize: integer('minimum_sample_size'),
  confidenceLevel: decimal('confidence_level', { precision: 3, scale: 2 }).default('0.95'),
  statisticalPower: decimal('statistical_power', { precision: 3, scale: 2 }).default('0.80'),
  
  // AI分析
  aiAnalysisEnabled: boolean('ai_analysis_enabled').default(true),
  realTimeMonitoring: boolean('real_time_monitoring').default(true),
  autoStopConditions: jsonb('auto_stop_conditions').default({}),
  
  // 结果
  results: jsonb('results').default({}),
  statisticalSignificance: boolean('statistical_significance'),
  winnerVariant: text('winner_variant'),
  
  status: text('status').default('draft'), // 'draft', 'running', 'completed', 'stopped'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const experimentsProjectIdx = index('experiments_project_idx').on(experiments.projectId);
export const experimentsFeatureFlagIdx = index('experiments_feature_flag_idx').on(experiments.featureFlagId);
export const experimentsStatusIdx = index('experiments_status_idx').on(experiments.status);
export const experimentsDateRangeIdx = index('experiments_date_range_idx').on(experiments.startDate, experiments.endDate);

// Relations
export const experimentsRelations = relations(experiments, ({ one }) => ({
  project: one(projects, {
    fields: [experiments.projectId],
    references: [projects.id],
  }),
  // 移除 featureFlag 关系，因为 feature_flags 表不存在
}));

// Zod Schemas
export const insertExperimentSchema = createInsertSchema(experiments);

export const selectExperimentSchema = createSelectSchema(experiments);

export const updateExperimentSchema = selectExperimentSchema.pick({
  projectId: true,
  featureFlagId: true,
  name: true,
  hypothesis: true,
  successMetrics: true,
  trafficAllocation: true,
  controlVariant: true,
  testVariants: true,
  startDate: true,
  endDate: true,
  durationDays: true,
  minimumSampleSize: true,
  confidenceLevel: true,
  statisticalPower: true,
  aiAnalysisEnabled: true,
  realTimeMonitoring: true,
  autoStopConditions: true,
  results: true,
  statisticalSignificance: true,
  winnerVariant: true,
  status: true,
}).partial();

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type UpdateExperiment = z.infer<typeof updateExperimentSchema>;
export type ExperimentStatus = z.infer<typeof ExperimentStatusEnum>;