import {
  createEnvironmentSchema,
  environmentIdSchema,
  grantEnvironmentPermissionSchema,
  projectIdQuerySchema,
  revokeEnvironmentPermissionSchema,
  updateEnvironmentSchema,
} from '@juanie/core-types'
import { EnvironmentsService } from '@juanie/service-environments'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class EnvironmentsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly environmentsService: EnvironmentsService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(createEnvironmentSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.create(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建环境失败',
            })
          }
        }),

      list: this.trpc.protectedProcedure
        .input(projectIdQuerySchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.list(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取环境列表失败',
            })
          }
        }),

      get: this.trpc.protectedProcedure.input(environmentIdSchema).query(async ({ ctx, input }) => {
        try {
          const environment = await this.environmentsService.get(ctx.user.id, input.environmentId)
          if (!environment) {
            throw new TRPCError({ code: 'NOT_FOUND', message: '环境不存在' })
          }
          return environment
        } catch (error) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error instanceof Error ? error.message : '获取环境详情失败',
          })
        }
      }),

      update: this.trpc.protectedProcedure
        .input(updateEnvironmentSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { environmentId, ...data } = input
            return await this.environmentsService.update(ctx.user.id, environmentId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '更新环境失败',
            })
          }
        }),

      delete: this.trpc.protectedProcedure
        .input(environmentIdSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.delete(ctx.user.id, input.environmentId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '删除环境失败',
            })
          }
        }),
    })
  }
}
