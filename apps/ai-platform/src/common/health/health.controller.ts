import { Controller, Get, Inject } from '@nestjs/common'
import type Redis from 'ioredis'

@Controller('health')
export class HealthController {
  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {}

  @Get()
  async check() {
    const redisStatus = await this.checkRedis()

    return {
      status: redisStatus ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        redis: redisStatus ? 'up' : 'down',
      },
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      await this.redis.ping()
      return true
    } catch (error) {
      console.error('Redis health check failed:', error)
      return false
    }
  }
}
