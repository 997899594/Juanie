import { pgTable, serial, integer, text, timestamp, jsonb, boolean, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';

// 枚举定义
export const MonitorTypeEnum = z.enum(['uptime', 'performance', 'error_rate', 'custom']);

export const monitoringConfigs = pgTable('monitoring_configs', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  environmentId: integer('environment_id').references(() => environments.id),
  serviceName: text('service_name'),
  
  // 监控类型
  monitorType: text('monitor_type').notNull(), // 'uptime', 'performance', 'error_rate', 'custom'
  
  // 配置参数
  checkInterval: integer('check_interval').default(60), // 秒
  timeout: integer('timeout').default(30), // 秒
  retryCount: integer('retry_count').default(3),
  
  // 检查配置
  checkConfig: jsonb('check_config').notNull(),
  
  // AI增强
  aiAnomalyDetection: boolean('ai_anomaly_detection').default(true),
  baselineLearningEnabled: boolean('baseline_learning_enabled').default(true),
  autoThresholdAdjustment: boolean('auto_threshold_adjustment').default(true),
  
  // 阈值配置
  warningThreshold: jsonb('warning_threshold').default({}),
  criticalThreshold: jsonb('critical_threshold').default({}),
  
  // 通知配置
  notificationChannels: jsonb('notification_channels').default([]),
  escalationPolicy: jsonb('escalation_policy').default({}),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const monitoringConfigsProjectIdx = index('monitoring_configs_project_idx').on(monitoringConfigs.projectId);
export const monitoringConfigsEnvironmentIdx = index('monitoring_configs_environment_idx').on(monitoringConfigs.environmentId);
export const monitoringConfigsTypeIdx = index('monitoring_configs_type_idx').on(monitoringConfigs.monitorType);
export const monitoringConfigsActiveIdx = index('monitoring_configs_active_idx').on(monitoringConfigs.isActive);

// Relations
export const monitoringConfigsRelations = relations(monitoringConfigs, ({ one }) => ({
  project: one(projects, {
    fields: [monitoringConfigs.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [monitoringConfigs.environmentId],
    references: [environments.id],
  }),
}));

// Zod Schemas with detailed enums
export const insertMonitoringConfigSchema = createInsertSchema(monitoringConfigs);

export const selectMonitoringConfigSchema = createSelectSchema(monitoringConfigs);

export const updateMonitoringConfigSchema = insertMonitoringConfigSchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type MonitoringConfig = typeof monitoringConfigs.$inferSelect;
export type NewMonitoringConfig = typeof monitoringConfigs.$inferInsert;
export type UpdateMonitoringConfig = z.infer<typeof updateMonitoringConfigSchema>;
export type MonitorType = z.infer<typeof MonitorTypeEnum>;