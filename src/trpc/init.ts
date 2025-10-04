import { initTRPC, TRPCError } from '@trpc/server'
import { createContext, type Context } from './context.js'
import { ErrorHandler } from '../middleware/error.middleware.js'
import { createLoggingMiddleware, createPerformanceMiddleware, logger } from '../middleware/logger.middleware.js'
import type { OpenApiMeta } from 'trpc-to-openapi'

/**
 * 扩展的上下文类型，包含用户信息
 */
type AuthenticatedContext = Context & {
  user: any // 认证后的用户信息
}

/**
 * 初始化 tRPC 实例
 * 集成错误处理和日志记录中间件
 */
const t = initTRPC.context<Context>().meta<OpenApiMeta>().create({
  errorFormatter({ shape, error }) {
    // 记录错误日志
    ErrorHandler.logError(error.cause || error, {
      code: error.code,
      path: shape.data?.path,
      httpStatus: shape.data?.httpStatus,
    })

    return {
      ...shape,
      data: {
        ...shape.data,
        // 在开发环境显示详细错误信息
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
        }),
      },
    }
  },
})

/**
 * 基础中间件 - 添加日志和性能监控
 */
const baseMiddleware = t.middleware(async ({ next, path, type, ctx }) => {
  const start = Date.now()
  
  try {
    const result = await next()
    const duration = Date.now() - start
    
    // 记录成功的 API 调用
    logger.logApiRequest({
      method: type,
      path,
      duration,
      statusCode: 200,
      userId: (await ctx.getCurrentUser())?.id,
    })
    
    return result
  } catch (error) {
    const duration = Date.now() - start
    
    // 记录失败的 API 调用
    logger.logApiRequest({
      method: type,
      path,
      duration,
      statusCode: 500,
      userId: (await ctx.getCurrentUser())?.id,
    })
    
    // 转换为标准化的 tRPC 错误
    throw ErrorHandler.toTRPCError(error)
  }
})

/**
 * 认证中间件
 */
const authMiddleware = t.middleware(async ({ next, ctx }) => {
  const user = await ctx.validateAuth()
  
  if (!user) {
    logger.logAuth('unauthorized_access', undefined, false)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '需要登录才能访问此资源',
    })
  }

  logger.logAuth('authorized_access', user.id, true)
  
  return next({
    ctx: {
      ...ctx,
      user, // 将用户信息添加到上下文
    } as AuthenticatedContext,
  })
})

/**
 * 管理员权限中间件
 */
const adminMiddleware = authMiddleware.unstable_pipe(
  t.middleware(async ({ next, ctx }) => {
    // 类型断言：authMiddleware已经确保ctx包含user属性
    const authenticatedCtx = ctx as AuthenticatedContext
    
    // 这里可以添加管理员权限检查逻辑
    // 目前简单检查用户邮箱是否包含 admin
    if (!authenticatedCtx.user.email.includes('admin')) {
      logger.logAuth('admin_access_denied', authenticatedCtx.user.id, false)
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: '需要管理员权限',
      })
    }

    logger.logAuth('admin_access_granted', authenticatedCtx.user.id, true)
    
    return next()
  })
)

/**
 * 速率限制中间件
 */
const rateLimitMiddleware = t.middleware(async ({ next, ctx, path }) => {
  // 这里可以实现基于用户或IP的速率限制
  // 目前只是记录日志
  const user = await ctx.getCurrentUser()
  
  logger.debug(`Rate limit check for ${path}`, {
    userId: user?.id,
    path,
    timestamp: new Date().toISOString(),
  })
  
  return next()
})

// 导出路由器和过程
export const router = t.router
export const middleware = t.middleware

// 公共过程（无需认证）
export const publicProcedure = t.procedure.use(baseMiddleware).use(rateLimitMiddleware)

// 受保护的过程（需要认证）
export const protectedProcedure = t.procedure
  .use(baseMiddleware)
  .use(rateLimitMiddleware)
  .use(authMiddleware)

// 管理员过程（需要管理员权限）
export const adminProcedure = t.procedure
  .use(baseMiddleware)
  .use(rateLimitMiddleware)
  .use(adminMiddleware)

// 导出上下文创建函数
export { createContext }
export type { Context }
