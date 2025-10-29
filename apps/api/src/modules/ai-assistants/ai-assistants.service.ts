import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { Ollama } from 'ollama'
import { DATABASE } from '@/database/database.module'
import * as schema from '@/database/schemas'

@Injectable()
export class AiAssistantsService {
  private ollama: Ollama

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    config: ConfigService,
  ) {
    // 初始化 Ollama 客户端
    this.ollama = new Ollama({
      host: config.get('OLLAMA_HOST') || 'http://localhost:11434',
    })
  }

  // 创建 AI 助手
  async create(
    userId: string,
    data: {
      organizationId?: string
      name: string
      type: 'code-reviewer' | 'devops-engineer' | 'cost-optimizer'
      modelConfig: {
        provider: 'ollama' | 'openai' | 'anthropic' | 'google'
        model: string
        temperature: number
      }
      systemPrompt: string
      isActive?: boolean
    },
  ) {
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
        systemPrompt: data.systemPrompt,
        isActive: data.isActive ?? true,
      })
      .returning()

    return assistant
  }

  // 列出 AI 助手
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
  async update(
    userId: string,
    assistantId: string,
    data: {
      name?: string
      modelConfig?: {
        provider: 'ollama' | 'openai' | 'anthropic' | 'google'
        model: string
        temperature: number
      }
      systemPrompt?: string
      isActive?: boolean
    },
  ) {
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

    const [updated] = await this.db
      .update(schema.aiAssistants)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.aiAssistants.id, assistantId))
      .returning()

    return updated
  }

  // 删除助手
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
  async chat(
    userId: string,
    assistantId: string,
    data: {
      message: string
      context?: Record<string, any>
    },
  ) {
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
      // 调用 Ollama
      const response = await this.ollama.generate({
        model: modelConfig.model || 'llama3.2:3b',
        prompt: message,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: modelConfig.temperature || 0.7,
          top_p: 0.9,
          top_k: 40,
        },
      })

      return response.response
    } catch (error) {
      console.error('Ollama error:', error)
      throw new Error(
        `Ollama 调用失败。请确保 Ollama 服务正在运行（http://localhost:11434）。错误：${error instanceof Error ? error.message : '未知错误'}`,
      )
    }
  }

  // 评分助手
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

    return member && ['owner', 'admin'].includes(member.role)
  }

  // 列出可用的 Ollama 模型
  async listOllamaModels() {
    try {
      const models = await this.ollama.list()
      return models.models.map((model) => ({
        name: model.name,
        size: model.size,
        modified: model.modified_at,
        digest: model.digest,
      }))
    } catch (error) {
      console.error('Failed to list Ollama models:', error)
      return []
    }
  }

  // 检查 Ollama 服务状态
  async checkOllamaStatus() {
    try {
      const models = await this.ollama.list()
      return {
        available: true,
        modelCount: models.models.length,
        models: models.models.map((m) => m.name),
      }
    } catch (error) {
      return {
        available: false,
        error: error instanceof Error ? error.message : '未知错误',
      }
    }
  }

  // 流式对话（用于实时响应）
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

    try {
      const stream = await this.ollama.generate({
        model: assistant.modelConfig.model || 'llama3.2:3b',
        prompt: message,
        system: assistant.systemPrompt,
        stream: true,
        options: {
          temperature: assistant.modelConfig.temperature || 0.7,
        },
      })

      for await (const chunk of stream) {
        yield chunk.response
      }
    } catch (error) {
      console.error('Ollama stream error:', error)
      throw new Error('流式响应失败')
    }
  }
}
