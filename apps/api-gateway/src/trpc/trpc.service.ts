import { AuthService } from '@juanie/service-auth'
import { Injectable } from '@nestjs/common'
import { initTRPC, TRPCError } from '@trpc/server'
import type { FastifyReply } from 'fastify'

// tRPC 上下文类型
export interface Context {
  sessionId?: string
  user?: {
    id: string
    email: string
  }
  reply?: FastifyReply
}

@Injectable()
export class TrpcService {
  constructor(private readonly authService: AuthService) {}

  trpc = initTRPC.context<Context>().create()

  // 公开的 procedure（无需认证）
  procedure = this.trpc.procedure

  // 受保护的 procedure（需要认证）
  protectedProcedure = this.trpc.procedure.use(async ({ ctx, next }) => {
    // 如果已经有 user，直接通过
    if (ctx.user) {
      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      })
    }

    // 必须有 sessionId
    if (!ctx.sessionId) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '请先登录',
      })
    }

    // 验证会话并获取用户
    const user = await this.authService.validateSession(ctx.sessionId)
    if (!user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '会话无效或已过期',
      })
    }

    return next({
      ctx: {
        ...ctx,
        user: {
          id: user.id,
          email: user.email,
        },
      },
    })
  })

  router = this.trpc.router
  mergeRouters = this.trpc.mergeRouters
}
