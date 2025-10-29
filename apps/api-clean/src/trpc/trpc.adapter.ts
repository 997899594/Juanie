import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import type { AppRouter } from './trpc.router'
import { TrpcRouter } from './trpc.router'
import type { Context } from './trpc.service'

export async function setupTrpc(app: FastifyInstance, trpcRouter: TrpcRouter) {
  await app.register(fastifyTRPCPlugin<AppRouter>, {
    prefix: '/trpc',
    trpcOptions: {
      router: trpcRouter.appRouter,
      createContext: async ({ req }): Promise<Context> => {
        // 从请求头中获取 session ID
        const sessionId = getSessionId(req)

        if (!sessionId) {
          return {}
        }

        // 从 Redis 获取会话信息
        // 注意：这里需要访问 Redis，但我们在 adapter 中没有直接访问
        // 实际上应该在 AuthService 中验证，这里只是传递 sessionId
        // 让中间件在 service 层处理

        // 简化方案：直接从 header 传递，让 protectedProcedure 调用 AuthService 验证
        return {
          sessionId,
        }
      },
    },
  })
}

function getSessionId(req: FastifyRequest): string | undefined {
  // 从 Authorization header 获取
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.substring(7)
  }

  // 从 cookie 获取
  const cookies = req.headers.cookie
  if (cookies) {
    const match = cookies.match(/sessionId=([^;]+)/)
    if (match) {
      return match[1]
    }
  }

  // 从自定义 header 获取
  const sessionHeader = req.headers['x-session-id']
  if (typeof sessionHeader === 'string') {
    return sessionHeader
  }

  return undefined
}
