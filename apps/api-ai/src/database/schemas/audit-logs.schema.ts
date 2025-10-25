import { pgTable, uuid, text, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';
import { projects } from './projects.schema';
import { users } from './users.schema';

// 行为结果：成功/失败/拒绝（风控或权限不足）
export const AuditOutcomeEnum = z.enum(['success', 'failure', 'denied']);
export const AuditOutcomePgEnum = pgEnum('audit_outcome', ['success', 'failure', 'denied']);

// 严重级别：审计事件的敏感性与风险级别
export const AuditSeverityEnum = z.enum(['low', 'medium', 'high', 'critical']);
export const AuditSeverityPgEnum = pgEnum('audit_severity', ['low', 'medium', 'high', 'critical']);

// 行为主体类型：用户/系统/服务账户
export const AuditActorTypeEnum = z.enum(['user', 'system', 'service']);
export const AuditActorTypePgEnum = pgEnum('audit_actor_type', ['user', 'system', 'service']);

export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 组织ID：审计事件所属组织
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // 项目ID：审计事件所属项目
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // 用户ID：产生该行为的用户（如有）
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),

  // 主体类型：user/system/service
  actorType: AuditActorTypePgEnum('actor_type').notNull().default('user'),

  // 主体ID：服务账户或系统组件的标识（当 actorType≠user 时使用）
  actorId: text('actor_id'),

  // 操作行为：如 'login', 'logout', 'create_project', 'delete_pipeline', 'update_role'
  action: text('action').notNull(),

  // 资源类型与ID：如 'project'/'pipeline'/'deployment' 等及其ID
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),

  // 请求追踪：用于跨系统串联审计（requestId 与 correlationId）
  requestId: text('request_id'),
  correlationId: text('correlation_id'),

  // 客户端信息：IP与User-Agent
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),

  // 结果与严重级别
  outcome: AuditOutcomePgEnum('outcome').notNull().default('success'),
  severity: AuditSeverityPgEnum('severity').notNull().default('low'),

  // 结果原因：失败或拒绝的具体说明
  reason: text('reason'),

  // 额外元数据：行为上下文（如旧值/新值、差异、策略命中）
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const auditLogsIndexes = {
  orgIdx: index('audit_logs_org_idx').on(auditLogs.organizationId),
  projectIdx: index('audit_logs_project_idx').on(auditLogs.projectId),
  userIdx: index('audit_logs_user_idx').on(auditLogs.userId),
  actionIdx: index('audit_logs_action_idx').on(auditLogs.action),
  resourceIdx: index('audit_logs_resource_idx').on(auditLogs.resourceType, auditLogs.resourceId),
  outcomeIdx: index('audit_logs_outcome_idx').on(auditLogs.outcome),
  severityIdx: index('audit_logs_severity_idx').on(auditLogs.severity),
  createdAtIdx: index('audit_logs_created_at_idx').on(auditLogs.createdAt),
  correlationIdx: index('audit_logs_correlation_idx').on(auditLogs.correlationId),
};

export const insertAuditLogSchema = createInsertSchema(auditLogs, {
  action: z.string().min(1),
  actorType: AuditActorTypeEnum,
  outcome: AuditOutcomeEnum,
  severity: AuditSeverityEnum,
});
export const selectAuditLogSchema = createSelectSchema(auditLogs);
export const updateAuditLogSchema = selectAuditLogSchema
  .pick({ outcome: true, severity: true, reason: true, metadata: true })
  .partial();

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
export type UpdateAuditLog = z.infer<typeof updateAuditLogSchema>;
export type AuditOutcome = z.infer<typeof AuditOutcomeEnum>;
export type AuditSeverity = z.infer<typeof AuditSeverityEnum>;
export type AuditActorType = z.infer<typeof AuditActorTypeEnum>;