import { z } from 'zod';
import { publicProcedure, router } from '../../trpc/trpc';
import { CostTrackingService } from './cost-tracking.service';
import { 
  insertCostTrackingSchema, 
  updateCostTrackingSchema, 
  costTrackingPublicSchema 
} from '../../database/schemas/cost-tracking.schema';

export const costTrackingRouter = router({
  // 创建成本记录
  create: publicProcedure
    .input(insertCostTrackingSchema)
    .output(costTrackingPublicSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.create(input);
    }),

  // 根据ID获取成本记录
  findById: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(costTrackingPublicSchema.nullable())
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.findById(input.id);
    }),

  // 根据项目获取成本记录
  findByProject: publicProcedure
    .input(z.object({
      projectId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .output(z.array(costTrackingPublicSchema))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.findByProject(input.projectId, input.limit, input.offset);
    }),

  // 根据组织获取成本记录
  findByOrganization: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .output(z.array(costTrackingPublicSchema))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.findByOrganization(input.organizationId, input.limit, input.offset);
    }),

  // 根据时间周期获取成本记录
  findByPeriod: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
    }))
    .output(z.array(costTrackingPublicSchema))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.findByPeriod(input.organizationId, input.period);
    }),

  // 获取时间范围内的成本记录
  findByPeriodRange: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      startPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'Start period must be in YYYY-MM format'),
      endPeriod: z.string().regex(/^\d{4}-\d{2}$/, 'End period must be in YYYY-MM format'),
      projectId: z.string().uuid().optional(),
    }))
    .output(z.array(costTrackingPublicSchema))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.findByPeriodRange(
        input.organizationId,
        input.startPeriod,
        input.endPeriod,
        input.projectId
      );
    }),

  // 更新成本记录
  update: publicProcedure
    .input(z.object({
      id: z.string().uuid(),
      data: updateCostTrackingSchema,
    }))
    .output(costTrackingPublicSchema.nullable())
    .mutation(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.update(input.id, input.data);
    }),

  // 删除成本记录
  delete: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .output(z.boolean())
    .mutation(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.delete(input.id);
    }),

  // 批量删除成本记录
  batchDelete: publicProcedure
    .input(z.object({
      ids: z.array(z.string().uuid()).min(1).max(100),
    }))
    .output(z.number())
    .mutation(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.batchDelete(input.ids);
    }),

  // 获取成本统计信息
  getCostStats: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
    }))
    .output(z.object({
      totalCost: z.number(),
      avgCost: z.number(),
      maxCost: z.number(),
      minCost: z.number(),
      recordCount: z.number(),
      costBreakdown: z.object({
        compute: z.number(),
        storage: z.number(),
        network: z.number(),
        database: z.number(),
        monitoring: z.number(),
      }),
    }))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.getCostStats(input.organizationId, input.projectId);
    }),

  // 获取成本趋势分析
  getCostTrend: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      months: z.number().int().min(1).max(24).default(12),
      projectId: z.string().uuid().optional(),
    }))
    .output(z.array(z.object({
      period: z.string(),
      totalCost: z.number(),
      computeCost: z.number(),
      storageCost: z.number(),
      networkCost: z.number(),
      databaseCost: z.number(),
      monitoringCost: z.number(),
      changePercent: z.number(),
    })))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.getCostTrend(input.organizationId, input.months, input.projectId);
    }),

  // 获取成本预算对比
  getCostBudgetComparison: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      period: z.string().regex(/^\d{4}-\d{2}$/, 'Period must be in YYYY-MM format'),
      budgetAmount: z.number().min(0),
    }))
    .output(z.object({
      actualCost: z.number(),
      budgetAmount: z.number(),
      variance: z.number(),
      variancePercent: z.number(),
      isOverBudget: z.boolean(),
      projectBreakdown: z.array(z.object({
        projectId: z.string(),
        actualCost: z.number(),
        budgetPercent: z.number(),
      })),
    }))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.getCostBudgetComparison(
        input.organizationId,
        input.period,
        input.budgetAmount
      );
    }),

  // 生成成本优化建议
  generateOptimizationTips: publicProcedure
    .input(z.object({
      organizationId: z.string().uuid(),
      projectId: z.string().uuid().optional(),
    }))
    .output(z.array(z.string()))
    .query(async ({ input, ctx }) => {
      const service = new CostTrackingService(ctx.db);
      return await service.generateOptimizationTips(input.organizationId, input.projectId);
    }),
});