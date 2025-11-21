import '@fastify/cookie'
import { oauthCallbackSchema } from '@juanie/core-types'
import { AuthService } from '@juanie/service-auth'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { TrpcService } from '../trpc/trpc.service'

/**
 * Auth 路由
 * 处理用户认证相关的所有端点
 */
@Injectable()
export class AuthRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authService: AuthService,
  ) {}

  get router() {
    return this.trpc.router({
      // GitHub OAuth
      githubAuthUrl: this.trpc.procedure.query(async () => {
        return await this.authService.getGitHubAuthUrl()
      }),

      githubCallback: this.trpc.procedure
        .input(oauthCallbackSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const user = await this.authService.handleGitHubCallback(input.code, input.state)
            if (!user) throw new Error('用户创建失败')
            const sessionId = await this.authService.createSession(user.id)

            // 设置 HttpOnly 会话 Cookie（Cookie-only）
            ctx.reply?.setCookie('sessionId', sessionId, {
              path: '/',
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: 7 * 24 * 60 * 60,
            })

            return {
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              },
              sessionId,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : 'GitHub 登录失败',
            })
          }
        }),

      // GitLab OAuth
      gitlabAuthUrl: this.trpc.procedure.query(async () => {
        return await this.authService.getGitLabAuthUrl()
      }),

      gitlabCallback: this.trpc.procedure
        .input(oauthCallbackSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const user = await this.authService.handleGitLabCallback(input.code, input.state)
            if (!user) throw new Error('用户创建失败')
            const sessionId = await this.authService.createSession(user.id)

            // 设置 HttpOnly 会话 Cookie（Cookie-only）
            ctx.reply?.setCookie('sessionId', sessionId, {
              path: '/',
              httpOnly: true,
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: 7 * 24 * 60 * 60,
            })

            return {
              user: {
                id: user.id,
                email: user.email,
                username: user.username,
                displayName: user.displayName,
                avatarUrl: user.avatarUrl,
              },
              sessionId,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : 'GitLab 登录失败',
            })
          }
        }),

      // 会话管理
      me: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        return {
          id: ctx.user.id,
          email: ctx.user.email,
        }
      }),
      // 登出改为受保护路由，无输入，清 Redis + 清 Cookie
      logout: this.trpc.protectedProcedure.mutation(async ({ ctx }) => {
        if (ctx.sessionId) {
          await this.authService.deleteSession(ctx.sessionId)
        }
        ctx.reply?.setCookie('sessionId', '', {
          path: '/',
          httpOnly: true,
          sameSite: 'lax',
          secure: process.env.NODE_ENV === 'production',
          maxAge: 0,
        })
        return { success: true }
      }),
      // 会话校验改为受保护路由，无输入（依赖 Cookie）
      validateSession: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        const user = ctx.sessionId ? await this.authService.validateSession(ctx.sessionId) : null

        if (!user) {
          throw new TRPCError({
            code: 'UNAUTHORIZED',
            message: '会话无效或已过期',
          })
        }

        return {
          valid: true,
          user: {
            id: user.id,
            email: user.email,
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
          },
        }
      }),
    })
  }
}
