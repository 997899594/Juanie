import {
  AIChatService,
  AIConfigGenerator,
  AIService,
  AITroubleshooter,
  ConversationService,
  PromptService,
  UsageTrackingService,
} from '@juanie/service-extensions'
import {
  addMessageSchema,
  aiChatSchema,
  aiCheckQuotaSchema,
  aiClearCacheSchema,
  aiCompleteSchema,
  conversationIdSchema,
  createConversationSchema,
  createPromptTemplateSchema,
  diagnoseSchema,
  generateDockerfileSchema,
  generateK8sConfigSchema,
  getCacheHitRateSchema,
  getPromptTemplatesByCategorySchema,
  getUsageStatisticsSchema,
  projectIdQuerySchema,
  promptTemplateIdSchema,
  quickDiagnoseSchema,
  renderPromptTemplateSchema,
  searchConversationsSchema,
  suggestOptimizationsSchema,
  updatePromptTemplateSchema,
} from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { TrpcService } from '../trpc/trpc.service'

/**
 * AI 路由
 * 提供 AI 配置生成、故障诊断、聊天功能和核心 AI 服务
 */
@Injectable()
export class AIRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly aiService: AIService,
    private readonly aiGenerator: AIConfigGenerator,
    private readonly aiTroubleshooter: AITroubleshooter,
    private readonly aiChat: AIChatService,
    private readonly conversationService: ConversationService,
    private readonly promptService: PromptService,
    private readonly usageTracking: UsageTrackingService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 生成 Kubernetes 配置
       */
      generateK8sConfig: this.trpc.protectedProcedure
        .input(generateK8sConfigSchema)
        .mutation(async ({ input }: any) => {
          const config = await this.aiGenerator.generateK8sConfig(input)
          return { config }
        }),

      /**
       * 生成 Dockerfile
       */
      generateDockerfile: this.trpc.protectedProcedure
        .input(generateDockerfileSchema)
        .mutation(async ({ input }: any) => {
          const dockerfile = await this.aiGenerator.generateDockerfile(input)
          return { dockerfile }
        }),

      /**
       * 优化建议
       */
      suggestOptimizations: this.trpc.protectedProcedure
        .input(suggestOptimizationsSchema)
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
        .input(diagnoseSchema)
        .mutation(async ({ input }: any) => {
          const diagnosis = await this.aiTroubleshooter.diagnose(input.projectId, input.issue)
          return diagnosis
        }),

      /**
       * 快速诊断
       */
      quickDiagnose: this.trpc.protectedProcedure
        .input(quickDiagnoseSchema)
        .mutation(async ({ input }: any) => {
          const diagnosis = await this.aiTroubleshooter.quickDiagnose(input.projectId)
          return diagnosis
        }),

      /**
       * 聊天
       */
      chat: this.trpc.protectedProcedure
        .input(aiChatSchema)
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

      // ==================== 核心 AI 服务 ====================

      /**
       * AI 完成 (同步)
       */
      complete: this.trpc.protectedProcedure
        .input(aiCompleteSchema)
        .mutation(async ({ input, ctx }: any) => {
          const config = {
            provider: input.provider,
            model: input.model,
            temperature: input.temperature,
            maxTokens: input.maxTokens,
          }

          const options = {
            messages: input.messages,
          }

          const context = {
            userId: ctx.user.id,
            projectId: input.projectId,
          }

          return await this.aiService.complete(config, options, context)
        }),

      /**
       * 检查配额
       */
      checkQuota: this.trpc.protectedProcedure
        .input(aiCheckQuotaSchema)
        .query(async ({ input, ctx }: any) => {
          return await this.aiService.checkQuota(
            ctx.user.id,
            input.monthlyTokenLimit,
            input.monthlyCostLimit,
          )
        }),

      /**
       * 获取缓存统计
       */
      getCacheStats: this.trpc.protectedProcedure.query(async () => {
        return await this.aiService.getCacheStats()
      }),

      /**
       * 清除缓存
       */
      clearCache: this.trpc.protectedProcedure
        .input(aiClearCacheSchema)
        .mutation(async ({ input }: any) => {
          await this.aiService.clearCache(input.provider)
          return { success: true }
        }),

      // ==================== 对话管理 ====================

      /**
       * 创建对话
       */
      createConversation: this.trpc.protectedProcedure
        .input(createConversationSchema)
        .mutation(async ({ input, ctx }: any) => {
          return await this.conversationService.create({
            userId: ctx.user.id,
            projectId: input.projectId,
            title: input.title,
          })
        }),

      /**
       * 获取对话
       */
      getConversation: this.trpc.protectedProcedure
        .input(conversationIdSchema)
        .query(async ({ input }: any) => {
          return await this.conversationService.findById(input.conversationId)
        }),

      /**
       * 获取用户的所有对话
       */
      getUserConversations: this.trpc.protectedProcedure.query(async ({ ctx }: any) => {
        return await this.conversationService.findByUser(ctx.user.id)
      }),

      /**
       * 获取项目的所有对话
       */
      getProjectConversations: this.trpc.protectedProcedure
        .input(projectIdQuerySchema)
        .query(async ({ input }: any) => {
          return await this.conversationService.findByProject(input.projectId)
        }),

      /**
       * 添加消息到对话
       */
      addMessage: this.trpc.protectedProcedure
        .input(addMessageSchema)
        .mutation(async ({ input }: any) => {
          return await this.conversationService.addMessage(input.conversationId, {
            role: input.role,
            content: input.content,
          })
        }),

      /**
       * 搜索对话
       */
      searchConversations: this.trpc.protectedProcedure
        .input(searchConversationsSchema)
        .query(async ({ input, ctx }: any) => {
          return await this.conversationService.search(ctx.user.id, input.query)
        }),

      /**
       * 删除对话
       */
      deleteConversation: this.trpc.protectedProcedure
        .input(conversationIdSchema)
        .mutation(async ({ input }: any) => {
          await this.conversationService.delete(input.conversationId)
          return { success: true }
        }),

      // ==================== 提示词模板管理 ====================

      /**
       * 创建提示词模板
       */
      createPromptTemplate: this.trpc.protectedProcedure
        .input(createPromptTemplateSchema)
        .mutation(async ({ input }: any) => {
          return await this.promptService.create(input)
        }),

      /**
       * 获取提示词模板
       */
      getPromptTemplate: this.trpc.protectedProcedure
        .input(promptTemplateIdSchema)
        .query(async ({ input }: any) => {
          return await this.promptService.findById(input.templateId)
        }),

      /**
       * 按分类获取模板
       */
      getPromptTemplatesByCategory: this.trpc.protectedProcedure
        .input(getPromptTemplatesByCategorySchema)
        .query(async ({ input }: any) => {
          return await this.promptService.findByCategory(input.category)
        }),

      /**
       * 渲染提示词模板
       */
      renderPromptTemplate: this.trpc.protectedProcedure
        .input(renderPromptTemplateSchema)
        .mutation(async ({ input }: any) => {
          const rendered = await this.promptService.render(input.templateId, input.variables)
          return { rendered }
        }),

      /**
       * 更新提示词模板
       */
      updatePromptTemplate: this.trpc.protectedProcedure
        .input(updatePromptTemplateSchema)
        .mutation(async ({ input }: any) => {
          const { templateId, ...data } = input
          return await this.promptService.update(templateId, data)
        }),

      /**
       * 删除提示词模板
       */
      deletePromptTemplate: this.trpc.protectedProcedure
        .input(promptTemplateIdSchema)
        .mutation(async ({ input }: any) => {
          await this.promptService.delete(input.templateId)
          return { success: true }
        }),

      // ==================== 使用统计 ====================

      /**
       * 获取使用统计
       */
      getUsageStatistics: this.trpc.protectedProcedure
        .input(getUsageStatisticsSchema)
        .query(async ({ input, ctx }: any) => {
          return await this.usageTracking.getStatistics({
            userId: ctx.user.id,
            projectId: input.projectId,
            startDate: input.startDate,
            endDate: input.endDate,
          })
        }),

      /**
       * 获取缓存命中率
       */
      getCacheHitRate: this.trpc.protectedProcedure
        .input(getCacheHitRateSchema)
        .query(async ({ input, ctx }: any) => {
          return await this.usageTracking.getCacheHitRate({
            userId: ctx.user.id,
            projectId: input.projectId,
            startDate: input.startDate,
            endDate: input.endDate,
          })
        }),
    })
  }
}
