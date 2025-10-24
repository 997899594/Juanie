import { pgTable, serial, integer, text, timestamp, jsonb, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { monitoringConfigs } from './monitoring-configs.schema';
import { users } from './users.schema';

// 枚举定义
export const AlertTypeEnum = z.enum(['anomaly', 'threshold', 'prediction', 'correlation']);
export const AlertSeverityEnum = z.enum(['info', 'warning', 'critical']);
export const AlertStatusEnum = z.enum(['open', 'acknowledged', 'resolved', 'suppressed']);

export const intelligentAlerts = pgTable('intelligent_alerts', {
  id: serial('id').primaryKey(),
  monitorConfigId: integer('monitor_config_id').references(() => monitoringConfigs.id),
  
  // 告警信息
  alertType: text('alert_type').notNull(), // 'anomaly', 'threshold', 'prediction', 'correlation'
  severity: text('severity').notNull(), // 'info', 'warning', 'critical'
  title: text('title').notNull(),
  description: text('description'),
  
  // AI分析
  aiConfidence: decimal('ai_confidence', { precision: 3, scale: 2 }).notNull(),
  rootCauseAnalysis: jsonb('root_cause_analysis').default({}),
  correlationAnalysis: jsonb('correlation_analysis').default([]),
  impactAssessment: jsonb('impact_assessment').default({}),
  
  // 预测性告警
  predictionHorizon: integer('prediction_horizon'), // 分钟
  probabilityScore: decimal('probability_score', { precision: 3, scale: 2 }),
  
  // 自动修复
  autoRemediationAvailable: boolean('auto_remediation_available').default(false),
  remediationActions: jsonb('remediation_actions').default([]),
  autoRemediationApplied: boolean('auto_remediation_applied').default(false),
  
  // 状态管理
  status: text('status').default('open'), // 'open', 'acknowledged', 'resolved', 'suppressed'
  acknowledgedBy: integer('acknowledged_by').references(() => users.id),
  acknowledgedAt: timestamp('acknowledged_at'),
  resolvedAt: timestamp('resolved_at'),
  resolutionNotes: text('resolution_notes'),
  
  // 通知状态
  notificationsSent: jsonb('notifications_sent').default([]),
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

// Zod Schemas with detailed enums
export const insertIntelligentAlertSchema = createInsertSchema(intelligentAlerts);

export const selectIntelligentAlertSchema = createSelectSchema(intelligentAlerts);

export const updateIntelligentAlertSchema = insertIntelligentAlertSchema.partial().omit({
  id: true,
  createdAt: true,
});

export type IntelligentAlert = typeof intelligentAlerts.$inferSelect;
export type NewIntelligentAlert = typeof intelligentAlerts.$inferInsert;
export type UpdateIntelligentAlert = z.infer<typeof updateIntelligentAlertSchema>;
export type AlertType = z.infer<typeof AlertTypeEnum>;
export type AlertSeverity = z.infer<typeof AlertSeverityEnum>;
export type AlertStatus = z.infer<typeof AlertStatusEnum>;