import { pgTable, uuid, text, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { organizations } from './organizations.schema';
import { projects } from './projects.schema';

// 事件优先级：低/中/高/紧急（用于队列调度）
export const EventPriorityEnum = z.enum(['low', 'medium', 'high', 'urgent']);
export const EventPriorityPgEnum = pgEnum('event_priority', ['low', 'medium', 'high', 'urgent']);

// 事件状态：生成/入队/处理成功/处理失败
export const EventStatusEnum = z.enum(['created', 'queued', 'processed', 'failed']);
export const EventStatusPgEnum = pgEnum('event_status', ['created', 'queued', 'processed', 'failed']);

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 组织ID：事件归属组织
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // 项目ID：事件归属项目
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // 事件类型：如 'deployment.started', 'pipeline.failed', 'incident.opened'
  eventType: text('event_type').notNull(),

  // 事件来源：系统组件或服务名（如 'api', 'runner', 'scheduler'）
  source: text('source'),

  // 优先级
  priority: EventPriorityPgEnum('priority').notNull().default('medium'),

  // 状态
  status: EventStatusPgEnum('status').notNull().default('created'),

  // 事件载荷：自定义数据
  payload: jsonb('payload').notNull(),

  // 追踪ID：用于串联跨服务处理流程
  traceId: text('trace_id'),
  spanId: text('span_id'),

  // 处理结果：成功/失败的附加信息
  result: jsonb('result').$type<Record<string, unknown>>(),

  // 关键时间点
  queuedAt: timestamp('queued_at'),
  processedAt: timestamp('processed_at'),
  failedAt: timestamp('failed_at'),

  // 时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const eventsIndexes = {
  orgIdx: index('events_org_idx').on(events.organizationId),
  projectIdx: index('events_project_idx').on(events.projectId),
  typeIdx: index('events_type_idx').on(events.eventType),
  sourceIdx: index('events_source_idx').on(events.source),
  priorityIdx: index('events_priority_idx').on(events.priority),
  statusIdx: index('events_status_idx').on(events.status),
  createdAtIdx: index('events_created_at_idx').on(events.createdAt),
  processedAtIdx: index('events_processed_at_idx').on(events.processedAt),
};

export const insertEventSchema = createInsertSchema(events, {
  eventType: z.string().min(1),
  priority: EventPriorityEnum,
  status: EventStatusEnum,
});
export const selectEventSchema = createSelectSchema(events);
export const updateEventSchema = selectEventSchema
  .pick({ priority: true, status: true, result: true, queuedAt: true, processedAt: true, failedAt: true })
  .partial();

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type EventPriority = z.infer<typeof EventPriorityEnum>;