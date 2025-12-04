/**
 * Git 同步队列 Worker
 *
 * 处理 Git 同步队列中的任务
 * Requirements: 4.2, 4.8, 7.2
 */

import * as schema from '@juanie/core/database'
import { GIT_SYNC_QUEUE } from '@juanie/core/queue'
import { DATABASE } from '@juanie/core/tokens'
import type { GitProvider, ProjectRole } from '@juanie/types'
import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import type { Job, Queue } from 'bullmq'
import { Worker } from 'bullmq'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { CredentialManagerService } from '../credentials/credential-manager.service'
import { GitProviderService } from '../git-providers/git-provider.service'
import type { GitSyncBatchJob, GitSyncMemberJob, GitSyncRemoveMemberJob } from './git-sync.service'
import { mapPermissionForProvider, mapProjectRoleToGitPermission } from './permission-mapper'

/**
 * Git 同步 Worker
 *
 * 处理队列中的同步任务
 */
@Injectable()
export class GitSyncWorker implements OnModuleInit {
  private readonly logger = new Logger(GitSyncWorker.name)
  private worker: Worker | null = null

  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(GIT_SYNC_QUEUE) readonly queue: Queue,
    private readonly gitProvider: GitProviderService,
    private readonly credentialManager: CredentialManagerService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>('REDIS_URL') || 'redis://localhost:6379'

    this.worker = new Worker(
      'git-sync',
      async (job: Job) => {
        this.logger.log(`Processing job: ${job.name} (${job.id})`)

        try {
          switch (job.name) {
            case 'sync-member':
              await this.handleSyncMember(job)
              break
            case 'remove-member':
              await this.handleRemoveMember(job)
              break
            case 'batch-sync':
              await this.handleBatchSync(job)
              break
            default:
              this.logger.warn(`Unknown job type: ${job.name}`)
          }
        } catch (error) {
          this.logger.error(`Job ${job.id} failed:`, error)
          throw error
        }
      },
      {
        connection: {
          url: redisUrl,
          maxRetriesPerRequest: null,
        },
        concurrency: 5, // 并发处理 5 个任务
      },
    )

    this.worker.on('completed', (job) => {
      this.logger.log(`Job ${job.id} completed`)
    })

    this.worker.on('failed', (job, err) => {
      this.logger.error(`Job ${job?.id} failed:`, err)
    })

    this.logger.log('Git Sync Worker started')
  }

  /**
   * 处理成员同步任务
   */
  private async handleSyncMember(job: Job<GitSyncMemberJob & { syncLogId: string }>) {
    const { projectId, userId, role, syncLogId } = job.data

    this.logger.log(`Syncing member: project=${projectId}, user=${userId}, role=${role}`)

    try {
      // 更新同步日志状态
      await this.updateSyncLogAttempt(syncLogId)

      // 获取项目信息
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // 获取项目的 Git 认证信息
      const [projectAuth] = await this.db
        .select()
        .from(schema.projectGitAuth)
        .where(eq(schema.projectGitAuth.projectId, projectId))
        .limit(1)

      if (!projectAuth) {
        throw new Error(`Project ${projectId} has no Git authentication configured`)
      }

      // 推断 provider
      const provider = this.inferProviderFromAuthType(projectAuth.authType)

      // 获取用户的 Git 账号信息
      const [userGitAccount] = await this.db
        .select()
        .from(schema.userGitAccounts)
        .where(
          and(
            eq(schema.userGitAccounts.userId, userId),
            eq(schema.userGitAccounts.provider, provider),
          ),
        )
        .limit(1)

      if (!userGitAccount) {
        throw new Error(`User ${userId} has not linked their ${provider} account`)
      }

      // 检查 token 是否过期
      if (userGitAccount.syncStatus !== 'active') {
        throw new Error(`User ${userId}'s ${provider} account is ${userGitAccount.syncStatus}`)
      }

      // 映射权限
      const gitPermission = mapProjectRoleToGitPermission(role)
      const platformPermission = mapPermissionForProvider(provider, gitPermission)

      // 获取访问 token（使用 CredentialManager）
      const credential = await this.credentialManager.getProjectCredential(projectId)
      const accessToken = await credential.getAccessToken()

      // 从项目认证配置中获取仓库信息
      // 注意：这里需要从某处获取仓库的 full name
      // 暂时使用项目 slug 作为仓库名（实际应该从配置中获取）
      const repoFullName = `${project.organizationId}/${project.slug}`

      // 调用 Git Provider API 添加协作者
      await this.gitProvider.addCollaborator(
        provider as 'github' | 'gitlab',
        accessToken,
        repoFullName,
        userGitAccount.gitUsername,
        platformPermission as string,
      )

      // 更新同步日志为成功
      await this.db
        .update(schema.gitSyncLogs)
        .set({
          status: 'success',
          completedAt: new Date(),
          metadata: {
            attemptCount: (job.attemptsMade || 0) + 1,
            gitApiResponse: {
              username: userGitAccount.gitUsername,
              permission: platformPermission,
            },
          },
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))

      this.logger.log(`Member sync completed: ${syncLogId}`)
    } catch (error) {
      // 更新同步日志为失败
      await this.db
        .update(schema.gitSyncLogs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          completedAt: new Date(),
          metadata: {
            attemptCount: (job.attemptsMade || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
          } as any,
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))

      throw error
    }
  }

  /**
   * 处理成员移除任务
   */
  private async handleRemoveMember(job: Job<GitSyncRemoveMemberJob & { syncLogId: string }>) {
    const { projectId, userId, syncLogId } = job.data

    this.logger.log(`Removing member access: project=${projectId}, user=${userId}`)

    try {
      // 更新同步日志状态
      await this.updateSyncLogAttempt(syncLogId)

      // 获取项目信息
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // 获取项目的 Git 认证信息
      const [projectAuth] = await this.db
        .select()
        .from(schema.projectGitAuth)
        .where(eq(schema.projectGitAuth.projectId, projectId))
        .limit(1)

      if (!projectAuth) {
        throw new Error(`Project ${projectId} has no Git authentication configured`)
      }

      const provider = this.inferProviderFromAuthType(projectAuth.authType)

      // 获取用户的 Git 账号信息
      const [userGitAccount] = await this.db
        .select()
        .from(schema.userGitAccounts)
        .where(
          and(
            eq(schema.userGitAccounts.userId, userId),
            eq(schema.userGitAccounts.provider, provider),
          ),
        )
        .limit(1)

      if (!userGitAccount) {
        // 用户没有关联 Git 账号，无需移除
        this.logger.warn(`User ${userId} has no ${provider} account, skipping removal`)
        await this.db
          .update(schema.gitSyncLogs)
          .set({
            status: 'success',
            completedAt: new Date(),
            metadata: {
              note: 'User has no Git account linked',
            } as any,
          })
          .where(eq(schema.gitSyncLogs.id, syncLogId))
        return
      }

      // 获取访问 token
      const credential = await this.credentialManager.getProjectCredential(projectId)
      const accessToken = await credential.getAccessToken()

      // 获取仓库全名
      const repoFullName = `${project.organizationId}/${project.slug}`

      // 调用 Git Provider API 移除协作者
      await this.gitProvider.removeCollaborator(
        provider as 'github' | 'gitlab',
        accessToken,
        repoFullName,
        userGitAccount.gitUsername,
      )

      // 更新同步日志为成功
      await this.db
        .update(schema.gitSyncLogs)
        .set({
          status: 'success',
          completedAt: new Date(),
          metadata: {
            attemptCount: (job.attemptsMade || 0) + 1,
            gitApiResponse: {
              username: userGitAccount.gitUsername,
              action: 'removed',
            },
          },
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))

      this.logger.log(`Member removal completed: ${syncLogId}`)
    } catch (error) {
      // 更新同步日志为失败
      await this.db
        .update(schema.gitSyncLogs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          completedAt: new Date(),
          metadata: {
            attemptCount: (job.attemptsMade || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
          } as any,
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))

      throw error
    }
  }

  /**
   * 处理批量同步任务
   */
  private async handleBatchSync(job: Job<GitSyncBatchJob & { syncLogId: string }>) {
    const { projectId, syncLogId } = job.data

    this.logger.log(`Batch syncing project: ${projectId}`)

    try {
      // 更新同步日志状态
      await this.updateSyncLogAttempt(syncLogId)

      // 获取项目信息
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (!project) {
        throw new Error(`Project ${projectId} not found`)
      }

      // 获取项目的 Git 认证信息
      const [projectAuth] = await this.db
        .select()
        .from(schema.projectGitAuth)
        .where(eq(schema.projectGitAuth.projectId, projectId))
        .limit(1)

      if (!projectAuth) {
        throw new Error(`Project ${projectId} has no Git authentication configured`)
      }

      const provider = this.inferProviderFromAuthType(projectAuth.authType)

      // 获取项目所有成员
      const members = await this.db
        .select()
        .from(schema.projectMembers)
        .where(eq(schema.projectMembers.projectId, projectId))

      this.logger.log(`Found ${members.length} members to sync`)

      let successCount = 0
      let failCount = 0
      const errors: Array<{ userId: string; error: string }> = []

      // 获取访问 token
      const credential = await this.credentialManager.getProjectCredential(projectId)
      const accessToken = await credential.getAccessToken()
      const repoFullName = `${project.organizationId}/${project.slug}`

      // 逐个同步成员
      for (const member of members) {
        try {
          // 获取用户的 Git 账号
          const [userGitAccount] = await this.db
            .select()
            .from(schema.userGitAccounts)
            .where(
              and(
                eq(schema.userGitAccounts.userId, member.userId),
                eq(schema.userGitAccounts.provider, provider),
              ),
            )
            .limit(1)

          if (!userGitAccount) {
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
            userGitAccount.gitUsername,
            platformPermission as string,
          )

          successCount++
          this.logger.log(`Synced member ${member.userId}`)
        } catch (error) {
          failCount++
          errors.push({
            userId: member.userId,
            error: error instanceof Error ? error.message : String(error),
          })
          this.logger.error(`Failed to sync member ${member.userId}:`, error)
        }
      }

      // 更新同步日志
      await this.db
        .update(schema.gitSyncLogs)
        .set({
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
          } as any,
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))

      this.logger.log(`Batch sync completed: ${successCount} success, ${failCount} failed`)

      if (failCount > 0) {
        throw new Error(`Batch sync partially failed: ${failCount} members failed`)
      }
    } catch (error) {
      // 更新同步日志为失败
      await this.db
        .update(schema.gitSyncLogs)
        .set({
          status: 'failed',
          error: error instanceof Error ? error.message : String(error),
          errorStack: error instanceof Error ? error.stack : undefined,
          completedAt: new Date(),
          metadata: {
            attemptCount: (job.attemptsMade || 0) + 1,
            lastAttemptAt: new Date().toISOString(),
          },
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))

      throw error
    }
  }

  /**
   * 更新同步日志的尝试次数
   */
  private async updateSyncLogAttempt(syncLogId: string) {
    const [log] = await this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.id, syncLogId))
      .limit(1)

    if (log) {
      const attemptCount = ((log.metadata as any)?.attemptCount || 0) + 1
      await this.db
        .update(schema.gitSyncLogs)
        .set({
          metadata: {
            ...((log.metadata as any) || {}),
            attemptCount,
            lastAttemptAt: new Date().toISOString(),
          },
        })
        .where(eq(schema.gitSyncLogs.id, syncLogId))
    }
  }

  /**
   * 从认证类型推断 Git 提供商
   */
  private inferProviderFromAuthType(authType: string): GitProvider {
    if (authType.includes('github')) {
      return 'github'
    }
    if (authType.includes('gitlab')) {
      return 'gitlab'
    }
    // 默认 GitHub
    return 'github'
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close()
      this.logger.log('Git Sync Worker stopped')
    }
  }
}
