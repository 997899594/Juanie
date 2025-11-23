import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DATABASE } from '@juanie/core-tokens'
import type { HealthIssue, ProjectHealth } from '@juanie/core-types'
import { DeploymentsService } from '../deployments/deployments.service'
import { FluxService } from '../gitops/flux/flux.service'
import { K3sService } from '../gitops/k3s/k3s.service'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { and, desc, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

interface HealthFactors {
  deploymentSuccessRate: number
  gitopsSyncStatus: 'healthy' | 'degraded' | 'failed'
  podHealthStatus: 'healthy' | 'degraded' | 'failed'
  lastDeploymentAge: number
}

@Injectable()
export class HealthMonitorService {
  private readonly logger = new Logger(HealthMonitorService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private deploymentsService: DeploymentsService,
    private fluxService: FluxService,
    private k3sService: K3sService,
  ) {}

  /**
   * 计算项目的健康度
   * Requirements: 5.1, 5.3
   */
  @Trace('health-monitor.calculateHealth')
  async calculateHealth(projectId: string): Promise<ProjectHealth> {
    this.logger.log(`Calculating health for project ${projectId}`)

    try {
      // 1. 获取最近 10 次部署记录
      const recentDeployments = await this.getRecentDeployments(projectId, 10)
      const successRate = this.calculateSuccessRate(recentDeployments)

      // 2. 检查 GitOps 资源状态
      const gitopsStatus = await this.checkGitOpsStatus(projectId)

      // 3. 检查 Pod 健康状态
      const podStatus = await this.checkPodHealth(projectId)

      // 4. 计算最后部署时间
      const lastDeploymentAge = this.getLastDeploymentAge(recentDeployments)

      // 5. 计算综合评分
      const factors: HealthFactors = {
        deploymentSuccessRate: successRate,
        gitopsSyncStatus: gitopsStatus,
        podHealthStatus: podStatus,
        lastDeploymentAge,
      }

      const score = this.calculateScore(factors)

      // 6. 生成问题列表和建议
      const issues = await this.detectIssues(projectId, {
        deployments: recentDeployments,
        gitopsStatus,
        podStatus,
        successRate,
      })

      const recommendations = this.generateRecommendations(issues)

      const health: ProjectHealth = {
        score,
        status: this.getStatusFromScore(score),
        factors: {
          deploymentSuccessRate: successRate,
          gitopsSyncStatus: gitopsStatus,
          podHealthStatus: podStatus,
          lastDeploymentAge,
        },
        issues,
        recommendations,
        lastChecked: new Date(),
      }

      this.logger.log(
        `Health calculated for project ${projectId}: score=${score}, status=${health.status}`,
      )

      return health
    } catch (error: any) {
      this.logger.error(`Failed to calculate health for project ${projectId}:`, error)
      throw new Error(`计算项目健康度失败: ${error.message}`)
    }
  }

  /**
   * 获取最近的部署记录
   */
  private async getRecentDeployments(projectId: string, limit: number = 10) {
    const deployments = await this.db
      .select()
      .from(schema.deployments)
      .where(and(eq(schema.deployments.projectId, projectId), isNull(schema.deployments.deletedAt)))
      .orderBy(desc(schema.deployments.createdAt))
      .limit(limit)

    return deployments
  }

  /**
   * 计算部署成功率
   */
  private calculateSuccessRate(deployments: any[]): number {
    if (deployments.length === 0) {
      return 100 // 没有部署记录，默认为 100
    }

    const successfulDeployments = deployments.filter((d) => d.status === 'success').length
    return (successfulDeployments / deployments.length) * 100
  }

  /**
   * 检查 GitOps 资源状态
   */
  private async checkGitOpsStatus(projectId: string): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      const gitopsResources = await this.fluxService.listGitOpsResources(projectId)

      if (gitopsResources.length === 0) {
        return 'healthy' // 没有 GitOps 资源，默认为健康
      }

      const failedCount = gitopsResources.filter((r) => r.status === 'failed').length
      const reconcilingCount = gitopsResources.filter((r) => r.status === 'reconciling').length

      if (failedCount > 0) {
        return 'failed'
      }

      if (reconcilingCount > gitopsResources.length / 2) {
        return 'degraded'
      }

      return 'healthy'
    } catch (error: any) {
      this.logger.warn(`Failed to check GitOps status: ${error.message}`)
      return 'degraded'
    }
  }

  /**
   * 检查 Pod 健康状态
   */
  private async checkPodHealth(projectId: string): Promise<'healthy' | 'degraded' | 'failed'> {
    try {
      if (!this.k3sService.isK3sConnected()) {
        return 'healthy' // K3s 未连接，跳过检查
      }

      // 获取项目的所有环境
      const environments = await this.db.query.environments.findMany({
        where: and(
          eq(schema.environments.projectId, projectId),
          isNull(schema.environments.deletedAt),
        ),
      })

      if (environments.length === 0) {
        return 'healthy'
      }

      let totalPods = 0
      let healthyPods = 0

      for (const env of environments) {
        // Construct namespace from project ID and environment type
        const namespace = `${projectId}-${env.type}`

        try {
          const pods = await this.k3sService.getPods(namespace)

          for (const pod of pods) {
            totalPods++

            const phase = pod.status?.phase
            const conditions = pod.status?.conditions || []

            // 检查 Pod 是否健康
            const isReady = conditions.some((c) => c.type === 'Ready' && c.status === 'True')

            if (phase === 'Running' && isReady) {
              healthyPods++
            }
          }
        } catch (error: any) {
          this.logger.warn(`Failed to get pods for namespace ${namespace}: ${error.message}`)
        }
      }

      if (totalPods === 0) {
        return 'healthy' // 没有 Pod，默认为健康
      }

      const healthyRatio = healthyPods / totalPods

      if (healthyRatio < 0.5) {
        return 'failed'
      }

      if (healthyRatio < 0.8) {
        return 'degraded'
      }

      return 'healthy'
    } catch (error: any) {
      this.logger.warn(`Failed to check pod health: ${error.message}`)
      return 'degraded'
    }
  }

  /**
   * 获取最后部署时间（天数）
   */
  private getLastDeploymentAge(deployments: any[]): number {
    if (deployments.length === 0) {
      return -1 // 没有部署记录
    }

    const lastDeployment = deployments[0]
    const now = new Date()
    const lastDeploymentDate = new Date(lastDeployment.createdAt)
    const diffMs = now.getTime() - lastDeploymentDate.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    return diffDays
  }

  /**
   * 计算综合评分（0-100）
   */
  private calculateScore(factors: HealthFactors): number {
    // 部署成功率权重 40%
    const deploymentScore = factors.deploymentSuccessRate * 0.4

    // GitOps 状态权重 30%
    const gitopsScore = this.gitopsStatusToScore(factors.gitopsSyncStatus) * 0.3

    // Pod 健康状态权重 30%
    const podScore = this.podStatusToScore(factors.podHealthStatus) * 0.3

    return Math.round(deploymentScore + gitopsScore + podScore)
  }

  /**
   * GitOps 状态转换为分数
   */
  private gitopsStatusToScore(status: 'healthy' | 'degraded' | 'failed'): number {
    switch (status) {
      case 'healthy':
        return 100
      case 'degraded':
        return 50
      case 'failed':
        return 0
      default:
        return 100
    }
  }

  /**
   * Pod 状态转换为分数
   */
  private podStatusToScore(status: 'healthy' | 'degraded' | 'failed'): number {
    switch (status) {
      case 'healthy':
        return 100
      case 'degraded':
        return 50
      case 'failed':
        return 0
      default:
        return 100
    }
  }

  /**
   * 根据分数获取状态
   */
  private getStatusFromScore(score: number): 'healthy' | 'warning' | 'critical' {
    if (score >= 80) {
      return 'healthy'
    }
    if (score >= 50) {
      return 'warning'
    }
    return 'critical'
  }

  /**
   * 检测问题
   * Requirements: 5.4
   */
  private async detectIssues(
    projectId: string,
    data: {
      deployments: any[]
      gitopsStatus: 'healthy' | 'degraded' | 'failed'
      podStatus: 'healthy' | 'degraded' | 'failed'
      successRate: number
    },
  ): Promise<HealthIssue[]> {
    const issues: HealthIssue[] = []

    // 1. 检测部署失败模式
    if (data.successRate < 50) {
      const recentFailures = data.deployments.filter((d) => d.status === 'failed').slice(0, 3)

      issues.push({
        severity: 'critical',
        category: 'deployment',
        message: `部署成功率过低 (${data.successRate.toFixed(1)}%)`,
        affectedResources: recentFailures.map((d) => d.id),
        suggestedAction: '检查最近失败的部署日志，排查配置或代码问题',
      })
    } else if (data.successRate < 80) {
      issues.push({
        severity: 'warning',
        category: 'deployment',
        message: `部署成功率偏低 (${data.successRate.toFixed(1)}%)`,
        affectedResources: [],
        suggestedAction: '关注部署流程，考虑增加测试覆盖率',
      })
    }

    // 2. 检测 GitOps 同步问题
    if (data.gitopsStatus === 'failed') {
      const failedResources = await this.getFailedGitOpsResources(projectId)

      issues.push({
        severity: 'critical',
        category: 'gitops',
        message: 'GitOps 资源同步失败',
        affectedResources: failedResources.map((r) => r.id),
        suggestedAction: '检查 GitOps 资源配置和 Git 仓库连接',
      })
    } else if (data.gitopsStatus === 'degraded') {
      issues.push({
        severity: 'warning',
        category: 'gitops',
        message: 'GitOps 资源同步缓慢',
        affectedResources: [],
        suggestedAction: '检查 Flux 控制器状态和网络连接',
      })
    }

    // 3. 检测资源异常
    if (data.podStatus === 'failed') {
      issues.push({
        severity: 'critical',
        category: 'resource',
        message: '超过 50% 的 Pod 不健康',
        affectedResources: [],
        suggestedAction: '检查 Pod 日志和资源限制配置',
      })
    } else if (data.podStatus === 'degraded') {
      issues.push({
        severity: 'warning',
        category: 'resource',
        message: '部分 Pod 不健康',
        affectedResources: [],
        suggestedAction: '检查 Pod 状态和健康检查配置',
      })
    }

    // 4. 检测长时间未部署
    const lastDeploymentAge = this.getLastDeploymentAge(data.deployments)
    if (lastDeploymentAge > 30) {
      issues.push({
        severity: 'info',
        category: 'deployment',
        message: `项目已 ${lastDeploymentAge} 天未部署`,
        affectedResources: [],
        suggestedAction: '确认项目是否仍在活跃开发中',
      })
    }

    return issues
  }

  /**
   * 获取失败的 GitOps 资源
   */
  private async getFailedGitOpsResources(projectId: string) {
    const resources = await this.fluxService.listGitOpsResources(projectId)
    return resources.filter((r) => r.status === 'failed')
  }

  /**
   * 生成优化建议
   * Requirements: 5.5
   */
  private generateRecommendations(issues: HealthIssue[]): string[] {
    const recommendations: string[] = []

    // 基于问题生成建议
    for (const issue of issues) {
      if (issue.severity === 'critical') {
        recommendations.push(`🔴 ${issue.suggestedAction}`)
      } else if (issue.severity === 'warning') {
        recommendations.push(`🟡 ${issue.suggestedAction}`)
      } else {
        recommendations.push(`ℹ️ ${issue.suggestedAction}`)
      }
    }

    // 如果没有问题，提供一般性建议
    if (recommendations.length === 0) {
      recommendations.push('✅ 项目健康状态良好，继续保持')
      recommendations.push('💡 建议定期检查部署日志和资源使用情况')
    }

    return recommendations
  }
}
