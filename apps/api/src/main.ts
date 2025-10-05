/**
 * Nitro + tRPC + NestJS 架构入口文件
 *
 * 在新架构中：
 * - Nitro 负责运行时和路由管理
 * - tRPC 负责 API 层和类型安全
 * - NestJS 作为服务层提供依赖注入
 *
 * 此文件仅用于导出必要的类型和服务，不再包含传统的启动逻辑
 */

// 导出 NestJS 应用模块供 tRPC 上下文使用
export { AppModule } from './app.module'
// 导出 tRPC 路由类型供前端使用
export type { AppRouter } from './routers/index'
export type { AuthService } from './services/auth.service'
export type { DatabaseService } from './services/database.service'
// 导出服务层接口（供外部使用）
export type { HealthService } from './services/health.service'
// 导出共享类型
export * from './shared'

/**
 * 架构说明：
 *
 * 1. 运行时由 Nitro 管理 (nitro.config.ts)
 * 2. API 路由由 tRPC 处理 (routes/trpc/[...].ts)
 * 3. 服务层由 NestJS 提供 (通过 tRPC 上下文注入)
 * 4. 数据层由 Drizzle 管理 (类型安全的 ORM)
 *
 * 这种架构实现了：
 * - 端到端类型安全
 * - 边缘计算就绪
 * - 优秀的开发体验
 * - 生产级可靠性
 */
