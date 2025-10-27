import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { ExperimentsService } from './experiments.service';
import { 
  insertExperimentSchema, 
  updateExperimentSchema, 
  selectExperimentSchema 
} from '../../database/schemas/experiments.schema';

@Injectable()
export class ExperimentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly experimentsService: ExperimentsService,
  ) {}

  public get experimentsRouter() {
    return this.trpc.router({
      // 创建实验
      create: this.trpc.publicProcedure
        .input(insertExperimentSchema)
        .output(selectExperimentSchema)
        .mutation(async ({ input }) => {
          return this.experimentsService.create(input);
        }),

      // 根据ID获取实验
      findById: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectExperimentSchema.nullable())
        .query(async ({ input }) => {
          return this.experimentsService.findById(input.id);
        }),

      // 根据项目获取实验列表
      findByProject: this.trpc.publicProcedure
        .input(z.object({
          projectId: z.string().uuid(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        }))
        .output(z.array(selectExperimentSchema))
        .query(async ({ input }) => {
          return this.experimentsService.findByProject(input.projectId, input.limit, input.offset);
        }),

      // 根据状态获取实验列表
      findByStatus: this.trpc.publicProcedure
        .input(z.object({
          status: z.enum(['draft', 'running', 'completed', 'stopped']),
          projectId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        }))
        .output(z.array(selectExperimentSchema))
        .query(async ({ input }) => {
          return this.experimentsService.findByStatus(input.status, input.projectId, input.limit, input.offset);
        }),

      // 搜索实验
      search: this.trpc.publicProcedure
        .input(z.object({
          query: z.string().min(1),
          projectId: z.string().uuid().optional(),
          limit: z.number().int().min(1).max(100).default(50),
          offset: z.number().int().min(0).default(0),
        }))
        .output(z.array(selectExperimentSchema))
        .query(async ({ input }) => {
          return this.experimentsService.search(input.query, input.projectId, input.limit, input.offset);
        }),

      // 更新实验
      update: this.trpc.publicProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateExperimentSchema,
        }))
        .output(selectExperimentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.experimentsService.update(input.id, input.data);
        }),

      // 启动实验
      start: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectExperimentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.experimentsService.start(input.id);
        }),

      // 停止实验
      stop: this.trpc.publicProcedure
        .input(z.object({
          id: z.string().uuid(),
          conclusion: z.string().optional(),
        }))
        .output(selectExperimentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.experimentsService.stop(input.id, input.conclusion);
        }),

      // 完成实验
      complete: this.trpc.publicProcedure
        .input(z.object({
          id: z.string().uuid(),
          results: z.object({
            conclusion: z.string(),
            primaryMetricResult: z.number(),
            statisticalSignificanceAchieved: z.boolean(),
            winnerVariant: z.string().optional(),
          }),
        }))
        .output(selectExperimentSchema.nullable())
        .mutation(async ({ input }) => {
          return this.experimentsService.complete(input.id, input.results);
        }),

      // 删除实验
      delete: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.boolean())
        .mutation(async ({ input }) => {
          return this.experimentsService.delete(input.id);
        }),

      // 批量删除实验
      batchDelete: this.trpc.publicProcedure
        .input(z.object({
          ids: z.array(z.string().uuid()).min(1).max(100),
        }))
        .output(z.number())
        .mutation(async ({ input }) => {
          return this.experimentsService.batchDelete(input.ids);
        }),

      // 获取实验统计
      getExperimentStats: this.trpc.publicProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
        }))
        .output(z.object({
          totalExperiments: z.number(),
          runningExperiments: z.number(),
          completedExperiments: z.number(),
          draftExperiments: z.number(),
          stoppedExperiments: z.number(),
          successfulExperiments: z.number(),
          avgDuration: z.number(),
          statusDistribution: z.record(z.string(), z.number()),
        }))
        .query(async ({ input }) => {
          return this.experimentsService.getExperimentStats(input.projectId);
        }),

      // 获取实验性能
      getExperimentPerformance: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({
          experimentId: z.string(),
          name: z.string(),
          status: z.string(),
          duration: z.number(),
          sampleSize: z.number(),
          conversionRate: z.number(),
          confidenceLevel: z.number(),
          statisticalPower: z.number(),
          isSignificant: z.boolean(),
          variants: z.array(z.object({
            name: z.string(),
            type: z.string(),
            trafficAllocation: z.number(),
            performance: z.number(),
          })),
          recommendations: z.array(z.string()),
        }).nullable())
        .query(async ({ input }) => {
          return this.experimentsService.getExperimentPerformance(input.id);
        }),

      // 获取实验趋势
      getExperimentTrends: this.trpc.publicProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          days: z.number().int().min(1).max(365).default(30),
        }))
        .output(z.array(z.object({
          date: z.string(),
          experimentsStarted: z.number(),
          experimentsCompleted: z.number(),
          successRate: z.number(),
        })))
        .query(async ({ input }) => {
          return this.experimentsService.getExperimentTrends(input.projectId, input.days);
        }),

      // 检查自动停止条件
      checkAutoStopConditions: this.trpc.publicProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({
          shouldStop: z.boolean(),
          reason: z.string().optional(),
          recommendation: z.string(),
        }))
        .query(async ({ input }) => {
          return this.experimentsService.checkAutoStopConditions(input.id);
        }),
    });
  }
}
