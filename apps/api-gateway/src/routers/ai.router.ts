import { AIChatService, AIConfigGenerator, AITroubleshooter } from '@juanie/service-extensions'
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * AI 路由
 * 提供 AI 配置生成、故障诊断和聊天功能
 */
@Injectable()
export class AIRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly aiGenerator: AIConfigGenerator,
    private readonly aiTroubleshooter: AITroubleshooter,
    private readonly aiChat: AIChatService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 生成 Kubernetes 配置
       */
      generateK8sConfig: this.trpc.protectedProcedure
        .input(
          z.object({
            appName: z.string(),
            appType: z.enum(['web', 'api', 'worker', 'cron']),
            language: z.string(),
            framework: z.string().optional(),
            port: z.number().optional(),
            replicas: z.number().optional(),
            resources: z
              .object({
                cpu: z.string(),
                memory: z.string(),
              })
              .optional(),
            envVars: z.record(z.string(), z.string()).optional(),
          }),
        )
        .mutation(async ({ input }: any) => {
          const config = await this.aiGenerator.generateK8sConfig(input)
          return { config }
        }),

      /**
       * 生成 Dockerfile
       */
      generateDockerfile: this.trpc.protectedProcedure
        .input(
          z.object({
            language: z.string(),
            framework: z.string().optional(),
            buildCommand: z.string().optional(),
            startCommand: z.string().optional(),
            port: z.number().optional(),
            workdir: z.string().optional(),
          }),
        )
        .mutation(async ({ input }: any) => {
          const dockerfile = await this.aiGenerator.generateDockerfile(input)
          return { dockerfile }
        }),

      /**
       * 优化建议
       */
      suggestOptimizations: this.trpc.protectedProcedure
        .input(
          z.object({
            config: z.string(),
            type: z.enum(['k8s', 'dockerfile']),
          }),
        )
        .mutation(async ({ input }: any) => {
          const suggestions = await this.aiGenerator.suggestOptimizations(input.config, input.type)
          return { suggestions }
        }),

      /**
       * 健康检查
       */
      health: this.trpc.protectedProcedure.query(async () => {
        const healthy = await this.aiGenerator.checkHealth()
        const models = healthy ? await this.aiGenerator.listModels() : []
        return {
          healthy,
          models,
        }
      }),

      /**
       * 诊断项目问题
       */
      diagnose: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            issue: z.string().optional(),
          }),
        )
        .mutation(async ({ input }: any) => {
          const diagnosis = await this.aiTroubleshooter.diagnose(input.projectId, input.issue)
          return diagnosis
        }),

      /**
       * 快速诊断
       */
      quickDiagnose: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
          }),
        )
        .mutation(async ({ input }: any) => {
          const diagnosis = await this.aiTroubleshooter.quickDiagnose(input.projectId)
          return diagnosis
        }),

      /**
       * 聊天
       */
      chat: this.trpc.protectedProcedure
        .input(
          z.object({
            message: z.string(),
            context: z.record(z.string(), z.any()).optional(),
          }),
        )
        .mutation(async ({ input, ctx }: any) => {
          const userId = ctx.user.id
          const response = await this.aiChat.chat(userId, input.message, input.context)
          return response
        }),

      /**
       * 清除聊天历史
       */
      clearChatHistory: this.trpc.protectedProcedure.mutation(async ({ ctx }: any) => {
        const userId = ctx.user.id
        this.aiChat.clearHistory(userId)
        return { success: true }
      }),

      /**
       * 获取聊天统计
       */
      getChatStats: this.trpc.protectedProcedure.query(async ({ ctx }: any) => {
        const userId = ctx.user.id
        const stats = this.aiChat.getConversationStats(userId)
        return stats
      }),
    })
  }
}
