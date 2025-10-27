import { pgTable, text, timestamp, jsonb, decimal, index, integer, boolean, uuid, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { z } from 'zod';

// 枚举定义
export const PlanTypeEnum = z.enum(['free', 'starter', 'professional', 'enterprise']);
export const PlanTypePgEnum = pgEnum('plan_type', ['free', 'starter', 'professional', 'enterprise'])

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(), // 组织唯一ID
  name: text('name').notNull(), // 组织名称
  slug: text('slug').notNull().unique(), // 组织标识 slug
  displayName: text('display_name'), // 展示名称
  description: text('description'), // 组织描述
  logoUrl: text('logo_url'), // Logo 地址
  website: text('website'), // 官网地址
  // 简化 settings - 核心组织设置
  timezone: text('timezone').default('UTC'), // 时区
  language: text('language').default('en'), // 语言
  emailDomain: text('email_domain'), // 邮件域名
  twoFactorAuthEnabled: boolean('two_factor_auth_enabled').default(false), // 双因素认证开关
  // 简化 billingInfo - 核心计费信息
  billingEmail: text('billing_email'), // 计费邮箱
  billingAddress: text('billing_address'), // 计费地址
  taxId: text('tax_id'), // 税号
  paymentMethod: text('payment_method'), // 支付方式
  planType: PlanTypePgEnum('plan_type').default('free'), // 套餐类型：free/starter/professional/enterprise
  // 简化 usageLimits - 核心使用限制
  maxProjects: integer('max_projects').default(1), // 最大项目数
  maxUsers: integer('max_users').default(5), // 最大用户数
  maxStorageGb: integer('max_storage_gb').default(1), // 最大存储（GB）
  maxMonthlyRuns: integer('max_monthly_runs').default(100), // 最大月度运行次数
  // 简化 currentUsage - 核心当前使用量
  currentProjects: integer('current_projects').default(0), // 当前项目数
  currentUsers: integer('current_users').default(0), // 当前用户数
  currentStorageGb: integer('current_storage_gb').default(0), // 当前存储使用（GB）
  currentMonthlyRuns: integer('current_monthly_runs').default(0), // 当前月度运行次数
  createdAt: timestamp('created_at').defaultNow().notNull(), // 创建时间
  updatedAt: timestamp('updated_at').defaultNow().notNull(), // 更新时间
}, (table) => [
  index('organizations_slug_idx').on(table.slug),
  index('organizations_name_idx').on(table.name),
]);

// Zod Schemas with detailed enums
export const insertOrganizationSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/),
  displayName: z.string().max(100).optional(),
  description: z.string().max(500).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  timezone: z.string().optional(),
  language: z.string().optional(),
  emailDomain: z.string().optional(),
  twoFactorAuthEnabled: z.boolean().optional(),
  billingEmail: z.string().email().optional(),
  billingAddress: z.string().optional(),
  taxId: z.string().optional(),
  paymentMethod: z.string().optional(),
  planType: PlanTypeEnum.optional(),
  maxProjects: z.number().int().min(1).optional(),
  maxUsers: z.number().int().min(1).optional(),
  maxStorageGb: z.number().int().min(1).optional(),
  maxMonthlyRuns: z.number().int().min(1).optional(),
  currentProjects: z.number().int().min(0).optional(),
  currentUsers: z.number().int().min(0).optional(),
  currentStorageGb: z.number().int().min(0).optional(),
  currentMonthlyRuns: z.number().int().min(0).optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectOrganizationSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  displayName: z.string().nullable(),
  description: z.string().nullable(),
  logoUrl: z.string().nullable(),
  website: z.string().nullable(),
  timezone: z.string(),
  language: z.string(),
  emailDomain: z.string().nullable(),
  twoFactorAuthEnabled: z.boolean(),
  billingEmail: z.string().nullable(),
  billingAddress: z.string().nullable(),
  taxId: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  planType: z.string(),
  maxProjects: z.number().int(),
  maxUsers: z.number().int(),
  maxStorageGb: z.number().int(),
  maxMonthlyRuns: z.number().int(),
  currentProjects: z.number().int(),
  currentUsers: z.number().int(),
  currentStorageGb: z.number().int(),
  currentMonthlyRuns: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateOrganizationSchema = selectOrganizationSchema.pick({
  name: true,
  slug: true,
  displayName: true,
  description: true,
  logoUrl: true,
  website: true,
  timezone: true,
  language: true,
  emailDomain: true,
  twoFactorAuthEnabled: true,
  billingEmail: true,
  billingAddress: true,
  taxId: true,
  paymentMethod: true,
  maxProjects: true,
  maxUsers: true,
  maxStorageGb: true,
  maxMonthlyRuns: true,
  currentProjects: true,
  currentUsers: true,
  currentStorageGb: true,
  currentMonthlyRuns: true,
}).partial();

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type PlanType = z.infer<typeof PlanTypeEnum>;