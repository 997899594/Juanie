import { pgTable, serial, integer, text, timestamp, jsonb, boolean, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// 枚举定义
export const ResourceTypeEnum = z.enum(['project', 'environment', 'service', 'data']);

export const zeroTrustPolicies = pgTable('zero_trust_policies', {
  id: serial('id').primaryKey(),
  resourceType: text('resource_type').notNull(), // 'project', 'environment', 'service', 'data'
  resourceId: integer('resource_id').notNull(),
  
  // 访问条件
  userConditions: jsonb('user_conditions').default({}), // 用户属性要求
  deviceConditions: jsonb('device_conditions').default({}), // 设备要求
  networkConditions: jsonb('network_conditions').default({}), // 网络位置要求
  timeConditions: jsonb('time_conditions').default({}), // 时间限制
  
  // 持续验证
  continuousVerification: boolean('continuous_verification').default(true),
  verificationInterval: integer('verification_interval').default(3600), // 秒
  riskThreshold: decimal('risk_threshold', { precision: 3, scale: 2 }).default('0.7'),
  
  // 自适应访问
  adaptiveAccess: boolean('adaptive_access').default(true),
  aiRiskScoring: boolean('ai_risk_scoring').default(true),
  
  // 审计要求
  auditAllAccess: boolean('audit_all_access').default(true),
  logFailedAttempts: boolean('log_failed_attempts').default(true),
  
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const zeroTrustPoliciesResourceIdx = index('zero_trust_policies_resource_idx').on(zeroTrustPolicies.resourceType, zeroTrustPolicies.resourceId);
export const zeroTrustPoliciesResourceTypeIdx = index('zero_trust_policies_resource_type_idx').on(zeroTrustPolicies.resourceType);
export const zeroTrustPoliciesActiveIdx = index('zero_trust_policies_active_idx').on(zeroTrustPolicies.isActive);

// Relations - 由于资源类型是动态的，这里不定义具体的关系

// Zod Schemas with detailed enums
export const insertZeroTrustPolicySchema = createInsertSchema(zeroTrustPolicies);

export const selectZeroTrustPolicySchema = createSelectSchema(zeroTrustPolicies);

export const updateZeroTrustPolicySchema = insertZeroTrustPolicySchema.partial().omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type ZeroTrustPolicy = typeof zeroTrustPolicies.$inferSelect;
export type NewZeroTrustPolicy = typeof zeroTrustPolicies.$inferInsert;
export type UpdateZeroTrustPolicy = z.infer<typeof updateZeroTrustPolicySchema>;
export type ResourceType = z.infer<typeof ResourceTypeEnum>;