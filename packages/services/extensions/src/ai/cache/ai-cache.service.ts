import { createHash } from 'node:crypto'
import { REDIS } from '@juanie/core/tokens'
import type { AIClientConfig, AICompletionOptions, AICompletionResult } from '@juanie/types'
import { ErrorFactory } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import type { Redis } from 'ioredis'

/**
 * AI 响应缓存服务
 * 使用 Redis 缓存 AI 响应以降低成本和延迟
 */
@Injectable()
export class AICacheService {
  private readonly CACHE_PREFIX = 'ai:cache:'
  private readonly CACHE_TTL = 24 * 60 * 60 // 24 小时 (秒)
  private readonly STATS_PREFIX = 'ai:cache:stats:'

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  /**
   * 生成缓存键
   * 基于配置和选项生成唯一的缓存键
   * @param config - AI 客户端配置
   * @param options - 完成选项
   * @returns 缓存键
   */
  generateKey(config: AIClientConfig, options: AICompletionOptions): string {
    // 构建用于生成哈希的数据
    const data = {
      provider: config.provider,
      model: config.model,
      temperature: options.temperature ?? config.temperature ?? 0.7,
      maxTokens: options.maxTokens ?? config.maxTokens,
      messages: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      functions: options.functions?.map((fn) => ({
        name: fn.name,
        parameters: fn.parameters,
      })),
      stopSequences: options.stopSequences,
    }

    // 使用 SHA256 生成哈希
    const hash = createHash('sha256').update(JSON.stringify(data)).digest('hex')

    return `${this.CACHE_PREFIX}${hash}`
  }

  /**
   * 获取缓存的响应
   * @param key - 缓存键
   * @returns 缓存的响应或 null
   */
  async get(key: string): Promise<AICompletionResult | null> {
    try {
      const cached = await this.redis.get(key)
      if (!cached) {
        await this.recordMiss()
        return null
      }

      await this.recordHit()
      return JSON.parse(cached) as AICompletionResult
    } catch (error) {
      // 缓存读取失败不应该影响主流程
      console.error('Failed to get cache:', error)
      return null
    }
  }

  /**
   * 设置缓存
   * @param key - 缓存键
   * @param value - 要缓存的响应
   * @param ttl - 过期时间 (秒),默认 24 小时
   */
  async set(key: string, value: AICompletionResult, ttl?: number): Promise<void> {
    try {
      const ttlSeconds = ttl ?? this.CACHE_TTL
      await this.redis.setex(key, ttlSeconds, JSON.stringify(value))
    } catch (error) {
      // 缓存写入失败不应该影响主流程
      console.error('Failed to set cache:', error)
    }
  }

  /**
   * 清除指定的缓存
   * @param key - 缓存键
   */
  async clear(key: string): Promise<void> {
    try {
      await this.redis.del(key)
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to clear cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 清除所有 AI 缓存
   */
  async clearAll(): Promise<void> {
    try {
      // 使用 SCAN 命令查找所有匹配的键
      const keys: string[] = []
      let cursor = '0'

      do {
        const [nextCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.CACHE_PREFIX}*`,
          'COUNT',
          100,
        )
        cursor = nextCursor
        keys.push(...foundKeys)
      } while (cursor !== '0')

      // 批量删除
      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to clear all cache: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 清除特定提供商的缓存
   * @param _provider - 提供商名称
   */
  async clearByProvider(_provider: string): Promise<void> {
    try {
      // 注意: 这个方法效率较低,因为需要遍历所有缓存键
      // 在生产环境中,可以考虑在缓存键中包含提供商信息以便快速清除
      const keys: string[] = []
      let cursor = '0'

      do {
        const [nextCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.CACHE_PREFIX}*`,
          'COUNT',
          100,
        )
        cursor = nextCursor

        // 检查每个键的内容
        for (const key of foundKeys) {
          const value = await this.redis.get(key)
          if (value) {
            // 这里简化处理,实际应该在键中包含提供商信息
            keys.push(key)
          }
        }
      } while (cursor !== '0')

      if (keys.length > 0) {
        await this.redis.del(...keys)
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to clear cache by provider: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 记录缓存命中
   */
  async recordHit(): Promise<void> {
    try {
      const key = `${this.STATS_PREFIX}hits`
      await this.redis.incr(key)
    } catch (error) {
      // 统计失败不应该影响主流程
      console.error('Failed to record cache hit:', error)
    }
  }

  /**
   * 记录缓存未命中
   */
  async recordMiss(): Promise<void> {
    try {
      const key = `${this.STATS_PREFIX}misses`
      await this.redis.incr(key)
    } catch (error) {
      // 统计失败不应该影响主流程
      console.error('Failed to record cache miss:', error)
    }
  }

  /**
   * 获取缓存统计
   * @returns 缓存统计信息
   */
  async getStats(): Promise<{
    hits: number
    misses: number
    total: number
    hitRate: number
  }> {
    try {
      const hitsKey = `${this.STATS_PREFIX}hits`
      const missesKey = `${this.STATS_PREFIX}misses`

      const [hitsStr, missesStr] = await Promise.all([
        this.redis.get(hitsKey),
        this.redis.get(missesKey),
      ])

      const hits = Number.parseInt(hitsStr || '0', 10)
      const misses = Number.parseInt(missesStr || '0', 10)
      const total = hits + misses

      const hitRate = total > 0 ? (hits / total) * 100 : 0

      return {
        hits,
        misses,
        total,
        hitRate,
      }
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to get cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 重置缓存统计
   */
  async resetStats(): Promise<void> {
    try {
      const hitsKey = `${this.STATS_PREFIX}hits`
      const missesKey = `${this.STATS_PREFIX}misses`

      await Promise.all([this.redis.del(hitsKey), this.redis.del(missesKey)])
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to reset cache stats: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }

  /**
   * 获取缓存大小 (键的数量)
   * @returns 缓存键的数量
   */
  async getCacheSize(): Promise<number> {
    try {
      let count = 0
      let cursor = '0'

      do {
        const [nextCursor, foundKeys] = await this.redis.scan(
          cursor,
          'MATCH',
          `${this.CACHE_PREFIX}*`,
          'COUNT',
          100,
        )
        cursor = nextCursor
        count += foundKeys.length
      } while (cursor !== '0')

      return count
    } catch (error) {
      throw ErrorFactory.ai.inferenceFailed(
        `Failed to get cache size: ${error instanceof Error ? error.message : 'Unknown error'}`,
      )
    }
  }
}
