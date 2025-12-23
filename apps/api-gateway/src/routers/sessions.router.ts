import { SessionService } from '@juanie/service-foundation'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * Session 管理路由
 * 提供会话列表、撤销等功能
 * Requirements: 6.3, 6.4, 6.5
 */
@Injectable()
export class SessionsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly sessionService: SessionService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 获取当前用户的所有活跃会话
       * Requirements: 6.3
       */
      listSessions: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        try {
          const sessions = await this.sessionService.listUserSessions(ctx.user.id)

          return {
            sessions: sessions.map((session) => ({
              id: session.id,
              sessionId: session.sessionId,
              ipAddress: session.ipAddress,
              userAgent: session.userAgent,
              deviceInfo: session.deviceInfo,
              status: session.status,
              lastActivityAt: session.lastActivityAt,
              createdAt: session.createdAt,
              isCurrent: session.sessionId === ctx.sessionId,
            })),
          }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : '获取会话列表失败',
          })
        }
      }),

      /**
       * 撤销指定会话
       * Requirements: 6.4
       */
      revokeSession: this.trpc.protectedProcedure
        .input(
          z.object({
            sessionId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // 不允许撤销当前会话（应该使用 logout）
            if (input.sessionId === ctx.sessionId) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: '不能撤销当前会话，请使用登出功能',
              })
            }

            await this.sessionService.revokeSession(input.sessionId)

            return {
              success: true,
              message: '会话已撤销',
            }
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error
            }
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '撤销会话失败',
            })
          }
        }),

      /**
       * 撤销所有其他会话（保留当前会话）
       * Requirements: 6.5
       */
      revokeAllSessions: this.trpc.protectedProcedure.mutation(async ({ ctx }) => {
        try {
          if (!ctx.sessionId) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: '无效的会话',
            })
          }

          const count = await this.sessionService.revokeAllSessionsExceptCurrent(
            ctx.user.id,
            ctx.sessionId,
          )

          return {
            success: true,
            message: `已撤销 ${count} 个会话`,
            count,
          }
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : '撤销会话失败',
          })
        }
      }),

      /**
       * 获取当前会话信息
       * Requirements: 6.3
       */
      getCurrentSession: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        try {
          if (!ctx.sessionId) {
            throw new TRPCError({
              code: 'UNAUTHORIZED',
              message: '无效的会话',
            })
          }

          const session = await this.sessionService.getSession(ctx.sessionId)

          if (!session) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '会话不存在',
            })
          }

          return {
            id: session.id,
            sessionId: session.sessionId,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            deviceInfo: session.deviceInfo,
            status: session.status,
            lastActivityAt: session.lastActivityAt,
            createdAt: session.createdAt,
          }
        } catch (error) {
          if (error instanceof TRPCError) {
            throw error
          }
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : '获取会话信息失败',
          })
        }
      }),
    })
  }
}
