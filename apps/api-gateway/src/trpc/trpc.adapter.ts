import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AppRouter } from './trpc.router'
import { TrpcRouter } from './trpc.router'
import type { Context } from './trpc.service'

export async function setupTrpc(app: FastifyInstance, trpcRouter: TrpcRouter) {
  await app.register(fastifyTRPCPlugin<AppRouter>, {
    prefix: '/trpc',
    trpcOptions: {
      router: trpcRouter.appRouter,
      createContext: async ({ req, res }): Promise<Context> => {
        // 从 Cookie 获取 session ID（Cookie-only 模式）
        const sessionId = getSessionId(req)

        if (!sessionId) {
          return { reply: res as FastifyReply }
        }

        // 从 Redis 获取会话信息
        // 注意：这里需要访问 Redis，但我们在 adapter 中没有直接访问
        // 实际上应该在 AuthService 中验证，这里只是传递 sessionId
        // 让中间件在 service 层处理

        // 简化方案：直接从 header 传递，让 protectedProcedure 调用 AuthService 验证
        return {
          sessionId,
          reply: res as FastifyReply,
        }
      },
    },
  })
}

function getSessionId(req: FastifyRequest): string | undefined {
  // 优先使用 @fastify/cookie 解析的值
  const cookieFromPlugin = req.cookies?.sessionId
  if (typeof cookieFromPlugin === 'string' && cookieFromPlugin.length > 0) {
    return cookieFromPlugin
  }
  return undefined
}
