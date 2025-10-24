import { pgTable, serial, integer, text, timestamp, jsonb, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';

// 枚举定义
export const MetricTypeEnum = z.enum(['counter', 'gauge', 'histogram', 'summary']);

export const performanceMetrics = pgTable('performance_metrics', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id),
  environmentId: integer('environment_id').references(() => environments.id),
  serviceName: text('service_name'),
  
  // 指标信息
  metricName: text('metric_name').notNull(),
  metricType: text('metric_type').notNull(), // 'counter', 'gauge', 'histogram', 'summary'
  
  // 数值数据
  value: decimal('value', { precision: 15, scale: 6 }).notNull(),
  unit: text('unit'),
  
  // 标签和维度
  labels: jsonb('labels').default({}),
  dimensions: jsonb('dimensions').default({}),
  
  // 时间戳
  timestamp: timestamp('timestamp').notNull(),
  
  // AI分析标记
  isAnomaly: boolean('is_anomaly').default(false),
  anomalyScore: decimal('anomaly_score', { precision: 3, scale: 2 }),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const performanceMetricsTimestampIdx = index('performance_metrics_timestamp_idx').on(performanceMetrics.timestamp);
export const performanceMetricsProjectServiceIdx = index('performance_metrics_project_service_idx').on(
  performanceMetrics.projectId, 
  performanceMetrics.serviceName, 
  performanceMetrics.timestamp
);
export const performanceMetricsProjectIdx = index('performance_metrics_project_idx').on(performanceMetrics.projectId);
export const performanceMetricsEnvironmentIdx = index('performance_metrics_environment_idx').on(performanceMetrics.environmentId);
export const performanceMetricsTypeIdx = index('performance_metrics_type_idx').on(performanceMetrics.metricType);
export const performanceMetricsAnomalyIdx = index('performance_metrics_anomaly_idx').on(performanceMetrics.isAnomaly);

// Relations
export const performanceMetricsRelations = relations(performanceMetrics, ({ one }) => ({
  project: one(projects, {
    fields: [performanceMetrics.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [performanceMetrics.environmentId],
    references: [environments.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics);

export const selectPerformanceMetricSchema = createSelectSchema(performanceMetrics);

export const updatePerformanceMetricSchema = selectPerformanceMetricSchema.pick({
  projectId: true,
  environmentId: true,
  serviceName: true,
  metricName: true,
  metricType: true,
  value: true,
  unit: true,
  labels: true,
  dimensions: true,
  timestamp: true,
  isAnomaly: true,
  anomalyScore: true,
}).partial();

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;
export type UpdatePerformanceMetric = z.infer<typeof updatePerformanceMetricSchema>;
export type MetricType = z.infer<typeof MetricTypeEnum>;