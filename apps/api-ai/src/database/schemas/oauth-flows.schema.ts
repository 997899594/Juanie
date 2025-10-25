import { pgTable, uuid, varchar, text, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// OAuth 授权流程状态（支持 OIDC/PKCE 安全最佳实践）
export const oauthFlows = pgTable('oauth_flows', {
  // 主键，使用 UUID，唯一标识一次授权流程
  id: uuid('id').defaultRandom().primaryKey(),

  // OAuth 提供商，如 'gitlab'、'github'、'okta' 等
  provider: varchar('provider', { length: 50 }).notNull(),

  // 授权流程的 state，用于防止CSRF；唯一约束保证不可重复使用
  state: varchar('state', { length: 255 }).notNull(),

  // OIDC 的 nonce，用于防止重放攻击
  nonce: varchar('nonce', { length: 255 }),

  // PKCE 的 code_verifier（仅在服务端存储，不泄露给前端）
  codeVerifier: text('code_verifier'),

  // 重定向回调地址，用于校验合法回调域
  redirectUri: text('redirect_uri').notNull(),

  // 授权流程创建时间与过期时间（通常几分钟）
  createdAt: timestamp('created_at').notNull().defaultNow(),
  expiresAt: timestamp('expires_at'),

  // 授权流程被使用的时间（交换令牌成功后标记）
  usedAt: timestamp('used_at'),

  // 流程发起端信息（用于审计与风控）
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  // 错误信息（如授权失败时的错误码与说明）
  errorCode: varchar('error_code', { length: 100 }),
  errorDescription: text('error_description'),
});

// 索引与唯一约束
export const oauthFlowsIndexes = {
  providerIdx: index('oauth_flows_provider_idx').on(oauthFlows.provider),
  usedAtIdx: index('oauth_flows_used_at_idx').on(oauthFlows.usedAt),
  stateUnique: uniqueIndex('oauth_flows_state_unique').on(oauthFlows.state),
};

// Zod 校验（插入与选择）
export const insertOAuthFlowSchema = createInsertSchema(oauthFlows, {
  provider: z.string().min(2).max(50),
  state: z.string().min(8).max(255),
  redirectUri: z.string().url(),
});

export const selectOAuthFlowSchema = createSelectSchema(oauthFlows);

export type OAuthFlow = typeof oauthFlows.$inferSelect;
export type NewOAuthFlow = typeof oauthFlows.$inferInsert;
export type UpdateOAuthFlow = z.infer<typeof insertOAuthFlowSchema>;