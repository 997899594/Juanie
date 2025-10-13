import { authRouter } from '../modules/auth/routers/auth.router'
import { gitRouter } from '../modules/git/routers/git.router'
import { healthRouter } from '../modules/health/routers/health.router'
import { router } from '../trpc/init'

/**
 * 应用主路由
 * 聚合所有模块的路由
 */
export const appRouter = router({
  auth: authRouter,
  git: gitRouter,
  health: healthRouter,
})

export type AppRouter = typeof appRouter
