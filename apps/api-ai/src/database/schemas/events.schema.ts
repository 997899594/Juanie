import { pgTable, uuid, text, timestamp, jsonb, index, pgEnum } from 'drizzle-orm/pg-core';
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

// Zod Schemas
export const insertEventSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  eventType: z.string().min(1),
  source: z.string().optional(),
  priority: EventPriorityEnum.default('medium'),
  status: EventStatusEnum.default('created'),
  payload: z.unknown(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  queuedAt: z.date().optional(),
  processedAt: z.date().optional(),
  failedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectEventSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  eventType: z.string(),
  source: z.string().nullable(),
  priority: EventPriorityEnum,
  status: EventStatusEnum,
  payload: z.unknown(),
  traceId: z.string().nullable(),
  spanId: z.string().nullable(),
  result: z.record(z.string(), z.unknown()).nullable(),
  queuedAt: z.date().nullable(),
  processedAt: z.date().nullable(),
  failedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateEventSchema = z.object({
  priority: EventPriorityEnum.optional(),
  status: EventStatusEnum.optional(),
  result: z.record(z.string(), z.unknown()).optional(),
  queuedAt: z.date().optional(),
  processedAt: z.date().optional(),
  failedAt: z.date().optional(),
});

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type UpdateEvent = z.infer<typeof updateEventSchema>;
export type EventPriority = z.infer<typeof EventPriorityEnum>;