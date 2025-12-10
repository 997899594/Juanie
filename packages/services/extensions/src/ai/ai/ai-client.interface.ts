import type { AICompletionOptions, AICompletionResult } from '@juanie/types'

/**
 * 统一的 AI 客户端接口
 * 所有 AI 提供商适配器都必须实现此接口
 */
export interface IAIClient {
  /**
   * 同步完成 - 一次性返回完整响应
   * @param options - AI 完成选项
   * @returns AI 完成结果
   */
  complete(options: AICompletionOptions): Promise<AICompletionResult>

  /**
   * 流式完成 - 实时返回生成的内容
   * @param options - AI 完成选项
   * @returns 异步迭代器，逐块返回生成的文本
   */
  streamComplete(options: AICompletionOptions): AsyncIterable<string>
}
