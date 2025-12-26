import { Trace } from '@juanie/core/observability'
import { Injectable, type OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PinoLogger } from 'nestjs-pino'
import { Ollama } from 'ollama'

@Injectable()
export class OllamaService implements OnModuleInit {
  private ollama: Ollama
  private isConnected = false

  constructor(
    config: ConfigService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OllamaService.name)
    this.ollama = new Ollama({
      host: config.get('OLLAMA_HOST') || 'http://localhost:11434',
    })
  }

  async onModuleInit() {
    await this.checkConnection()
    await this.ensureModelsAvailable()
  }

  // 检查连接
  private async checkConnection() {
    try {
      await this.ollama.list()
      this.isConnected = true
      this.logger.info('✅ Ollama 连接成功')
    } catch {
      this.isConnected = false
      this.logger.warn('⚠️ Ollama 连接失败，将使用模拟响应')
      this.logger.warn('启动 Ollama: docker-compose up -d ollama')
    }
  }

  // 确保基础模型可用
  private async ensureModelsAvailable() {
    if (!this.isConnected) return

    try {
      const models = await this.listModels()
      const modelNames = models.map((m) => m.name)

      // 推荐的轻量级模型
      const recommendedModels = [
        'llama3.2:3b', // 3B 参数，适合代码和对话
        'codellama:7b', // 7B 参数，专门用于代码
        'mistral:7b', // 7B 参数，通用模型
      ]

      const missingModels = recommendedModels.filter((model) => {
        const modelPrefix = model.split(':')[0]
        if (!modelPrefix) return false
        return !modelNames.some((name) => name.startsWith(modelPrefix))
      })

      if (missingModels.length > 0) {
        this.logger.info('📥 推荐下载以下模型以获得最佳体验:')
        missingModels.forEach((model) => {
          this.logger.info(`   ollama pull ${model}`)
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      this.logger.warn(`检查模型时出错: ${message}`)
    }
  }

  // 生成响应
  @Trace('ollama.generate')
  async generate(
    model: string,
    prompt: string,
    system?: string,
    options?: {
      temperature?: number
      max_tokens?: number
    },
  ): Promise<string> {
    if (!this.isConnected) {
      return this.generateMockResponse(model, prompt, system)
    }

    try {
      const response = await this.ollama.generate({
        model,
        prompt,
        system,
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 2048,
        },
      })
      return response.response
    } catch (error) {
      this.logger.error('Ollama 生成错误', error)
      return this.generateMockResponse(model, prompt, system)
    }
  }

  // 流式响应
  @Trace('ollama.generateStream')
  async *generateStream(
    model: string,
    prompt: string,
    system?: string,
    options?: {
      temperature?: number
      max_tokens?: number
    },
  ): AsyncGenerator<string, void, unknown> {
    if (!this.isConnected) {
      yield* this.generateMockStream(model, prompt, system)
      return
    }

    try {
      const stream = await this.ollama.generate({
        model,
        prompt,
        system,
        stream: true,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 2048,
        },
      })

      for await (const chunk of stream) {
        if (chunk.response) {
          yield chunk.response
        }
      }
    } catch (error) {
      this.logger.error('Ollama 流式生成错误', error)
      yield* this.generateMockStream(model, prompt, system)
    }
  }

  // 对话（带历史）
  @Trace('ollama.chat')
  async chat(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    options?: {
      temperature?: number
      max_tokens?: number
    },
  ): Promise<string> {
    if (!this.isConnected) {
      const lastMessage = messages[messages.length - 1]
      if (!lastMessage) {
        throw new Error('No messages provided')
      }
      const systemMessage = messages.find((m) => m.role === 'system')
      return this.generateMockResponse(model, lastMessage.content, systemMessage?.content)
    }

    try {
      const response = await this.ollama.chat({
        model,
        messages,
        stream: false,
        options: {
          temperature: options?.temperature || 0.7,
          num_predict: options?.max_tokens || 2048,
        },
      })
      return response.message.content
    } catch (error) {
      this.logger.error('Ollama 对话错误', error)
      const lastMessage = messages[messages.length - 1]
      if (!lastMessage) {
        throw new Error('No messages provided')
      }
      const systemMessage = messages.find((m) => m.role === 'system')
      return this.generateMockResponse(model, lastMessage.content, systemMessage?.content)
    }
  }

  // 列出可用模型
  @Trace('ollama.listModels')
  async listModels() {
    if (!this.isConnected) {
      return [
        { name: 'llama3.2:3b', size: 2000000000, modified: new Date() },
        { name: 'codellama:7b', size: 4000000000, modified: new Date() },
        { name: 'mistral:7b', size: 4000000000, modified: new Date() },
      ]
    }

    try {
      const models = await this.ollama.list()
      return models.models.map((m) => ({
        name: m.name,
        size: m.size,
        modified: new Date(m.modified_at),
      }))
    } catch (error) {
      this.logger.error('获取模型列表错误', error)
      return []
    }
  }

  // 拉取模型
  @Trace('ollama.pullModel')
  async pullModel(model: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Ollama 未连接')
    }

    try {
      this.logger.info(`📥 开始下载模型: ${model}`)
      await this.ollama.pull({ model })
      this.logger.info(`✅ 模型下载完成: ${model}`)
    } catch (error) {
      this.logger.error(`模型下载失败: ${model}`, error)
      throw error
    }
  }

  // 删除模型
  @Trace('ollama.deleteModel')
  async deleteModel(model: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Ollama 未连接')
    }

    try {
      await this.ollama.delete({ model })
      this.logger.info(`🗑️ 模型已删除: ${model}`)
    } catch (error) {
      this.logger.error(`删除模型失败: ${model}`, error)
      throw error
    }
  }

  // 检查模型是否存在
  @Trace('ollama.modelExists')
  async modelExists(model: string): Promise<boolean> {
    const models = await this.listModels()
    const modelPrefix = model.split(':')[0]
    if (!modelPrefix) return false
    return models.some((m) => m.name === model || m.name.startsWith(modelPrefix))
  }

  // 获取推荐模型
  getRecommendedModels() {
    return [
      {
        name: 'llama3.2:3b',
        description: '轻量级通用模型，适合对话和简单任务',
        size: '2GB',
        use_case: ['对话', '文本生成', '简单问答'],
      },
      {
        name: 'codellama:7b',
        description: '专门用于代码生成和代码审查',
        size: '4GB',
        use_case: ['代码生成', '代码审查', '代码解释'],
      },
      {
        name: 'mistral:7b',
        description: '高质量通用模型，平衡性能和质量',
        size: '4GB',
        use_case: ['复杂对话', '分析', '创作'],
      },
    ]
  }

  // 生成模拟响应（当 Ollama 不可用时）
  private generateMockResponse(model: string, prompt: string, system?: string): string {
    const responses = {
      'code-reviewer': [
        '代码审查建议：\n1. 建议添加错误处理\n2. 考虑性能优化\n3. 代码风格符合规范',
        '这段代码看起来不错！建议：\n- 添加单元测试\n- 考虑边界情况处理\n- 文档可以更详细',
        '发现几个改进点：\n1. 变量命名可以更清晰\n2. 函数可以拆分得更小\n3. 添加类型注解',
      ],
      'devops-engineer': [
        'DevOps 建议：\n1. 部署策略建议使用蓝绿部署\n2. 建议添加健康检查\n3. 考虑添加自动回滚机制',
        '基础设施建议：\n- 使用 Kubernetes 进行容器编排\n- 配置监控和告警\n- 实施 GitOps 工作流',
        '安全建议：\n1. 启用 RBAC 权限控制\n2. 使用 Secret 管理敏感信息\n3. 定期更新依赖',
      ],
      'cost-optimizer': [
        '成本优化建议：\n1. 可以使用 Spot 实例节省 70% 成本\n2. 建议启用自动扩缩容\n3. 优化存储使用',
        '资源优化：\n- 右调实例大小\n- 使用预留实例\n- 清理未使用的资源',
        '成本分析：\n1. 当前成本主要在计算资源\n2. 建议使用更便宜的存储类型\n3. 考虑多云策略',
      ],
    }

    // 根据 system prompt 选择响应类型
    let responseType = 'general'
    if (system?.includes('code') || system?.includes('代码')) {
      responseType = 'code-reviewer'
    } else if (system?.includes('devops') || system?.includes('部署')) {
      responseType = 'devops-engineer'
    } else if (system?.includes('cost') || system?.includes('成本')) {
      responseType = 'cost-optimizer'
    }

    const typeResponses = responses[responseType as keyof typeof responses]
    if (typeResponses) {
      const randomResponse = typeResponses[Math.floor(Math.random() * typeResponses.length)]
      return `${randomResponse}\n\n针对您的问题"${prompt}"，这是基于 ${model} 模型的建议。\n\n⚠️ 当前使用模拟响应，启动 Ollama 获得真实 AI 回答。`
    }

    return `收到您的消息："${prompt}"\n\n这是一个模拟响应。要获得真实的 AI 回答，请：\n1. 启动 Ollama: docker-compose up -d ollama\n2. 下载模型: ollama pull ${model}\n3. 重启应用\n\n模型: ${model}`
  }

  // 生成模拟流式响应
  private async *generateMockStream(
    model: string,
    prompt: string,
    system?: string,
  ): AsyncGenerator<string, void, unknown> {
    const response = this.generateMockResponse(model, prompt, system)
    const words = response.split(' ')

    for (const word of words) {
      yield `${word} `
      await new Promise((resolve) => setTimeout(resolve, 50)) // 模拟打字效果
    }
  }

  // 获取连接状态
  isOllamaConnected(): boolean {
    return this.isConnected
  }
}
