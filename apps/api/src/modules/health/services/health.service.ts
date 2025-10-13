import { Injectable } from '@nestjs/common'
import type { DatabaseService } from '../../database/services/database.service'

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  version: string
  environment: string
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
    heapUsedPercentage: number
  }
  services: {
    database: boolean
    redis?: boolean
  }
}

/**
 * 增强的健康检查服务
 * 提供全面的系统健康状态监控
 */
@Injectable()
export class HealthService {
  constructor(private readonly databaseService: DatabaseService) {}

  /**
   * 获取服务健康状态
   */
  async getHealthStatus(): Promise<HealthStatus> {
    const memoryUsage = process.memoryUsage()
    const heapUsedPercentage = Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100)

    // 检查各服务状态
    const [databaseHealth] = await Promise.allSettled([this.databaseService.checkHealth()])

    const services = {
      database: databaseHealth.status === 'fulfilled' && databaseHealth.value.status === 'healthy',
    }

    // 确定整体状态
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
    if (!services.database) {
      status = 'unhealthy'
    } else if (heapUsedPercentage > 90) {
      status = 'degraded'
    }

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        heapUsedPercentage,
      },
      services,
    }
  }

  /**
   * Ping 测试
   */
  async ping(): Promise<{ status: string; timestamp: string; responseTime: number }> {
    const start = Date.now()

    return {
      status: 'pong',
      timestamp: new Date().toISOString(),
      responseTime: Date.now() - start,
    }
  }

  /**
   * 检查数据库连接健康状态
   */
  async checkDatabaseHealth() {
    return await this.databaseService.checkHealth()
  }

  /**
   * 检查所有服务就绪状态
   */
  async checkReadiness() {
    const healthStatus = await this.getHealthStatus()

    return {
      ready: healthStatus.status !== 'unhealthy',
      services: healthStatus.services,
    }
  }
}
