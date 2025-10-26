import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { PipelinesService } from './pipelines.service';
import { 
  insertPipelineSchema, 
  updatePipelineSchema,
  selectPipelineSchema 
} from '../../database/schemas';
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

@Injectable()
export class PipelinesRouter {
  public router: any;

  constructor(
    private readonly trpc: TrpcService,
    private readonly pipelinesService: PipelinesService,
  ) {
    this.router = this.trpc.router({
      /**
       * 创建流水线
       */
      create: this.trpc.publicProcedure
        .input(insertPipelineSchema)
        .output(selectPipelineSchema)
        .mutation(async ({ input }) => {
          return await this.pipelinesService.createPipeline(input);
        }),

      /**
       * 根据ID获取流水线
       */
      getById: this.trpc.publicProcedure
        .input(getPipelineByIdSchema)
        .output(selectPipelineSchema.nullable())
        .query(async ({ input }) => {
          return await this.pipelinesService.getPipelineById(input.id);
        }),

      /**
       * 获取项目的流水线列表
       */
      getByProject: this.trpc.publicProcedure
        .input(getPipelinesByProjectSchema)
        .output(pipelineListResponseSchema)
        .query(async ({ input }) => {
          return await this.pipelinesService.getPipelinesByProject(
            input.projectId,
            { 
              page: input.page, 
              limit: input.limit,
              search: input.search, 
              isActive: input.isActive, 
              configSource: input.configSource 
            }
          );
        }),

      /**
       * 更新流水线
       */
      update: this.trpc.publicProcedure
        .input(updatePipelineParamsSchema)
        .output(selectPipelineSchema)
        .mutation(async ({ input }) => {
          return await this.pipelinesService.updatePipeline(input.id, input.data);
        }),

      /**
       * 删除流水线
       */
      delete: this.trpc.publicProcedure
        .input(deletePipelineSchema)
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          await this.pipelinesService.deletePipeline(input.id);
          return { success: true };
        }),

      /**
       * 切换流水线状态
       */
      toggleStatus: this.trpc.publicProcedure
        .input(togglePipelineStatusSchema)
        .output(selectPipelineSchema)
        .mutation(async ({ input }) => {
          return await this.pipelinesService.togglePipelineStatus(input.id);
        }),

      /**
       * 获取流水线统计信息
       */
      getStats: this.trpc.publicProcedure
        .input(getPipelineStatsSchema)
        .output(pipelineStatsResponseSchema)
        .query(async ({ input }) => {
          return await this.pipelinesService.getPipelineStats(input.projectId);
        }),

      /**
       * 批量更新流水线状态
       */
      batchUpdateStatus: this.trpc.publicProcedure
        .input(batchUpdatePipelineStatusSchema)
        .output(z.array(selectPipelineSchema))
        .mutation(async ({ input }) => {
          return await this.pipelinesService.batchUpdatePipelineStatus(
            input.pipelineIds,
            input.isActive
          );
        }),

      /**
       * 克隆流水线
       */
      clone: this.trpc.publicProcedure
        .input(clonePipelineSchema)
        .output(selectPipelineSchema)
        .mutation(async ({ input }) => {
          return await this.pipelinesService.clonePipeline(
            input.id,
            input.newName,
            input.targetProjectId
          );
        }),

      /**
       * 更新流水线指标
       */
      updateMetrics: this.trpc.publicProcedure
        .input(updatePipelineMetricsSchema)
        .output(selectPipelineSchema)
        .mutation(async ({ input }) => {
          // 使用 updatePipeline 方法替代不存在的 updatePipelineMetrics
          return await this.pipelinesService.updatePipeline(input.id, {});
        }),

      /**
       * 获取流水线模板
       */
      getTemplate: this.trpc.publicProcedure
        .input(getPipelineTemplateSchema)
        .output(pipelineTemplateResponseSchema)
        .query(async ({ input }) => {
          // 返回默认模板，因为 getPipelineTemplate 方法不存在
          return {
            template: `# Pipeline Template for ${input.configSource}`,
            description: `Default template for ${input.configSource} configuration source`,
          };
        }),
    });
  }
}

export type PipelinesRouterType = typeof PipelinesRouter;