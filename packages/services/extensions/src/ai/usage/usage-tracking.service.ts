import type { AIUsage, Database } from '@juanie/core/database'
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import type { AIProvider } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, between, desc, eq, gte, sql } from 'drizzle-orm'

/**
 * 使用记录数据
 */
export interface UsageRecord {
  userId: string
  projectId?: string
  provider: AIProvider
  model: string
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
  timestamp: Date
}

/**
 * 统计数据
 */
export interface UsageStatistics {
  totalCalls: number
  totalTokens: number
  totalCost: number
  byProvider: Record<
    string,
    {
      calls: number
      tokens: number
      cost: number
    }
  >
  byModel: Record<
    string,
    {
      calls: number
      tokens: number
      cost: number
    }
  >
}

/**
 * 配额配置
 */
export interface QuotaConfig {
  userId?: string
  projectId?: string
  monthlyTokenLimit: number
  monthlyCostLimit: number // 以分为单位
}

/**
 * 使用统计和成本追踪服务
 */
@Injectable()
export class UsageTrackingService {
  // 模型价格配置 (每 1M tokens 的价格,单位:分)
  private readonly MODEL_PRICING: Record<string, { input: number; output: number }> = {
    // Claude 模型
    'claude-3-5-sonnet-20241022': { input: 300, output: 1500 },
    'claude-3-opus-20240229': { input: 1500, output: 7500 },
    'claude-3-sonnet-20240229': { input: 300, output: 1500 },
    'claude-3-haiku-20240307': { input: 25, output: 125 },

    // OpenAI 模型
    'gpt-4-turbo': { input: 1000, output: 3000 },
    'gpt-4': { input: 3000, output: 6000 },
    'gpt-3.5-turbo': { input: 50, output: 150 },

    // 智谱 GLM 模型
    'glm-4': { input: 10, output: 10 },
    'glm-4-flash': { input: 1, output: 1 },
    'glm-4v': { input: 10, output: 10 },

    // 阿里 Qwen 模型
    'qwen2.5': { input: 4, output: 4 },
    'qwen2.5-coder': { input: 2, output: 2 },
    qwenvl: { input: 8, output: 8 },

    // Ollama 本地模型 (免费)
    'qwen2.5-coder:7b': { input: 0, output: 0 },
    'deepseek-coder:6.7b': { input: 0, output: 0 },
    'codellama:7b': { input: 0, output: 0 },
    'mistral:7b': { input: 0, output: 0 },
    'llama3.1:8b': { input: 0, output: 0 },
  }

  constructor(@Inject(DATABASE) private readonly db: Database) {}

  /**
   * 记录 AI 使用
   * @param record - 使用记录
   */
  async record(record: UsageRecord): Promise<AIUsage> {
    try {
      // 计算成本
      const cost = this.calculateCost(
        record.model,
        record.usage.promptTokens,
        record.usage.completionTokens,
      )

      // 插入使用记录
      const [usage] = await this.db
        .insert(schema.aiUsage)
        .values({
          userId: record.userId,
          projectId: record.projectId,
          provider: record.provider,
          model: record.model,
          promptTokens: record.usage.promptTokens,
          completionTokens: record.usage.completionTokens,
          totalTokens: record.usage.totalTokens,
          cost,
          cached: false,
          timestamp: record.timestamp,
        })
        .returning()

      if (!usage) {
        throw ErrorFactory.ai.inferenceFailed('Failed to record usage: No data returned')
      }

      return usage
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to record usage: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 记录缓存命中
   * @param context - 上下文信息
   */
  async recordCacheHit(context?: { userId: string; projectId?: string }): Promise<void> {
    if (!context) return

    try {
      // 记录一个零成本的缓存命中
      await this.db.insert(schema.aiUsage).values({
        userId: context.userId,
        projectId: context.projectId,
        provider: 'cache',
        model: 'cache',
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        cost: 0,
        cached: true,
        timestamp: new Date(),
      })
    } catch (error) {
      // 缓存命中记录失败不应该影响主流程
      console.error('Failed to record cache hit:', error)
    }
  }

  /**
   * 计算成本
   * @param model - 模型名称
   * @param promptTokens - 输入 tokens
   * @param completionTokens - 输出 tokens
   * @returns 成本 (以分为单位)
   */
  calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.MODEL_PRICING[model]
    if (!pricing) {
      // 未知模型使用默认价格
      return Math.round(((promptTokens + completionTokens) / 1_000_000) * 100)
    }

    const inputCost = (promptTokens / 1_000_000) * pricing.input
    const outputCost = (completionTokens / 1_000_000) * pricing.output

    return Math.round(inputCost + outputCost)
  }

  /**
   * 获取统计数据
   * @param options - 查询选项
   * @returns 统计数据
   */
  async getStatistics(options: {
    userId?: string
    projectId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<UsageStatistics> {
    try {
      const conditions = []

      if (options.userId) {
        conditions.push(eq(schema.aiUsage.userId, options.userId))
      }

      if (options.projectId) {
        conditions.push(eq(schema.aiUsage.projectId, options.projectId))
      }

      if (options.startDate && options.endDate) {
        conditions.push(between(schema.aiUsage.timestamp, options.startDate, options.endDate))
      } else if (options.startDate) {
        conditions.push(gte(schema.aiUsage.timestamp, options.startDate))
      }

      // 排除缓存命中记录
      conditions.push(eq(schema.aiUsage.cached, false))

      // 查询所有记录
      const records = await this.db
        .select()
        .from(schema.aiUsage)
        .where(and(...conditions))
        .orderBy(desc(schema.aiUsage.timestamp))

      // 聚合统计
      const totalCalls = records.length
      const totalTokens = records.reduce((sum, r) => sum + r.totalTokens, 0)
      const totalCost = records.reduce((sum, r) => sum + r.cost, 0)

      // 按提供商统计
      const byProvider: Record<string, { calls: number; tokens: number; cost: number }> = {}
      for (const record of records) {
        if (!byProvider[record.provider]) {
          byProvider[record.provider] = { calls: 0, tokens: 0, cost: 0 }
        }
        const providerStats = byProvider[record.provider]
        if (providerStats) {
          providerStats.calls++
          providerStats.tokens += record.totalTokens
          providerStats.cost += record.cost
        }
      }

      // 按模型统计
      const byModel: Record<string, { calls: number; tokens: number; cost: number }> = {}
      for (const record of records) {
        if (!byModel[record.model]) {
          byModel[record.model] = { calls: 0, tokens: 0, cost: 0 }
        }
        const modelStats = byModel[record.model]
        if (modelStats) {
          modelStats.calls++
          modelStats.tokens += record.totalTokens
          modelStats.cost += record.cost
        }
      }

      return {
        totalCalls,
        totalTokens,
        totalCost,
        byProvider,
        byModel,
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to get statistics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 检查配额
   * @param config - 配额配置
   * @returns 是否超过配额
   */
  async checkQuota(config: QuotaConfig): Promise<{
    exceeded: boolean
    usage: {
      tokens: number
      cost: number
    }
    limits: {
      tokens: number
      cost: number
    }
    percentage: {
      tokens: number
      cost: number
    }
  }> {
    try {
      // 获取当月的开始和结束时间
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

      // 获取当月统计
      const stats = await this.getStatistics({
        userId: config.userId,
        projectId: config.projectId,
        startDate: startOfMonth,
        endDate: endOfMonth,
      })

      // 计算百分比
      const tokenPercentage = (stats.totalTokens / config.monthlyTokenLimit) * 100
      const costPercentage = (stats.totalCost / config.monthlyCostLimit) * 100

      // 检查是否超过配额
      const exceeded =
        stats.totalTokens >= config.monthlyTokenLimit || stats.totalCost >= config.monthlyCostLimit

      return {
        exceeded,
        usage: {
          tokens: stats.totalTokens,
          cost: stats.totalCost,
        },
        limits: {
          tokens: config.monthlyTokenLimit,
          cost: config.monthlyCostLimit,
        },
        percentage: {
          tokens: tokenPercentage,
          cost: costPercentage,
        },
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to check quota: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 检查并触发告警
   * @param config - 配额配置
   * @returns 是否需要告警
   */
  async checkAndAlert(config: QuotaConfig): Promise<{
    shouldAlert: boolean
    level: 'warning' | 'critical' | null
    message: string
  }> {
    const quotaStatus = await this.checkQuota(config)

    // 超过配额 - 严重告警
    if (quotaStatus.exceeded) {
      return {
        shouldAlert: true,
        level: 'critical',
        message: `AI 使用配额已超限! Tokens: ${quotaStatus.usage.tokens}/${quotaStatus.limits.tokens}, 成本: ¥${(quotaStatus.usage.cost / 100).toFixed(2)}/¥${(quotaStatus.limits.cost / 100).toFixed(2)}`,
      }
    }

    // 超过 90% - 警告
    if (quotaStatus.percentage.tokens >= 90 || quotaStatus.percentage.cost >= 90) {
      return {
        shouldAlert: true,
        level: 'warning',
        message: `AI 使用配额即将超限! Tokens: ${quotaStatus.percentage.tokens.toFixed(1)}%, 成本: ${quotaStatus.percentage.cost.toFixed(1)}%`,
      }
    }

    return {
      shouldAlert: false,
      level: null,
      message: '',
    }
  }

  /**
   * 获取缓存命中率
   * @param options - 查询选项
   * @returns 缓存命中率 (0-100)
   */
  async getCacheHitRate(options: {
    userId?: string
    projectId?: string
    startDate?: Date
    endDate?: Date
  }): Promise<number> {
    try {
      const conditions = []

      if (options.userId) {
        conditions.push(eq(schema.aiUsage.userId, options.userId))
      }

      if (options.projectId) {
        conditions.push(eq(schema.aiUsage.projectId, options.projectId))
      }

      if (options.startDate && options.endDate) {
        conditions.push(between(schema.aiUsage.timestamp, options.startDate, options.endDate))
      } else if (options.startDate) {
        conditions.push(gte(schema.aiUsage.timestamp, options.startDate))
      }

      // 查询总调用次数和缓存命中次数
      const [totalResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.aiUsage)
        .where(and(...conditions))

      const [cachedResult] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(schema.aiUsage)
        .where(and(...conditions, eq(schema.aiUsage.cached, true)))

      const total = totalResult?.count || 0
      const cached = cachedResult?.count || 0

      if (total === 0) return 0

      return (cached / total) * 100
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to get cache hit rate: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
