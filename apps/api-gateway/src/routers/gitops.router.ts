import {
  commitConfigChangesSchema,
  createGitOpsResourceSchema,
  deleteGitOpsResourceSchema,
  deployWithGitOpsSchema,
  gitOpsResourceIdSchema,
  installFluxSchema,
  listGitOpsResourcesSchema,
  previewChangesSchema,
  triggerSyncSchema,
  updateGitOpsResourceSchema,
  validateYAMLSchema,
} from '@juanie/core-types'
import { DeploymentsService } from '@juanie/service-deployments'
import { FluxService } from '@juanie/service-flux'
import { GitOpsService } from '@juanie/service-git-ops'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class GitOpsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly fluxService: FluxService,
    private readonly gitOpsService: GitOpsService,
    private readonly deploymentsService: DeploymentsService,
  ) {}

  get router() {
    return this.trpc.router({
      // ============================================
      // Flux 管理 API
      // ============================================

      /**
       * 安装 Flux v2 到 K3s 集群
       * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
       */
      installFlux: this.trpc.protectedProcedure
        .input(installFluxSchema)
        .mutation(async ({ input }) => {
          try {
            return await this.fluxService.installFlux(input)
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '安装 Flux 失败',
            })
          }
        }),

      /**
       * 检查 Flux 组件健康状态
       * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
       */
      checkFluxHealth: this.trpc.protectedProcedure.query(async () => {
        try {
          return await this.fluxService.checkFluxHealth()
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : '检查 Flux 健康状态失败',
          })
        }
      }),

      /**
       * 卸载 Flux
       * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
       */
      uninstallFlux: this.trpc.protectedProcedure.mutation(async () => {
        try {
          await this.fluxService.uninstallFlux()
          return { success: true }
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error instanceof Error ? error.message : '卸载 Flux 失败',
          })
        }
      }),

      // ============================================
      // GitOps 资源管理 API
      // ============================================

      /**
       * 创建 GitOps 资源（Kustomization 或 HelmRelease）
       * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
       */
      createGitOpsResource: this.trpc.protectedProcedure
        .input(createGitOpsResourceSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            // TODO: Check user permissions for the project
            return await this.fluxService.createGitOpsResource(input)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '创建 GitOps 资源失败',
            })
          }
        }),

      /**
       * 列出项目的所有 GitOps 资源
       * Requirements: 3.1, 3.2, 3.3, 3.5
       */
      listGitOpsResources: this.trpc.protectedProcedure
        .input(listGitOpsResourcesSchema)
        .query(async ({ ctx, input }) => {
          try {
            // TODO: Check user permissions for the project
            return await this.fluxService.listGitOpsResources(input.projectId)
          } catch (error) {
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取 GitOps 资源列表失败',
            })
          }
        }),

      /**
       * 获取单个 GitOps 资源详情
       * Requirements: 3.1, 3.2, 3.3, 3.5
       */
      getGitOpsResource: this.trpc.protectedProcedure
        .input(gitOpsResourceIdSchema)
        .query(async ({ ctx, input }) => {
          try {
            const resource = await this.fluxService.getGitOpsResource(input.resourceId)

            if (!resource) {
              throw new TRPCError({
                code: 'NOT_FOUND',
                message: 'GitOps 资源不存在',
              })
            }

            // TODO: Check user permissions for the resource's project

            return resource
          } catch (error) {
            if (error instanceof TRPCError) {
              throw error
            }
            throw new TRPCError({
              code: 'FORBIDDEN',
              message: error instanceof Error ? error.message : '获取 GitOps 资源详情失败',
            })
          }
        }),

      /**
       * 更新 GitOps 资源
       * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
       */
      updateGitOpsResource: this.trpc.protectedProcedure
        .input(updateGitOpsResourceSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { resourceId, ...data } = input

            // TODO: Check user permissions for the resource's project

            return await this.fluxService.updateGitOpsResource(resourceId, data)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '更新 GitOps 资源失败',
            })
          }
        }),

      /**
       * 删除 GitOps 资源（软删除）
       * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
       */
      deleteGitOpsResource: this.trpc.protectedProcedure
        .input(deleteGitOpsResourceSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            // TODO: Check user permissions for the resource's project

            await this.fluxService.deleteGitOpsResource(input.resourceId)
            return { success: true }
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '删除 GitOps 资源失败',
            })
          }
        }),

      /**
       * 手动触发 Flux 同步
       * Requirements: 10.1, 10.2, 10.3
       */
      triggerSync: this.trpc.protectedProcedure
        .input(triggerSyncSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            await this.fluxService.triggerReconciliation(input.kind, input.name, input.namespace)
            return { success: true, message: '同步已触发' }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '触发同步失败',
            })
          }
        }),

      // ============================================
      // 双向部署 API（核心功能）
      // ============================================

      /**
       * 通过 GitOps 部署（UI → Git → Flux → K8s）
       * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
       */
      deployWithGitOps: this.trpc.protectedProcedure
        .input(deployWithGitOpsSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, environmentId, changes, commitMessage } = input

            // TODO: Check user permissions for deployment

            // 1. Commit changes to Git
            const commitSha = await this.gitOpsService.commitFromUI({
              projectId,
              environmentId,
              changes,
              userId: ctx.user.id,
              commitMessage,
            })

            // 2. Create deployment record
            const deployment = await this.deploymentsService.create(ctx.user.id, {
              projectId,
              environmentId,
              version: changes.image || 'unknown',
              commitHash: commitSha,
              branch: 'main', // TODO: Get from environment config
              strategy: 'rolling',
            })

            return {
              deployment,
              commitSha,
              message: '部署已提交到 Git，Flux 将自动同步',
            }
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : 'GitOps 部署失败',
            })
          }
        }),

      /**
       * 提交配置变更到 Git
       * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
       */
      commitConfigChanges: this.trpc.protectedProcedure
        .input(commitConfigChangesSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            const { projectId, environmentId, changes, commitMessage } = input

            // TODO: Check user permissions

            const commitSha = await this.gitOpsService.commitFromUI({
              projectId,
              environmentId,
              changes,
              userId: ctx.user.id,
              commitMessage,
            })

            return {
              commitSha,
              message: '配置变更已提交到 Git',
            }
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '提交配置变更失败',
            })
          }
        }),

      /**
       * 预览配置变更（不提交）
       * Requirements: 4.1, 4.2, 4.3
       */
      previewChanges: this.trpc.protectedProcedure
        .input(previewChangesSchema)
        .query(async ({ ctx, input }) => {
          try {
            const { projectId, environmentId, changes } = input

            // TODO: Check user permissions

            return await this.gitOpsService.previewChanges({
              projectId,
              environmentId,
              changes,
            })
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '预览变更失败',
            })
          }
        }),

      /**
       * 验证 YAML 语法
       * Requirements: 15.1, 15.2, 15.3
       */
      validateYAML: this.trpc.protectedProcedure
        .input(validateYAMLSchema)
        .query(async ({ input }) => {
          try {
            return this.gitOpsService.validateYAML(input.content)
          } catch (error) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: error instanceof Error ? error.message : '验证 YAML 失败',
            })
          }
        }),
    })
  }
}
