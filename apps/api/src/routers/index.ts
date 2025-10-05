import { router } from '../trpc/init'
import { authRouter } from './auth'
import { healthRouter } from './health'

/**
 * 应用程序主路由
 * 聚合所有子路由模块
 */
export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
})

export type AppRouter = typeof appRouter
