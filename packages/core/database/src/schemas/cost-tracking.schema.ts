import { pgTable, uuid, text, jsonb, uniqueIndex, index, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './organizations.schema';
import { projects } from './projects.schema';

export const costTracking = pgTable('cost_tracking', {
    id: uuid('id').primaryKey().defaultRandom(),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id),
    projectId: uuid('project_id').references(() => projects.id),

    // 时间周期（日粒度）
    date: text('date').notNull(), // YYYY-MM-DD

    // 成本分类（JSONB）
    costs: jsonb('costs').$type<{
        compute: number;
        storage: number;
        network: number;
        database: number;
        total: number;
    }>(),

    currency: text('currency').notNull().default('USD'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('cost_org_project_date_unique').on(table.organizationId, table.projectId, table.date),
    index('cost_date_idx').on(table.date),
]);

export type CostTracking = typeof costTracking.$inferSelect;
export type NewCostTracking = typeof costTracking.$inferInsert;
