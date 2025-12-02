import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { Cron, CronExpression } from '@nestjs/schedule'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { CredentialManagerService } from './credential-manager.service'

/**
 * 凭证健康监控服务
 * 定期检查所有项目的凭证健康状态
 */
@Injectable()
export class CredentialHealthMonitorService {
  private readonly logger = new Logger(CredentialHealthMonitorService.name)

  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly credentialManager: CredentialManagerService,
  ) {}

  /**
   * 每小时检查所有项目的凭证健康状态
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkAllCredentials(): Promise<void> {
    this.logger.log('Starting credential health check for all projects')

    try {
      // 获取所有有凭证的项目
      const projects = await this.db
        .select({ projectId: schema.projectGitAuth.projectId })
        .from(schema.projectGitAuth)

      this.logger.log(`Checking ${projects.length} project credentials`)

      let healthyCount = 0
      let unhealthyCount = 0

      for (const { projectId } of projects) {
        try {
          const health = await this.credentialManager.healthCheck(projectId)

          if (health.status === 'healthy') {
            healthyCount++
          } else {
            unhealthyCount++
            this.logger.warn(`Project ${projectId} credential unhealthy: ${health.message}`)
          }
        } catch (error: any) {
          unhealthyCount++
          this.logger.error(`Failed to check project ${projectId}:`, error)
        }
      }

      this.logger.log(`Health check complete: ${healthyCount} healthy, ${unhealthyCount} unhealthy`)
    } catch (error: any) {
      this.logger.error('Failed to run credential health check:', error)
    }
  }

  /**
   * 检查单个项目的凭证健康状态
   */
  async checkProjectCredential(projectId: string): Promise<void> {
    this.logger.log(`Checking credential health for project ${projectId}`)

    try {
      const health = await this.credentialManager.healthCheck(projectId)

      if (health.status !== 'healthy') {
        this.logger.warn(`Project ${projectId} credential unhealthy: ${health.message}`)
      }
    } catch (error: any) {
      this.logger.error(`Failed to check project ${projectId}:`, error)
    }
  }
}
