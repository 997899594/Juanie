import { Logger } from '@juanie/core/logger'
import { DeploymentsService } from '@juanie/service-business'
import {
  approveDeploymentSchema,
  createDeploymentSchema,
  deploymentIdSchema,
  deployWithGitOpsSchema,
  rejectDeploymentSchema,
  rollbackDeploymentSchema,
} from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class DeploymentsRouter {
  constructor(
    private trpc: TrpcService,
    private deploymentsService: DeploymentsService,
    private logger: Logger,
  ) {
    this.logger.setContext(DeploymentsRouter.name)
  }

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(createDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.create(ctx.user.id, input)
        }),

      list: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid().optional(),
            environmentId: z.string().uuid().optional(),
            status: z.string().optional(),
          }),
        )
        .query(async ({ ctx, input }) => {
          return await this.deploymentsService.list(ctx.user.id, input)
        }),

      get: this.trpc.protectedProcedure.input(deploymentIdSchema).query(async ({ ctx, input }) => {
        return await this.deploymentsService.get(ctx.user.id, input.deploymentId)
      }),

      rollback: this.trpc.protectedProcedure
        .input(rollbackDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.deploymentsService.rollback(ctx.user.id, input.deploymentId)
        }),

      approve: this.trpc.protectedProcedure
        .input(approveDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          const { deploymentId, ...data } = input
          return await this.deploymentsService.approve(ctx.user.id, deploymentId, data)
        }),

      reject: this.trpc.protectedProcedure
        .input(rejectDeploymentSchema)
        .mutation(async ({ ctx, input }) => {
          const { deploymentId, ...data } = input
          return await this.deploymentsService.reject(ctx.user.id, deploymentId, data)
        }),

      // ==================== GitOps 相关端点 ====================

      // 通过 GitOps 部署（UI → Git 工作流）
      deployWithGitOps: this.trpc.protectedProcedure
        .input(deployWithGitOpsSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            // Extract version from image if not provided
            let version = 'latest'
            if (input.changes.image) {
              const imageParts = input.changes.image.split(':')
              version = imageParts.length > 1 ? imageParts[1]! : 'latest'
            }

            return await this.deploymentsService.deployWithGitOps(ctx.user.id, {
              projectId: input.projectId,
              environmentId: input.environmentId,
              version,
              changes: input.changes,
              commitMessage: input.commitMessage,
            })
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : 'GitOps 部署失败',
            })
          }
        }),

      // 按项目获取部署列表
      getByProject: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string(), limit: z.number().optional() }))
        .query(async ({ input: _input }) => {
          // TODO: 实现获取项目部署列表的逻辑
          return {
            deployments: [] as Array<{
              id: string
              projectId: string
              environmentId: string
              pipelineRunId: string | null
              status: 'pending' | 'running' | 'success' | 'failed' | 'rolled_back'
              version: string
              commitHash: string
              branch: string
              deployedBy: string | null
              strategy: string // 使用 strategy 而不是 deploymentStrategy，与数据库字段一致
              startedAt: string | null
              finishedAt: string | null
              commitMessage?: string
              createdAt: string
            }>,
          }
        }),

      // 获取部署统计
      getStats: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ input: _input }) => {
          // TODO: 实现获取部署统计的逻辑
          return {
            total: 0,
            success: 0,
            failed: 0,
            pending: 0,
            cancelled: 0,
            running: 0,
            rolledBack: 0,
            successRate: 0, // 成功率百分比
            avgDeploymentTime: 0,
          }
        }),

      // ==================== 触发部署 ====================

      // 触发立即部署（公开 endpoint，用于 CI/CD 回调）
      // 安全性：只验证项目是否存在，信任来自 GitHub Actions 的请求
      trigger: this.trpc.procedure
        .input(
          z.object({
            projectId: z.string(),
            environment: z.enum(['development', 'staging', 'production']),
            imageTag: z.string().optional(),
            commitSha: z.string().optional(),
            repository: z.string().optional(),
          }),
        )
        .mutation(async ({ input }) => {
          this.logger.info(`Deployment trigger request from CI/CD`, {
            projectId: input.projectId,
            environment: input.environment,
            repository: input.repository,
            commitSha: input.commitSha,
          })

          try {
            await this.deploymentsService.triggerDeploy(
              input.projectId,
              input.environment,
              input.imageTag,
            )

            return {
              success: true,
              message: `Deployment triggered for ${input.environment}`,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '触发部署失败',
            })
          }
        }),
    })
  }
}
