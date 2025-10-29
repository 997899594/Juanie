import { Injectable } from '@nestjs/common'
import { initTRPC, TRPCError } from '@trpc/server'

// tRPC 上下文类型
export interface Context {
  sessionId?: string
  user?: {
    id: string
    email: string
  }
}

@Injectable()
export class TrpcService {
  trpc = initTRPC.context<Context>().create()

  // 公开的 procedure（无需认证）
  procedure = this.trpc.procedure

  // 受保护的 procedure（需要认证）
  protectedProcedure = this.trpc.procedure.use(async ({ ctx, next }) => {
    // 如果已经有 user，直接通过
    if (ctx.user) {
      return next({
        ctx: {
          user: ctx.user,
        },
      })
    }

    // 从 sessionId 获取用户信息
    if (!ctx.sessionId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '请先登录',
      })
    }

    // TODO: 从 Redis 或其他存储获取会话
    // 现在暂时抛出错误
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '会话验证未实现',
    })
  })

  router = this.trpc.router
  mergeRouters = this.trpc.mergeRouters
}
