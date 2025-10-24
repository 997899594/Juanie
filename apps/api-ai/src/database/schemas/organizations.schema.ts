import { pgTable, serial, text, timestamp, jsonb, decimal, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';

// 枚举定义
export const PlanTypeEnum = z.enum(['free', 'starter', 'professional', 'enterprise']);

export const organizations = pgTable('organizations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name'),
  description: text('description'),
  logoUrl: text('logo_url'),
  website: text('website'),
  settings: jsonb('settings').default({}),
  billingInfo: jsonb('billing_info').default({}),
  planType: text('plan_type').default('free'), // 'free', 'starter', 'professional', 'enterprise'
  usageLimits: jsonb('usage_limits').default({}),
  currentUsage: jsonb('current_usage').default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Indexes
export const organizationsSlugIdx = index('organizations_slug_idx').on(organizations.slug);
export const organizationsNameIdx = index('organizations_name_idx').on(organizations.name);

// Zod Schemas with detailed enums
export const insertOrganizationSchema = createInsertSchema(organizations);

export const selectOrganizationSchema = createSelectSchema(organizations);

export const updateOrganizationSchema = selectOrganizationSchema.pick({
  name: true,
  slug: true,
  displayName: true,
  description: true,
  logoUrl: true,
  website: true,
  settings: true
}).partial();

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
export type UpdateOrganization = z.infer<typeof updateOrganizationSchema>;
export type PlanType = z.infer<typeof PlanTypeEnum>;