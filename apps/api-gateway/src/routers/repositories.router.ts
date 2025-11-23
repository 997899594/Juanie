import {
  disableGitOpsSchema,
  enableGitOpsSchema,
  getFluxStatusSchema,
  projectIdQuerySchema,
  repositoryIdSchema,
} from '@juanie/core-types'
import { RepositoriesService } from '@juanie/service-business'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class RepositoriesRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly repositoriesService: RepositoriesService,
  ) {}

  get router() {
    return this.trpc.router({
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

      // 获取用户在 Git 平台上的仓库列表
      listUserRepositories: this.trpc.protectedProcedure
        .input(
          z.object({
            provider: z.enum(['github', 'gitlab']),
            accessToken: z.string(),
          }),
        )
        .query(async ({ ctx, input }) => {
          try {
            // 如果是特殊标记，从 OAuth 账户获取真实 token
            let token = input.accessToken
            if (token === '__USE_OAUTH__') {
              token = await this.repositoriesService.resolveOAuthToken(ctx.user.id, input.provider)
            }

            return await this.repositoriesService.listUserRepositories(input.provider, token)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
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
