import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import pino from 'pino'
import { getConfig } from '../../core/config/nitro'
import { AppError } from '../errors'
import type { HealthStatus } from '../types'

// 现代化服务容器
class ServiceContainer {
  private static instance: ServiceContainer
  private services = new Map<string, any>()

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer()
    }
    return ServiceContainer.instance
  }

  // 注册服务
  register<T>(key: string, factory: () => T | Promise<T>): this {
    this.services.set(key, factory)
    return this
  }

  // 获取服务
  async get<T>(key: string): Promise<T> {
    const factory = this.services.get(key)
    if (!factory) {
      throw AppError.notFound(`Service '${key}' not found`)
    }

    try {
      return await factory()
    } catch (error) {
      throw AppError.internal(`Failed to create service '${key}'`, {
        service: key,
        error,
      })
    }
  }

  // 检查服务是否存在
  has(key: string): boolean {
    return this.services.has(key)
  }

  // 清理容器
  clear(): void {
    this.services.clear()
  }
}

// 全局容器实例
export const container = ServiceContainer.getInstance()

// 注册核心服务
container
  .register('redis', async () => {
    const config = getConfig()

    if (!config.redis?.url || !config.redis?.token) return null

    return new Redis({
      url: config.redis.url,
      token: config.redis.token,
      retry: {
        retries: config.redis.maxRetries,
        backoff: (retryCount) => Math.min(retryCount * (config.redis?.retryDelay || 1000), 3000),
      },
    })
  })

  .register('rateLimit', async () => {
    const config = getConfig()

    if (!config.redis?.url || !config.redis?.token) return null

    const redis = await container.get<Redis>('redis')
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(
        config.security.rateLimitRequests,
        `${config.security.rateLimitWindow} s`,
      ),
      analytics: true,
      prefix: `${config.app.name}:ratelimit`,
    })
  })

  .register('logger', () => {
    const config = getConfig()

    const pinoConfig: pino.LoggerOptions = {
      level: config.monitoring.logLevel,
      timestamp: pino.stdTimeFunctions.isoTime,
    }

    if (config.app.environment === 'development' && config.app.debug) {
      pinoConfig.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      }
    }

    return pino(pinoConfig)
  })

  .register('healthCheck', async () => ({
    async check(): Promise<HealthStatus> {
      const config = getConfig()
      const services: Record<string, 'healthy' | 'unhealthy' | 'degraded'> = {}

      // Redis 健康检查
      if (config.redis?.url && config.redis?.token) {
        try {
          const redis = await container.get<Redis>('redis')
          await redis.ping()
          services.redis = 'healthy'
        } catch {
          services.redis = 'unhealthy'
        }
      }

      return {
        status: Object.values(services).every((status) => status === 'healthy')
          ? 'healthy'
          : 'unhealthy',
        services,
        timestamp: new Date().toISOString(),
        details: {
          uptime: process.uptime(),
          memory: process.memoryUsage(),
        },
      }
    },
  }))

export { ServiceContainer }
