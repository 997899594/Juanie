import { pgTable, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

export const organizations = pgTable('organizations', {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    displayName: text('display_name'),
    logoUrl: text('logo_url'),

    // 配额限制（JSONB）
    quotas: jsonb('quotas').$type<{
        maxProjects: number;
        maxUsers: number;
        maxStorageGb: number;
    }>().default({ maxProjects: 10, maxUsers: 50, maxStorageGb: 100 }),

    // 计费信息（JSONB）
    billing: jsonb('billing').$type<{
        plan: 'free' | 'pro' | 'enterprise';
        billingEmail?: string;
    }>(),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    index('orgs_slug_idx').on(table.slug),
    index('orgs_deleted_idx').on(table.deletedAt),
]);

export type Organization = typeof organizations.$inferSelect;
export type NewOrganization = typeof organizations.$inferInsert;
