import { pgTable, uuid, integer, text, timestamp, jsonb, boolean, index, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';

// 枚举定义
export const MonitorTypeEnum = z.enum(['uptime', 'performance', 'error_rate', 'custom']);
export const MonitorTypePgEnum = pgEnum('monitor_type', ['uptime', 'performance', 'error_rate', 'custom']);

export const monitoringConfigs = pgTable('monitoring_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  environmentId: uuid('environment_id').references(() => environments.id),
  serviceName: text('service_name'),
  
  // 监控类型
  monitorType: MonitorTypePgEnum('monitor_type').notNull(),
  
  // 配置参数
  checkInterval: integer('check_interval').default(60), // 秒
  timeout: integer('timeout').default(30), // 秒
  retryCount: integer('retry_count').default(3),
  
  // 简化 checkConfig - 核心检查配置
  checkUrl: text('check_url'), // 检查URL
  checkMethod: text('check_method').default('GET'), // 检查方法
  checkHeaders: text('check_headers'), // 检查头信息（JSON字符串）
  checkBody: text('check_body'), // 检查请求体
  expectedStatusCode: integer('expected_status_code').default(200), // 期望状态码
  expectedResponseContains: text('expected_response_contains'), // 期望响应包含
  
  // AI增强
  aiAnomalyDetection: boolean('ai_anomaly_detection').default(true),
  baselineLearningEnabled: boolean('baseline_learning_enabled').default(true),
  autoThresholdAdjustment: boolean('auto_threshold_adjustment').default(true),
  
  // 简化 warningThreshold - 核心警告阈值
  warningResponseTime: integer('warning_response_time').default(2000), // 警告响应时间（毫秒）
  warningErrorRate: decimal('warning_error_rate', { precision: 5, scale: 2 }).default('5.00'), // 警告错误率（%）
  
  // 简化 criticalThreshold - 核心严重阈值
  criticalResponseTime: integer('critical_response_time').default(5000), // 严重响应时间（毫秒）
  criticalErrorRate: decimal('critical_error_rate', { precision: 5, scale: 2 }).default('10.00'), // 严重错误率（%）
  
  // 简化 notificationChannels - 核心通知渠道
  emailNotifications: boolean('email_notifications').default(true), // 邮件通知
  slackNotifications: boolean('slack_notifications').default(false), // Slack通知
  smsNotifications: boolean('sms_notifications').default(false), // 短信通知
  
  // 简化 escalationPolicy - 核心升级策略
  escalationEnabled: boolean('escalation_enabled').default(false), // 是否启用升级
  escalationAfterMinutes: integer('escalation_after_minutes').default(30), // 升级时间（分钟）
  escalationEmail: text('escalation_email'), // 升级邮箱
  
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

export const updateMonitoringConfigSchema = selectMonitoringConfigSchema.pick({
  projectId: true,
  environmentId: true,
  serviceName: true,
  monitorType: true,
  checkInterval: true,
  timeout: true,
  retryCount: true,
  checkUrl: true,
  checkMethod: true,
  checkHeaders: true,
  checkBody: true,
  expectedStatusCode: true,
  expectedResponseContains: true,
  aiAnomalyDetection: true,
  baselineLearningEnabled: true,
  autoThresholdAdjustment: true,
  warningResponseTime: true,
  warningErrorRate: true,
  criticalResponseTime: true,
  criticalErrorRate: true,
  emailNotifications: true,
  slackNotifications: true,
  smsNotifications: true,
  escalationEnabled: true,
  escalationAfterMinutes: true,
  escalationEmail: true,
  isActive: true,
}).partial();

export type MonitoringConfig = typeof monitoringConfigs.$inferSelect;
export type NewMonitoringConfig = typeof monitoringConfigs.$inferInsert;
export type UpdateMonitoringConfig = z.infer<typeof updateMonitoringConfigSchema>;
export type MonitorType = z.infer<typeof MonitorTypeEnum>;