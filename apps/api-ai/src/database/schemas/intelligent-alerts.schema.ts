import { pgTable, uuid, text, timestamp, jsonb, boolean, decimal, index, pgEnum, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { monitoringConfigs } from './monitoring-configs.schema';
import { users } from './users.schema';

// 枚举定义
export const AlertTypeEnum = z.enum(['anomaly', 'threshold', 'prediction', 'correlation']);
export const AlertSeverityEnum = z.enum(['info', 'warning', 'critical']);
export const AlertStatusEnum = z.enum(['open', 'acknowledged', 'resolved', 'suppressed']);
export const RootCauseCategoryEnum = z.enum(['performance', 'availability', 'security', 'capacity', 'configuration']);
export const ImpactLevelEnum = z.enum(['low', 'medium', 'high', 'critical']);

// 使用 pgEnum 管理枚举类型
export const AlertTypePgEnum = pgEnum('alert_type', ['anomaly', 'threshold', 'prediction', 'correlation']);
export const AlertSeverityPgEnum = pgEnum('alert_severity', ['info', 'warning', 'critical']);
export const AlertStatusPgEnum = pgEnum('alert_status', ['open', 'acknowledged', 'resolved', 'suppressed']);
export const RootCauseCategoryPgEnum = pgEnum('root_cause_category', ['performance', 'availability', 'security', 'capacity', 'configuration']);
export const ImpactLevelPgEnum = pgEnum('impact_level', ['low', 'medium', 'high', 'critical']);

export const intelligentAlerts = pgTable('intelligent_alerts', {
  id: uuid('id').defaultRandom().primaryKey(),
  monitorConfigId: uuid('monitor_config_id').references(() => monitoringConfigs.id),
  
  // 告警信息
  alertType: AlertTypePgEnum('alert_type').notNull(),
  severity: AlertSeverityPgEnum('severity').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  
  // AI分析
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }).notNull(),
  
  // 简化 rootCauseAnalysis - 核心根因分析
  rootCauseCategory: RootCauseCategoryPgEnum('root_cause_category'),
  rootCauseComponent: text('root_cause_component'),
  rootCauseDescription: text('root_cause_description'),
  
  // 简化 correlationAnalysis - 核心关联分析
  relatedAlertsCount: integer('related_alerts_count').default(0),
  correlationStrength: decimal('correlation_strength', { precision: 3, scale: 2 }),
  
  // 简化 impactAssessment - 核心影响评估
  impactLevel: ImpactLevelPgEnum('impact_level'),
  affectedServices: text('affected_services'),
  estimatedDowntime: integer('estimated_downtime'),
  
  // 预测性告警
  predictionHorizon: integer('prediction_horizon'),
  probabilityScore: decimal('probability_score', { precision: 3, scale: 2 }),
  
  // 自动修复
  autoRemediationAvailable: boolean('auto_remediation_available').default(false),
  
  // 简化 remediationActions - 核心修复动作
  remediationActionType: text('remediation_action_type'),
  remediationScript: text('remediation_script'),
  remediationSuccessRate: decimal('remediation_success_rate', { precision: 3, scale: 2 }),
  
  autoRemediationApplied: boolean('auto_remediation_applied').default(false),
  
  // 状态管理
  status: AlertStatusPgEnum('status').default('open'),
  acknowledgedBy: uuid('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),
  
  // 简化 notificationsSent - 核心通知状态
  notificationChannels: text('notification_channels'),
  notificationSentCount: integer('notification_sent_count').default(0),
  firstNotificationSentAt: timestamp('first_notification_sent_at'),
  
  escalated: boolean('escalated').default(false),
  escalatedAt: timestamp('escalated_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Indexes
export const intelligentAlertsMonitorConfigIdx = index('intelligent_alerts_monitor_config_idx').on(intelligentAlerts.monitorConfigId);
export const intelligentAlertsStatusIdx = index('intelligent_alerts_status_idx').on(intelligentAlerts.status);
export const intelligentAlertsSeverityIdx = index('intelligent_alerts_severity_idx').on(intelligentAlerts.severity);
export const intelligentAlertsTypeIdx = index('intelligent_alerts_type_idx').on(intelligentAlerts.alertType);
export const intelligentAlertsAcknowledgedByIdx = index('intelligent_alerts_acknowledged_by_idx').on(intelligentAlerts.acknowledgedBy);

// Relations
export const intelligentAlertsRelations = relations(intelligentAlerts, ({ one }) => ({
  monitorConfig: one(monitoringConfigs, {
    fields: [intelligentAlerts.monitorConfigId],
    references: [monitoringConfigs.id],
  }),
  acknowledgedByUser: one(users, {
    fields: [intelligentAlerts.acknowledgedBy],
    references: [users.id],
  }),
}));

export const insertIntelligentAlertSchema = createInsertSchema(intelligentAlerts);
export const selectIntelligentAlertSchema = createSelectSchema(intelligentAlerts);
export const updateIntelligentAlertSchema = selectIntelligentAlertSchema.pick({
  monitorConfigId: true,
  alertType: true,
  severity: true,
  title: true,
  description: true,
  aiConfidence: true,
  rootCauseCategory: true,
  rootCauseComponent: true,
  rootCauseDescription: true,
  relatedAlertsCount: true,
  correlationStrength: true,
  impactLevel: true,
  affectedServices: true,
  estimatedDowntime: true,
  predictionHorizon: true,
  probabilityScore: true,
  autoRemediationAvailable: true,
  remediationActionType: true,
  remediationScript: true,
  remediationSuccessRate: true,
  autoRemediationApplied: true,
  status: true,
  acknowledgedBy: true,
  acknowledgedAt: true,
  resolvedAt: true,
  resolutionNotes: true,
  notificationChannels: true,
  notificationSentCount: true,
  firstNotificationSentAt: true,
  escalated: true,
  escalatedAt: true,
}).partial();

export type IntelligentAlert = typeof intelligentAlerts.$inferSelect;
export type NewIntelligentAlert = typeof intelligentAlerts.$inferInsert;
export type UpdateIntelligentAlert = z.infer<typeof updateIntelligentAlertSchema>;
export type AlertType = z.infer<typeof AlertTypeEnum>;
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;
export type AlertStatus = z.infer<typeof AlertStatusEnum>;