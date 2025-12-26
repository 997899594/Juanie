import { FluxCliService } from '@juanie/core/flux'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { Inject, Injectable } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import { and, eq, lt } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'

/**
 * 项目清理服务
 *
 * 职责：
 * 1. 定期清理失败的项目资源
 * 2. 清理长时间未使用的测试项目
 * 3. 防止资源泄漏
 */
@Injectable()
export class ProjectCleanupService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private fluxCli: FluxCliService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectCleanupService.name)
  }

  /**
   * 每小时清理失败的项目
   * 清理超过 24 小时的失败项目
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupFailedProjects() {
    this.logger.info('Starting cleanup of failed projects...')

    try {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

      // 查找失败的项目
      const failedProjects = await this.db
        .select()
        .from(schema.projects)
        .where(and(eq(schema.projects.status, 'failed'), lt(schema.projects.createdAt, oneDayAgo)))

      this.logger.info(`Found ${failedProjects.length} failed projects to cleanup`)

      for (const project of failedProjects) {
        try {
          this.logger.info(`Cleaning up failed project: ${project.id} (${project.name})`)

          // TODO: Re-implement GitOps cleanup using FluxCliService
          // The old FluxResourcesService has been removed
          // Need to implement cleanup using FluxCliService directly
          this.logger.warn(`GitOps cleanup not yet implemented for project ${project.id}`)

          // 标记项目为已清理
          await this.db
            .update(schema.projects)
            .set({
              status: 'archived',
              updatedAt: new Date(),
            })
            .where(eq(schema.projects.id, project.id))

          this.logger.info(`Project ${project.id} marked as archived`)
        } catch (error) {
          this.logger.error(`Failed to cleanup project ${project.id}:`, error)
        }
      }

      this.logger.info('Cleanup of failed projects completed')
    } catch (error) {
      this.logger.error('Failed to cleanup failed projects:', error)
    }
  }

  /**
   * 每天清理长时间未使用的测试项目
   * 清理超过 7 天未更新的测试项目
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupStaleTestProjects() {
    this.logger.info('Starting cleanup of stale test projects...')

    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      // 查找长时间未使用的项目（名称包含 test, demo, tmp 等）
      const staleProjects = await this.db
        .select()
        .from(schema.projects)
        .where(lt(schema.projects.updatedAt, sevenDaysAgo))

      const testProjects = staleProjects.filter(
        (p) =>
          p.name.toLowerCase().includes('test') ||
          p.name.toLowerCase().includes('demo') ||
          p.name.toLowerCase().includes('tmp') ||
          p.slug.toLowerCase().includes('test'),
      )

      this.logger.info(`Found ${testProjects.length} stale test projects to cleanup`)

      for (const project of testProjects) {
        try {
          this.logger.info(`Cleaning up stale test project: ${project.id} (${project.name})`)

          // TODO: Re-implement GitOps cleanup using FluxCliService
          this.logger.warn(`GitOps cleanup not yet implemented for project ${project.id}`)

          // 标记项目为已清理
          await this.db
            .update(schema.projects)
            .set({
              status: 'archived',
              updatedAt: new Date(),
            })
            .where(eq(schema.projects.id, project.id))
        } catch (error) {
          this.logger.error(`Failed to cleanup stale project ${project.id}:`, error)
        }
      }

      this.logger.info('Cleanup of stale test projects completed')
    } catch (error) {
      this.logger.error('Failed to cleanup stale test projects:', error)
    }
  }

  /**
   * 手动清理指定项目
   */
  async cleanupProject(projectId: string): Promise<{
    success: boolean
    message: string
  }> {
    try {
      this.logger.info(`Manually cleaning up project: ${projectId}`)

      // TODO: Re-implement GitOps cleanup using FluxCliService
      this.logger.warn(`GitOps cleanup not yet implemented for project ${projectId}`)

      // 标记项目为已清理
      await this.db
        .update(schema.projects)
        .set({
          status: 'archived',
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))

      return {
        success: true,
        message: `Successfully cleaned up project ${projectId}`,
      }
    } catch (error) {
      this.logger.error(`Failed to cleanup project ${projectId}:`, error)
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}
