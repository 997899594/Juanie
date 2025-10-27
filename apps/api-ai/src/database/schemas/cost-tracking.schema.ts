import { pgTable, uuid, varchar, text, timestamp, decimal, index, foreignKey } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { projects } from './projects.schema';
import { organizations } from './organizations.schema';

export const costTracking = pgTable(
  'cost_tracking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    
    // 基础成本信息（大幅简化）
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
    
    // 成本周期（简化格式：YYYY-MM）
    period: varchar('period', { length: 7 }).notNull(), // YYYY-MM格式
    
    // 总成本
    totalCost: decimal('total_cost', { precision: 12, scale: 2 }).notNull(),
    currency: varchar('currency', { length: 3 }).notNull().default('USD'),
    
    // 简化的成本分类（非JSONB字段）
    computeCost: decimal('compute_cost', { precision: 10, scale: 2 }).default('0'), // 计算成本
    storageCost: decimal('storage_cost', { precision: 10, scale: 2 }).default('0'), // 存储成本
    networkCost: decimal('network_cost', { precision: 10, scale: 2 }).default('0'), // 网络成本
    databaseCost: decimal('database_cost', { precision: 10, scale: 2 }).default('0'), // 数据库成本
    monitoringCost: decimal('monitoring_cost', { precision: 10, scale: 2 }).default('0'), // 监控成本
    
    // 基础优化建议（简单文本）
    optimizationTips: text('optimization_tips'),
    
    // 审计字段
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
);

// 索引定义
// 简化索引定义
export const costTrackingIndexes = {
  projectIdIdx: index('cost_tracking_project_id_idx').on(costTracking.projectId),
  organizationIdIdx: index('cost_tracking_organization_id_idx').on(costTracking.organizationId),
  periodIdx: index('cost_tracking_period_idx').on(costTracking.period),
  totalCostIdx: index('cost_tracking_total_cost_idx').on(costTracking.totalCost),
  createdAtIdx: index('cost_tracking_created_at_idx').on(costTracking.createdAt),
};

// Zod schemas for validation
export const insertCostTrackingSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  organizationId: z.string().uuid(),
  period: z.string().length(7), // YYYY-MM format
  totalCost: z.string(),
  currency: z.string().length(3).default('USD'),
  computeCost: z.string().optional(),
  storageCost: z.string().optional(),
  networkCost: z.string().optional(),
  databaseCost: z.string().optional(),
  monitoringCost: z.string().optional(),
  optimizationTips: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
});

export const selectCostTrackingSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  organizationId: z.string().uuid(),
  period: z.string(),
  totalCost: z.string(),
  currency: z.string(),
  computeCost: z.string().nullable(),
  storageCost: z.string().nullable(),
  networkCost: z.string().nullable(),
  databaseCost: z.string().nullable(),
  monitoringCost: z.string().nullable(),
  optimizationTips: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const updateCostTrackingSchema = selectCostTrackingSchema.pick({
  period: true,
  totalCost: true,
  currency: true,
  computeCost: true,
  storageCost: true,
  networkCost: true,
  databaseCost: true,
  monitoringCost: true,
  optimizationTips: true,
  projectId: true,
  organizationId: true,
}).partial();

export const costTrackingPublicSchema = selectCostTrackingSchema.pick({
  id: true,
  period: true,
  totalCost: true,
  currency: true,
  computeCost: true,
  storageCost: true,
  networkCost: true,
  databaseCost: true,
  monitoringCost: true,
  optimizationTips: true,
  createdAt: true,
});

export type CostTracking = typeof costTracking.$inferSelect;
export type NewCostTracking = typeof costTracking.$inferInsert;
export type UpdateCostTracking = z.infer<typeof updateCostTrackingSchema>;
export type CostTrackingPublic = z.infer<typeof costTrackingPublicSchema>;