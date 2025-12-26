import type { AIClientConfig, AICompletionOptions, AICompletionResult } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { AICacheService } from '../cache/ai-cache.service'
import { ContentFilterService } from '../security/content-filter.service'
import { UsageTrackingService } from '../usage/usage-tracking.service'
import { AIClientFactory } from './ai-client-factory'

/**
 * AI 调用上下文
 */
export interface AIContext {
  userId: string
  projectId?: string
}

/**
 * 核心 AI 服务
 *
 * 整合所有子服务,提供统一的 AI 调用接口
 *
 * 功能:
 * - 统一的 AI 客户端接口
 * - 响应缓存
 * - 使用统计和成本追踪
 * - 内容安全过滤
 * - 错误处理和重试
 */
@Injectable()
export class AIService {
  constructor(
    private clientFactory: AIClientFactory,
    private cacheService: AICacheService,
    private usageTracking: UsageTrackingService,
    private contentFilter: ContentFilterService,
  ) {}

  /**
   * 同步 AI 完成
   *
   * @param config - AI 客户端配置
   * @param options - 完成选项
   * @param context - 调用上下文 (用户 ID, 项目 ID)
   * @returns AI 完成结果
   *
   * @throws {Error} 如果内容包含敏感信息
   * @throws {Error} 如果 AI 调用失败
   */
  async complete(
    config: AIClientConfig,
    options: AICompletionOptions,
    context?: AIContext,
  ): Promise<AICompletionResult> {
    try {
      // 1. 安全过滤
      const filteredMessages = await this.contentFilter.filterMessages(options.messages)

      // 2. 检查缓存
      const cacheKey = this.cacheService.generateKey(config, {
        ...options,
        messages: filteredMessages,
      })
      const cached = await this.cacheService.get(cacheKey)

      if (cached) {
        // 记录缓存命中
        await this.cacheService.recordHit()
        if (context) {
          await this.usageTracking.recordCacheHit(context)
        }
        return cached
      }

      // 记录缓存未命中
      await this.cacheService.recordMiss()

      // 3. 调用 AI
      const client = this.clientFactory.createClient(config)
      const result = await this.retryWithBackoff(
        () => client.complete({ ...options, messages: filteredMessages }),
        3,
      )

      // 4. 缓存结果
      await this.cacheService.set(cacheKey, result)

      // 5. 记录使用统计
      if (context) {
        await this.usageTracking.record({
          userId: context.userId,
          projectId: context.projectId,
          provider: config.provider,
          model: config.model,
          usage: result.usage,
          timestamp: new Date(),
        })
      }

      // 6. 记录审计日志
      if (context) {
        await this.contentFilter.logInteraction({
          userId: context.userId,
          projectId: context.projectId,
          action: 'ai_completion',
          input: JSON.stringify(filteredMessages),
          output: result.content,
          filtered: filteredMessages !== options.messages,
          sensitiveInfo: [],
          timestamp: new Date(),
        })
      }

      return result
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `AI completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 流式 AI 完成
   *
   * @param config - AI 客户端配置
   * @param options - 完成选项
   * @param context - 调用上下文 (用户 ID, 项目 ID)
   * @yields 生成的文本块
   *
   * @throws {Error} 如果内容包含敏感信息
   * @throws {Error} 如果 AI 调用失败
   */
  async *streamComplete(
    config: AIClientConfig,
    options: AICompletionOptions,
    context?: AIContext,
  ): AsyncIterable<string> {
    try {
      // 1. 安全过滤
      const filteredMessages = await this.contentFilter.filterMessages(options.messages)

      // 2. 流式调用不使用缓存 (因为需要实时返回)
      const client = this.clientFactory.createClient(config)

      let _totalChunks = 0
      let totalLength = 0
      const chunks: string[] = []

      // 3. 流式生成
      for await (const chunk of client.streamComplete({ ...options, messages: filteredMessages })) {
        _totalChunks++
        totalLength += chunk.length
        chunks.push(chunk)
        yield chunk
      }

      // 4. 记录使用统计 (流式模式下粗略估算)
      if (context) {
        await this.usageTracking.record({
          userId: context.userId,
          projectId: context.projectId,
          provider: config.provider,
          model: config.model,
          usage: {
            promptTokens: 0, // 流式模式下无法准确获取
            completionTokens: Math.ceil(totalLength / 4), // 粗略估算: 1 token ≈ 4 字符
            totalTokens: Math.ceil(totalLength / 4),
          },
          timestamp: new Date(),
        })
      }

      // 5. 记录审计日志
      if (context) {
        await this.contentFilter.logInteraction({
          userId: context.userId,
          projectId: context.projectId,
          action: 'ai_stream_completion',
          input: JSON.stringify(filteredMessages),
          output: chunks.join(''),
          filtered: filteredMessages !== options.messages,
          sensitiveInfo: [],
          timestamp: new Date(),
        })
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `AI stream completion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 带指数退避的重试
   *
   * @param fn - 要重试的函数
   * @param maxRetries - 最大重试次数
   * @param baseDelay - 基础延迟 (毫秒)
   * @returns 函数执行结果
   */
  private async retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000,
  ): Promise<T> {
    let lastError: Error | undefined

    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error

        // 不重试的错误类型
        if (
          error instanceof Error &&
          (error.message.includes('quota') ||
            error.message.includes('filtered') ||
            error.message.includes('blocked'))
        ) {
          throw error
        }

        // 最后一次重试失败,直接抛出
        if (i === maxRetries - 1) {
          break
        }

        // 指数退避
        const delay = baseDelay * 2 ** i
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }

    throw lastError || new Error('Retry failed')
  }

  /**
   * 检查配额
   *
   * @param userId - 用户 ID
   * @param monthlyTokenLimit - 月度 token 限制
   * @param monthlyCostLimit - 月度成本限制 (分)
   * @returns 配额使用情况
   */
  async checkQuota(userId: string, monthlyTokenLimit: number, monthlyCostLimit: number) {
    return await this.usageTracking.checkQuota({ userId, monthlyTokenLimit, monthlyCostLimit })
  }

  /**
   * 检查并触发告警
   *
   * @param userId - 用户 ID
   * @param monthlyTokenLimit - 月度 token 限制
   * @param monthlyCostLimit - 月度成本限制 (分)
   */
  async checkAndAlert(userId: string, monthlyTokenLimit: number, monthlyCostLimit: number) {
    await this.usageTracking.checkAndAlert({ userId, monthlyTokenLimit, monthlyCostLimit })
  }

  /**
   * 获取缓存统计
   */
  async getCacheStats() {
    return await this.cacheService.getStats()
  }

  /**
   * 清除缓存
   *
   * @param provider - 提供商 (可选)
   */
  async clearCache(provider?: string) {
    if (provider) {
      await this.cacheService.clearByProvider(provider)
    } else {
      await this.cacheService.clearAll()
    }
  }
}
