import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import type {
  ChatWithAssistantInput,
  CreateAIAssistantInput,
  UpdateAIAssistantInput,
} from '@juanie/types'
import { OllamaService } from '../ollama/ollama.service'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class AiAssistantsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private ollamaService: OllamaService,
  ) {}

  // 创建 AI 助手
  @Trace('ai-assistants.create')
  async create(userId: string, data: CreateAIAssistantInput) {
    // 检查权限
    if (data.organizationId) {
      const hasPermission = await this.checkOrgPermission(userId, data.organizationId)
      if (!hasPermission) {
        throw new Error('没有权限创建组织级 AI 助手')
      }
    }

    const [assistant] = await this.db
      .insert(schema.aiAssistants)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        type: data.type,
        modelConfig: data.modelConfig,
        systemPrompt: data.systemPrompt || this.getDefaultSystemPrompt(data.type),
        isActive: data.isActive ?? true,
      })
      .returning()

    return assistant
  }

  // 获取默认系统提示词
  private getDefaultSystemPrompt(type: string): string {
    const prompts: Record<string, string> = {
      code_review: '你是一个专业的代码审查助手，帮助开发者发现代码中的问题并提供改进建议。',
      devops_engineer: '你是一个 DevOps 工程师助手，帮助团队优化 CI/CD 流程和基础设施。',
      cost_optimizer: '你是一个成本优化助手，帮助团队分析和优化云资源使用成本。',
      security_analyst: '你是一个安全分析助手，帮助团队识别和修复安全漏洞。',
    }
    return prompts[type] || '你是一个 AI 助手，帮助用户解决问题。'
  }

  // 列出 AI 助手
  @Trace('ai-assistants.list')
  async list(
    userId: string,
    filters: {
      organizationId?: string
      type?: string
    },
  ) {
    const conditions = []

    if (filters.organizationId) {
      const hasAccess = await this.checkOrgAccess(userId, filters.organizationId)
      if (!hasAccess) {
        throw new Error('没有权限访问该组织')
      }
      conditions.push(eq(schema.aiAssistants.organizationId, filters.organizationId))
    }

    if (filters.type) {
      conditions.push(eq(schema.aiAssistants.type, filters.type))
    }

    const assistants = await this.db
      .select()
      .from(schema.aiAssistants)
      .where(conditions.length > 0 ? and(...conditions) : undefined)

    return assistants
  }

  // 获取助手详情
  @Trace('ai-assistants.get')
  async get(userId: string, assistantId: string) {
    const [assistant] = await this.db
      .select()
      .from(schema.aiAssistants)
      .where(eq(schema.aiAssistants.id, assistantId))
      .limit(1)

    if (!assistant) {
      return null
    }

    // 检查访问权限
    if (assistant.organizationId) {
      const hasAccess = await this.checkOrgAccess(userId, assistant.organizationId)
      if (!hasAccess) {
        throw new Error('没有权限访问该助手')
      }
    }

    return assistant
  }

  // 更新助手
  @Trace('ai-assistants.update')
  async update(userId: string, assistantId: string, data: UpdateAIAssistantInput) {
    const assistant = await this.get(userId, assistantId)
    if (!assistant) {
      throw new Error('助手不存在')
    }

    // 检查权限
    if (assistant.organizationId) {
      const hasPermission = await this.checkOrgPermission(userId, assistant.organizationId)
      if (!hasPermission) {
        throw new Error('没有权限更新该助手')
      }
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name

    // 只有当 modelConfig 完整时才更新
    if (
      data.modelConfig &&
      data.modelConfig.provider &&
      data.modelConfig.model &&
      data.modelConfig.temperature !== undefined
    ) {
      updateData.modelConfig = {
        provider: data.modelConfig.provider,
        model: data.modelConfig.model,
        temperature: data.modelConfig.temperature,
      }
    }

    const [updated] = await this.db
      .update(schema.aiAssistants)
      .set(updateData)
      .where(eq(schema.aiAssistants.id, assistantId))
      .returning()

    return updated
  }

  // 删除助手
  @Trace('ai-assistants.delete')
  async delete(userId: string, assistantId: string) {
    const assistant = await this.get(userId, assistantId)
    if (!assistant) {
      throw new Error('助手不存在')
    }

    // 检查权限
    if (assistant.organizationId) {
      const hasPermission = await this.checkOrgPermission(userId, assistant.organizationId)
      if (!hasPermission) {
        throw new Error('没有权限删除该助手')
      }
    }

    await this.db.delete(schema.aiAssistants).where(eq(schema.aiAssistants.id, assistantId))

    return { success: true }
  }

  // 与助手对话
  @Trace('ai-assistants.chat')
  async chat(userId: string, assistantId: string, data: ChatWithAssistantInput) {
    const assistant = await this.get(userId, assistantId)
    if (!assistant) {
      throw new Error('助手不存在')
    }

    if (!assistant.isActive) {
      throw new Error('助手未激活')
    }

    // 更新使用次数
    await this.db
      .update(schema.aiAssistants)
      .set({
        usageCount: (assistant.usageCount || 0) + 1,
      })
      .where(eq(schema.aiAssistants.id, assistantId))

    // 调用 AI 服务
    const response = await this.callAiService(assistant, data.message, data.context)

    return {
      message: response,
      assistantId,
      timestamp: new Date().toISOString(),
    }
  }

  // 调用 AI 服务
  private async callAiService(
    assistant: any,
    message: string,
    _context?: Record<string, any>,
  ): Promise<string> {
    const { modelConfig, systemPrompt } = assistant

    if (!modelConfig) {
      throw new Error('助手模型配置缺失')
    }

    try {
      // 根据 provider 选择不同的 AI 服务
      switch (modelConfig.provider) {
        case 'ollama':
          return await this.callOllama(modelConfig, systemPrompt, message)

        case 'openai':
          // 未来可以添加 OpenAI 支持
          throw new Error('OpenAI provider not yet implemented')

        case 'anthropic':
          // 未来可以添加 Anthropic 支持
          throw new Error('Anthropic provider not yet implemented')

        case 'google':
          // 未来可以添加 Google AI 支持
          throw new Error('Google AI provider not yet implemented')

        default:
          throw new Error(`Unsupported provider: ${modelConfig.provider}`)
      }
    } catch (error) {
      console.error('AI service error:', error)
      // 如果 AI 服务失败，返回友好的错误消息
      return `抱歉，AI 服务暂时不可用。错误信息：${error instanceof Error ? error.message : '未知错误'}`
    }
  }

  // 调用 Ollama 本地模型
  private async callOllama(
    modelConfig: any,
    systemPrompt: string,
    message: string,
  ): Promise<string> {
    try {
      // 使用 OllamaService 而不是直接使用 Ollama 客户端
      return await this.ollamaService.generate(
        modelConfig.model || 'llama3.2:3b',
        message,
        systemPrompt,
        {
          temperature: modelConfig.temperature || 0.7,
        },
      )
    } catch (error) {
      console.error('Ollama error:', error)
      throw new Error(
        `Ollama 调用失败。请确保 Ollama 服务正在运行。错误：${error instanceof Error ? error.message : '未知错误'}`,
      )
    }
  }

  // 评分助手
  @Trace('ai-assistants.rate')
  async rate(userId: string, assistantId: string, rating: number) {
    if (rating < 1 || rating > 5) {
      throw new Error('评分必须在 1-5 之间')
    }

    const assistant = await this.get(userId, assistantId)
    if (!assistant) {
      throw new Error('助手不存在')
    }

    // 计算新的平均评分
    const currentAvg = assistant.averageRating || 0
    const currentCount = assistant.usageCount || 0
    const newAvg = Math.round((currentAvg * currentCount + rating) / (currentCount + 1))

    await this.db
      .update(schema.aiAssistants)
      .set({
        averageRating: newAvg,
      })
      .where(eq(schema.aiAssistants.id, assistantId))

    return { success: true, newAverageRating: newAvg }
  }

  // 辅助方法：检查组织访问权限
  private async checkOrgAccess(userId: string, organizationId: string): Promise<boolean> {
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!member
  }

  // 辅助方法：检查组织权限
  private async checkOrgPermission(userId: string, organizationId: string): Promise<boolean> {
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!member && ['owner', 'admin'].includes(member.role)
  }

  // 列出可用的 Ollama 模型
  @Trace('ai-assistants.listOllamaModels')
  async listOllamaModels() {
    return await this.ollamaService.listModels()
  }

  // 检查 Ollama 服务状态
  @Trace('ai-assistants.checkOllamaStatus')
  async checkOllamaStatus() {
    const isConnected = this.ollamaService.isOllamaConnected()
    if (!isConnected) {
      return {
        available: false,
        error: 'Ollama 服务未连接',
      }
    }

    const models = await this.ollamaService.listModels()
    return {
      available: true,
      modelCount: models.length,
      models: models.map((m) => m.name),
    }
  }

  // 流式对话（用于实时响应）
  @Trace('ai-assistants.chatStream')
  async *chatStream(userId: string, assistantId: string, message: string) {
    const assistant = await this.get(userId, assistantId)
    if (!assistant) {
      throw new Error('助手不存在')
    }

    if (!assistant.isActive) {
      throw new Error('助手未激活')
    }

    if (!assistant.modelConfig) {
      throw new Error('助手模型配置缺失')
    }

    // 更新使用次数
    await this.db
      .update(schema.aiAssistants)
      .set({
        usageCount: (assistant.usageCount || 0) + 1,
      })
      .where(eq(schema.aiAssistants.id, assistantId))

    // 只支持 Ollama 的流式响应
    if (assistant.modelConfig.provider !== 'ollama') {
      throw new Error('流式响应仅支持 Ollama provider')
    }

    // 使用 OllamaService 的流式生成
    yield* this.ollamaService.generateStream(
      assistant.modelConfig.model || 'llama3.2:3b',
      message,
      assistant.systemPrompt,
      {
        temperature: assistant.modelConfig.temperature || 0.7,
      },
    )
  }
}
