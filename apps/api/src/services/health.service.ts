import { Injectable } from '@nestjs/common'

export interface HealthStatus {
  status: string
  timestamp: string
  uptime: number
  version: string
  environment: string
  memory: {
    rss: number
    heapTotal: number
    heapUsed: number
    external: number
  }
  stack: string
}

/**
 * 健康检查服务
 * 提供系统健康状态检查功能
 * 统一管理所有健康检查相关的业务逻辑
 */
@Injectable()
export class HealthService {
  /**
   * 获取服务健康状态
   * @returns 完整的健康状态信息
   */
  getHealthStatus(): HealthStatus {
    const memoryUsage = process.memoryUsage()

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
      },
      stack: 'NestJS + tRPC + Nitro + Drizzle',
    }
  }

  /**
   * Ping 测试
   * @param message 可选的消息内容
   * @returns Ping 响应
   */
  ping(message?: string): { message: string; timestamp: string } {
    return {
      message: message ? `收到消息: ${message}` : 'pong',
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 获取系统性能指标
   * @returns 系统性能指标
   */
  getMetrics() {
    const memoryUsage = process.memoryUsage()

    return {
      memory: {
        used: memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        version: process.version,
      },
      timestamp: new Date().toISOString(),
    }
  }

  /**
   * 检查服务是否可用
   * @returns 服务可用性状态
   */
  isHealthy(): boolean {
    try {
      // 检查内存使用率
      const memoryUsage = process.memoryUsage()
      const memoryPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100

      // 如果内存使用率超过 90%，认为不健康
      if (memoryPercentage > 90) {
        return false
      }

      // 检查运行时间（如果运行时间太短，可能刚启动）
      if (process.uptime() < 1) {
        return false
      }

      return true
    } catch (_error) {
      return false
    }
  }
}
