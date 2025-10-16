import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { sql } from 'drizzle-orm'
import { DrizzleService } from '../../drizzle/drizzle.service'

@Injectable()
export class TestService {
  constructor(
    @Inject(ConfigService) private readonly configService: ConfigService,
    @Inject(DrizzleService) private readonly drizzleService: DrizzleService,
  ) {
    console.log('✅ TestService initialized successfully')
    console.log('✅ ConfigService injected:', !!this.configService)
    console.log('✅ DrizzleService injected:', !!this.drizzleService)
  }

  getStatus() {
    return {
      message: 'NestJS service is working!',
      timestamp: new Date().toISOString(),
      environment: this.configService.get('NODE_ENV'),
      database: {
        connected: !!this.configService.get('DATABASE_URL'),
        url: this.configService.get('DATABASE_URL') ? '***configured***' : 'not configured',
      },
      dependencies: {
        configService: !!this.configService,
        drizzleService: !!this.drizzleService,
      },
    }
  }

  async healthCheck() {
    return {
      status: 'healthy',
      service: 'TestService',
      timestamp: new Date().toISOString(),
      dependencies: {
        config: await this.testConfigService(),
        drizzle: await this.testDrizzleConnection(),
      },
    }
  }

  async testConfigService() {
    try {
      // 测试 NestJS 官方 ConfigService 的各种方法
      const tests = {
        basicGet: this.configService.get('NODE_ENV'),
        getWithDefault: this.configService.get('UNKNOWN_KEY', 'default_value'),
        getOrThrow: (() => {
          try {
            return this.configService.getOrThrow('NODE_ENV')
          } catch (error) {
            return `Error: ${error instanceof Error ? error.message : 'Unknown'}`
          }
        })(),
        nestedGet: this.configService.get('app.name'),
        databaseUrl: this.configService.get('DATABASE_URL') ? 'configured' : 'not configured',
        oauthGithub: this.configService.get('OAUTH_GITHUB_CLIENT_ID') ? 'configured' : 'not configured',
        oauthGitlab: this.configService.get('OAUTH_GITLAB_CLIENT_ID') ? 'configured' : 'not configured',
      }

      return {
        status: 'success',
        message: 'ConfigService is working correctly',
        tests,
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown ConfigService error',
      }
    }
  }

  async testDrizzleConnection() {
    try {
      // 检查 DrizzleService 是否可用
      if (!this.drizzleService || !this.drizzleService.db) {
        return {
          status: 'error',
          message: 'DrizzleService or database connection is not available',
        }
      }

      // 测试数据库连接
      const db = this.drizzleService.db
      // 执行一个简单的查询来测试连接
      const result = await db.execute(sql`SELECT 1 as test`)
      return {
        status: 'connected',
        message: 'Database connection successful',
        result: result,
      }
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown database error',
        details: {
          errorType: error?.constructor?.name || 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
        }
      }
    }
  }

  async performAsyncOperation() {
    // 模拟异步操作
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return {
      operation: 'async_test',
      completed: true,
      timestamp: new Date().toISOString(),
      config: {
        environment: this.configService.get('NODE_ENV'),
        port: this.configService.get('PORT', 3000),
      },
      data: {
        randomValue: Math.random(),
        processId: process.pid,
      },
    }
  }

  testErrorHandling(shouldThrow: boolean = false) {
    if (shouldThrow) {
      throw new Error('This is a test error for error handling validation')
    }
    
    return {
      message: 'Error handling test passed',
      timestamp: new Date().toISOString(),
      config: {
        environment: this.configService.get('NODE_ENV'),
      },
    }
  }

  getComprehensiveReport() {
    return {
      service: 'TestService',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: process.uptime(),
        nodeEnv: this.configService.get('NODE_ENV'),
      },
      configuration: {
        // 使用 NestJS 官方 ConfigService 读取配置
        environment: this.configService.get('NODE_ENV'),
        port: this.configService.get('PORT', 3000),
        appName: this.configService.get('APP_NAME', 'Juanie API'),
        databaseConfigured: !!this.configService.get('DATABASE_URL'),
        oauthProviders: {
          github: {
            configured: !!this.configService.get('OAUTH_GITHUB_CLIENT_ID'),
            clientId: this.configService.get('OAUTH_GITHUB_CLIENT_ID') ? '***configured***' : 'not configured',
          },
          gitlab: {
            configured: !!this.configService.get('OAUTH_GITLAB_CLIENT_ID'),
            clientId: this.configService.get('OAUTH_GITLAB_CLIENT_ID') ? '***configured***' : 'not configured',
            baseUrl: this.configService.get('OAUTH_GITLAB_BASE_URL', 'https://gitlab.com'),
          },
        },
      },
      dependencies: {
        configService: !!this.configService,
        drizzleService: !!this.drizzleService,
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
        external: Math.round(process.memoryUsage().external / 1024 / 1024),
      },
    }
  }
}