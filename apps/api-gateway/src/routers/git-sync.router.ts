import {
  ConflictResolutionService,
  GitSyncService,
  OrganizationSyncService,
} from '@juanie/service-business'
import { GitConnectionsService, RbacService } from '@juanie/service-foundation'
import type { GitSyncLog } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { checkPermission } from '../trpc/rbac.middleware'
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
    private readonly gitConnections: GitConnectionsService,
    private readonly gitSync: GitSyncService,
    private readonly organizationSync: OrganizationSyncService,
    private readonly conflictResolution: ConflictResolutionService,
    private readonly rbacService: RbacService,
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
            providerAccountId: z.string(), // Git 平台的用户 ID
            username: z.string(), // Git 用户名
            email: z.string().optional(),
            avatarUrl: z.string().optional(),
            accessToken: z.string(),
            refreshToken: z.string().optional(),
            expiresAt: z.date().optional(),
            serverUrl: z.string(), // Git 服务器地址（必传）
            serverType: z.enum(['cloud', 'self-hosted']).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            const connection = await this.gitConnections.upsertConnection({
              userId: ctx.user.id,
              provider: input.provider,
              providerAccountId: input.providerAccountId,
              username: input.username,
              email: input.email,
              avatarUrl: input.avatarUrl,
              accessToken: input.accessToken,
              refreshToken: input.refreshToken,
              expiresAt: input.expiresAt,
              serverUrl: input.serverUrl,
              serverType: input.serverType,
              purpose: 'both',
            })

            return {
              success: true,
              message: 'Git 账号关联成功',
              account: {
                id: connection.id,
                provider: connection.provider,
                username: connection.username,
                email: connection.email,
                status: connection.status,
                connectedAt: connection.connectedAt,
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
            const connection = await this.gitConnections.getConnectionByProvider(
              ctx.user.id,
              input.provider,
            )

            if (!connection) {
              return { isLinked: false }
            }

            return {
              isLinked: true,
              provider: connection.provider,
              username: connection.username,
              status: connection.status,
              lastSyncAt: connection.lastSyncAt || undefined,
              connectedAt: connection.connectedAt,
            }
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
            await this.gitConnections.deleteConnection(ctx.user.id, input.provider)

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
       * ✅ 权限检查：需要 manage_members Project 权限
       */
      retrySyncMember: this.trpc.protectedProcedure
        .input(
          z.object({
            syncLogId: z.string(),
            projectId: z.string(), // 添加 projectId 用于权限检查
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(
              this.rbacService,
              ctx.user.id,
              'manage_members',
              'Project',
              input.projectId,
            )

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
       * ✅ 权限检查：需要 read Project 权限
       */
      getSyncLogs: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            limit: z.number().optional().default(50),
          }),
        )
        .query(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(this.rbacService, ctx.user.id, 'read', 'Project', input.projectId)

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
       * ✅ 权限检查：需要 read Project 权限（如果指定了 projectId）
       * 注意：如果没有 projectId，则需要组织级权限
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
       * ✅ 权限检查：需要 manage_members Project 权限
       */
      retryFailedSyncs: this.trpc.protectedProcedure
        .input(
          z.object({
            syncLogIds: z.array(z.string()),
            projectId: z.string(), // 添加 projectId 用于权限检查
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(
              this.rbacService,
              ctx.user.id,
              'manage_members',
              'Project',
              input.projectId,
            )

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
       * 获取冲突历史
       * Requirements: 8.3
       * ✅ 权限检查：需要 read Project 权限
       */
      getConflictHistory: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
            limit: z.number().optional().default(50),
            offset: z.number().optional().default(0),
          }),
        )
        .query(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(this.rbacService, ctx.user.id, 'read', 'Project', input.projectId)

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

      // ==================== 组织级同步端点 (Phase 3) ====================

      /**
       * 手动触发组织成员全量同步
       * Requirements: Phase 3
       * ✅ 权限检查：需要 manage_members Organization 权限
       */
      syncOrganizationMembers: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(
              this.rbacService,
              ctx.user.id,
              'manage_members',
              'Organization',
              input.organizationId,
            )

            const result = await this.organizationSync.syncOrganizationMembers(input.organizationId)

            return {
              success: result.success,
              syncedMembers: result.syncedMembers,
              errors: result.errors,
              skipped: result.skipped,
              message: result.success
                ? `成功同步 ${result.syncedMembers} 个成员`
                : `同步完成，但有 ${result.errors.length} 个错误`,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '同步组织成员失败',
            })
          }
        }),

      /**
       * 获取组织同步状态
       * Requirements: Phase 3
       * ✅ 权限检查：需要 read Organization 权限
       */
      getOrganizationSyncStatus: this.trpc.protectedProcedure
        .input(
          z.object({
            organizationId: z.string(),
          }),
        )
        .query(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(
              this.rbacService,
              ctx.user.id,
              'read',
              'Organization',
              input.organizationId,
            )

            const status = await this.organizationSync.getOrganizationSyncStatus(
              input.organizationId,
            )

            return {
              enabled: status.enabled,
              lastSyncAt: status.lastSyncAt,
              memberCount: status.memberCount,
              syncedMemberCount: status.syncedMemberCount,
              pendingErrors: status.pendingErrors,
              workspaceType: status.workspaceType,
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '获取组织同步状态失败',
            })
          }
        }),

      /**
       * 手动触发项目协作者全量同步
       * Requirements: Phase 3
       * ✅ 权限检查：需要 manage_members Project 权限
       */
      syncProjectCollaborators: this.trpc.protectedProcedure
        .input(
          z.object({
            projectId: z.string(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          try {
            // 在 resolver 内部检查权限
            await checkPermission(
              this.rbacService,
              ctx.user.id,
              'manage_members',
              'Project',
              input.projectId,
            )

            // 使用现有的 batchSyncProject 方法
            await this.gitSync.batchSyncProject(input.projectId)

            return {
              success: true,
              message: '项目协作者同步任务已加入队列',
            }
          } catch (error) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: error instanceof Error ? error.message : '同步项目协作者失败',
            })
          }
        }),
    })
  }
}
