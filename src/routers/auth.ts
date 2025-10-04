import { z } from 'zod'
import { publicProcedure, protectedProcedure, router } from '../trpc/init.js'
import { logger } from '../middleware/logger.middleware.js'
import { ErrorHandler, createError } from '../middleware/error.middleware.js'

/**
 * 认证路由
 * 提供用户注册、登录、令牌验证等功能
 */
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
    .input(z.object({
      email: z.string().email('请输入有效的邮箱地址'),
      password: z.string().min(8, '密码至少需要8个字符'),
      name: z.string().min(2, '姓名至少需要2个字符'),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        createdAt: z.string(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('user_registration_attempt', undefined, false, { email: input.email })

        // 检查用户是否已存在
        const existingUser = await ctx.databaseService.getUserByEmail(input.email)
        if (existingUser) {
          logger.logAuth('user_registration_failed', undefined, false, { 
            email: input.email, 
            reason: 'email_exists' 
          })
          throw createError.validation('该邮箱已被注册')
        }

        // 创建新用户
        const newUser = await ctx.databaseService.createUser({
          email: input.email,
          password: input.password,
          name: input.name,
        })

        logger.logAuth('user_registration_success', newUser.id, true, { email: input.email })

        return {
          success: true,
          message: '注册成功',
          user: {
            id: newUser.id,
            email: newUser.email,
            name: newUser.name,
            createdAt: newUser.createdAt.toISOString(),
          },
        }
      } catch (error) {
        logger.error('User registration failed', { 
          error: (error as Error).message, 
          email: input.email 
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
        description: '验证用户凭据并返回访问令牌',
      },
    })
    .input(z.object({
      email: z.string().email('请输入有效的邮箱地址'),
      password: z.string().min(1, '请输入密码'),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      token: z.string().optional(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
      }).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('user_login_attempt', undefined, false, { email: input.email })

        // 验证用户凭据
        const user = await ctx.authService.validateUser(input.email, input.password)
        if (!user) {
          logger.logAuth('user_login_failed', undefined, false, { 
            email: input.email, 
            reason: 'invalid_credentials' 
          })
          throw createError.unauthorized('邮箱或密码错误')
        }

        // 生成访问令牌
        const token = await ctx.authService.generateToken(user.id)

        logger.logAuth('user_login_success', user.id, true, { email: input.email })

        return {
          success: true,
          message: '登录成功',
          token,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
        }
      } catch (error) {
        logger.error('User login failed', { 
          error: (error as Error).message, 
          email: input.email 
        })
        throw ErrorHandler.toTRPCError(error)
      }
    }),

  /**
   * 令牌验证
   */
  verify: publicProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/auth/verify',
        tags: ['Authentication'],
        summary: '验证令牌',
        description: '验证访问令牌的有效性',
      },
    })
    .input(z.object({
      token: z.string().min(1, '请提供令牌'),
    }))
    .output(z.object({
      valid: z.boolean(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
      }).optional(),
      expiresAt: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('token_verification_attempt', undefined, false)

        const payload = await ctx.authService.validateToken(input.token)
        if (!payload) {
          logger.logAuth('token_verification_failed', undefined, false, { reason: 'invalid_token' })
          return {
            valid: false,
          }
        }

        const user = await ctx.databaseService.getUserById(payload.userId)
        if (!user) {
          logger.logAuth('token_verification_failed', payload.userId, false, { reason: 'user_not_found' })
          return {
            valid: false,
          }
        }

        logger.logAuth('token_verification_success', user.id, true)

        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
          },
          expiresAt: new Date(payload.exp * 1000).toISOString(),
        }
      } catch (error) {
        logger.error('Token verification failed', { error: (error as Error).message })
        return {
          valid: false,
        }
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
        summary: '获取当前用户',
        description: '获取当前登录用户的信息',
      },
    })
    .input(z.void())
    .output(z.object({
      id: z.string(),
      email: z.string(),
      name: z.string(),
      createdAt: z.string(),
      updatedAt: z.string(),
    }))
    .query(async ({ ctx }) => {
      try {
        logger.logAuth('get_current_user_attempt', ctx.user.id, true)

        const user = await ctx.databaseService.getUserById(ctx.user.id)
        if (!user) {
          logger.logAuth('get_current_user_failed', ctx.user.id, false, { reason: 'user_not_found' })
          throw createError.unauthorized('用户不存在')
        }

        logger.logAuth('get_current_user_success', user.id, true)

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        }
      } catch (error) {
        logger.error('Get current user failed', { 
          error: (error as Error).message, 
          userId: ctx.user.id 
        })
        throw ErrorHandler.toTRPCError(error)
      }
    }),

  /**
   * 更新用户信息
   */
  updateProfile: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/auth/profile',
        tags: ['Authentication'],
        summary: '更新用户信息',
        description: '更新当前用户的个人信息',
      },
    })
    .input(z.object({
      name: z.string().min(2, '姓名至少需要2个字符').optional(),
      email: z.string().email('请输入有效的邮箱地址').optional(),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
      user: z.object({
        id: z.string(),
        email: z.string(),
        name: z.string(),
        updatedAt: z.string(),
      }),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('update_profile_attempt', ctx.user.id, true)

        // 如果要更新邮箱，检查是否已被其他用户使用
        if (input.email && input.email !== ctx.user.email) {
          const existingUser = await ctx.databaseService.getUserByEmail(input.email)
          if (existingUser && existingUser.id !== ctx.user.id) {
            logger.logAuth('update_profile_failed', ctx.user.id, false, { 
              reason: 'email_exists',
              newEmail: input.email 
            })
            throw createError.validation('该邮箱已被其他用户使用')
          }
        }

        const updatedUser = await ctx.databaseService.updateUser(ctx.user.id, input)

        logger.logAuth('update_profile_success', ctx.user.id, true, { 
          updatedFields: Object.keys(input) 
        })

        return {
          success: true,
          message: '个人信息更新成功',
          user: {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            updatedAt: updatedUser.updatedAt.toISOString(),
          },
        }
      } catch (error) {
        logger.error('Update profile failed', { 
          error: (error as Error).message, 
          userId: ctx.user.id 
        })
        throw ErrorHandler.toTRPCError(error)
      }
    }),

  /**
   * 修改密码
   */
  changePassword: protectedProcedure
    .meta({
      openapi: {
        method: 'PUT',
        path: '/auth/password',
        tags: ['Authentication'],
        summary: '修改密码',
        description: '修改当前用户的密码',
      },
    })
    .input(z.object({
      currentPassword: z.string().min(1, '请输入当前密码'),
      newPassword: z.string().min(8, '新密码至少需要8个字符'),
    }))
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      try {
        logger.logAuth('change_password_attempt', ctx.user.id, true)

        // 验证当前密码
        const isValidPassword = await ctx.authService.validateUser(
          ctx.user.email, 
          input.currentPassword
        )
        
        if (!isValidPassword) {
          logger.logAuth('change_password_failed', ctx.user.id, false, { reason: 'invalid_current_password' })
          throw createError.unauthorized('当前密码错误')
        }

        // 更新密码
        await ctx.authService.updatePassword(ctx.user.id, input.newPassword)

        logger.logAuth('change_password_success', ctx.user.id, true)

        return {
          success: true,
          message: '密码修改成功',
        }
      } catch (error) {
        logger.error('Change password failed', { 
          error: (error as Error).message, 
          userId: ctx.user.id 
        })
        throw ErrorHandler.toTRPCError(error)
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
        description: '登出当前用户并使令牌失效',
      },
    })
    .input(z.void())
    .output(z.object({
      success: z.boolean(),
      message: z.string(),
    }))
    .mutation(async ({ ctx }) => {
      try {
        logger.logAuth('user_logout_attempt', ctx.user.id, true)

        // 这里可以实现令牌黑名单或会话管理
        // 目前只是记录日志
        
        logger.logAuth('user_logout_success', ctx.user.id, true)

        return {
          success: true,
          message: '登出成功',
        }
      } catch (error) {
        logger.error('User logout failed', { 
          error: (error as Error).message, 
          userId: ctx.user.id 
        })
        throw ErrorHandler.toTRPCError(createError.internal('登出失败'))
      }
    }),
})