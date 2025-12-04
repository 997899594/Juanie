import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * HealthMonitorService - 项目健康度监控 (独立版)
 *
 * 📝 状态: 占位实现 - 功能已集成到 ProjectStatusService
 *
 * 说明: 
 * 当前健康度监控已在 ProjectStatusService 中实现基础版本
 * 此服务保留用于未来可能的独立监控需求 (如 Prometheus 集成、告警等)
 *
 * 计划功能:
 * - Prometheus 指标收集
 * - 实时告警推送
 * - 健康度趋势分析
 * - 自动化修复建议
 * - 成本优化建议
 */
@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name)

  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 计算项目健康度
   * 注意: 建议使用 ProjectStatusService.getHealth() 代替
   */
  @Trace('healthMonitor.calculateHealth')
  async calculateHealth(projectId: string) {
    this.logger.warn(
      `HealthMonitorService is placeholder. Use ProjectStatusService.getHealth() instead for project: ${projectId}`,
    )

    return {
      score: 100,
      isHealthy: true as const,
      factors: {
        deploymentSuccessRate: 100,
        gitopsSyncStatus: 'healthy' as const,
        podHealthStatus: 'healthy' as const,
        lastDeploymentAge: 0,
      },
      issues: [],
      recommendations: [],
      note: 'Using ProjectStatusService for actual health monitoring',
    }
  }

  /**
   * 启动健康度监控 (Prometheus 集成等)
   * 占位方法 - 等待 Prometheus 集成后实现
   */
  @Trace('healthMonitor.startMonitoring')
  async startMonitoring(projectId: string) {
    this.logger.debug(`Health monitoring placeholder for project: ${projectId}`)
    return { monitoring: false, reason: 'Not implemented' }
  }

  /**
   * 停止健康度监控
   * 占位方法
   */
  @Trace('healthMonitor.stopMonitoring')
  async stopMonitoring(projectId: string) {
    this.logger.debug(`Stop monitoring placeholder for project: ${projectId}`)
    return { success: true }
  }
}
