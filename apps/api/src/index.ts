/* Nitro + tRPC + NestJS 架构入口文件
 *
 * 清晰的分层架构：
 * - Nitro (边缘/HTTP 适配层)：负责文件路由与浏览器交互
 * - tRPC (前端到后端的类型化 RPC)：面向 SPA 的业务接口
 * - NestJS (领域服务/DI 容器)：承载业务服务
 * - Drizzle (数据持久化)：ORM 层
 */
import 'reflect-metadata'

import type { INestApplicationContext } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { defineNitroPlugin } from 'nitropack/runtime'
import { AppModule } from './app.module'
import { getConfig } from './core/config/nitro'
import { ServiceContainer } from './lib/service-container'

// NestJS 应用实例管理
let nestApp: INestApplicationContext | null = null

export interface AppContainer {
  nestApp: INestApplicationContext
}

// 创建 HTTP 服务器（用于独立运行）
export async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.init()
  return app
}

export default defineNitroPlugin(async (nitroApp) => {
  try {
    console.log('🚀 Initializing Nitro plugin...')

    // 初始化配置系统
    const config = getConfig()
    console.log(`📋 Configuration loaded for environment: ${config.app.environment}`)

    // 延迟初始化 NestJS 应用，避免重复创建
    console.log('✅ Nitro plugin initialized, NestJS app will be created on first request')
  } catch (error) {
    console.error('❌ Failed to initialize Nitro plugin:', error)
    throw error
  }
})

// 创建应用上下文（用于 Nitro 集成）
export async function initNestAppContainer(): Promise<AppContainer> {
  if (nestApp) {
    return { nestApp }
  }

  try {
    console.log('🚀 开始初始化 NestJS 应用上下文...')

    // 加载配置
    const config = getConfig()
    console.log(`📋 配置已加载，环境: ${config.app.environment}`)

    // 创建 NestJS 应用上下文
    nestApp = await NestFactory.createApplicationContext(AppModule, {
      logger: config.app.debug ? ['log', 'error', 'warn', 'debug', 'verbose'] : ['error', 'warn'],
    })

    // 启用关闭钩子
    nestApp.enableShutdownHooks()

    console.log('✅ NestJS 应用上下文初始化成功')

    // 初始化服务容器
    const { getServiceContainer } = await import('./lib/service-container')
    const serviceContainer = getServiceContainer()
    await serviceContainer.initialize(nestApp)

    console.log('✅ 服务容器初始化成功')

    return { nestApp }
  } catch (error) {
    console.error('❌ NestJS 应用上下文初始化失败:', error)
    throw error
  }
}

export async function getNestApp(): Promise<INestApplicationContext> {
  if (!nestApp) {
    const container = await initNestAppContainer()
    return container.nestApp
  }
  return nestApp
}

export async function getAppContainer(): Promise<AppContainer> {
  return initNestAppContainer()
}

export async function closeNestApp(): Promise<void> {
  if (nestApp) {
    await nestApp.close()
    nestApp = null
  }
}

export { createContext } from './lib/trpc/context'
export {
  protectedProcedure,
  publicProcedure,
  router,
} from './lib/trpc/procedures'

export * from './lib/types/index'

export { buildOpenApiDocument } from './openapi'

export type { AppRouter } from './routers/index'

export { nestApp }
