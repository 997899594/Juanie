import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * 项目初始化步骤服务
 * 负责管理 project_initialization_steps 表的 CRUD 操作
 */
@Injectable()
export class InitializationStepsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(InitializationStepsService.name)
  }

  /**
   * 开始一个新步骤
   */
  async startStep(projectId: string, step: string): Promise<string> {
    const [record] = await this.db
      .insert(schema.projectInitializationSteps)
      .values({
        projectId,
        step,
        status: 'running',
        progress: '0',
        startedAt: new Date(),
      })
      .returning()

    if (!record) {
      throw new Error(`Failed to create initialization step ${step} for project ${projectId}`)
    }

    this.logger.debug(`Started step ${step} for project ${projectId}`)
    return record.id
  }

  /**
   * 更新步骤进度
   */
  async updateStepProgress(projectId: string, step: string, progress: string): Promise<void> {
    await this.db
      .update(schema.projectInitializationSteps)
      .set({
        progress,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, projectId),
          eq(schema.projectInitializationSteps.step, step),
        ),
      )
  }

  /**
   * 完成步骤
   */
  async completeStep(projectId: string, step: string): Promise<void> {
    await this.db
      .update(schema.projectInitializationSteps)
      .set({
        status: 'completed',
        progress: '100',
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, projectId),
          eq(schema.projectInitializationSteps.step, step),
        ),
      )

    this.logger.debug(`Completed step ${step} for project ${projectId}`)
  }

  /**
   * 标记步骤失败
   */
  async failStep(
    projectId: string,
    step: string,
    error: string,
    errorStack?: string,
  ): Promise<void> {
    await this.db
      .update(schema.projectInitializationSteps)
      .set({
        status: 'failed',
        error,
        errorStack,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, projectId),
          eq(schema.projectInitializationSteps.step, step),
        ),
      )

    this.logger.error(`Failed step ${step} for project ${projectId}: ${error}`)
  }

  /**
   * 跳过步骤
   */
  async skipStep(projectId: string, step: string, reason?: string): Promise<void> {
    await this.db
      .update(schema.projectInitializationSteps)
      .set({
        status: 'skipped',
        error: reason,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, projectId),
          eq(schema.projectInitializationSteps.step, step),
        ),
      )

    this.logger.debug(`Skipped step ${step} for project ${projectId}`)
  }

  /**
   * 获取项目的所有步骤
   */
  async getProjectSteps(projectId: string): Promise<schema.ProjectInitializationStep[]> {
    return this.db.query.projectInitializationSteps.findMany({
      where: eq(schema.projectInitializationSteps.projectId, projectId),
      orderBy: [desc(schema.projectInitializationSteps.createdAt)],
    })
  }

  /**
   * 获取当前正在运行的步骤
   */
  async getCurrentStep(projectId: string): Promise<schema.ProjectInitializationStep | undefined> {
    return this.db.query.projectInitializationSteps.findFirst({
      where: and(
        eq(schema.projectInitializationSteps.projectId, projectId),
        eq(schema.projectInitializationSteps.status, 'running'),
      ),
      orderBy: [desc(schema.projectInitializationSteps.createdAt)],
    })
  }

  /**
   * 清理项目的所有步骤记录（用于重试）
   */
  async clearProjectSteps(projectId: string): Promise<void> {
    await this.db
      .delete(schema.projectInitializationSteps)
      .where(eq(schema.projectInitializationSteps.projectId, projectId))

    this.logger.debug(`Cleared all steps for project ${projectId}`)
  }
}
