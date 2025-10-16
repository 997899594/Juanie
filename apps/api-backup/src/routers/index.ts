import { router } from '../lib/trpc/procedures'
import { authRouter } from '../modules/auth/routers/auth.router'
import { gitRouter } from '../modules/git/routers/git.router'
import { healthRouter } from '../modules/health/routers/health.router'

export const appRouter = router({
  auth: authRouter,
  git: gitRouter,
  health: healthRouter,
})

export type AppRouter = typeof appRouter
