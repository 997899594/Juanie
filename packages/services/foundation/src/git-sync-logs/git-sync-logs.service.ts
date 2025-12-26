import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'

/**
 * Git 同步日志服务 (Foundation 层)
 *
 * 职责:
 * - 管理 gitSyncLogs 表的所有 CRUD 操作
 * - 提供日志查询和统计功能
 * - 为 Business 层提供数据访问接口
 */

export interface CreateGitSyncLogDto {
  projectId: string
  syncType: 'project' | 'member' | 'organization'
  action?: 'create' | 'update' | 'delete' | 'sync' | 'add' | 'remove'
  status: 'pending' | 'processing' | 'success' | 'failed' | 'retrying'
  gitProvider: 'github' | 'gitlab'
  gitResourceId?: string
  gitResourceType?: 'repository' | 'organization' | 'user' | 'team' | 'member'
  error?: string
  metadata?: Record<string, any>
}

export interface UpdateGitSyncLogDto {
  status?: 'pending' | 'processing' | 'success' | 'failed' | 'retrying'
  error?: string
  completedAt?: Date
  metadata?: Record<string, any>
}

@Injectable()
export class GitSyncLogsService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitSyncLogsService.name)
  }

  /**
   * 创建同步日志
   */
  async create(data: CreateGitSyncLogDto) {
    this.logger.debug(`Creating git sync log for project ${data.projectId}`)

    const [log] = await this.db
      .insert(schema.gitSyncLogs)
      .values({
        projectId: data.projectId,
        syncType: data.syncType,
        action: data.action || 'sync',
        status: data.status,
        provider: data.gitProvider,
        gitResourceId: data.gitResourceId,
        gitResourceType: data.gitResourceType,
        error: data.error,
        metadata: data.metadata,
      })
      .returning()

    return log
  }

  /**
   * 更新同步日志状态
   */
  async updateStatus(id: string, updates: UpdateGitSyncLogDto) {
    this.logger.debug(`Updating git sync log ${id}`)

    const [updated] = await this.db
      .update(schema.gitSyncLogs)
      .set(updates)
      .where(eq(schema.gitSyncLogs.id, id))
      .returning()

    return updated
  }

  /**
   * 标记为处理中
   */
  async markProcessing(id: string) {
    return this.updateStatus(id, {
      status: 'processing',
    })
  }

  /**
   * 标记为成功
   */
  async markSuccess(id: string, metadata?: Record<string, any>) {
    return this.updateStatus(id, {
      status: 'success',
      completedAt: new Date(),
      metadata,
    })
  }

  /**
   * 标记为失败
   */
  async markFailed(id: string, error: string, metadata?: Record<string, any>) {
    return this.updateStatus(id, {
      status: 'failed',
      error,
      completedAt: new Date(),
      metadata,
    })
  }

  /**
   * 根据 ID 查询日志
   */
  async findById(id: string) {
    const log = await this.db.query.gitSyncLogs.findFirst({
      where: eq(schema.gitSyncLogs.id, id),
    })

    return log
  }

  /**
   * 查询项目的所有同步日志
   */
  async findByProject(projectId: string, limit = 50) {
    const logs = await this.db.query.gitSyncLogs.findMany({
      where: eq(schema.gitSyncLogs.projectId, projectId),
      orderBy: [desc(schema.gitSyncLogs.createdAt)],
      limit,
    })

    return logs
  }

  /**
   * 查询项目的最新同步日志
   */
  async findLatestByProject(projectId: string) {
    const log = await this.db.query.gitSyncLogs.findFirst({
      where: eq(schema.gitSyncLogs.projectId, projectId),
      orderBy: [desc(schema.gitSyncLogs.createdAt)],
    })

    return log
  }

  /**
   * 查询项目特定类型的同步日志
   */
  async findByProjectAndType(
    projectId: string,
    syncType: 'project' | 'member' | 'organization',
    limit = 20,
  ) {
    const logs = await this.db.query.gitSyncLogs.findMany({
      where: and(
        eq(schema.gitSyncLogs.projectId, projectId),
        eq(schema.gitSyncLogs.syncType, syncType),
      ),
      orderBy: [desc(schema.gitSyncLogs.createdAt)],
      limit,
    })

    return logs
  }

  /**
   * 查询失败的同步日志
   */
  async findFailedLogs(projectId: string, limit = 20) {
    const logs = await this.db.query.gitSyncLogs.findMany({
      where: and(
        eq(schema.gitSyncLogs.projectId, projectId),
        eq(schema.gitSyncLogs.status, 'failed'),
      ),
      orderBy: [desc(schema.gitSyncLogs.createdAt)],
      limit,
    })

    return logs
  }

  /**
   * 统计项目的同步状态
   */
  async getProjectSyncStats(projectId: string) {
    const logs = await this.db.query.gitSyncLogs.findMany({
      where: eq(schema.gitSyncLogs.projectId, projectId),
    })

    const stats = {
      total: logs.length,
      pending: logs.filter((l) => l.status === 'pending').length,
      processing: logs.filter((l) => l.status === 'processing').length,
      success: logs.filter((l) => l.status === 'success').length,
      failed: logs.filter((l) => l.status === 'failed').length,
      retrying: logs.filter((l) => l.status === 'retrying').length,
      successRate:
        logs.length > 0
          ? (logs.filter((l) => l.status === 'success').length / logs.length) * 100
          : 0,
    }

    return stats
  }

  /**
   * 删除旧的同步日志 (保留最近 N 条)
   */
  async cleanupOldLogs(projectId: string, keepCount = 100) {
    const logs = await this.db.query.gitSyncLogs.findMany({
      where: eq(schema.gitSyncLogs.projectId, projectId),
      orderBy: [desc(schema.gitSyncLogs.createdAt)],
    })

    if (logs.length <= keepCount) {
      return 0
    }

    const logsToDelete = logs.slice(keepCount)
    const idsToDelete = logsToDelete.map((l) => l.id)

    await this.db.delete(schema.gitSyncLogs).where(
      and(
        eq(schema.gitSyncLogs.projectId, projectId),
        // @ts-expect-error - drizzle-orm types issue
        schema.gitSyncLogs.id.in(idsToDelete),
      ),
    )

    this.logger.info(`Cleaned up ${idsToDelete.length} old sync logs for project ${projectId}`)

    return idsToDelete.length
  }
}
