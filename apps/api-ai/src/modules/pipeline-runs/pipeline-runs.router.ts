import { z } from 'zod';
import { publicProcedure, router } from '../../lib/trpc';
import { PipelineRunsService } from './pipeline-runs.service';
import { 
  insertPipelineRunSchema, 
  updatePipelineRunSchema,
  selectPipelineRunSchema 
} from '../../database/schemas';

// 输入验证schemas
const getPipelineRunByIdSchema = z.object({
  id: z.string().uuid(),
});

const getPipelineRunsByPipelineSchema = z.object({
  pipelineId: z.string().uuid(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'running', 'success', 'failure', 'cancelled']).optional(),
  branch: z.string().optional(),
  triggeredBy: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const getPipelineRunsByProjectSchema = z.object({
  projectId: z.string().uuid(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'running', 'success', 'failure', 'cancelled']).optional(),
  pipelineId: z.string().uuid().optional(),
});

const updatePipelineRunParamsSchema = z.object({
  id: z.string().uuid(),
  data: updatePipelineRunSchema,
});

const startPipelineRunSchema = z.object({
  id: z.string().uuid(),
});

const finishPipelineRunSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['success', 'failure', 'cancelled']),
  duration: z.number().int().positive().optional(),
});

const cancelPipelineRunSchema = z.object({
  id: z.string().uuid(),
});

const retryPipelineRunSchema = z.object({
  id: z.string().uuid(),
  triggeredBy: z.string().uuid().optional(),
});

const getPipelineRunStatsSchema = z.object({
  pipelineId: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const batchCancelPipelineRunsSchema = z.object({
  runIds: z.array(z.string().uuid()),
});

const deletePipelineRunSchema = z.object({
  id: z.string().uuid(),
});

const batchDeletePipelineRunsSchema = z.object({
  runIds: z.array(z.string().uuid()),
});

const getRecentPipelineRunsSchema = z.object({
  projectId: z.string().uuid(),
  limit: z.number().int().positive().max(50).optional().default(10),
});

// 输出schemas
const pipelineRunWithDetailsSchema = selectPipelineRunSchema.extend({
  pipeline: z.object({
    name: z.string(),
    projectId: z.string().optional(),
  }).optional(),
  triggeredByUser: z.object({
    name: z.string(),
    email: z.string(),
  }).optional(),
});

const pipelineRunListResponseSchema = z.object({
  runs: z.array(pipelineRunWithDetailsSchema),
  total: z.number(),
  page: z.number(),
  limit: z.number(),
});

const pipelineRunStatsResponseSchema = z.object({
  total: z.number(),
  success: z.number(),
  failure: z.number(),
  cancelled: z.number(),
  running: z.number(),
  pending: z.number(),
  successRate: z.number(),
  avgDuration: z.number(),
  totalDuration: z.number(),
  byStatus: z.record(z.string(), z.number()),
  byBranch: z.record(z.string(), z.number()),
});

export const pipelineRunsRouter = router({
  /**
   * 创建流水线执行
   */
  create: publicProcedure
    .input(insertPipelineRunSchema)
    .output(selectPipelineRunSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.createPipelineRun(input);
    }),

  /**
   * 根据ID获取流水线执行
   */
  getById: publicProcedure
    .input(getPipelineRunByIdSchema)
    .output(pipelineRunWithDetailsSchema)
    .query(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.getPipelineRunById(input.id);
    }),

  /**
   * 获取流水线的执行列表
   */
  getByPipeline: publicProcedure
    .input(getPipelineRunsByPipelineSchema)
    .output(pipelineRunListResponseSchema)
    .query(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.getPipelineRunsByPipeline(input.pipelineId, {
        page: input.page,
        limit: input.limit,
        status: input.status,
        branch: input.branch,
        triggeredBy: input.triggeredBy,
        dateFrom: input.dateFrom,
        dateTo: input.dateTo,
      });
    }),

  /**
   * 获取项目的流水线执行列表
   */
  getByProject: publicProcedure
    .input(getPipelineRunsByProjectSchema)
    .output(pipelineRunListResponseSchema)
    .query(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.getPipelineRunsByProject(input.projectId, {
        page: input.page,
        limit: input.limit,
        status: input.status,
        pipelineId: input.pipelineId,
      });
    }),

  /**
   * 更新流水线执行
   */
  update: publicProcedure
    .input(updatePipelineRunParamsSchema)
    .output(selectPipelineRunSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.updatePipelineRun(input.id, input.data);
    }),

  /**
   * 开始执行流水线
   */
  start: publicProcedure
    .input(startPipelineRunSchema)
    .output(selectPipelineRunSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.startPipelineRun(input.id);
    }),

  /**
   * 完成流水线执行
   */
  finish: publicProcedure
    .input(finishPipelineRunSchema)
    .output(selectPipelineRunSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.finishPipelineRun(
        input.id,
        input.status,
        input.duration
      );
    }),

  /**
   * 取消流水线执行
   */
  cancel: publicProcedure
    .input(cancelPipelineRunSchema)
    .output(selectPipelineRunSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.cancelPipelineRun(input.id);
    }),

  /**
   * 重新运行流水线
   */
  retry: publicProcedure
    .input(retryPipelineRunSchema)
    .output(selectPipelineRunSchema)
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.retryPipelineRun(input.id, input.triggeredBy);
    }),

  /**
   * 获取流水线执行统计
   */
  getStats: publicProcedure
    .input(getPipelineRunStatsSchema)
    .output(pipelineRunStatsResponseSchema)
    .query(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.getPipelineRunStats(
        input.pipelineId,
        input.projectId,
        input.dateFrom,
        input.dateTo
      );
    }),

  /**
   * 批量取消流水线执行
   */
  batchCancel: publicProcedure
    .input(batchCancelPipelineRunsSchema)
    .output(z.array(selectPipelineRunSchema))
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.batchCancelPipelineRuns(input.runIds);
    }),

  /**
   * 删除流水线执行记录
   */
  delete: publicProcedure
    .input(deletePipelineRunSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      await pipelineRunsService.deletePipelineRun(input.id);
      return { success: true };
    }),

  /**
   * 批量删除流水线执行记录
   */
  batchDelete: publicProcedure
    .input(batchDeletePipelineRunsSchema)
    .output(z.object({ success: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      await pipelineRunsService.batchDeletePipelineRuns(input.runIds);
      return { success: true };
    }),

  /**
   * 获取最近的流水线执行
   */
  getRecent: publicProcedure
    .input(getRecentPipelineRunsSchema)
    .output(z.array(pipelineRunWithDetailsSchema))
    .query(async ({ input, ctx }) => {
      const pipelineRunsService = new PipelineRunsService(ctx.db);
      return await pipelineRunsService.getRecentPipelineRuns(
        input.projectId,
        input.limit
      );
    }),
});

export type PipelineRunsRouter = typeof pipelineRunsRouter;