import { pgTable, uuid, text, timestamp, boolean, jsonb, index, integer, pgEnum } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { webhookEndpoints } from './webhook-endpoints.schema';

// Webhook 事件状态枚举：pending=待发送, delivered=已送达, failed=失败
export const WebhookEventStatusEnum = z.enum(['pending', 'delivered', 'failed']);
export const WebhookEventStatusPgEnum = pgEnum('webhook_event_status', ['pending', 'delivered', 'failed']);

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 端点ID：事件将推送到哪个Webhook端点
  endpointId: uuid('endpoint_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),

  // 事件类型：如 deployment.succeeded / pipeline.failed / incident.opened 等
  eventType: text('event_type').notNull(),

  // 事件载荷：推送的数据内容（JSON）
  payload: jsonb('payload').notNull(),

  // 消息签名：用于目标服务验签
  signature: text('signature'),

  // 状态：pending/delivered/failed
  status: WebhookEventStatusPgEnum('status').notNull().default('pending'),

  // 重试次数：用于重试策略
  retryCount: integer('retry_count').notNull().default(0),

  // 目标响应码：HTTP状态码（如200/400/500）
  responseCode: integer('response_code'),

  // 目标响应体：简要或截断存储以便审计
  responseBody: text('response_body'),

  // 错误信息：失败时记录错误原因
  errorMessage: text('error_message'),

  // 送达时间：成功发送的时间
  deliveredAt: timestamp('delivered_at'),

  // 备注：管理员或系统备注
  description: text('description'),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const webhookEventsIndexes = {
  endpointIdx: index('webhook_events_endpoint_idx').on(webhookEvents.endpointId),
  typeIdx: index('webhook_events_type_idx').on(webhookEvents.eventType),
  statusIdx: index('webhook_events_status_idx').on(webhookEvents.status),
  deliveredAtIdx: index('webhook_events_delivered_at_idx').on(webhookEvents.deliveredAt),
  createdAtIdx: index('webhook_events_created_at_idx').on(webhookEvents.createdAt),
};

export const insertWebhookEventSchema = z.object({
  id: z.string().uuid().optional(),
  endpointId: z.string().uuid(),
  eventType: z.string().min(1),
  payload: z.record(z.string(), z.object({})),
  signature: z.string().optional(),
  status: WebhookEventStatusEnum.optional(),
  retryCount: z.number().int().optional(),
  responseCode: z.number().int().optional(),
  responseBody: z.string().optional(),
  errorMessage: z.string().optional(),
  deliveredAt: z.date().optional(),
  description: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectWebhookEventSchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  eventType: z.string(),
  payload: z.record(z.string(), z.object({})),
  signature: z.string().nullable(),
  status: WebhookEventStatusEnum,
  retryCount: z.number().int(),
  responseCode: z.number().int().nullable(),
  responseBody: z.string().nullable(),
  errorMessage: z.string().nullable(),
  deliveredAt: z.date().nullable(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateWebhookEventSchema = selectWebhookEventSchema
  .pick({ status: true, retryCount: true, responseCode: true, responseBody: true, errorMessage: true, deliveredAt: true, description: true })
  .partial();

export type WebhookEvent = typeof webhookEvents.$inferSelect;
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;
export type UpdateWebhookEvent = z.infer<typeof updateWebhookEventSchema>;