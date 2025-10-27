import { pgTable, uuid, integer, text, timestamp, boolean, decimal, index, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
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
  
  // 指标定义
  metricName: text('metric_name').notNull(),
  metricType: MetricTypePgEnum('metric_type').notNull(),
  metricCategory: MetricCategoryPgEnum('metric_category').notNull(),
  
  // 指标值
  value: decimal('value', { precision: 15, scale: 6 }).notNull(),
  unit: text('unit'),
  
  // 简化标签（逗号分隔的键值对）
  simpleLabels: text('simple_labels'),
  
  // 时间戳
  timestamp: timestamp('timestamp').notNull(),
  
  // 基础状态标记
  isAlert: boolean('is_alert').default(false),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('performance_metrics_timestamp_idx').on(table.timestamp),
  index('performance_metrics_project_service_idx').on(table.projectId, table.serviceName, table.timestamp),
  index('performance_metrics_project_idx').on(table.projectId),
  index('performance_metrics_category_idx').on(table.metricCategory),
  index('performance_metrics_alert_idx').on(table.isAlert),
]);

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

// Zod Schemas
export const insertPerformanceMetricSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  environmentId: z.string().uuid().optional(),
  serviceName: z.string(),
  metricName: z.string(),
  metricType: MetricTypeEnum,
  metricCategory: MetricCategoryEnum,
  value: z.string(),
  unit: z.string().optional(),
  simpleLabels: z.string().optional(),
  timestamp: z.date(),
  isAlert: z.boolean().default(false),
  createdAt: z.date().optional(),
});

export const selectPerformanceMetricSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  environmentId: z.string().uuid().nullable(),
  serviceName: z.string(),
  metricName: z.string(),
  metricType: MetricTypeEnum,
  metricCategory: MetricCategoryEnum,
  value: z.string(),
  unit: z.string().nullable(),
  simpleLabels: z.string().nullable(),
  timestamp: z.date(),
  isAlert: z.boolean(),
  createdAt: z.date(),
});

export const updatePerformanceMetricSchema = insertPerformanceMetricSchema.partial();

export type PerformanceMetric = typeof performanceMetrics.$inferSelect;
export type NewPerformanceMetric = typeof performanceMetrics.$inferInsert;
export type UpdatePerformanceMetric = z.infer<typeof updatePerformanceMetricSchema>;
export type MetricType = z.infer<typeof MetricTypeEnum>;
export type MetricCategory = z.infer<typeof MetricCategoryEnum>;