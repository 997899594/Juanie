import { createOpenAI } from '@ai-sdk/openai'
import type {
  AIClientConfig,
  AICompletionOptions,
  AICompletionResult,
  AIFunction,
} from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { generateText, streamText } from 'ai'
import type { IAIClient } from '../ai-client.interface'

/**
 * 智谱 GLM 适配器
 * 使用 createOpenAI 创建兼容 OpenAI 的客户端
 */
export class ZhipuAdapter implements IAIClient {
  private provider: ReturnType<typeof createOpenAI>
  private model: ReturnType<ReturnType<typeof createOpenAI>>

  constructor(private readonly config: AIClientConfig) {
    if (!config.apiKey) {
      throw ErrorFactory.ai.inferenceFailed('Zhipu API key is required')
    }

    // 智谱 AI 使用 OpenAI 兼容的 API
    this.provider = createOpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL || 'https://open.bigmodel.cn/api/paas/v4',
    })

    this.model = this.provider(config.model)
  }

  /**
   * 同步完成
   */
  async complete(options: AICompletionOptions): Promise<AICompletionResult> {
    try {
      const result = await generateText({
        model: this.model,
        messages: options.messages.map((msg) => ({
          role: msg.role === 'function' ? 'assistant' : msg.role,
          content: msg.content,
        })),
        temperature: options.temperature ?? this.config.temperature,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
        tools: options.functions ? this.convertFunctionsToTools(options.functions) : undefined,
      })

      return {
        content: result.text,
        finishReason: this.mapFinishReason(result.finishReason),
        usage: {
          promptTokens: result.usage.promptTokens,
          completionTokens: result.usage.completionTokens,
          totalTokens: result.usage.totalTokens,
        },
        functionCall: result.toolCalls?.[0]
          ? {
              name: result.toolCalls[0].toolName,
              arguments: result.toolCalls[0].args as Record<string, unknown>,
            }
          : undefined,
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Zhipu API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 流式完成
   */
  async *streamComplete(options: AICompletionOptions): AsyncIterable<string> {
    try {
      const result = await streamText({
        model: this.model,
        messages: options.messages.map((msg) => ({
          role: msg.role === 'function' ? 'assistant' : msg.role,
          content: msg.content,
        })),
        temperature: options.temperature ?? this.config.temperature,
        maxTokens: options.maxTokens ?? this.config.maxTokens,
      })

      for await (const chunk of result.textStream) {
        yield chunk
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Zhipu streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 将 OpenAI 风格的函数定义转换为 Vercel AI SDK 的工具格式
   */
  private convertFunctionsToTools(functions: AIFunction[]) {
    return Object.fromEntries(
      functions.map((fn) => [
        fn.name,
        {
          description: fn.description,
          parameters: fn.parameters,
        },
      ]),
    )
  }

  /**
   * 映射完成原因
   */
  private mapFinishReason(reason: string): AICompletionResult['finishReason'] {
    switch (reason) {
      case 'stop':
        return 'stop'
      case 'length':
        return 'length'
      case 'tool-calls':
        return 'function_call'
      case 'content-filter':
        return 'content_filter'
      default:
        return 'stop'
    }
  }
}
