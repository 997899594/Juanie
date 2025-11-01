import {
  updateUserPreferencesSchema,
  updateUserSchema,
  userIdSchema,
  userIdsSchema,
} from '@juanie/core-types'
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
    })
  }
}
