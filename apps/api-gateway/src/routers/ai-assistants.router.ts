import { createAIAssistantSchema, idSchema, updateAIAssistantSchema } from '@juanie/types'
import { AiAssistantsService } from '@juanie/service-extensions'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class AiAssistantsRouter {
  constructor(
    private trpc: TrpcService,
    private aiAssistantsService: AiAssistantsService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(createAIAssistantSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.aiAssistantsService.create(ctx.user.id, input)
        }),

      list: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string().uuid().optional(),
            type: z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.aiAssistantsService.list(ctx.user.id, input)
        }),

      get: this.trpc.protectedProcedure.input(idSchema).query(async ({ ctx, input }) => {
        return await this.aiAssistantsService.get(ctx.user.id, input.id)
      }),

      update: this.trpc.protectedProcedure
        .input(updateAIAssistantSchema)
        .mutation(async ({ ctx, input }) => {
          const { assistantId, ...data } = input
          return await this.aiAssistantsService.update(ctx.user.id, assistantId, data)
        }),

      delete: this.trpc.protectedProcedure.input(idSchema).mutation(async ({ ctx, input }) => {
        return await this.aiAssistantsService.delete(ctx.user.id, input.id)
      }),

      chat: this.trpc.protectedProcedure
        .input(
          z.object({
            assistantId: z.string().uuid(),
            message: z.string(),
            context: z.record(z.string(), z.any()).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.aiAssistantsService.chat(ctx.user.id, input.assistantId, {
            message: input.message,
            context: input.context,
          })
        }),

      rate: this.trpc.protectedProcedure
        .input(
          z.object({
            assistantId: z.string().uuid(),
            rating: z.number().min(1).max(5),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.aiAssistantsService.rate(ctx.user.id, input.assistantId, input.rating)
        }),

      // 列出可用的 Ollama 模型
      listOllamaModels: this.trpc.protectedProcedure.query(async () => {
        return await this.aiAssistantsService.listOllamaModels()
      }),

      // 检查 Ollama 服务状态
      checkOllamaStatus: this.trpc.protectedProcedure.query(async () => {
        return await this.aiAssistantsService.checkOllamaStatus()
      }),
    })
  }
}
