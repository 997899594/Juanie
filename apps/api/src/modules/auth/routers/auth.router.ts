import { z } from 'zod'
import { createError, ErrorHandler } from '../../../middleware/error.middleware'
import { logger } from '../../../middleware/logger.middleware'
import { protectedProcedure, publicProcedure, router } from '../../../trpc/init'

export const authRouter = router({
  /**
   * 用户注册
   */
  register: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/register',
        tags: ['Authentication'],
        summary: '用户注册',
        description: '创建新用户账户',
      },
    })
    .input(
      z.object({
        email: z.string().email('请输入有效的邮箱地址'),
        password: z.string().min(8, '密码至少需要8个字符'),
        name: z.string().min(2, '姓名至少需要2个字符'),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        user: z
          .object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
            createdAt: z.string(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('user_register_attempt', undefined, false, { email: input.email })

        // 检查用户是否已存在
        const existingUser = await ctx.databaseService.getUserByEmail(input.email)
        if (existingUser) {
          logger.logAuth('user_register_failed', undefined, false, {
            email: input.email,
            reason: 'email_exists',
          })
          throw createError.conflict('该邮箱已被注册')
        }

        // 哈希密码
        const passwordHash = await ctx.authService.hashPassword(input.password)

        // 创建用户
        const user = await ctx.databaseService.createUser({
          email: input.email,
          name: input.name,
        })

        // 创建用户凭据
        await ctx.databaseService.createUserCredential({
          userId: user.id,
          passwordHash,
        })

        logger.logAuth('user_register_success', user.id, true, { email: input.email })

        return {
          success: true,
          message: '注册成功',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            createdAt: user.createdAt.toISOString(),
          },
        }
      } catch (error) {
        logger.error('User registration failed', {
          error: (error as Error).message,
          email: input.email,
        })
        throw ErrorHandler.toTRPCError(error)
      }
    }),

  /**
   * 用户登录
   */
  login: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/login',
        tags: ['Authentication'],
        summary: '用户登录',
        description: '验证用户凭据并创建会话',
      },
    })
    .input(
      z.object({
        email: z.string().email('请输入有效的邮箱地址'),
        password: z.string().min(1, '请输入密码'),
      }),
    )
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
        sessionId: z.string().optional(),
        user: z
          .object({
            id: z.string(),
            email: z.string(),
            name: z.string(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('user_login_attempt', undefined, false, { email: input.email })

        // 验证用户凭据
        const user = await ctx.authService.validateCredentials(input.email, input.password)

        if (!user) {
          logger.logAuth('user_login_failed', undefined, false, {
            email: input.email,
            reason: 'invalid_credentials',
          })
          throw createError.unauthorized('邮箱或密码错误')
        }

        // 创建会话
        const sessionId = await ctx.authService.createSession(user.id)

        logger.logAuth('user_login_success', user.id, true, { email: input.email })

        return {
          success: true,
          message: '登录成功',
          sessionId,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        }
      } catch (error) {
        logger.error('User login failed', {
          error: (error as Error).message,
          email: input.email,
        })
        throw ErrorHandler.toTRPCError(error)
      }
    }),

  /**
   * 获取当前用户信息
   */
  me: protectedProcedure
    .meta({
      openapi: {
        method: 'GET',
        path: '/auth/me',
        tags: ['Authentication'],
        summary: '获取当前用户信息',
        description: '返回当前登录用户的详细信息',
        protect: true,
      },
    })
    .output(
      z.object({
        user: z.object({
          id: z.string(),
          email: z.string(),
          name: z.string(),
          createdAt: z.string(),
          updatedAt: z.string(),
        }),
      }),
    )
    .query(async ({ ctx }) => {
      return {
        user: {
          id: ctx.user.id,
          email: ctx.user.email,
          name: ctx.user.name,
          createdAt: ctx.user.createdAt.toISOString(),
          updatedAt: ctx.user.updatedAt.toISOString(),
        },
      }
    }),

  /**
   * 用户登出
   */
  logout: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/logout',
        tags: ['Authentication'],
        summary: '用户登出',
        description: '登出当前用户并销毁会话',
        protect: true,
      },
    })
    .output(
      z.object({
        success: z.boolean(),
        message: z.string(),
      }),
    )
    .mutation(async ({ ctx }) => {
      try {
        logger.logAuth('user_logout_attempt', ctx.user.id, true)

        // 销毁当前会话（需要从上下文获取会话 ID）
        if (ctx.session) {
          await ctx.authService.destroySession(ctx.session.sessionId)
        }

        logger.logAuth('user_logout_success', ctx.user.id, true)

        return {
          success: true,
          message: '登出成功',
        }
      } catch (error) {
        logger.error('User logout failed', {
          error: (error as Error).message,
          userId: ctx.user.id,
        })
        throw ErrorHandler.toTRPCError(createError.internal('登出失败'))
      }
    }),
})
