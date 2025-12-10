import { createAnthropic } from '@ai-sdk/anthropic'
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
 * Claude (Anthropic) 适配器
 * 使用 Vercel AI SDK 的 @ai-sdk/anthropic 实现
 */
export class ClaudeAdapter implements IAIClient {
  private provider: ReturnType<typeof createAnthropic>
  private model: ReturnType<ReturnType<typeof createAnthropic>>

  constructor(private readonly config: AIClientConfig) {
    if (!config.apiKey) {
      throw ErrorFactory.ai.inferenceFailed('Anthropic API key is required')
    }

    this.provider = createAnthropic({
      apiKey: config.apiKey,
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
        messages: options.messages
          .filter((msg) => msg.role !== 'function')
          .map((msg) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
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
        `Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
        messages: options.messages
          .filter((msg) => msg.role !== 'function')
          .map((msg) => ({
            role: msg.role as 'system' | 'user' | 'assistant',
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
        `Claude streaming error: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
      case 'end_turn':
        return 'stop'
      case 'length':
      case 'max_tokens':
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
