/**
 * 简洁的 Nitro + tRPC 架构入口文件
 *
 * 优雅的分层架构：
 * - Nitro (边缘/HTTP 适配层)：负责文件路由与浏览器交互
 * - tRPC (前端到后端的类型化 RPC)：面向 SPA 的业务接口
 * - 简洁服务层：手动依赖注入，无需复杂的 DI 容器
 * - Drizzle (数据持久化)：ORM 层
 */

import { defineNitroPlugin } from 'nitropack/runtime'

export default defineNitroPlugin(async (nitroApp) => {
  console.log('🚀 Juanie API 启动中...')

  // Nitro 插件初始化完成
  nitroApp.hooks.hook('render:route', (url, result, context) => {
    // 可以在这里添加全局路由处理逻辑
  })

  console.log('✅ Juanie API 已启动')
})

// 导出 tRPC 路由类型供前端使用
export type { AppRouter } from './routers'
