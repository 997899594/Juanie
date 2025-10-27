import { pgTable, uuid, integer, text, timestamp, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';
import { projects } from './projects.schema';

// 枚举定义
export const ExperimentStatusEnum = z.enum(['draft', 'running', 'completed', 'stopped']);
export const SuccessMetricTypeEnum = z.enum(['conversion_rate', 'click_through_rate', 'engagement_time', 'revenue', 'user_satisfaction']);
export const VariantTypeEnum = z.enum(['control', 'treatment', 'feature_toggle', 'ui_variant']);
export const AutoStopConditionEnum = z.enum(['significance_reached', 'sample_size_reached', 'duration_exceeded', 'performance_degradation']);

export const experiments = pgTable('experiments', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id),
  featureFlagId: integer('feature_flag_id'), // 移除外键引用，因为 feature_flags 表不存在
  
  // 实验信息
  name: text('name').notNull(),
  hypothesis: text('hypothesis'),
  
  // 简化 successMetrics - 核心成功指标
  primarySuccessMetric: text('primary_success_metric'), // 主要成功指标
  secondarySuccessMetrics: text('secondary_success_metrics'), // 次要成功指标（逗号分隔）
  successMetricTargetValue: decimal('success_metric_target_value', { precision: 5, scale: 2 }), // 目标值
  
  // 实验配置
  trafficAllocation: decimal('traffic_allocation', { precision: 5, scale: 2 }).default('50.0'), // 百分比
  
  // 简化 controlVariant - 核心对照组配置
  controlVariantName: text('control_variant_name').notNull(), // 对照组名称
  controlVariantDescription: text('control_variant_description'), // 对照组描述
  
  // 简化 testVariants - 核心实验组配置
  testVariantCount: integer('test_variant_count').default(1), // 实验组数量
  testVariantNames: text('test_variant_names'), // 实验组名称（逗号分隔）
  
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
  
  // 简化 autoStopConditions - 核心自动停止条件
  autoStopEnabled: boolean('auto_stop_enabled').default(false), // 是否启用自动停止
  autoStopMinSampleSize: integer('auto_stop_min_sample_size'), // 自动停止最小样本数
  autoStopConfidenceLevel: decimal('auto_stop_confidence_level', { precision: 3, scale: 2 }), // 自动停止置信度
  autoStopMaxDuration: integer('auto_stop_max_duration'), // 自动停止最大持续时间（天）
  
  // 简化 results - 核心实验结果
  experimentConclusion: text('experiment_conclusion'), // 实验结论
  primaryMetricResult: decimal('primary_metric_result', { precision: 5, scale: 2 }), // 主要指标结果
  statisticalSignificanceAchieved: boolean('statistical_significance_achieved'), // 是否达到统计显著性
  
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

export const insertExperimentSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid(),
  featureFlagId: z.number().int().optional(),
  name: z.string(),
  hypothesis: z.string().optional(),
  primarySuccessMetric: z.string().optional(),
  secondarySuccessMetrics: z.string().optional(),
  successMetricTargetValue: z.string().optional(),
  trafficAllocation: z.string().optional(),
  controlVariantName: z.string(),
  controlVariantDescription: z.string().optional(),
  testVariantCount: z.number().int().optional(),
  testVariantNames: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  durationDays: z.number().int().optional(),
  minimumSampleSize: z.number().int().optional(),
  confidenceLevel: z.string().optional(),
  statisticalPower: z.string().optional(),
  aiAnalysisEnabled: z.boolean().optional(),
  realTimeMonitoring: z.boolean().optional(),
  autoStopEnabled: z.boolean().optional(),
  autoStopMinSampleSize: z.number().int().optional(),
  autoStopConfidenceLevel: z.string().optional(),
  autoStopMaxDuration: z.number().int().optional(),
  experimentConclusion: z.string().optional(),
  primaryMetricResult: z.string().optional(),
  statisticalSignificanceAchieved: z.boolean().optional(),
  statisticalSignificance: z.boolean().optional(),
  winnerVariant: z.string().optional(),
  status: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectExperimentSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  featureFlagId: z.number().int().nullable(),
  name: z.string(),
  hypothesis: z.string().nullable(),
  primarySuccessMetric: z.string().nullable(),
  secondarySuccessMetrics: z.string().nullable(),
  successMetricTargetValue: z.string().nullable(),
  trafficAllocation: z.string().nullable(),
  controlVariantName: z.string(),
  controlVariantDescription: z.string().nullable(),
  testVariantCount: z.number().int().nullable(),
  testVariantNames: z.string().nullable(),
  startDate: z.date().nullable(),
  endDate: z.date().nullable(),
  durationDays: z.number().int().nullable(),
  minimumSampleSize: z.number().int().nullable(),
  confidenceLevel: z.string().nullable(),
  statisticalPower: z.string().nullable(),
  aiAnalysisEnabled: z.boolean().nullable(),
  realTimeMonitoring: z.boolean().nullable(),
  autoStopEnabled: z.boolean().nullable(),
  autoStopMinSampleSize: z.number().int().nullable(),
  autoStopConfidenceLevel: z.string().nullable(),
  autoStopMaxDuration: z.number().int().nullable(),
  experimentConclusion: z.string().nullable(),
  primaryMetricResult: z.string().nullable(),
  statisticalSignificanceAchieved: z.boolean().nullable(),
  statisticalSignificance: z.boolean().nullable(),
  winnerVariant: z.string().nullable(),
  status: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateExperimentSchema = selectExperimentSchema.pick({
  projectId: true,
  featureFlagId: true,
  name: true,
  hypothesis: true,
  primarySuccessMetric: true,
  secondarySuccessMetrics: true,
  successMetricTargetValue: true,
  trafficAllocation: true,
  controlVariantName: true,
  controlVariantDescription: true,
  testVariantCount: true,
  testVariantNames: true,
  startDate: true,
  endDate: true,
  durationDays: true,
  minimumSampleSize: true,
  confidenceLevel: true,
  statisticalPower: true,
  aiAnalysisEnabled: true,
  realTimeMonitoring: true,
  autoStopEnabled: true,
  autoStopMinSampleSize: true,
  autoStopConfidenceLevel: true,
  autoStopMaxDuration: true,
  experimentConclusion: true,
  primaryMetricResult: true,
  statisticalSignificanceAchieved: true,
  statisticalSignificance: true,
  winnerVariant: true,
  status: true,
}).partial();

export type Experiment = typeof experiments.$inferSelect;
export type NewExperiment = typeof experiments.$inferInsert;
export type UpdateExperiment = z.infer<typeof updateExperimentSchema>;
export type ExperimentStatus = z.infer<typeof ExperimentStatusEnum>;