import { AuthService, RateLimitService } from '@juanie/service-foundation'
import { Injectable } from '@nestjs/common'
import { initTRPC, TRPCError } from '@trpc/server'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { createRateLimitMiddleware } from './rate-limit.middleware'

// tRPC 上下文类型
export interface Context {
  sessionId?: string
  user?: {
    id: string
    email: string
  }
  req?: FastifyRequest
  reply?: FastifyReply
}

@Injectable()
export class TrpcService {
  private readonly trpc = initTRPC.context<Context>().create()

  constructor(
    private readonly authService: AuthService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  // Rate Limiting 中间件
  private get rateLimitProcedure() {
    return this.trpc.procedure.use(createRateLimitMiddleware(this.rateLimitService))
  }

  // 公开的 procedure（需要限流）
  get procedure() {
    return this.rateLimitProcedure
  }

  // 受保护的 procedure（需要认证 + 限流）
  get protectedProcedure() {
    return this.rateLimitProcedure.use(async ({ ctx, next }) => {
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
  }

  get router() {
    return this.trpc.router
  }

  get mergeRouters() {
    return this.trpc.mergeRouters
  }
}
