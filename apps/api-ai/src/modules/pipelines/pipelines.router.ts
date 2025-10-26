import { z } from 'zod';
import { publicProcedure, router } from '../../lib/trpc';
import { PipelinesService } from './pipelines.service';
import { 
  insertPipelineSchema, 
  updatePipelineSchema,
  selectPipelineSchema 
} from '../../database/schemas';

// 输入验证schemas
const getPipelineByIdSchema = z.object({
  id: z.string().uuid(),
});

const getPipelinesByProjectSchema = z.object({
  projectId: z.string().uuid(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  search: z.string().optional(),
  isActive: z.boolean().optional(),
  configSource: z.enum(['repository', 'ui', 'api', 'template']).optional(),
});

const updatePipelineParamsSchema = z.object({
  id: z.string().uuid(),
  data: updatePipelineSchema,
});

const deletePipelineSchema = z.object({
  id: z.string().uuid(),
});

const togglePipelineStatusSchema = z.object({
  id: z.string().uuid(),
  isActive: z.boolean(),
});

const getPipelineStatsSchema = z.object({
  projectId: z.string().uuid(),
});

const batchUpdatePipelineStatusSchema = z.object({
  pipelineIds: z.array(z.string().uuid()),
  isActive: z.boolean(),
});

const clonePipelineSchema = z.object({
  id: z.string().uuid(),
  newName: z.string().min(1).max(255),
  targetProjectId: z.string().uuid().optional(),
});

const updatePipelineMetricsSchema = z.object({
  id: z.string().uuid(),
  metrics: z.object({
    successRate: z.number().min(0).max(100).optional(),
    averageDuration: z.number().int().positive().optional(),
  }),
});

const getPipelineTemplateSchema = z.object({
  configSource: z.enum(['repository', 'ui', 'api', 'template']),
});

// 输出schemas
const pipelineListResponseSchema = z.object({
  pipelines: z.array(selectPipelineSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const pipelineStatsResponseSchema = z.object({
  total: z.number(),
  active: z.number(),
  inactive: z.number(),
  byConfigSource: z.record(z.string(), z.number()),
  avgSuccessRate: z.number(),
  avgDuration: z.number(),
});

const pipelineTemplateResponseSchema = z.object({
  template: z.string(),
  description: z.string(),
});

export const pipelinesRouter = router({
  /**
   * 创建流水线
   */
  create: publicProcedure
    .input(insertPipelineSchema)
    .output(selectPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.createPipeline(input);
    }),

  /**
   * 根据ID获取流水线
   */
  getById: publicProcedure
    .input(getPipelineByIdSchema)
    .output(selectPipelineSchema)
    .query(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.getPipelineById(input.id);
    }),

  /**
   * 获取项目的流水线列表
   */
  getByProject: publicProcedure
    .input(getPipelinesByProjectSchema)
    .output(pipelineListResponseSchema)
    .query(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.getPipelinesByProject(input.projectId, {
        page: input.page,
        limit: input.limit,
        search: input.search,
        isActive: input.isActive,
        configSource: input.configSource,
      });
    }),

  /**
   * 更新流水线
   */
  update: publicProcedure
    .input(updatePipelineParamsSchema)
    .output(selectPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.updatePipeline(input.id, input.data);
    }),

  /**
   * 删除流水线
   */
  delete: publicProcedure
    .input(deletePipelineSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      await pipelinesService.deletePipeline(input.id);
      return { success: true };
    }),

  /**
   * 启用/禁用流水线
   */
  toggleStatus: publicProcedure
    .input(togglePipelineStatusSchema)
    .output(selectPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.togglePipelineStatus(input.id, input.isActive);
    }),

  /**
   * 获取流水线统计信息
   */
  getStats: publicProcedure
    .input(getPipelineStatsSchema)
    .output(pipelineStatsResponseSchema)
    .query(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.getPipelineStats(input.projectId);
    }),

  /**
   * 批量更新流水线状态
   */
  batchUpdateStatus: publicProcedure
    .input(batchUpdatePipelineStatusSchema)
    .output(z.array(selectPipelineSchema))
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.batchUpdatePipelineStatus(
        input.pipelineIds,
        input.isActive
      );
    }),

  /**
   * 复制流水线
   */
  clone: publicProcedure
    .input(clonePipelineSchema)
    .output(selectPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.clonePipeline(
        input.id,
        input.newName,
        input.targetProjectId
      );
    }),

  /**
   * 更新流水线统计数据
   */
  updateMetrics: publicProcedure
    .input(updatePipelineMetricsSchema)
    .output(selectPipelineSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.updatePipelineMetrics(input.id, input.metrics);
    }),

  /**
   * 获取流水线配置模板
   */
  getTemplate: publicProcedure
    .input(getPipelineTemplateSchema)
    .output(pipelineTemplateResponseSchema)
    .query(async ({ input, ctx }) => {
      const pipelinesService = new PipelinesService(ctx.db);
      return await pipelinesService.getPipelineTemplate(input.configSource);
    }),
});

export type PipelinesRouter = typeof pipelinesRouter;