import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { sql } from 'drizzle-orm'
import { DrizzleService } from '../../../drizzle/drizzle.service'

export interface HealthStatus {
  status: 'healthy' | 'unhealthy'
  timestamp: string
  version: string
  environment: string
  uptime: number
  details: {
    database: {
      status: 'healthy' | 'unhealthy'
      responseTime?: number
      error?: string
    }
    config: {
      status: 'healthy' | 'unhealthy'
      environment: string
      debug: boolean
    }
  }
}
3
@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly drizzleService: DrizzleService,
  ) {}

  async getHealthStatus(): Promise<HealthStatus> {
    const startTime = Date.now()

    // 调试日志
    console.log('🔍 HealthService.getHealthStatus called')
    console.log('🔍 configService:', this.configService)
    console.log('🔍 configService type:', typeof this.configService)

    if (!this.configService) {
      throw new Error('ConfigService is undefined in HealthService')
    }

    // 使用 NestJS 官方 ConfigService 获取配置
    const appVersion = this.configService.get<string>('APP_VERSION', '1.0.0')
    const appEnvironment = this.configService.get<string>('NODE_ENV', 'development')
    const appDebug = this.configService.get<boolean>('DEBUG', false)

    // 检查数据库连接
    const databaseHealth = await this.checkDatabaseHealth()

    // 计算整体健康状态
    const isHealthy = databaseHealth.status === 'healthy'

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: appVersion,
      environment: appEnvironment,
      uptime: process.uptime(),
      details: {
        database: databaseHealth,
        config: {
          status: 'healthy',
          environment: appEnvironment,
          debug: appDebug,
        },
      },
    }
  }

  private async checkDatabaseHealth(): Promise<{
    status: 'healthy' | 'unhealthy'
    responseTime?: number
    error?: string
  }> {
    try {
      const startTime = Date.now()

      // 检查 DrizzleService 是否可用
      if (!this.drizzleService || !this.drizzleService.db) {
        return {
          status: 'unhealthy',
          error: 'DrizzleService or database connection is not available',
        }
      }

      // 执行简单的数据库查询来检查连接
      await this.drizzleService.db.execute(sql`SELECT 1`)

      const responseTime = Date.now() - startTime

      return {
        status: 'healthy',
        responseTime,
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown database error'
      console.error('🔍 Database health check failed:', errorMessage)

      return {
        status: 'unhealthy',
        error: `Failed query: SELECT 1\nparams: ${errorMessage}`,
      }
    }
  }
}
