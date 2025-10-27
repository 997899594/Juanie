import { pgTable, uuid, text, timestamp, boolean, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { organizations } from './organizations.schema';
import { projects } from './projects.schema';

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),

  // 组织ID：该端点所属组织（用于组织级事件推送）
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'cascade' }),

  // 项目ID：该端点所属项目（用于项目级事件推送）
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),

  // 端点名称：用于管理后台展示与区分
  name: text('name').notNull(),

  // 回调URL：事件推送的目标地址
  url: text('url').notNull(),

  // 签名密钥：用于生成消息签名（建议仅保存哈希或使用密钥管理）
  secret: text('secret'),

  // 是否启用：控制该端点是否接收事件
  enabled: boolean('enabled').notNull().default(true),

  // 订阅事件：该端点订阅的事件类型列表（如 deployment.succeeded, pipeline.failed 等）
  subscribedEvents: text('subscribed_events').array(),

  // 传输设置：自定义header、重试策略等
  settings: jsonb('settings').$type<{
    headers?: Record<string, string>;
    retry?: { maxAttempts?: number; backoffMs?: number };
    signature?: { algorithm?: 'sha256' | 'sha1'; header?: string };
    timeoutMs?: number;
  }>(),

  // 运行状态：最近一次成功/失败时间、失败累计次数
  lastSuccessAt: timestamp('last_success_at'),
  lastFailureAt: timestamp('last_failure_at'),
  failureCount: text('failure_count'), // 备注：可按字符串存储以便迁移灵活；也可改为integer

  // 备注：管理员说明
  description: text('description'),

  // 时间戳：创建与更新
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const webhookEndpointsIndexes = {
  orgIdx: index('webhook_endpoints_org_idx').on(webhookEndpoints.organizationId),
  projectIdx: index('webhook_endpoints_project_idx').on(webhookEndpoints.projectId),
  enabledIdx: index('webhook_endpoints_enabled_idx').on(webhookEndpoints.enabled),
  urlIdx: index('webhook_endpoints_url_idx').on(webhookEndpoints.url),
  uniqueOrgUrl: uniqueIndex('webhook_endpoints_org_url_unique').on(
    webhookEndpoints.organizationId,
    webhookEndpoints.url,
  ),
  uniqueProjectUrl: uniqueIndex('webhook_endpoints_project_url_unique').on(
    webhookEndpoints.projectId,
    webhookEndpoints.url,
  ),
};

export const insertWebhookEndpointSchema = z.object({
  id: z.string().uuid().optional(),
  organizationId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  name: z.string().min(1),
  url: z.string().url(),
  secret: z.string().optional(),
  enabled: z.boolean().optional(),
  subscribedEvents: z.array(z.string()).optional(),
  settings: z.record(z.string(), z.object({})).optional(),
  lastSuccessAt: z.date().optional(),
  lastFailureAt: z.date().optional(),
  failureCount: z.string().optional(),
  description: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectWebhookEndpointSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid().nullable(),
  projectId: z.string().uuid().nullable(),
  name: z.string(),
  url: z.string(),
  secret: z.string().nullable(),
  enabled: z.boolean(),
  subscribedEvents: z.array(z.string()).nullable(),
  settings: z.record(z.string(), z.object({})).nullable(),
  lastSuccessAt: z.date().nullable(),
  lastFailureAt: z.date().nullable(),
  failureCount: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
export const updateWebhookEndpointSchema = selectWebhookEndpointSchema
  .pick({ name: true, url: true, secret: true, enabled: true, subscribedEvents: true, settings: true, description: true })
  .partial();

export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type UpdateWebhookEndpoint = z.infer<typeof updateWebhookEndpointSchema>;