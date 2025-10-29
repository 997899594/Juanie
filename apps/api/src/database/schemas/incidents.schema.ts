import { pgTable, uuid, text, integer, timestamp, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';
import { environments } from './environments.schema';
import { users } from './users.schema';

export const incidents = pgTable('incidents', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').references(() => projects.id),
    environmentId: uuid('environment_id').references(() => environments.id),

    title: text('title').notNull(),
    description: text('description'),
    severity: text('severity').notNull(), // 'low', 'medium', 'high', 'critical'
    status: text('status').notNull().default('open'), // 'open', 'investigating', 'resolved', 'closed'

    // AI 检测相关
    source: text('source').notNull(), // 'manual', 'ai', 'monitoring'
    aiConfidence: integer('ai_confidence'), // 0-100

    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    index('incidents_project_idx').on(table.projectId),
    index('incidents_severity_idx').on(table.severity),
    index('incidents_status_idx').on(table.status),
]);

export type Incident = typeof incidents.$inferSelect;
export type NewIncident = typeof incidents.$inferInsert;
