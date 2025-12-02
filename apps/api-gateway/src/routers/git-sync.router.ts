import { ConflictResolutionService, GitSyncService } from '@juanie/service-business'
import { GitAccountLinkingService } from '@juanie/service-foundation'
import type { GitSyncLog } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

/**
 * Git 同步路由
 * 提供 Git 账号关联和同步管理功能
 * Requirements: 5.2, 5.5, 6.6, 8.3
 */
@Injectable()
export class GitSyncRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly gitAccountLinking: GitAccountLinkingService,
    private readonly gitSync: GitSyncService,
    private readonly conflictResolution: ConflictResolutionService,
  ) {}

  get router() {
    return this.trpc.router({
      /**
       * 关联 Git 账号
       * Requirements: 5.2
       *
       * 注意：实际的 OAuth 流程在 AuthRouter 中处理
       * 这个端点用于手动关联或更新 Git 账号信息
       */
      linkGitAccount: this.trpc.protectedProcedure
        .input(
          z.object({
            provider: z.enum(['github', 'gitlab']),
            gitUserId: z.string(),
            gitUsername: z.string(),
            gitEmail: z.string().optional(),
            gitAvatarUrl: z.string().optional(),
            accessToken: z.string(),
            refreshToken: z.string().optional(),
            tokenExpiresAt: z.date().optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const account = await this.gitAccountLinking.linkGitAccount({
              userId: ctx.user.id,
              ...input,
            })

            return {
              success: true,
              message: 'Git 账号关联成功',
              account: {
                id: account.id,
                provider: account.provider,
                gitUsername: account.gitUsername,
                gitEmail: account.gitEmail,
                syncStatus: account.syncStatus,
                connectedAt: account.connectedAt,
              },
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '关联 Git 账号失败',
            })
          }
        }),

      /**
       * 获取 Git 账号状态
       * Requirements: 5.5
       */
      getGitAccountStatus: this.trpc.protectedProcedure
        .input(
          z.object({
            provider: z.enum(['github', 'gitlab']),
          }),
        )
        .query(async ({ ctx, input }) => {
          try {
            const status = await this.gitAccountLinking.getGitAccountStatus(
              ctx.user.id,
              input.provider,
            )

            return status
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取 Git 账号状态失败',
            })
          }
        }),

      /**
       * 取消关联 Git 账号
       * Requirements: 5.5
       */
      unlinkGitAccount: this.trpc.protectedProcedure
        .input(
          z.object({
            provider: z.enum(['github', 'gitlab']),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            await this.gitAccountLinking.unlinkGitAccount(ctx.user.id, input.provider)

            return {
              success: true,
              message: 'Git 账号已取消关联',
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '取消关联 Git 账号失败',
            })
          }
        }),

      /**
       * 重试同步成员
       * Requirements: 6.6
       */
      retrySyncMember: this.trpc.protectedProcedure
        .input(
          z.object({
            syncLogId: z.string(),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            await this.gitSync.retrySyncTask(input.syncLogId)

            return {
              success: true,
              message: '同步任务已重新加入队列',
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '重试同步失败',
            })
          }
        }),

      /**
       * 获取项目的同步日志
       * Requirements: 6.4
       */
      getSyncLogs: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            limit: z.number().optional().default(50),
          }),
        )
        .query(async ({ input }) => {
          try {
            const logs = await this.gitSync.getSyncLogs(input.projectId, input.limit)

            return {
              logs: logs.map((log) => ({
                id: log.id,
                syncType: log.syncType as GitSyncLog['syncType'],
                action: log.action as GitSyncLog['action'],
                status: log.status as GitSyncLog['status'],
                error: log.error,
                createdAt: log.createdAt,
                completedAt: log.completedAt,
                metadata: log.metadata as GitSyncLog['metadata'],
              })),
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取同步日志失败',
            })
          }
        }),

      /**
       * 获取失败的同步任务
       * Requirements: 6.5
       */
      getFailedSyncs: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string().optional(),
          }),
        )
        .query(async ({ input }) => {
          try {
            const logs = await this.gitSync.getFailedSyncs(input.projectId)

            return {
              logs: logs.map((log) => ({
                id: log.id,
                syncType: log.syncType as GitSyncLog['syncType'],
                action: log.action as GitSyncLog['action'],
                projectId: log.projectId,
                userId: log.userId,
                status: log.status as GitSyncLog['status'],
                error: log.error,
                errorStack: log.errorStack,
                createdAt: log.createdAt,
                metadata: log.metadata as GitSyncLog['metadata'],
              })),
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取失败的同步任务失败',
            })
          }
        }),

      /**
       * 批量重试失败的同步任务
       * Requirements: 6.6
       */
      retryFailedSyncs: this.trpc.protectedProcedure
        .input(
          z.object({
            syncLogIds: z.array(z.string()),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            const results = await Promise.allSettled(
              input.syncLogIds.map((id) => this.gitSync.retrySyncTask(id)),
            )

            const succeeded = results.filter((r) => r.status === 'fulfilled').length
            const failed = results.filter((r) => r.status === 'rejected').length

            return {
              success: true,
              message: `已重试 ${succeeded} 个任务，${failed} 个失败`,
              succeeded,
              failed,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '批量重试失败',
            })
          }
        }),

      /**
       * 检测项目成员权限冲突
       * Requirements: 8.3
       */
      detectConflicts: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
          }),
        )
        .query(async ({ input }) => {
          try {
            const conflicts = await this.conflictResolution.detectProjectMemberConflicts(
              input.projectId,
            )

            return {
              conflicts: conflicts.map((c) => ({
                userId: c.userId,
                userName: c.userName,
                gitLogin: c.gitLogin,
                systemRole: c.systemRole,
                gitPermission: c.gitPermission,
                expectedGitPermission: c.expectedGitPermission,
                conflictType: c.conflictType,
              })),
              total: conflicts.length,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '检测冲突失败',
            })
          }
        }),

      /**
       * 解决项目成员权限冲突
       * Requirements: 8.3
       */
      resolveConflicts: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            autoResolve: z.boolean().optional().default(true),
            conflictTypes: z
              .array(z.enum(['permission_mismatch', 'missing_on_git', 'extra_on_git']))
              .optional()
              .default(['permission_mismatch', 'missing_on_git']),
          }),
        )
        .mutation(async ({ input }) => {
          try {
            const result = await this.conflictResolution.resolveProjectMemberConflicts(
              input.projectId,
              {
                autoResolve: input.autoResolve,
                conflictTypes: input.conflictTypes,
              },
            )

            return {
              success: true,
              message: `已解决 ${result.resolved} 个冲突，${result.failed} 个失败，${result.skipped} 个跳过`,
              ...result,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '解决冲突失败',
            })
          }
        }),

      /**
       * 获取冲突统计信息
       * Requirements: 8.3
       */
      getConflictStats: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
          }),
        )
        .query(async ({ input }) => {
          try {
            const stats = await this.conflictResolution.getConflictStats(input.projectId)

            return stats
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取冲突统计失败',
            })
          }
        }),

      /**
       * 获取冲突历史
       * Requirements: 8.3
       */
      getConflictHistory: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            limit: z.number().optional().default(50),
            offset: z.number().optional().default(0),
          }),
        )
        .query(async ({ input }) => {
          try {
            const history = await this.conflictResolution.getConflictHistory(input.projectId, {
              limit: input.limit,
              offset: input.offset,
            })

            return {
              history: history.map((h) => ({
                id: h.id,
                syncType: h.syncType,
                status: h.status,
                details: h.details,
                error: h.error,
                syncedAt: h.syncedAt,
              })),
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取冲突历史失败',
            })
          }
        }),
    })
  }
}
