import { pgTable, uuid, text, timestamp, varchar, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { users } from './users.schema';
import { oauthAccounts } from './oauth-accounts.schema';

// OAuth 应用会话管理（应用层登录态）
export const authSessions = pgTable('auth_sessions', {
  // 主键，使用 UUID，唯一标识一条会话记录
  id: uuid('id').defaultRandom().primaryKey(),
  
  // 关联的用户ID，删除用户时级联删除会话
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  
  // 关联的OAuth账号（如GitLab），便于定位来源账号与令牌
  accountId: uuid('account_id').references(() => oauthAccounts.id, { onDelete: 'set null' }),

  // 会话令牌哈希（不存明文），用于服务端校验登录态
  sessionTokenHash: text('session_token_hash').notNull(),
  
  // 刷新令牌哈希（不存明文），用于刷新登录态
  refreshTokenHash: text('refresh_token_hash'),

  // 访问令牌过期时间（会话有效期），用于强制重新登录
  accessExpiresAt: timestamp('access_expires_at'),
  
  // 刷新令牌过期时间，用于控制可刷新时长
  refreshExpiresAt: timestamp('refresh_expires_at'),

  // 最近一次使用时间，用于活动监控与自动登出
  lastUsedAt: timestamp('last_used_at'),

  // 登录来源IP（IPv4/IPv6），用于审计与风控
  ipAddress: varchar('ip_address', { length: 45 }),

  // 登录来源的User-Agent，辅助审计与设备管理
  userAgent: text('user_agent'),

  // 会话撤销时间（如登出或风控封禁）
  revokedAt: timestamp('revoked_at'),

  // 记录创建与更新的时间戳
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

// 索引与唯一约束
export const authSessionsIndexes = {
  userIdIdx: index('auth_sessions_user_id_idx').on(authSessions.userId),
  accountIdIdx: index('auth_sessions_account_id_idx').on(authSessions.accountId),
  sessionTokenUnique: uniqueIndex('auth_sessions_session_token_hash_unique').on(authSessions.sessionTokenHash),
};

// Zod Schemas
export const insertAuthSessionSchema = z.object({
  id: z.string().uuid().optional(),
  userId: z.string().uuid(),
  accountId: z.string().uuid().optional(),
  sessionTokenHash: z.string().min(20),
  refreshTokenHash: z.string().min(20).optional(),
  accessExpiresAt: z.date().optional(),
  refreshExpiresAt: z.date().optional(),
  lastUsedAt: z.date().optional(),
  ipAddress: z.string().max(45).optional(),
  userAgent: z.string().optional(),
  revokedAt: z.date().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectAuthSessionSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  accountId: z.string().uuid().nullable(),
  sessionTokenHash: z.string(),
  refreshTokenHash: z.string().nullable(),
  accessExpiresAt: z.date().nullable(),
  refreshExpiresAt: z.date().nullable(),
  lastUsedAt: z.date().nullable(),
  ipAddress: z.string().nullable(),
  userAgent: z.string().nullable(),
  revokedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;
export type UpdateAuthSession = z.infer<typeof insertAuthSessionSchema>;