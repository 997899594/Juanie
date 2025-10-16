import { z } from 'zod'
import { AppError } from '../../../lib/errors'
import { protectedProcedure, publicProcedure, router } from '../../../lib/trpc/procedures'

export const authRouter = router({
  // 获取当前用户
  me: protectedProcedure.query(async ({ ctx }) => {
    return ctx.user
  }),

  // 登录
  login: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await ctx.authService.login(input.email, input.password)
        return result
      } catch (error) {
        throw AppError.unauthorized('Invalid credentials')
      }
    }),

  // 注册
  register: publicProcedure
    .input(
      z.object({
        email: z.string().email(),
        password: z.string().min(6),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const result = await ctx.authService.register(input.email, input.password)
        return result
      } catch (error) {
        if (error instanceof Error && error.message.includes('already exists')) {
          throw AppError.conflict('User already exists')
        }
        throw AppError.internal('Registration failed')
      }
    }),

  // 登出
  logout: protectedProcedure.mutation(async ({ ctx }) => {
    await ctx.authService.logout(ctx.user!.id)
    return { success: true }
  }),

  // GitHub OAuth 登录 URL
  getGitHubLoginUrl: publicProcedure.query(async ({ ctx }) => {
    return ctx.authService.getGitHubLoginUrl()
  }),

  // GitLab OAuth 登录 URL
  getGitLabLoginUrl: publicProcedure.query(async ({ ctx }) => {
    return ctx.authService.getGitLabLoginUrl()
  }),
})
