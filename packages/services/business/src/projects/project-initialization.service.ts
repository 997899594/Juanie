import * as schema from '@juanie/core/database'
import { GitOpsEvents, type GitOpsSetupRequestedEvent } from '@juanie/core/events'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * 项目初始化服务
 *
 * 职责：
 * - 协调项目初始化流程
 * - 发布事件给其他服务
 * - 更新项目状态
 *
 * 这个服务被 Worker 调用，但包含所有业务逻辑
 */
@Injectable()
export class ProjectInitializationService {
  private readonly logger = new Logger(ProjectInitializationService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 请求 GitOps 资源创建
   *
   * 通过发布事件，让 GitOpsEventHandlerService 处理实际创建
   */
  @Trace('projectInit.requestGitOpsSetup')
  async requestGitOpsSetup(data: {
    projectId: string
    repositoryId: string
    repositoryUrl: string
    repositoryBranch: string
    userId: string // 用于获取 OAuth token
    environments: Array<{
      id: string
      type: 'development' | 'staging' | 'production'
      name: string
    }>
    jobId?: string
  }): Promise<boolean> {
    this.logger.log(`Requesting GitOps setup for project: ${data.projectId}`)

    try {
      // 发布事件
      const event: GitOpsSetupRequestedEvent = {
        projectId: data.projectId,
        repositoryId: data.repositoryId,
        repositoryUrl: data.repositoryUrl,
        repositoryBranch: data.repositoryBranch,
        userId: data.userId,
        environments: data.environments,
        jobId: data.jobId,
      }

      // 使用 emitAsync 等待事件处理完成
      await this.eventEmitter.emitAsync(GitOpsEvents.SETUP_REQUESTED, event)

      this.logger.log('GitOps setup request completed successfully')
      return true
    } catch (error) {
      this.logger.error('GitOps setup request failed:', error)

      // 更新项目配置，标记 GitOps 设置失败
      await this.markGitOpsSetupFailed(data.projectId, error as Error)

      return false
    }
  }

  /**
   * 标记 GitOps 设置失败
   */
  private async markGitOpsSetupFailed(projectId: string, error: Error): Promise<void> {
    try {
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (project) {
        await this.db
          .update(schema.projects)
          .set({
            config: {
              ...(project.config as any),
              gitops: {
                enabled: false,
                setupFailed: true,
                error: (error instanceof Error ? error.message : String(error)),
              },
            },
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, projectId))
      }
    } catch (err) {
      this.logger.error('Failed to mark GitOps setup as failed:', err)
    }
  }
}
