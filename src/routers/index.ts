import { router } from '../trpc/init.js'
import { healthRouter } from './health.js'
import { authRouter } from './auth.js'

/**
 * 应用程序主路由
 * 聚合所有子路由模块
 */
export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
})

export type AppRouter = typeof appRouter
