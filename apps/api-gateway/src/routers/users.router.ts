import {
  updateUserPreferencesSchema,
  updateUserSchema,
  userIdSchema,
  userIdsSchema,
} from '@juanie/core-types'
import { AuthService, OAuthAccountsService } from '@juanie/service-auth'
import { UsersService } from '@juanie/service-users'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class UsersRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly usersService: UsersService,
    private readonly oauthAccountsService: OAuthAccountsService,
    private readonly authService: AuthService,
  ) {}

  get router() {
    return this.trpc.router({
      // 获取当前用户信息
      getMe: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        const user = await this.usersService.getMe(ctx.user.id)

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '用户不存在',
          })
        }

        return user
      }),

      // 更新当前用户信息
      updateMe: this.trpc.protectedProcedure
        .input(updateUserSchema)
        .mutation(async ({ ctx, input }) => {
          const user = await this.usersService.updateMe(ctx.user.id, input)

          if (!user) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '用户不存在',
            })
          }

          return user
        }),

      // 更新用户偏好设置
      updatePreferences: this.trpc.protectedProcedure
        .input(updateUserPreferencesSchema)
        .mutation(async ({ ctx, input }) => {
          const user = await this.usersService.updatePreferences(ctx.user.id, input)

          if (!user) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '用户不存在',
            })
          }

          return user
        }),

      // 获取用户详情（公开信息）
      getUser: this.trpc.procedure.input(userIdSchema).query(async ({ input }) => {
        const user = await this.usersService.getUser(input.userId)

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: '用户不存在',
          })
        }

        return user
      }),

      // 列出用户
      listUsers: this.trpc.protectedProcedure.input(userIdsSchema).query(async ({ input }) => {
        return await this.usersService.listUsers(input.userIds)
      }),

      // OAuth 账户管理
      oauthAccounts: this.trpc.router({
        // 获取当前用户的 OAuth 账户列表
        list: this.trpc.protectedProcedure.query(async ({ ctx }) => {
          return await this.oauthAccountsService.listUserAccounts(ctx.user.id)
        }),

        // 检查是否已连接指定提供商
        hasProvider: this.trpc.protectedProcedure
          .input(
            z.object({
              provider: z.enum(['github', 'gitlab']),
            }),
          )
          .query(async ({ ctx, input }) => {
            const hasProvider = await this.oauthAccountsService.hasProvider(
              ctx.user.id,
              input.provider,
            )
            return { hasProvider }
          }),

        // 获取 OAuth 授权 URL（用于连接账户）
        getAuthUrl: this.trpc.protectedProcedure
          .input(
            z.object({
              provider: z.enum(['github', 'gitlab']),
            }),
          )
          .query(async ({ ctx, input }) => {
            return await this.authService.getConnectAuthUrl(input.provider, ctx.user.id)
          }),

        // 处理 OAuth 回调（连接账户）
        connectCallback: this.trpc.protectedProcedure
          .input(
            z.object({
              provider: z.enum(['github', 'gitlab']),
              code: z.string(),
              state: z.string(),
            }),
          )
          .mutation(async ({ ctx, input }) => {
            if (input.provider === 'github') {
              return await this.authService.connectGitHubAccount(
                ctx.user.id,
                input.code,
                input.state,
              )
            } else {
              return await this.authService.connectGitLabAccount(
                ctx.user.id,
                input.code,
                input.state,
              )
            }
          }),

        // 断开 OAuth 连接
        disconnect: this.trpc.protectedProcedure
          .input(
            z.object({
              provider: z.enum(['github', 'gitlab']),
            }),
          )
          .mutation(async ({ ctx, input }) => {
            return await this.oauthAccountsService.disconnect(ctx.user.id, input.provider)
          }),
      }),
    })
  }
}
