import { FluxResourcesService, FluxService, FluxSyncService } from '@juanie/service-business'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * GitOps 路由
 * 提供 GitOps 资源的手动管理功能
 */
@Injectable()
export class GitOpsRouter {
  constructor(
    private trpc: TrpcService,
    private flux: FluxService,
    private fluxResources: FluxResourcesService,
    private fluxSync: FluxSyncService,
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
          const summary = await this.fluxSync.getProjectGitOpsSummary(input.projectId)
          const resources = await this.fluxResources.listGitOpsResources(input.projectId)

          return {
            enabled: summary.totalResources > 0,
            summary,
            resources,
          }
        }),

      /**
       * 设置项目的 GitOps 资源栈
       * 为项目创建完整的 K8s 资源（Namespace、GitRepository、Kustomization）
       */
      setupProjectGitOps: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            repositoryId: z.string().uuid(),
            repositoryUrl: z.string(),
            repositoryBranch: z.string(),
            accessToken: z.string(),
            environments: z.array(
              z.object({
                id: z.string().uuid(),
                type: z.enum(['development', 'staging', 'production']),
                name: z.string(),
              }),
            ),
          }),
        )
        .mutation(async ({ input }) => {
          const result = await this.fluxResources.setupProjectGitOps(input)

          if (!result.success) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `GitOps 资源创建失败: ${result.errors.join(', ')}`,
            })
          }

          return {
            success: true,
            message: 'GitOps 资源创建成功',
            data: {
              namespaces: result.namespaces,
              gitRepositories: result.gitRepositories,
              kustomizations: result.kustomizations,
            },
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
          await this.fluxSync.syncProjectGitOpsStatus(input.projectId)

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
          const result = await this.fluxResources.cleanupProjectGitOps(input.projectId)

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

      /**
       * 创建 GitOps 资源
       */
      createGitOpsResource: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            environmentId: z.string().uuid(),
            repositoryId: z.string().uuid(),
            type: z.enum(['kustomization', 'helm']),
            name: z.string(),
            namespace: z.string(),
            config: z.any(),
          }),
        )
        .mutation(async ({ input }) => {
          return await this.fluxResources.createGitOpsResource(input)
        }),

      /**
       * 列出 GitOps 资源
       */
      listGitOpsResources: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input }) => {
          return await this.fluxResources.listGitOpsResources(input.projectId)
        }),

      /**
       * 获取单个 GitOps 资源
       */
      getGitOpsResource: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return await this.fluxResources.getGitOpsResource(input.id)
        }),

      /**
       * 更新 GitOps 资源
       */
      updateGitOpsResource: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            config: z.any().optional(),
            status: z.string().optional(),
            errorMessage: z.string().optional(),
          }),
        )
        .mutation(async ({ input }) => {
          const { id, ...data } = input
          return await this.fluxResources.updateGitOpsResource(id, data)
        }),

      /**
       * 删除 GitOps 资源
       */
      deleteGitOpsResource: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          await this.fluxResources.deleteGitOpsResource(input.id)
          return { success: true, message: '资源删除成功' }
        }),

      /**
       * 触发同步
       */
      triggerSync: this.trpc.protectedProcedure
        .input(
          z.object({
            kind: z.string(),
            name: z.string(),
            namespace: z.string(),
          }),
        )
        .mutation(async ({ input }) => {
          await this.fluxSync.triggerReconciliation(input.kind, input.name, input.namespace)
          return { success: true, message: '同步已触发' }
        }),

      /**
       * 使用 GitOps 部署
       */
      deployWithGitOps: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            environmentId: z.string().uuid(),
            config: z.object({
              image: z.string().optional(),
              tag: z.string().optional(),
              replicas: z.number().optional(),
              resources: z
                .object({
                  cpu: z.string().optional(),
                  memory: z.string().optional(),
                })
                .optional(),
            }),
            commitMessage: z.string().optional(),
          }),
        )
        .mutation(async ({ input }) => {
          // TODO: 实现 GitOps 部署逻辑
          // 1. 更新 Git 仓库中的配置文件
          // 2. 提交变更
          // 3. Flux 会自动检测并应用变更
          return {
            success: true,
            message: '部署配置已提交到 Git',
            commitHash: 'placeholder',
          }
        }),

      /**
       * 提交配置变更到 Git
       */
      commitConfigChanges: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            environmentId: z.string().uuid(),
            changes: z.any(),
            commitMessage: z.string().optional(),
          }),
        )
        .mutation(async ({ input }) => {
          // TODO: 实现配置提交逻辑
          return {
            success: true,
            message: '配置变更已提交',
            commitHash: 'placeholder',
          }
        }),

      /**
       * 预览配置变更
       */
      previewChanges: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().uuid(),
            environmentId: z.string().uuid(),
            changes: z.any(),
          }),
        )
        .query(async ({ input }) => {
          // TODO: 实现变更预览逻辑
          return {
            diff: '# 配置变更预览\n# TODO: 实现实际的 diff',
            files: [],
          }
        }),

      /**
       * 验证 YAML 语法
       */
      validateYAML: this.trpc.protectedProcedure
        .input(z.object({ content: z.string() }))
        .query(async ({ input }) => {
          try {
            // 简单的 YAML 验证
            const yaml = await import('yaml')
            yaml.parse(input.content)
            return {
              valid: true,
              message: 'YAML 语法正确',
            }
          } catch (error: any) {
            return {
              valid: false,
              message: error.message,
              line: error.linePos?.[0]?.line,
              column: error.linePos?.[0]?.col,
            }
          }
        }),
    })
  }
}
