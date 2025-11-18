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
        const sessionId = getSessionId(req)
        if (!sessionId) {
          return { reply: res as FastifyReply }
        }
        return {
          sessionId,
          reply: res as FastifyReply,
        }
      },
    },
    // 启用 SSE 支持 subscription
    useWSS: false, // 使用 HTTP/SSE 而不是 WebSocket
  })
}

function getSessionId(req: FastifyRequest): string | undefined {
  const cookieFromPlugin = req.cookies?.sessionId
  if (typeof cookieFromPlugin === 'string' && cookieFromPlugin.length > 0) {
    return cookieFromPlugin
  }
  return undefined
}
