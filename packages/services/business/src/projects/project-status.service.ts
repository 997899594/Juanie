import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import type { ProjectStatus } from '@juanie/types'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * ProjectStatusService
 *
 * 职责：项目状态管理
 * - 获取项目状态
 * - 归档/恢复项目
 */
@Injectable()
export class ProjectStatusService {
  private readonly logger = new Logger(ProjectStatusService.name)

  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 获取项目完整状态（包括所有关联资源）
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
      project: project as any,
      environments: environments as any,
      repositories: repositories as any,
      repository: repositories.length > 0 ? (repositories[0] as any) : null,
      gitopsResources: gitopsResources as any,
      stats: {
        totalDeployments: deployments.length,
        successfulDeployments: 0,
        failedDeployments: 0,
      },
      health: {
        score: 100,
        status: 'healthy' as const,
        factors: {
          deploymentSuccessRate: 100,
          gitopsSyncStatus: 'healthy' as const,
          podHealthStatus: 'healthy' as const,
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
   * TODO: 实现完整的健康度计算逻辑
   */
  @Trace('projectStatus.getHealth')
  async getHealth(projectId: string) {
    return {
      score: 100,
      status: 'healthy' as const,
      factors: {
        deploymentSuccessRate: 100,
        gitopsSyncStatus: 'healthy' as const,
        podHealthStatus: 'healthy' as const,
        lastDeploymentAge: 0,
      },
      issues: [],
      recommendations: [],
    }
  }

  /**
   * 更新项目健康度（定时任务调用）
   * TODO: 实现完整的健康度计算逻辑
   */
  @Trace('projectStatus.updateHealth')
  async updateHealth(projectId: string) {
    const health = await this.getHealth(projectId)

    await this.db
      .update(schema.projects)
      .set({
        healthScore: health.score,
        healthStatus: health.status,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

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

    this.logger.log(`Updated health for ${successful} projects, ${failed} failed`)

    return {
      total: activeProjects.length,
      successful,
      failed,
    }
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
