import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import type { ProjectStatus } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'

/**
 * ProjectStatusService
 *
 * 职责：项目状态管理
 * - 获取项目状态和健康度
 * - 更新健康度监控指标
 * - 归档/恢复项目
 * - 项目统计和分析
 *
 * 注意：初始化步骤不再持久化到数据库，改为从 BullMQ Job 和 Redis 获取实时进度
 */
@Injectable()
export class ProjectStatusService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectStatusService.name)
  }

  /**
   * 获取项目完整状态（包括所有关联资源）
   *
   * 注意：初始化步骤不再从数据库查询，改为从 BullMQ Job 和 Redis 获取实时进度
   */
  @Trace('projectStatus.get')
  async getStatus(projectId: string): Promise<ProjectStatus> {
    // 获取项目基本信息
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      throw new Error('项目不存在')
    }

    // 获取环境
    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    // 获取部署历史（最近 10 条）
    const deployments = await this.db
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.projectId, projectId))
      .orderBy(schema.deployments.createdAt)
      .limit(10)

    // 获取仓库信息
    const repositories = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.projectId, projectId))

    // 获取 GitOps 资源
    const gitopsResources = await this.db
      .select()
      .from(schema.gitopsResources)
      .where(eq(schema.gitopsResources.projectId, projectId))

    return {
      project: {
        ...project,
        config: project.config || {
          defaultBranch: 'main',
          enableCiCd: true,
          enableAi: true,
        },
      },
      environments,
      repositories,
      repository: repositories.length > 0 ? repositories[0] : null,
      gitopsResources,
      stats: {
        totalDeployments: deployments.length,
        successfulDeployments: 0,
        failedDeployments: 0,
      },
      health: {
        status: 'healthy',
        score: 100,
        factors: {
          deploymentSuccessRate: 100,
          gitopsSyncStatus: 'healthy',
          podHealthStatus: 'healthy',
          lastDeploymentAge: 0,
        },
        issues: [],
        recommendations: [],
      },
      resourceUsage: {
        pods: 0,
        cpu: '0',
        memory: '0',
      },
    }
  }

  /**
   * 获取项目健康度
   * 基于部署历史、GitOps 状态等计算健康度分数
   */
  @Trace('projectStatus.getHealth')
  async getHealth(projectId: string) {
    // 获取最近部署记录
    const recentDeployments = await this.db
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.projectId, projectId))
      .orderBy(schema.deployments.createdAt)
      .limit(20)

    // 计算部署成功率
    const totalDeployments = recentDeployments.length
    const successfulDeployments = recentDeployments.filter((d) => d.status === 'success').length
    const deploymentSuccessRate =
      totalDeployments > 0 ? Math.round((successfulDeployments / totalDeployments) * 100) : 100

    // 检查 GitOps 资源状态
    const gitopsResources = await this.db
      .select()
      .from(schema.gitopsResources)
      .where(eq(schema.gitopsResources.projectId, projectId))

    const gitopsSyncStatus = gitopsResources.some((r) => r.status === 'failed')
      ? 'warning'
      : 'healthy'

    // 计算最后部署时间
    const lastDeployment = recentDeployments[0]
    const lastDeploymentAge = lastDeployment
      ? Math.floor(
          (Date.now() - new Date(lastDeployment.createdAt).getTime()) / (1000 * 60 * 60 * 24),
        )
      : 0

    // 计算综合健康度评分
    let score = 100
    const issues: Array<{ severity: string; error: string }> = []
    const recommendations: string[] = []

    // 部署成功率影响
    if (deploymentSuccessRate < 80) {
      score -= 30
      issues.push({
        severity: 'critical',
        error: `部署成功率较低 (${deploymentSuccessRate}%)`,
      })
      recommendations.push('检查最近失败的部署日志,找出根本原因')
    } else if (deploymentSuccessRate < 90) {
      score -= 15
      issues.push({
        severity: 'warning',
        error: `部署成功率偏低 (${deploymentSuccessRate}%)`,
      })
    }

    // GitOps 同步状态影响
    if (gitopsSyncStatus === 'warning') {
      score -= 20
      issues.push({
        severity: 'warning',
        error: '部分 GitOps 资源同步失败',
      })
      recommendations.push('检查 GitOps 资源配置和 Git 仓库状态')
    }

    // 长时间未部署警告
    if (lastDeploymentAge > 30) {
      issues.push({
        severity: 'info',
        error: `已有 ${lastDeploymentAge} 天未部署`,
      })
      recommendations.push('考虑定期更新项目依赖和安全补丁')
    }

    // 确定健康状态
    const status = score >= 80 ? 'healthy' : score >= 60 ? 'warning' : 'critical'

    return {
      score,
      status,
      factors: {
        deploymentSuccessRate,
        gitopsSyncStatus: gitopsSyncStatus as 'healthy' | 'warning' | 'critical',
        podHealthStatus: 'healthy',
        lastDeploymentAge,
      },
      issues,
      recommendations,
    }
  }

  /**
   * 更新项目健康度（定时任务调用）
   */
  @Trace('projectStatus.updateHealth')
  async updateHealth(projectId: string) {
    const health = await this.getHealth(projectId)

    await this.db
      .update(schema.projects)
      .set({
        healthScore: health.score,
        healthStatus: health.status as 'healthy' | 'warning' | 'critical',
        lastHealthCheck: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    this.logger.info(`Updated health for project ${projectId}: ${health.score} (${health.status})`)

    return health
  }

  /**
   * 批量更新所有活跃项目的健康度（定时任务调用）
   */
  @Trace('projectStatus.updateAllHealth')
  async updateAllHealth() {
    const activeProjects = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.status, 'active'))

    const results = await Promise.allSettled(
      activeProjects.map((project) => this.updateHealth(project.id)),
    )

    const successful = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length

    this.logger.info(`Updated health for ${successful} projects, ${failed} failed`)

    return {
      total: activeProjects.length,
      successful,
      failed,
    }
  }

  /**
   * 获取项目初始化步骤详情
   *
   * 从数据库查询持久化的步骤记录，支持页面刷新后恢复进度
   */
  @Trace('projectStatus.getInitializationSteps')
  async getInitializationSteps(projectId: string) {
    const steps = await this.db
      .select()
      .from(schema.projectInitializationSteps)
      .where(eq(schema.projectInitializationSteps.projectId, projectId))
      .orderBy(schema.projectInitializationSteps.sequence)

    return steps
  }

  /**
   * 归档项目
   */
  @Trace('projectStatus.archive')
  async archive(projectId: string) {
    const [updated] = await this.db
      .update(schema.projects)
      .set({
        status: 'archived',
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
      .returning()

    return updated
  }

  /**
   * 恢复项目
   */
  @Trace('projectStatus.restore')
  async restore(projectId: string) {
    const [updated] = await this.db
      .update(schema.projects)
      .set({
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
      .returning()

    return updated
  }
}
