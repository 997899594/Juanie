import type { AIClientConfig, AICompletionOptions, AICompletionResult } from '@juanie/types'
import { ConfigService } from '@nestjs/config'
import { OllamaClient } from '../../ollama.client'
import type { IAIClient } from '../ai-client.interface'

/**
 * Ollama 适配器
 * 复用现有的 OllamaClient 实现
 */
export class OllamaAdapter implements IAIClient {
  private ollamaClient: OllamaClient

  constructor(
    private readonly config: AIClientConfig,
    configService: ConfigService,
  ) {
    this.ollamaClient = new OllamaClient(configService)
  }

  /**
   * 同步完成
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    // 提取系统消息和用户消息
    const systemMessage = options.messages.find((m) => m.role === 'system')
    const userMessages = options.messages.filter((m) => m.role === 'user')
    const prompt = userMessages.map((m) => m.content).join('\n\n')

    const response = await this.ollamaClient.generate({
      model: this.config.model,
      prompt,
      system: systemMessage?.content,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    })

    return {
      content: response,
      finishReason: 'stop',
      usage: {
        // Ollama 不提供详细的 token 统计
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      },
    }
  }

  /**
   * 流式完成
   */
  async *streamComplete(options: AICompletionOptions): AsyncIterable<string> {
    // 提取系统消息和用户消息
    const systemMessage = options.messages.find((m) => m.role === 'system')
    const userMessages = options.messages.filter((m) => m.role === 'user')
    const prompt = userMessages.map((m) => m.content).join('\n\n')

    for await (const chunk of this.ollamaClient.generateStream({
      model: this.config.model,
      prompt,
      system: systemMessage?.content,
      temperature: options.temperature ?? this.config.temperature,
      maxTokens: options.maxTokens ?? this.config.maxTokens,
    })) {
      yield chunk
    }
  }
}
