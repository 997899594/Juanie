import { FluxCliService } from '@juanie/core/flux'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
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
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private fluxCli: FluxCliService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 列出 GitOps 资源
       */
      listGitOpsResources: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string().uuid() }))
        .query(async ({ input }) => {
          return await this.db.query.gitopsResources.findMany({
            where: eq(schema.gitopsResources.projectId, input.projectId),
            with: {
              environment: true,
              repository: true,
            },
          })
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
          const [resource] = await this.db
            .insert(schema.gitopsResources)
            .values({
              projectId: input.projectId,
              environmentId: input.environmentId,
              repositoryId: input.repositoryId,
              type: input.type,
              name: input.name,
              namespace: input.namespace,
              config: input.config,
              status: 'pending',
            })
            .returning()

          return resource
        }),

      /**
       * 更新 GitOps 资源
       */
      updateGitOpsResource: this.trpc.protectedProcedure
        .input(
          z.object({
            id: z.string().uuid(),
            config: z.any().optional(),
            status: z.enum(['pending', 'ready', 'reconciling', 'failed']).optional(),
            errorMessage: z.string().optional(),
          }),
        )
        .mutation(async ({ input }) => {
          const { id, ...data } = input
          const [resource] = await this.db
            .update(schema.gitopsResources)
            .set({
              ...data,
              updatedAt: new Date(),
            })
            .where(eq(schema.gitopsResources.id, id))
            .returning()

          return resource
        }),

      /**
       * 删除 GitOps 资源
       */
      deleteGitOpsResource: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          await this.db
            .update(schema.gitopsResources)
            .set({ deletedAt: new Date() })
            .where(eq(schema.gitopsResources.id, input.id))

          return { success: true, message: '资源删除成功' }
        }),

      /**
       * 触发同步 - 直接使用 Core 层 FluxCliService
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
          await this.triggerSyncInternal(input)
          return { success: true, message: '同步已触发' }
        }),
    })
  }

  /**
   * 内部方法：触发同步（带追踪）
   */
  @Trace()
  private async triggerSyncInternal(input: { kind: string; name: string; namespace: string }) {
    await this.fluxCli.reconcile(input.kind, input.name, input.namespace)
  }
}
