import { pgTable, uuid, text, timestamp, jsonb, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { projects } from './projects.schema';

export const environments = pgTable('environments', {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // 'development', 'staging', 'production', 'testing'

    // 环境配置（JSONB）
    config: jsonb('config').$type<{
        cloudProvider?: 'aws' | 'gcp' | 'azure';
        region?: string;
        approvalRequired: boolean;
        minApprovals: number;
    }>().default({ approvalRequired: false, minApprovals: 1 }),

    // 环境权限（JSONB 数组）
    permissions: jsonb('permissions').$type<Array<{
        subjectType: 'user' | 'team';
        subjectId: string;
        permission: 'read' | 'deploy' | 'admin';
    }>>().default([]),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
    uniqueIndex('envs_project_name_unique').on(table.projectId, table.name),
    index('envs_type_idx').on(table.type),
    index('envs_deleted_idx').on(table.deletedAt),
]);

export type Environment = typeof environments.$inferSelect;
export type NewEnvironment = typeof environments.$inferInsert;
