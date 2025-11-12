import {
  configureGitOpsSchema,
  createEnvironmentSchema,
  disableEnvironmentGitOpsSchema,
  environmentIdSchema,
  getGitOpsConfigSchema,
  projectIdQuerySchema,
  updateEnvironmentSchema,
} from '@juanie/core-types'
import { EnvironmentsService } from '@juanie/service-environments'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
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

      // ==================== GitOps 相关端点 ====================

      // 配置环境的 GitOps
      configureGitOps: this.trpc.protectedProcedure
        .input(configureGitOpsSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { environmentId, config } = input
            return await this.environmentsService.configureGitOps(
              ctx.user.id,
              environmentId,
              config,
            )
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '配置 GitOps 失败',
            })
          }
        }),

      // 获取环境的 GitOps 配置
      getGitOpsConfig: this.trpc.protectedProcedure
        .input(getGitOpsConfigSchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.getGitOpsConfig(ctx.user.id, input.environmentId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取 GitOps 配置失败',
            })
          }
        }),

      // 禁用环境的 GitOps
      disableGitOps: this.trpc.protectedProcedure
        .input(disableEnvironmentGitOpsSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.environmentsService.disableGitOps(ctx.user.id, input.environmentId)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '禁用 GitOps 失败',
            })
          }
        }),
    })
  }
}
