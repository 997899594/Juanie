import {
  connectRepositorySchema,
  disableGitOpsSchema,
  enableGitOpsSchema,
  getFluxStatusSchema,
  projectIdQuerySchema,
  repositoryIdSchema,
} from '@juanie/core-types'
import { RepositoriesService } from '@juanie/service-repositories'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class RepositoriesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly repositoriesService: RepositoriesService,
  ) {}

  get router() {
    return this.trpc.router({
      // 连接仓库
      connect: this.trpc.protectedProcedure
        .input(connectRepositorySchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.repositoriesService.connect(ctx.user.id, input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '连接仓库失败',
            })
          }
        }),

      // 列出项目的仓库
      list: this.trpc.protectedProcedure
        .input(projectIdQuerySchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.repositoriesService.list(ctx.user.id, input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取仓库列表失败',
            })
          }
        }),

      // 获取仓库详情
      get: this.trpc.protectedProcedure.input(repositoryIdSchema).query(async ({ ctx, input }) => {
        try {
          const repository = await this.repositoriesService.get(ctx.user.id, input.repositoryId)

          if (!repository) {
            throw new TRPCError({
              code: 'NOT_FOUND',
              message: '仓库不存在',
            })
          }

          return repository
        } catch (error) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: error instanceof Error ? error.message : '获取仓库详情失败',
          })
        }
      }),

      // 同步仓库元数据
      sync: this.trpc.protectedProcedure
        .input(repositoryIdSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.repositoriesService.sync(ctx.user.id, input.repositoryId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '同步仓库失败',
            })
          }
        }),

      // 断开仓库连接
      disconnect: this.trpc.protectedProcedure
        .input(repositoryIdSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.repositoriesService.disconnect(ctx.user.id, input.repositoryId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '断开仓库失败',
            })
          }
        }),

      // ==================== GitOps 相关端点 ====================

      // 启用 GitOps
      enableGitOps: this.trpc.protectedProcedure
        .input(enableGitOpsSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { repositoryId, config } = input
            return await this.repositoriesService.enableGitOps(ctx.user.id, repositoryId, config)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '启用 GitOps 失败',
            })
          }
        }),

      // 禁用 GitOps
      disableGitOps: this.trpc.protectedProcedure
        .input(disableGitOpsSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.repositoriesService.disableGitOps(ctx.user.id, input.repositoryId)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '禁用 GitOps 失败',
            })
          }
        }),

      // 获取 Flux 同步状态
      getFluxStatus: this.trpc.protectedProcedure
        .input(getFluxStatusSchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.repositoriesService.getFluxStatus(ctx.user.id, input.repositoryId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取 Flux 状态失败',
            })
          }
        }),
    })
  }
}
