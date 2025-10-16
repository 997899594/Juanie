import { initTRPC } from '@trpc/server'
import { ZodError } from 'zod'

// 简化的上下文类型
export interface Context {
  req?: any
  resHeaders?: any
  db?: {
    isConnected: boolean
    mockData?: any[]
  }
}

// 格式化 Zod 错误为更友好的格式
function formatZodError(error: ZodError) {
  return {
    issues: error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    })),
    summary: `验证失败: ${error.issues.length} 个错误`,
  }
}

const t = initTRPC.context<Context>().create({
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
    } else if (error.code === 'INTERNAL_SERVER_ERROR') {
      friendlyMessage = '服务器内部错误，请稍后重试'
    }

    return {
      ...shape,
      message: friendlyMessage,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? formatZodError(error.cause) : null,
        originalMessage: shape.message,
        timestamp: new Date().toISOString(),
      },
    }
  },
})

// 基础中间件
const errorHandlerMiddleware = t.middleware(async ({ next }) => {
  try {
    return await next()
  } catch (error) {
    console.error('🚨 tRPC 错误:', {
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString(),
    })
    throw error
  }
})

// 导出路由器和过程
export const router = t.router
export const publicProcedure = t.procedure.use(errorHandlerMiddleware)
