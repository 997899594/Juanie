import { index, jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { users } from '../auth/users.schema'
import { organizations } from '../organization/organizations.schema'

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id),
    organizationId: uuid('organization_id').references(() => organizations.id),

    action: text('action').notNull(), // 'user.login', 'project.create', 'deployment.approve'
    resourceType: text('resource_type'), // 'project', 'deployment', 'user'
    resourceId: uuid('resource_id'),

    // 元数据（JSONB）
    metadata: jsonb('metadata').$type<Record<string, any>>(),

    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),

    // 安全违规相关
    violationSeverity: text('violation_severity'), // 'low', 'medium', 'high', 'critical'

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('audit_user_idx').on(table.userId),
    index('audit_org_idx').on(table.organizationId),
    index('audit_action_idx').on(table.action),
    index('audit_created_idx').on(table.createdAt),
  ],
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
