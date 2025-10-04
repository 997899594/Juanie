import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { HealthService } from '../services/health.service.js'
import { TrpcService } from './trpc.service.js'
import { DatabaseService } from '../services/database.service.js'
import { AuthService } from '../services/auth.service.js'

/**
 * 创建 tRPC 上下文
 * 提供所有 NestJS 服务的访问
 * 建立清晰的服务层次结构
 */

// 创建单例 NestJS 应用实例
let nestApp: any = null

async function getNestApp() {
  if (!nestApp) {
    nestApp = await NestFactory.createApplicationContext(AppModule, {
      logger: false, // 禁用启动日志以避免重复输出
    })
  }
  return nestApp
}

/**
 * 创建 tRPC 上下文
 * @param opts 请求选项
 * @returns tRPC 上下文对象
 */
export async function createContext(opts: { req?: any; res?: any }) {
  try {
    const app = await getNestApp()
    
    // 安全地获取服务，如果某个服务不可用则返回null
    let healthService = null
    let trpcService = null
    let databaseService = null
    let authService = null

    try {
      healthService = app.get(HealthService)
    } catch (error) {
      console.warn('HealthService not available:', (error as Error).message)
    }

    try {
      trpcService = app.get(TrpcService)
    } catch (error) {
      console.warn('TrpcService not available:', (error as Error).message)
    }

    try {
      databaseService = app.get(DatabaseService)
    } catch (error) {
      console.warn('DatabaseService not available:', (error as Error).message)
    }

    try {
      authService = app.get(AuthService)
    } catch (error) {
      console.warn('AuthService not available:', (error as Error).message)
    }

    // 提取认证信息
    const authHeader = opts.req?.headers?.authorization

    return {
      // 核心服务
      healthService,
      trpcService,
      databaseService,
      authService,
      
      // 请求信息
      req: opts.req,
      res: opts.res,
      authHeader,
      
      // 便捷方法
      async getCurrentUser() {
        if (!trpcService) {
          throw new Error('TrpcService not available')
        }
        return await trpcService.getCurrentUser(authHeader?.replace('Bearer ', ''))
      },
      
      async validateAuth() {
        if (!trpcService) {
          throw new Error('TrpcService not available')
        }
        return await trpcService.validateRequest(authHeader)
      },
    }
  } catch (error) {
    console.error('Failed to create tRPC context:', error)
    
    // 返回降级的上下文
    return {
      healthService: null,
      trpcService: null,
      databaseService: null,
      authService: null,
      req: opts.req,
      res: opts.res,
      authHeader: opts.req?.headers?.authorization,
      async getCurrentUser() {
        throw new Error('Services not available')
      },
      async validateAuth() {
        throw new Error('Services not available')
      },
    }
  }
}

export type Context = Awaited<ReturnType<typeof createContext>>
