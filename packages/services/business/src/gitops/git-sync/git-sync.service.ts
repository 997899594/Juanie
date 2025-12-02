/**
 * Git 同步服务
 *
 * 负责协调平台与 Git 平台的同步操作
 * Requirements: 4.2, 4.8, 7.2
 */

import * as schema from '@juanie/core/database'
import { GIT_SYNC_QUEUE } from '@juanie/core/queue'
import { DATABASE } from '@juanie/core/tokens'
import type { GitProvider, ProjectRole } from '@juanie/types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * Git 同步任务数据
 */
export interface GitSyncMemberJob {
  projectId: string
  userId: string
  role: ProjectRole
}

export interface GitSyncRemoveMemberJob {
  projectId: string
  userId: string
}

export interface GitSyncBatchJob {
  projectId: string
}

/**
 * Git 同步服务
 *
 * 使用队列异步处理同步任务，避免阻塞用户操作
 */
@Injectable()
export class GitSyncService {
  private readonly logger = new Logger(GitSyncService.name)

  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(GIT_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

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

  /**
   * 同步项目成员权限到 Git 平台
   * Requirements: 4.2, 4.3, 4.4
   *
   * 使用队列异步处理，避免阻塞用户操作
   *
   * @param projectId - 项目 ID
   * @param userId - 用户 ID
   * @param role - 项目角色
   */
  async syncProjectMember(projectId: string, userId: string, role: ProjectRole): Promise<void> {
    this.logger.log(`Queueing member sync: project=${projectId}, user=${userId}, role=${role}`)

    // 检查项目是否启用了 Git 同步
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // 检查项目是否有 Git 认证配置
    const [projectAuth] = await this.db
      .select()
      .from(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))
      .limit(1)

    if (!projectAuth) {
      this.logger.warn(`Project ${projectId} has no Git authentication configured, skipping sync`)
      return
    }

    // 从 authType 推断 provider
    const provider = this.inferProviderFromAuthType(projectAuth.authType)

    // 创建同步日志记录
    const [syncLog] = await this.db
      .insert(schema.gitSyncLogs)
      .values({
        syncType: 'member',
        action: 'create',
        projectId,
        userId,
        provider,
        status: 'pending',
        metadata: {
          attemptCount: 0,
          role,
        },
      })
      .returning()

    // 添加到队列
    await this.queue.add(
      'sync-member',
      {
        projectId,
        userId,
        role,
        syncLogId: syncLog.id,
      } as GitSyncMemberJob & { syncLogId: string },
      {
        jobId: `sync-member-${projectId}-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.log(`Member sync queued: ${syncLog.id}`)
  }

  /**
   * 移除成员的 Git 权限
   * Requirements: 4.8
   *
   * @param projectId - 项目 ID
   * @param userId - 用户 ID
   */
  async removeMemberAccess(projectId: string, userId: string): Promise<void> {
    this.logger.log(`Queueing member removal: project=${projectId}, user=${userId}`)

    // 检查项目
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // 检查项目是否有 Git 认证配置
    const [projectAuth] = await this.db
      .select()
      .from(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))
      .limit(1)

    if (!projectAuth) {
      this.logger.warn(
        `Project ${projectId} has no Git authentication configured, skipping removal`,
      )
      return
    }

    const provider = this.inferProviderFromAuthType(projectAuth.authType)

    // 创建同步日志记录
    const [syncLog] = await this.db
      .insert(schema.gitSyncLogs)
      .values({
        syncType: 'member',
        action: 'delete',
        projectId,
        userId,
        provider,
        status: 'pending',
        metadata: {
          attemptCount: 0,
        },
      })
      .returning()

    // 添加到队列
    await this.queue.add(
      'remove-member',
      {
        projectId,
        userId,
        syncLogId: syncLog.id,
      } as GitSyncRemoveMemberJob & { syncLogId: string },
      {
        jobId: `remove-member-${projectId}-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.log(`Member removal queued: ${syncLog.id}`)
  }

  /**
   * 批量同步项目（用于迁移现有项目）
   * Requirements: 7.2, 7.3
   *
   * @param projectId - 项目 ID
   */
  async batchSyncProject(projectId: string): Promise<void> {
    this.logger.log(`Queueing batch sync for project: ${projectId}`)

    // 检查项目
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // 检查项目是否有 Git 认证配置
    const [projectAuth] = await this.db
      .select()
      .from(schema.projectGitAuth)
      .where(eq(schema.projectGitAuth.projectId, projectId))
      .limit(1)

    if (!projectAuth) {
      throw new Error(`Project ${projectId} has no Git authentication configured`)
    }

    const provider = this.inferProviderFromAuthType(projectAuth.authType)

    // 创建同步日志记录
    const [syncLog] = await this.db
      .insert(schema.gitSyncLogs)
      .values({
        syncType: 'project',
        action: 'update',
        projectId,
        provider,
        status: 'pending',
        metadata: {
          attemptCount: 0,
        },
      })
      .returning()

    // 添加到队列
    await this.queue.add(
      'batch-sync',
      {
        projectId,
        syncLogId: syncLog.id,
      } as GitSyncBatchJob & { syncLogId: string },
      {
        jobId: `batch-sync-${projectId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.log(`Batch sync queued: ${syncLog.id}`)
  }

  /**
   * 获取同步日志
   *
   * @param projectId - 项目 ID
   * @param limit - 返回数量限制
   */
  async getSyncLogs(projectId: string, limit: number = 50) {
    const { desc } = await import('drizzle-orm')
    return this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.projectId, projectId))
      .orderBy(desc(schema.gitSyncLogs.createdAt))
      .limit(limit)
  }

  /**
   * 获取失败的同步任务
   *
   * @param projectId - 项目 ID（可选）
   */
  async getFailedSyncs(projectId?: string) {
    const { desc, and } = await import('drizzle-orm')

    if (projectId) {
      return this.db
        .select()
        .from(schema.gitSyncLogs)
        .where(
          and(eq(schema.gitSyncLogs.status, 'failed'), eq(schema.gitSyncLogs.projectId, projectId)),
        )
        .orderBy(desc(schema.gitSyncLogs.createdAt))
        .limit(100)
    }

    return this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.status, 'failed'))
      .orderBy(desc(schema.gitSyncLogs.createdAt))
      .limit(100)
  }

  /**
   * 重试失败的同步任务
   *
   * @param syncLogId - 同步日志 ID
   */
  async retrySyncTask(syncLogId: string): Promise<void> {
    this.logger.log(`Retrying sync task: ${syncLogId}`)

    // 获取同步日志
    const [syncLog] = await this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.id, syncLogId))
      .limit(1)

    if (!syncLog) {
      throw new Error(`Sync log ${syncLogId} not found`)
    }

    if (syncLog.status !== 'failed') {
      throw new Error(`Sync log ${syncLogId} is not in failed state`)
    }

    // 更新状态为 pending
    await this.db
      .update(schema.gitSyncLogs)
      .set({
        status: 'pending',
        error: null,
        errorStack: null,
      })
      .where(eq(schema.gitSyncLogs.id, syncLogId))

    // 根据同步类型重新添加到队列
    if (syncLog.syncType === 'member') {
      if (syncLog.action === 'create' || syncLog.action === 'update') {
        // 需要从 metadata 中获取 role 信息
        const role = (syncLog.metadata as any)?.role || 'developer'
        await this.queue.add(
          'sync-member',
          {
            projectId: syncLog.projectId!,
            userId: syncLog.userId!,
            role,
            syncLogId: syncLog.id,
          },
          {
            jobId: `retry-sync-member-${syncLog.projectId}-${syncLog.userId}-${Date.now()}`,
          },
        )
      } else if (syncLog.action === 'delete') {
        await this.queue.add(
          'remove-member',
          {
            projectId: syncLog.projectId!,
            userId: syncLog.userId!,
            syncLogId: syncLog.id,
          },
          {
            jobId: `retry-remove-member-${syncLog.projectId}-${syncLog.userId}-${Date.now()}`,
          },
        )
      }
    } else if (syncLog.syncType === 'project') {
      await this.queue.add(
        'batch-sync',
        {
          projectId: syncLog.projectId!,
          syncLogId: syncLog.id,
        },
        {
          jobId: `retry-batch-sync-${syncLog.projectId}-${Date.now()}`,
        },
      )
    }

    this.logger.log(`Sync task retried: ${syncLogId}`)
  }
}
