import { Logger } from '@juanie/core/logger'
import { REDIS } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import type Redis from 'ioredis'

/**
 * 速率限制服务
 *
 * 使用 Redis Sorted Set 实现滑动窗口算法
 * 防止暴力破解和 DDoS 攻击
 */
@Injectable()
export class RateLimitService {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(RateLimitService.name)
  }

  /**
   * 检查是否超过速率限制
   *
   * @param key - 限制键（例如: 'login:192.168.1.1' 或 'api:user-123'）
   * @param limit - 限制次数
   * @param window - 时间窗口（秒）
   * @returns 是否允许请求、剩余次数、重置时间
   */
  async checkRateLimit(input: {
    key: string
    limit: number
    window: number
  }): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const redisKey = `ratelimit:${input.key}`
    const now = Date.now()
    const windowMs = input.window * 1000

    try {
      // 使用 Redis sorted set 存储请求时间戳
      const pipeline = this.redis.pipeline()

      // 1. 删除窗口外的记录
      pipeline.zremrangebyscore(redisKey, 0, now - windowMs)

      // 2. 添加当前请求
      pipeline.zadd(redisKey, now, `${now}`)

      // 3. 获取窗口内的请求数
      pipeline.zcard(redisKey)

      // 4. 设置过期时间（窗口大小 + 1秒缓冲）
      pipeline.expire(redisKey, input.window + 1)

      const results = await pipeline.exec()

      // 获取请求数（第3个命令的结果）
      const count = (results?.[2]?.[1] as number) || 0

      const allowed = count <= input.limit
      const remaining = Math.max(0, input.limit - count)
      const resetAt = new Date(now + windowMs)

      if (!allowed) {
        this.logger.warn(`Rate limit exceeded for ${input.key}: ${count}/${input.limit}`)
      }

      return { allowed, remaining, resetAt }
    } catch (error) {
      this.logger.error(`Rate limit check failed for ${input.key}`, error)
      // 失败时允许请求（fail open）
      return {
        allowed: true,
        remaining: input.limit,
        resetAt: new Date(now + windowMs),
      }
    }
  }

  /**
   * 重置速率限制
   */
  async resetRateLimit(key: string): Promise<void> {
    const redisKey = `ratelimit:${key}`
    await this.redis.del(redisKey)
    this.logger.info(`Reset rate limit for ${key}`)
  }

  /**
   * 获取当前请求数
   */
  async getCurrentCount(key: string): Promise<number> {
    const redisKey = `ratelimit:${key}`
    return await this.redis.zcard(redisKey)
  }
}
