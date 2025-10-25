import { pgTable, uuid, varchar, text, timestamp, decimal, integer, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { createInsertSchema, createSelectSchema } from 'drizzle-zod';
import { z } from 'zod';
import { projects } from './projects.schema';
import { environments } from './environments.schema';

export const resourceUsage = pgTable(
  'resource_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // 基础关联
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    environmentId: uuid('environment_id').references(() => environments.id, { onDelete: 'cascade' }),
    
    // 资源类型和标识
    resourceType: varchar('resource_type', { length: 50 }).notNull(), // 'compute', 'storage', 'network', 'database'
    resourceName: varchar('resource_name', { length: 100 }).notNull(),
    
    // 基础使用指标
    usagePercentage: decimal('usage_percentage', { precision: 5, scale: 2 }).notNull(), // 使用率百分比
    costPerHour: decimal('cost_per_hour', { precision: 10, scale: 4 }).notNull(), // 每小时成本
    
    // 优化建议（简单文本）
    optimizationSuggestion: text('optimization_suggestion'),
    
    // 时间戳
    recordedAt: timestamp('recorded_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  }
);

// 简化索引定义
export const resourceUsageIndexes = {
  projectIdIdx: index('resource_usage_project_id_idx').on(resourceUsage.projectId),
  environmentIdIdx: index('resource_usage_environment_id_idx').on(resourceUsage.environmentId),
  resourceTypeIdx: index('resource_usage_resource_type_idx').on(resourceUsage.resourceType),
  recordedAtIdx: index('resource_usage_recorded_at_idx').on(resourceUsage.recordedAt),
};

// 关系定义
export const resourceUsageRelations = relations(resourceUsage, ({ one }) => ({
  project: one(projects, {
    fields: [resourceUsage.projectId],
    references: [projects.id],
  }),
  environment: one(environments, {
    fields: [resourceUsage.environmentId],
    references: [environments.id],
  }),
}));

// 简化的Zod Schemas
export const insertResourceUsageSchema = createInsertSchema(resourceUsage, {
  resourceType: z.enum(['compute', 'storage', 'network', 'database']),
  usagePercentage: z.number().min(0).max(100),
  costPerHour: z.number().positive(),
  recordedAt: z.date(),
});

export const selectResourceUsageSchema = createSelectSchema(resourceUsage);
export const updateResourceUsageSchema = insertResourceUsageSchema.partial();

export type ResourceUsage = typeof resourceUsage.$inferSelect;
export type NewResourceUsage = typeof resourceUsage.$inferInsert;
export type UpdateResourceUsage = z.infer<typeof updateResourceUsageSchema>;