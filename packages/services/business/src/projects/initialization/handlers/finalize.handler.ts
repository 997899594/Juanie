import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { AuditLogsService, NotificationsService } from '@juanie/service-foundation'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 完成初始化处理器
 */
@Injectable()
export class FinalizeHandler implements StateHandler {
  readonly name = 'FINALIZING' as const
  private readonly logger = new Logger(FinalizeHandler.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private notifications: NotificationsService,
    private audit: AuditLogsService,
  ) {}

  canHandle(context: InitializationContext): boolean {
    // 总是需要完成
    return true
  }

  getProgress(): number {
    return 100
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.projectId) {
      throw new Error('Project ID is required')
    }

    this.logger.log(`Finalizing project: ${context.projectId}`)

    const repositoryPending = !!context.repository && !context.repositoryId

    await this.db
      .update(schema.projects)
      .set({
        status: repositoryPending ? 'initializing' : 'active',
        initializationStatus: repositoryPending
          ? {
              step: 'setup_repository',
              progress: 70,
              completedSteps: [
                'create_project',
                'load_template',
                'render_template',
                'create_environments',
              ],
            }
          : {
              step: 'completed',
              progress: 100,
              completedSteps: [
                'create_project',
                'load_template',
                'render_template',
                'create_environments',
                'setup_repository',
                'create_gitops_resources',
              ],
            },
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, context.projectId))

    // 记录审计日志
    await this.audit.log({
      userId: context.userId,
      organizationId: context.organizationId,
      action: 'project.initialized',
      resourceType: 'project',
      resourceId: context.projectId,
      metadata: {
        name: context.projectData.name,
        slug: context.projectData.slug,
        templateId: context.templateId,
        hasRepository: !!context.repositoryId,
        environmentCount: context.environmentIds?.length || 0,
        gitopsResourceCount: context.gitopsResourceIds?.length || 0,
      },
    })

    // 发送通知
    await this.notifications.create({
      userId: context.userId,
      type: 'system',
      title: repositoryPending ? '项目初始化进行中' : '项目初始化完成',
      message: repositoryPending
        ? `项目 "${context.projectData.name}" 已创建，正在创建仓库...`
        : `项目 "${context.projectData.name}" 已成功初始化`,
      priority: 'normal',
    })

    this.logger.log(
      `Project ${context.projectId} finalized ${repositoryPending ? '(pending repository)' : 'successfully'}`,
    )
  }
}
