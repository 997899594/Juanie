import { Inject, Injectable } from '@nestjs/common'
import { initTRPC, TRPCError } from '@trpc/server'
import type Redis from 'ioredis'
import { REDIS } from '@/database/database.module'

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

  constructor(@Inject(REDIS) private redis: Redis) {}

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

    // 从 Redis 获取会话
    const sessionData = await this.redis.get(`session:${ctx.sessionId}`)
    if (!sessionData) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: '会话无效或已过期',
      })
    }

    const session = JSON.parse(sessionData) as {
      userId: string
      email: string
      createdAt: string
    }

    return next({
      ctx: {
        user: {
          id: session.userId,
          email: session.email,
        },
      },
    })
  })

  router = this.trpc.router
  mergeRouters = this.trpc.mergeRouters
}
