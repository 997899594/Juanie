import { GitOpsOrchestratorService } from '@juanie/service-business'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * GitOps 路由
 * 提供 GitOps 资源的手动管理功能
 * 
 * 注意：完整实现需要访问数据库和 OAuth 服务
 * 当前版本提供基础框架，具体实现待完善
 */
@Injectable()
export class GitOpsRouter {
  constructor(
    private trpc: TrpcService,
    private gitopsOrchestrator: GitOpsOrchestratorService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 获取项目的 GitOps 状态
       */
      getProjectGitOpsStatus: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
          }),
        )
        .query(async ({ input }) => {
          const summary = await this.gitopsOrchestrator.getProjectGitOpsSummary(input.projectId)

          return {
            enabled: false,
            summary,
            resources: [],
          }
        }),

      /**
       * 同步项目的 GitOps 资源状态
       */
      syncProjectGitOpsStatus: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
          }),
        )
        .mutation(async ({ input }) => {
          await this.gitopsOrchestrator.syncGitOpsStatus(input.projectId)

          return {
            success: true,
            message: '状态同步完成',
          }
        }),

      /**
       * 清理项目的 GitOps 资源
       */
      cleanupProjectGitOps: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
          }),
        )
        .mutation(async ({ input }) => {
          const result = await this.gitopsOrchestrator.cleanupProjectGitOps(input.projectId)

          if (!result.success) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `资源清理失败: ${result.errors.join(', ')}`,
            })
          }

          return {
            success: true,
            message: 'GitOps 资源清理成功',
            data: {
              deletedResources: result.deletedResources,
            },
          }
        }),
    })
  }
}
