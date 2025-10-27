import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
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
  status: z.enum(['pending', 'running', 'success', 'failed', 'cancelled']).optional(),
  branch: z.string().optional(),
  triggeredBy: z.string().uuid().optional(),
  dateFrom: z.date().optional(),
  dateTo: z.date().optional(),
});

const getPipelineRunsByProjectSchema = z.object({
  projectId: z.string().uuid(),
  page: z.number().int().positive().optional().default(1),
  limit: z.number().int().positive().max(100).optional().default(20),
  status: z.enum(['pending', 'running', 'success', 'failed', 'cancelled']).optional(),
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
  status: z.enum(['success', 'failed', 'cancelled']),
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
  limit: z.number().int().positive().max(50).optional().default(10),
});

// 输出schemas
const pipelineRunWithDetailsSchema = selectPipelineRunSchema.extend({
  pipeline: z.object({
    name: z.string(),
    projectId: z.string().uuid().optional(),
  }).optional(),
  triggerUser: z.object({
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

@Injectable()
export class PipelineRunsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly pipelineRunsService: PipelineRunsService,
  ) {}

  public get pipelineRunsRouter() {
    return this.trpc.router({
      // 创建流水线运行 - 需要认证
      create: this.trpc.protectedProcedure
        .input(insertPipelineRunSchema)
        .output(selectPipelineRunSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.createPipelineRun(input);
        }),

      // 根据ID获取流水线运行 - 需要认证
      getById: this.trpc.protectedProcedure
        .input(getPipelineRunByIdSchema)
        .output(pipelineRunWithDetailsSchema)
        .query(async ({ input }) => {
          return this.pipelineRunsService.getPipelineRunById(input.id);
        }),

      // 根据流水线获取运行列表 - 需要认证
      getByPipeline: this.trpc.protectedProcedure
        .input(getPipelineRunsByPipelineSchema)
        .output(pipelineRunListResponseSchema)
        .query(async ({ input }) => {
          const { pipelineId, page, limit, ...filters } = input;
          return this.pipelineRunsService.getPipelineRunsByPipeline(
            pipelineId,
            { page, limit, ...filters }
          );
        }),

      // 根据项目获取运行列表 - 需要认证
      getByProject: this.trpc.protectedProcedure
        .input(getPipelineRunsByProjectSchema)
        .output(pipelineRunListResponseSchema)
        .query(async ({ input }) => {
          const { projectId, page, limit, ...filters } = input;
          return this.pipelineRunsService.getPipelineRunsByProject(
            projectId,
            { page, limit, ...filters }
          );
        }),

      // 更新流水线运行 - 需要认证
      update: this.trpc.protectedProcedure
        .input(updatePipelineRunParamsSchema)
        .output(selectPipelineRunSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.updatePipelineRun(input.id, input.data);
        }),

      // 开始流水线运行 - 需要认证
      start: this.trpc.protectedProcedure
        .input(startPipelineRunSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.startPipelineRun(input.id);
        }),

      // 完成流水线运行 - 需要认证
      finish: this.trpc.protectedProcedure
        .input(finishPipelineRunSchema)
        .output(selectPipelineRunSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.finishPipelineRun(
            input.id,
            input.status,
            input.duration
          );
        }),

      // 取消流水线运行 - 需要认证
      cancel: this.trpc.protectedProcedure
        .input(cancelPipelineRunSchema)
        .output(selectPipelineRunSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.cancelPipelineRun(input.id);
        }),

      // 重试流水线运行 - 需要认证
      retry: this.trpc.protectedProcedure
        .input(retryPipelineRunSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.retryPipelineRun(input.id, input.triggeredBy);
        }),

      // 获取流水线运行统计 - 需要认证
      getStats: this.trpc.protectedProcedure
        .input(getPipelineRunStatsSchema)
        .output(pipelineRunStatsResponseSchema)
        .query(async ({ input }) => {
          return this.pipelineRunsService.getPipelineRunStats(
            input.pipelineId,
            input.projectId,
            input.dateFrom,
            input.dateTo
          );
        }),

      // 批量取消流水线运行 - 需要认证
      batchCancel: this.trpc.protectedProcedure
        .input(batchCancelPipelineRunsSchema)
        .mutation(async ({ input }) => {
          return this.pipelineRunsService.batchCancelPipelineRuns(input.runIds);
        }),

      // 删除流水线运行 - 需要认证
      delete: this.trpc.protectedProcedure
        .input(deletePipelineRunSchema)
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          await this.pipelineRunsService.deletePipelineRun(input.id);
          return { success: true };
        }),

      // 批量删除流水线运行 - 需要认证
      batchDelete: this.trpc.protectedProcedure
        .input(batchDeletePipelineRunsSchema)
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          await this.pipelineRunsService.batchDeletePipelineRuns(input.runIds);
          return { success: true };
        }),

      // 获取最近的流水线运行 - 需要认证
      getRecent: this.trpc.protectedProcedure
        .input(getRecentPipelineRunsSchema)
        .output(z.array(pipelineRunWithDetailsSchema))
        .query(async ({ input }) => {
          return this.pipelineRunsService.getRecentPipelineRuns(input.limit);
        }),
    });
  }
}
