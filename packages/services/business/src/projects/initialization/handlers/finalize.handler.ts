import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { AuditLogsService, NotificationsService } from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { InitializationContext, ProjectWithRelations, StateHandler } from '../types'

/**
 * 完成初始化处理器
 *
 * 职责:
 * 1. 添加项目 owner 成员
 * 2. 记录审计日志
 * 3. 更新项目状态
 * 4. 发送通知
 * 5. 查询并返回完整项目对象
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

  canHandle(_context: InitializationContext): boolean {
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

    const db = context.tx || this.db

    // 1. 添加项目 owner 成员
    await this.addProjectOwner(context, db)

    // 2. 更新项目状态
    const repositoryPending = !!context.repository && !context.repositoryId
    await db
      .update(schema.projects)
      .set({
        status: repositoryPending ? 'initializing' : 'active',
        initializationStatus: repositoryPending
          ? {
              step: 'setup_repository',
              progress: 0,
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

    // 3. 记录审计日志
    await this.logAuditTrail(context)

    // 4. 发送通知
    await this.sendNotification(context, repositoryPending)

    // 5. 查询完整项目对象
    context.projectWithRelations = await this.loadCompleteProject(context.projectId, db)

    this.logger.log(
      `Project ${context.projectId} finalized ${repositoryPending ? '(pending repository)' : 'successfully'}`,
    )
  }

  /**
   * 添加项目 owner 成员
   */
  private async addProjectOwner(context: InitializationContext, db: any): Promise<void> {
    await db.insert(schema.projectMembers).values({
      projectId: context.projectId!,
      userId: context.userId,
      role: 'owner',
    })
    this.logger.log(`Added owner member: ${context.userId}`)
  }

  /**
   * 记录审计日志
   */
  private async logAuditTrail(context: InitializationContext): Promise<void> {
    await this.audit.log({
      userId: context.userId,
      organizationId: context.organizationId,
      action: 'project.initialized',
      resourceType: 'project',
      resourceId: context.projectId!,
      metadata: {
        name: context.projectData.name,
        slug: context.projectData.slug,
        templateId: context.templateId,
        hasRepository: !!context.repositoryId,
        environmentCount: context.environmentIds?.length || 0,
        gitopsResourceCount: context.gitopsResourceIds?.length || 0,
      },
    })
  }

  /**
   * 发送通知
   */
  private async sendNotification(
    context: InitializationContext,
    repositoryPending: boolean,
  ): Promise<void> {
    await this.notifications.create({
      userId: context.userId,
      type: 'system',
      title: repositoryPending ? '项目初始化进行中' : '项目初始化完成',
      message: repositoryPending
        ? `项目 "${context.projectData.name}" 已创建，正在创建仓库...`
        : `项目 "${context.projectData.name}" 已成功初始化`,
      priority: 'normal',
    })
  }

  /**
   * 查询完整项目对象（包含关联数据）
   */
  private async loadCompleteProject(projectId: string, db: any): Promise<ProjectWithRelations> {
    const project = await db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      with: {
        members: {
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
        },
        environments: true,
      },
    })

    if (!project) {
      throw new Error(`Project ${projectId} not found after finalization`)
    }

    return project as ProjectWithRelations
  }
}
