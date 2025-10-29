import { RepositoriesService } from '@juanie/service-repositories'
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
      // 连接仓库
      connect: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            provider: z.enum(['github', 'gitlab']),
            fullName: z.string(),
            cloneUrl: z.url(),
            defaultBranch: z.string().optional(),
          }),
        )
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
        .input(z.object({ projectId: z.string() }))
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
      get: this.trpc.protectedProcedure
        .input(z.object({ repositoryId: z.string() }))
        .query(async ({ ctx, input }) => {
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
        .input(z.object({ repositoryId: z.string() }))
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
        .input(z.object({ repositoryId: z.string() }))
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
    })
  }
}
