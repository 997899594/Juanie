import { pgTable, uuid, integer, text, timestamp, boolean, decimal, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';

// 简化枚举定义
export const MetricTypeEnum = z.enum(['counter', 'gauge', 'histogram', 'summary']);
export const MetricCategoryEnum = z.enum(['performance', 'availability', 'error', 'capacity']);
export const MetricTypePgEnum = pgEnum('metric_type', ['counter', 'gauge', 'histogram', 'summary']);
export const MetricCategoryPgEnum = pgEnum('metric_category', ['performance', 'availability', 'error', 'capacity']);

export const performanceMetrics = pgTable('performance_metrics', {
  id: uuid('id').defaultRandom().primaryKey(),
  projectId: uuid('project_id').references(() => projects.id),
  environmentId: uuid('environment_id').references(() => environments.id),
  serviceName: text('service_name').notNull(),
  
  // 基础指标信息
  metricName: text('metric_name').notNull(),
  metricType: MetricTypePgEnum('metric_type').notNull(),
  metricCategory: MetricCategoryPgEnum('metric_category').notNull(),
  
  // 数值数据
  value: decimal('value', { precision: 15, scale: 6 }).notNull(),
  unit: text('unit'),
  
  // 简化标签（用逗号分隔的key=value格式）
  simpleLabels: text('simple_labels'),
  
  // 时间戳
  timestamp: timestamp('timestamp').notNull(),
  
  // 基础状态标记
  isAlert: boolean('is_alert').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// 简化索引定义
export const performanceMetricsTimestampIdx = index('performance_metrics_timestamp_idx').on(performanceMetrics.timestamp);
export const performanceMetricsProjectServiceIdx = index('performance_metrics_project_service_idx').on(
  performanceMetrics.projectId, 
  performanceMetrics.serviceName, 
  performanceMetrics.timestamp
);
export const performanceMetricsProjectIdx = index('performance_metrics_project_idx').on(performanceMetrics.projectId);
export const performanceMetricsCategoryIdx = index('performance_metrics_category_idx').on(performanceMetrics.metricCategory);
export const performanceMetricsAlertIdx = index('performance_metrics_alert_idx').on(performanceMetrics.isAlert);

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

// 简化的Zod Schemas
export const insertPerformanceMetricSchema = createInsertSchema(performanceMetrics, {
  metricType: MetricTypeEnum,
  metricCategory: MetricCategoryEnum,
  value: z.string(),
});

export const selectPerformanceMetricSchema = createSelectSchema(performanceMetrics);

export const updatePerformanceMetricSchema = insertPerformanceMetricSchema.partial();

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;
export type UpdatePerformanceMetric = z.infer<typeof updatePerformanceMetricSchema>;
export type MetricType = z.infer<typeof MetricTypeEnum>;
export type MetricCategory = z.infer<typeof MetricCategoryEnum>;