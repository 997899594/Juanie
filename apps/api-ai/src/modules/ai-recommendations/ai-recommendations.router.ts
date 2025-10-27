import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { TrpcService } from '../../trpc/trpc.service';
import { AiRecommendationsService, AiRecommendationSearchFilters } from './ai-recommendations.service';
import {
  insertAiRecommendationSchema,
  updateAiRecommendationSchema,
  selectAiRecommendationSchema,
  UserFeedbackEnum,
  ContextTypeEnum,
  RecommendationPriorityEnum
} from '../../database/schemas/ai-recommendations.schema';

@Injectable()
export class AiRecommendationsRouter {
  constructor(
    private readonly aiRecommendationsService: AiRecommendationsService,
    private readonly trpc: TrpcService
  ) {}

  public get aiRecommendationsRouter() {
    return this.trpc.router({
    // 测试端点
    hello: this.trpc.publicProcedure
      .input(z.object({ name: z.string().optional() }))
      .query(({ input }) => {
        return {
          greeting: `Hello ${input.name ?? 'AI Recommendations'}!`,
          timestamp: new Date().toISOString(),
        };
      }),

    // 创建AI推荐
    create: this.trpc.protectedProcedure
      .input(insertAiRecommendationSchema)
      .mutation(async ({ input }) => {
        return await this.aiRecommendationsService.createAiRecommendation(input);
      }),

    // 根据ID获取AI推荐
    getById: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .query(async ({ input }) => {
        const recommendation = await this.aiRecommendationsService.getAiRecommendationById(input.id);
        if (!recommendation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'AI recommendation not found',
          });
        }
        return recommendation;
      }),

    // 根据AI助手获取推荐列表
    getByAssistant: this.trpc.protectedProcedure
      .input(z.object({
        assistantId: z.string().uuid(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getRecommendationsByAssistant(
          input.assistantId,
          input.limit,
          input.offset
        );
      }),

    // 根据上下文获取推荐列表
    getByContext: this.trpc.protectedProcedure
      .input(z.object({
        contextType: ContextTypeEnum,
        contextId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getRecommendationsByContext(
          input.contextType,
          input.contextId,
          input.limit,
          input.offset
        );
      }),

    // 根据优先级获取推荐列表
    getByPriority: this.trpc.protectedProcedure
      .input(z.object({
        priority: RecommendationPriorityEnum,
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getRecommendationsByPriority(
          input.priority,
          input.limit,
          input.offset
        );
      }),

    // 搜索AI推荐
    search: this.trpc.protectedProcedure
      .input(z.object({
        query: z.string(),
        filters: z.object({
          assistantId: z.string().uuid().optional(),
          contextType: ContextTypeEnum.optional(),
          contextId: z.number().optional(),
          recommendationType: z.string().optional(),
          priority: RecommendationPriorityEnum.optional(),
          userFeedback: UserFeedbackEnum.optional(),
          minConfidenceScore: z.number().min(0).max(1).optional(),
          maxConfidenceScore: z.number().min(0).max(1).optional(),
          dateFrom: z.string().datetime().transform(str => new Date(str)).optional(),
          dateTo: z.string().datetime().transform(str => new Date(str)).optional(),
        }).optional(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.searchRecommendations(
          input.query,
          input.filters as AiRecommendationSearchFilters,
          input.limit,
          input.offset
        );
      }),

    // 更新AI推荐
    update: this.trpc.protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        data: updateAiRecommendationSchema,
      }))
      .mutation(async ({ input }) => {
        const recommendation = await this.aiRecommendationsService.updateAiRecommendation(input.id, input.data);
        if (!recommendation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'AI recommendation not found',
          });
        }
        return recommendation;
      }),

    // 删除AI推荐
    delete: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        const success = await this.aiRecommendationsService.deleteAiRecommendation(input.id);
        if (!success) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'AI recommendation not found',
          });
        }
        return { success: true };
      }),

    // 批量删除AI推荐
    batchDelete: this.trpc.protectedProcedure
      .input(z.object({
        ids: z.array(z.string().uuid()).min(1).max(50),
      }))
      .mutation(async ({ input }) => {
        const deletedCount = await this.aiRecommendationsService.batchDeleteRecommendations(input.ids);
        return { deletedCount };
      }),

    // 提交用户反馈
    submitFeedback: this.trpc.protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
        feedback: UserFeedbackEnum,
        rating: z.number().min(1).max(5).optional(),
        comment: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const success = await this.aiRecommendationsService.submitUserFeedback(
          input.id,
          input.feedback,
          input.rating,
          input.comment
        );
        if (!success) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to submit feedback',
          });
        }
        return { success: true };
      }),

    // 获取AI推荐统计信息
    getStats: this.trpc.protectedProcedure
      .input(z.object({
        assistantId: z.string().uuid().optional(),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getRecommendationStats(input.assistantId);
      }),

    // 获取AI推荐数量
    getCount: this.trpc.protectedProcedure
      .input(z.object({
        assistantId: z.string().uuid().optional(),
        contextType: ContextTypeEnum.optional(),
        priority: RecommendationPriorityEnum.optional(),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getRecommendationCount(
          input.assistantId,
          input.contextType,
          input.priority
        );
      }),

    // 获取高优先级推荐
    getHighPriority: this.trpc.protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getHighPriorityRecommendations(
          input.limit,
          input.offset
        );
      }),

    // 获取待反馈推荐
    getPendingFeedback: this.trpc.protectedProcedure
      .input(z.object({
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getPendingFeedbackRecommendations(
          input.limit,
          input.offset
        );
      }),

    // 获取带助手信息的推荐
    getWithAssistant: this.trpc.protectedProcedure
      .input(z.object({
        id: z.string().uuid(),
      }))
      .query(async ({ input }) => {
        return await this.aiRecommendationsService.getRecommendationWithAssistant(input.id);
      }),

    // 验证AI推荐配置
    validate: this.trpc.protectedProcedure
      .input(selectAiRecommendationSchema.partial())
      .mutation(async ({ input }) => {
        return await this.aiRecommendationsService.validateRecommendation(input);
      }),
    });
  }
}