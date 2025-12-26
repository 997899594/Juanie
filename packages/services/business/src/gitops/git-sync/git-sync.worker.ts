import {
  GitConnectionsService,
  GitProviderService,
  GitSyncLogsService,
} from '@juanie/service-foundation'
import type { GitProvider, ProjectRole } from '@juanie/types'
import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import type { Job } from 'bullmq'
import { PinoLogger } from 'nestjs-pino'
import { ProjectsService } from '../../projects/core'
import type { GitSyncBatchJob, GitSyncMemberJob, GitSyncRemoveMemberJob } from './git-sync.service'
import { GitSyncOperationError, getRetryDelay, shouldRetryGitError } from './git-sync-errors'
import { OrganizationSyncService } from './organization-sync.service'
import { mapPermissionForProvider, mapProjectRoleToGitPermission } from './permission-mapper'

/**
 * Git 同步 Worker（重构版 - 使用 @nestjs/bullmq）
 *
 * 处理队列中的同步任务
 *
 * 架构说明:
 * - ✅ 项目级同步: 直接在 Worker 中处理 (handleSyncMember, handleRemoveMember, handleBatchSync)
 * - ✅ 组织级同步: 委托给 OrganizationSyncService 处理
 * - ✅ 所有数据库访问通过 Service 层 (ProjectsService, GitConnectionsService, GitSyncLogsService)
 * - ✅ 使用 @nestjs/bullmq 的 @Processor 和 @OnWorkerEvent 装饰器
 */
@Processor('git-sync', {
  concurrency: 5,
})
@Injectable()
export class GitSyncWorker extends WorkerHost {
  constructor(
    private readonly projects: ProjectsService,
    private readonly gitProvider: GitProviderService,
    private readonly gitConnections: GitConnectionsService,
    private readonly gitSyncLogs: GitSyncLogsService,
    private readonly organizationSync: OrganizationSyncService,
    private readonly logger: PinoLogger,
  ) {
    super()
    this.logger.setContext(GitSyncWorker.name)
  }

  /**
   * 处理队列任务
   *
   * 使用 BullMQ 的 process() 方法，由 @Processor 装饰器自动调用
   */
  async process(job: Job): Promise<void> {
    this.logger.info(`Processing job: ${job.name} (${job.id})`)

    try {
      switch (job.name) {
        // 项目级同步任务
        case 'sync-member':
          await this.handleSyncMember(job)
          break
        case 'remove-member':
          await this.handleRemoveMember(job)
          break
        case 'batch-sync':
          await this.handleBatchSync(job)
          break

        // 组织级同步任务
        case 'sync-org-member-add':
          await this.handleSyncOrgMemberAdd(job)
          break
        case 'sync-org-member-remove':
          await this.handleSyncOrgMemberRemove(job)
          break
        case 'sync-org-member-role-update':
          await this.handleSyncOrgMemberRoleUpdate(job)
          break

        default:
          this.logger.warn(`Unknown job type: ${job.name}`)
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error)
      throw error
    }
  }

  /**
   * 作业完成事件处理
   */
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.info(`Job ${job.id} completed`)
  }

  /**
   * 作业失败事件处理
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    if (!job) {
      this.logger.error({ error }, 'Job failed without job context')
      return
    }
    this.logger.error(`Job ${job.id} failed:`, error)
  }

  /**
   * Worker 激活事件处理
   */
  @OnWorkerEvent('active')
  onActive(job: Job) {
    this.logger.info(`Job ${job.id} started`)
  }

  /**
   * 处理成员同步任务
   */
  private async handleSyncMember(job: Job<GitSyncMemberJob & { syncLogId: string }>) {
    const { projectId, userId, role, syncLogId } = job.data

    this.logger.info(`Syncing member: project=${projectId}, user=${userId}, role=${role}`)

    let provider: GitProvider = 'github' // Default, will be set from connection

    try {
      // 更新同步日志状态
      await this.updateSyncLogAttempt(syncLogId)

      // ✅ 使用 ProjectsService 获取项目信息
      const project = await this.projects.findById(projectId)
      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // ✅ 使用 GitConnectionsService 获取项目的 Git 认证信息
      const projectAuth = await this.gitConnections.getProjectAuth(projectId)
      if (!projectAuth) {
        throw new Error(`Project ${projectId} has no Git authentication configured`)
      }

      // ✅ 使用 GitConnectionsService 获取 provider
      const connection = await this.gitConnections.getConnectionById(projectAuth.oauthAccountId!)
      if (!connection) {
        throw new Error(`Git connection ${projectAuth.oauthAccountId} not found`)
      }
      provider = connection.provider as GitProvider

      // ✅ 使用 GitConnectionsService 获取用户的 Git 连接信息
      const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
        userId,
        provider,
      )
      if (!gitConnection) {
        throw new Error(`User ${userId} has not linked their ${provider} account`)
      }

      // 检查 token 是否过期
      if (gitConnection.status !== 'active') {
        throw new Error(`User ${userId}'s ${provider} account is ${gitConnection.status}`)
      }

      // 映射权限
      const gitPermission = mapProjectRoleToGitPermission(role)
      const platformPermission = mapPermissionForProvider(provider, gitPermission)

      // 获取访问 token（使用 GitConnectionsService）
      const { token: accessToken } = await this.gitConnections.getProjectAccessToken(projectId)

      // ✅ 使用 ProjectsService 获取项目的仓库信息
      const repository = await this.projects.getProjectRepository(projectId)
      if (!repository) {
        throw new Error(`No repository found for project ${projectId}`)
      }

      const repoFullName = repository.fullName

      // 调用 Git Provider API 添加协作者
      await this.gitProvider.addCollaborator(
        provider as 'github' | 'gitlab',
        accessToken,
        repoFullName,
        gitConnection.username,
        platformPermission as string,
      )

      // ✅ 使用 GitSyncLogsService 更新同步日志为成功
      await this.gitSyncLogs.updateStatus(syncLogId, {
        status: 'success',
        completedAt: new Date(),
        metadata: {
          attemptCount: (job.attemptsMade || 0) + 1,
          gitApiResponse: {
            username: gitConnection.username,
            permission: platformPermission,
          },
        },
      })

      this.logger.info(`Member sync completed: ${syncLogId}`)
    } catch (error) {
      // ✅ 使用新的错误处理工具
      const attemptCount = (job.attemptsMade || 0) + 1
      const shouldRetry = shouldRetryGitError(error as Error, attemptCount)
      const retryDelay = shouldRetry ? getRetryDelay(error as Error) : 0

      // ✅ 包装错误以添加业务上下文
      const syncError = new GitSyncOperationError('add collaborator', provider, error as Error)

      // ✅ 使用 GitSyncLogsService 更新同步日志为失败
      await this.gitSyncLogs.updateStatus(syncLogId, {
        status: 'failed',
        error: syncError.message,
        completedAt: new Date(),
        metadata: {
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
          shouldRetry,
          retryDelay,
          originalError: (error as Error).message,
        },
      })

      this.logger.error(
        {
          syncLogId,
          attemptCount,
          shouldRetry,
          retryDelay,
          error: syncError,
        },
        'Member sync failed',
      )

      throw syncError
    }
  }

  /**
   * 处理成员移除任务
   */
  private async handleRemoveMember(job: Job<GitSyncRemoveMemberJob & { syncLogId: string }>) {
    const { projectId, userId, syncLogId } = job.data

    this.logger.info(`Removing member access: project=${projectId}, user=${userId}`)

    let provider: GitProvider = 'github' // Default, will be set from connection

    try {
      // 更新同步日志状态
      await this.updateSyncLogAttempt(syncLogId)

      // ✅ 使用 ProjectsService 获取项目信息
      const project = await this.projects.findById(projectId)
      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // ✅ 使用 GitConnectionsService 获取项目的 Git 认证信息
      const projectAuth = await this.gitConnections.getProjectAuth(projectId)
      if (!projectAuth) {
        throw new Error(`Project ${projectId} has no Git authentication configured`)
      }

      // ✅ 使用 GitConnectionsService 获取 provider
      const connection = await this.gitConnections.getConnectionById(projectAuth.oauthAccountId!)
      if (!connection) {
        throw new Error(`Git connection ${projectAuth.oauthAccountId} not found`)
      }
      provider = connection.provider as GitProvider

      // ✅ 使用 GitConnectionsService 获取用户的 Git 连接信息
      const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
        userId,
        provider,
      )
      if (!gitConnection) {
        // 用户没有关联 Git 账号，无需移除
        this.logger.warn(`User ${userId} has no ${provider} account, skipping removal`)
        await this.gitSyncLogs.updateStatus(syncLogId, {
          status: 'success',
          completedAt: new Date(),
          metadata: {
            note: 'User has no Git account linked',
          },
        })
        return
      }

      // 获取访问 token
      const { token: accessToken } = await this.gitConnections.getProjectAccessToken(projectId)

      // ✅ 使用 ProjectsService 获取项目的仓库信息
      const repository = await this.projects.getProjectRepository(projectId)
      if (!repository) {
        throw new Error(`No repository found for project ${projectId}`)
      }

      const repoFullName = repository.fullName

      // 调用 Git Provider API 移除协作者
      await this.gitProvider.removeCollaborator(
        provider as 'github' | 'gitlab',
        accessToken,
        repoFullName,
        gitConnection.username,
      )

      // ✅ 使用 GitSyncLogsService 更新同步日志为成功
      await this.gitSyncLogs.updateStatus(syncLogId, {
        status: 'success',
        completedAt: new Date(),
        metadata: {
          attemptCount: (job.attemptsMade || 0) + 1,
          gitApiResponse: {
            username: gitConnection.username,
            action: 'removed',
          },
        },
      })

      this.logger.info(`Member removal completed: ${syncLogId}`)
    } catch (error) {
      // ✅ 使用新的错误处理工具
      const attemptCount = (job.attemptsMade || 0) + 1
      const shouldRetry = shouldRetryGitError(error as Error, attemptCount)
      const retryDelay = shouldRetry ? getRetryDelay(error as Error) : 0

      // ✅ 包装错误以添加业务上下文
      const syncError = new GitSyncOperationError('remove collaborator', provider, error as Error)

      // ✅ 使用 GitSyncLogsService 更新同步日志为失败
      await this.gitSyncLogs.updateStatus(syncLogId, {
        status: 'failed',
        error: syncError.message,
        completedAt: new Date(),
        metadata: {
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
          shouldRetry,
          retryDelay,
          originalError: (error as Error).message,
        },
      })

      this.logger.error(
        {
          syncLogId,
          attemptCount,
          shouldRetry,
          retryDelay,
          error: syncError,
        },
        'Member removal failed',
      )

      throw syncError
    }
  }

  /**
   * 处理批量同步任务
   */
  private async handleBatchSync(job: Job<GitSyncBatchJob & { syncLogId: string }>) {
    const { projectId, syncLogId } = job.data

    this.logger.info(`Batch syncing project: ${projectId}`)

    try {
      // 更新同步日志状态
      await this.updateSyncLogAttempt(syncLogId)

      // ✅ 使用 ProjectsService 获取项目信息
      const project = await this.projects.findById(projectId)
      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // ✅ 使用 GitConnectionsService 获取项目的 Git 认证信息
      const projectAuth = await this.gitConnections.getProjectAuth(projectId)
      if (!projectAuth) {
        throw new Error(`Project ${projectId} has no Git authentication configured`)
      }

      // ✅ 使用 GitConnectionsService 获取 provider
      const connection = await this.gitConnections.getConnectionById(projectAuth.oauthAccountId!)
      if (!connection) {
        throw new Error(`Git connection ${projectAuth.oauthAccountId} not found`)
      }
      const provider = connection.provider as GitProvider

      // ✅ 使用 ProjectsService 获取项目所有成员
      const members = await this.projects.getProjectMembers(projectId)

      this.logger.info(`Found ${members.length} members to sync`)

      let successCount = 0
      let failCount = 0
      const errors: Array<{ userId: string; error: string }> = []

      // 获取访问 token
      const { token: accessToken } = await this.gitConnections.getProjectAccessToken(projectId)

      // ✅ 使用 ProjectsService 获取项目的仓库信息
      const repository = await this.projects.getProjectRepository(projectId)
      if (!repository) {
        throw new Error(`No repository found for project ${projectId}`)
      }

      const repoFullName = repository.fullName

      // 逐个同步成员
      for (const member of members) {
        try {
          // ✅ 使用 GitConnectionsService 获取用户的 Git 连接
          const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
            member.userId,
            provider,
          )

          if (!gitConnection) {
            this.logger.warn(`User ${member.userId} has no Git account, skipping`)
            failCount++
            errors.push({
              userId: member.userId,
              error: 'No Git account linked',
            })
            continue
          }

          // 映射权限
          const gitPermission = mapProjectRoleToGitPermission(member.role as ProjectRole)
          const platformPermission = mapPermissionForProvider(provider, gitPermission)

          // 添加协作者
          await this.gitProvider.addCollaborator(
            provider as 'github' | 'gitlab',
            accessToken,
            repoFullName,
            gitConnection.username,
            platformPermission as string,
          )

          successCount++
          this.logger.info(`Synced member ${member.userId}`)
        } catch (error) {
          failCount++

          // ✅ 使用新的错误处理工具
          const syncError = new GitSyncOperationError('batch sync member', provider, error as Error)

          errors.push({
            userId: member.userId,
            error: syncError.message,
          })
          this.logger.error(`Failed to sync member ${member.userId}:`, syncError)
        }
      }

      // ✅ 使用 GitSyncLogsService 更新同步日志
      await this.gitSyncLogs.updateStatus(syncLogId, {
        status: failCount === 0 ? 'success' : 'failed',
        completedAt: new Date(),
        metadata: {
          attemptCount: (job.attemptsMade || 0) + 1,
          batchResult: {
            total: members.length,
            success: successCount,
            failed: failCount,
            errors,
          },
        },
      })

      this.logger.info(`Batch sync completed: ${successCount} success, ${failCount} failed`)

      if (failCount > 0) {
        throw new Error(`Batch sync partially failed: ${failCount} members failed`)
      }
    } catch (error) {
      // ✅ 使用新的错误处理工具
      const attemptCount = (job.attemptsMade || 0) + 1
      const shouldRetry = shouldRetryGitError(error as Error, attemptCount)
      const retryDelay = shouldRetry ? getRetryDelay(error as Error) : 0

      // ✅ 包装错误以添加业务上下文
      const syncError =
        error instanceof GitSyncOperationError
          ? error
          : new GitSyncOperationError('batch sync', 'github' as GitProvider, error as Error)

      // ✅ 使用 GitSyncLogsService 更新同步日志为失败
      await this.gitSyncLogs.updateStatus(syncLogId, {
        status: 'failed',
        error: syncError.message,
        completedAt: new Date(),
        metadata: {
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
          shouldRetry,
          retryDelay,
          originalError: (error as Error).message,
        },
      })

      this.logger.error(
        {
          syncLogId,
          attemptCount,
          shouldRetry,
          retryDelay,
          error: syncError,
        },
        'Batch sync failed',
      )

      throw syncError
    }
  }

  /**
   * 更新同步日志的尝试次数
   */
  private async updateSyncLogAttempt(syncLogId: string) {
    // ✅ 使用 GitSyncLogsService 获取日志
    const log = await this.gitSyncLogs.findById(syncLogId)

    if (log) {
      const attemptCount = ((log.metadata as any)?.attemptCount || 0) + 1
      await this.gitSyncLogs.updateStatus(syncLogId, {
        metadata: {
          ...((log.metadata as any) || {}),
          attemptCount,
          lastAttemptAt: new Date().toISOString(),
        },
      })
    }
  }

  /**
   * 处理组织成员添加任务
   * Requirements: 2.2, 4.1
   *
   * 架构说明:
   * - ✅ 委托给 OrganizationSyncService 处理
   * - ✅ Worker 只负责任务调度,不处理业务逻辑
   */
  private async handleSyncOrgMemberAdd(
    job: Job<{
      organizationId: string
      userId: string
      role: 'owner' | 'admin' | 'member'
      triggeredBy: string // 用于审计日志
    }>,
  ) {
    const { organizationId, userId, role, triggeredBy } = job.data

    this.logger.info(
      `Syncing organization member add: org=${organizationId}, user=${userId}, role=${role}`,
    )

    try {
      // ✅ 委托给 OrganizationSyncService
      await this.organizationSync.addMemberToGitOrganization(
        organizationId,
        userId,
        role,
        triggeredBy,
      )

      this.logger.info(`Organization member add sync completed for user ${userId}`)
    } catch (error) {
      this.logger.error(`Organization member add sync failed:`, error)
      throw error
    }
  }

  /**
   * 处理组织成员移除任务
   * Requirements: 4.1
   *
   * 架构说明:
   * - ✅ 委托给 OrganizationSyncService 处理
   */
  private async handleSyncOrgMemberRemove(
    job: Job<{
      organizationId: string
      userId: string
      triggeredBy: string // 用于审计日志
    }>,
  ) {
    const { organizationId, userId, triggeredBy } = job.data

    this.logger.info(`Syncing organization member remove: org=${organizationId}, user=${userId}`)

    try {
      // ✅ 委托给 OrganizationSyncService
      await this.organizationSync.removeMemberFromGitOrganization(
        organizationId,
        userId,
        triggeredBy,
      )

      this.logger.info(`Organization member remove sync completed for user ${userId}`)
    } catch (error) {
      this.logger.error(`Organization member remove sync failed:`, error)
      throw error
    }
  }

  /**
   * 处理组织成员角色更新任务
   * Requirements: 4.1
   *
   * 架构说明:
   * - ✅ 委托给 OrganizationSyncService 处理
   */
  private async handleSyncOrgMemberRoleUpdate(
    job: Job<{
      organizationId: string
      userId: string
      oldRole: 'owner' | 'admin' | 'member'
      newRole: 'owner' | 'admin' | 'member'
      triggeredBy: string // 用于审计日志
    }>,
  ) {
    const { organizationId, userId, newRole, triggeredBy } = job.data

    this.logger.info(
      `Syncing organization member role update: org=${organizationId}, user=${userId}, new role=${newRole}`,
    )

    try {
      // ✅ 委托给 OrganizationSyncService
      await this.organizationSync.updateMemberRoleInGitOrganization(
        organizationId,
        userId,
        newRole,
        triggeredBy,
      )

      this.logger.info(`Organization member role update sync completed for user ${userId}`)
    } catch (error) {
      this.logger.error(`Organization member role update sync failed:`, error)
      throw error
    }
  }
}
