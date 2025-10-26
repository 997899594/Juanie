import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { AiAssistantsService } from './ai-assistants.service';
import {
  insertAiAssistantSchema,
  selectAiAssistantSchema,
  updateAiAssistantSchema,
  aiAssistantPublicSchema,
} from '../../database/schemas/ai-assistants.schema';

@Injectable()
export class AiAssistantsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly aiAssistantsService: AiAssistantsService,
  ) {}

  public get aiAssistantsRouter() {
    return this.trpc.router({
      // 健康检查
      hello: this.trpc.publicProcedure.query(() => {
        return { message: 'AI Assistants module is working!' };
      }),

      // 创建AI助手
      create: this.trpc.protectedProcedure
        .input(insertAiAssistantSchema.omit({ id: true, createdAt: true, updatedAt: true }))
        .output(selectAiAssistantSchema)
        .mutation(async ({ input, ctx }) => {
          return await this.aiAssistantsService.createAiAssistant({
            ...input,
            createdBy: ctx.user.id,
          });
        }),

      // 获取AI助手列表
      list: this.trpc.protectedProcedure
        .input(z.object({
          organizationId: z.string().uuid().optional(),
          type: z.enum(['code-reviewer', 'devops-engineer', 'security-analyst', 'cost-optimizer', 'incident-responder']).optional(),
          isPublic: z.boolean().optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .output(z.object({
          items: z.array(aiAssistantPublicSchema),
          total: z.number(),
        }))
        .query(async ({ input }) => {
          const items = input.isPublic 
            ? await this.aiAssistantsService.getPublicAiAssistants(input.limit, input.offset)
            : input.organizationId
              ? await this.aiAssistantsService.getAiAssistantsByOrganization(input.organizationId, input.limit, input.offset)
              : input.type
                ? await this.aiAssistantsService.getAiAssistantsByType(input.type, input.limit, input.offset)
                : [];
          
          const total = await this.aiAssistantsService.getAiAssistantCount(input.organizationId);
          return { items, total };
        }),

      // 通过ID获取AI助手
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(selectAiAssistantSchema.nullable())
        .query(async ({ input }) => {
          return await this.aiAssistantsService.getAiAssistantById(input.id);
        }),

      // 更新AI助手
      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updateAiAssistantSchema,
        }))
        .output(selectAiAssistantSchema.nullable())
        .mutation(async ({ input }) => {
          return await this.aiAssistantsService.updateAiAssistant(input.id, input.data);
        }),

      // 删除AI助手
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          const success = await this.aiAssistantsService.deleteAiAssistant(input.id);
          return { success };
        }),

      // 获取用户创建的AI助手
      getMyAssistants: this.trpc.protectedProcedure
        .input(z.object({
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .output(z.object({
          items: z.array(selectAiAssistantSchema),
          total: z.number(),
        }))
        .query(async ({ input, ctx }) => {
          const items = await this.aiAssistantsService.getAiAssistantsByCreator(ctx.user.id, input.limit, input.offset);
          const total = items.length; // 简化实现
          return { items, total };
        }),

      // 更新使用统计
      updateUsage: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          rating: z.number().int().min(1).max(5).optional(),
        }))
        .output(z.object({ success: z.boolean() }))
        .mutation(async ({ input }) => {
          let success = await this.aiAssistantsService.recordUsage(input.id);
          if (input.rating && success) {
            success = await this.aiAssistantsService.updateRating(input.id, input.rating);
          }
          return { success };
        }),
    });
  }
}