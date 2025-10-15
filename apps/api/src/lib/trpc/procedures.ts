import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'
import { AppError, toTRPCError } from '../errors'
import { formatZodErrorMessage } from '../utils/zod-helpers'
import type { Context } from './context'
import type { TRPCMeta } from './meta'

// 格式化 Zod 错误为更友好的格式
function formatZodError(error: ZodError) {
  const flattened = error.flatten()

  return {
    ...flattened,
    formattedErrors: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
      expected: issue.code === 'invalid_type' ? (issue as any).expected : undefined,
      received: issue.code === 'invalid_type' ? (issue as any).received : undefined,
      minimum: issue.code === 'too_small' ? (issue as any).minimum : undefined,
      maximum: issue.code === 'too_big' ? (issue as any).maximum : undefined,
    })),
    summary: formatZodErrorMessage(error),
  }
}

const t = initTRPC
  .context<Context>()
  .meta<TRPCMeta>()
  .create({
    errorFormatter({ shape, error }) {
      // 增强错误信息的可读性
      let friendlyMessage = shape.message

      // 处理常见的认证错误
      if (error.code === 'UNAUTHORIZED') {
        friendlyMessage = '认证失败，请先登录'
      } else if (error.code === 'FORBIDDEN') {
        friendlyMessage = '权限不足，无法访问此资源'
      } else if (error.code === 'NOT_FOUND') {
        friendlyMessage = '请求的资源不存在'
      } else if (error.code === 'BAD_REQUEST') {
        friendlyMessage = '请求参数有误，请检查输入'
      } else if (error.code === 'CONFLICT') {
        friendlyMessage = '资源冲突，可能已存在相同数据'
      } else if (error.code === 'INTERNAL_SERVER_ERROR') {
        friendlyMessage = '服务器内部错误，请稍后重试'
      }

      return {
        ...shape,
        message: friendlyMessage,
        data: {
          ...shape.data,
          zodError: error.cause instanceof ZodError ? formatZodError(error.cause) : null,
          originalMessage: shape.message, // 保留原始错误信息用于调试
          timestamp: new Date().toISOString(),
          environment: process.env.NODE_ENV || 'development',
        },
      }
    },
  })

// 基础中间件
const errorHandlerMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    // 增强错误日志记录
    console.error('🚨 tRPC 错误:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
      type: error instanceof AppError ? 'AppError' : error?.constructor?.name || 'Unknown',
    })

    throw toTRPCError(error)
  }
})

// 认证中间件
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw AppError.unauthorized('需要登录才能访问此功能')
  }
  return next({ ctx: { ...ctx, user: ctx.user! } })
})

// 导出路由器和过程
export const router = t.router
export const publicProcedure = t.procedure.use(errorHandlerMiddleware)
export const protectedProcedure = publicProcedure.use(authMiddleware)
