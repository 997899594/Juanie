import Redis from 'ioredis'

/**
 * Redis 连接配置
 */
export interface RedisConfig {
  url: string
  lazyConnect?: boolean
  enableReadyCheck?: boolean
  onConnect?: () => void
  onError?: (error: Error) => void
}

/**
 * 创建 Redis 客户端
 *
 * 这是唯一的 Redis 连接创建函数
 * redis.module.ts 和脚本都使用这个函数
 */
export function createRedisClient(config: RedisConfig): Redis {
  const redis = new Redis(config.url, {
    lazyConnect: config.lazyConnect ?? true,
    enableReadyCheck: config.enableReadyCheck ?? false,
  })

  if (config.onConnect) {
    redis.on('connect', config.onConnect)
  }

  if (config.onError) {
    redis.on('error', config.onError)
  }

  return redis
}

/**
 * Redis 客户端类型
 */
export type RedisClient = Redis
