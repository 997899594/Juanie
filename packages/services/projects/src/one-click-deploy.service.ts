import { Injectable, Logger } from '@nestjs/common'
import { ProjectsService } from './projects.service'

/**
 * 部署配置
 */
export interface DeployConfig {
  projectName: string
  templateId: string
  gitProvider: 'github' | 'gitlab'
  organizationId: string
  userId: string
  description?: string
}

/**
 * 部署结果
 */
export interface DeployResult {
  projectId: string
  jobId?: string
  status: 'success' | 'failed'
  duration: number
  message: string
}

/**
 * 一键部署服务
 *
 * 精简设计：复用现有的 ProjectsService.create() 方法
 * 该方法已经包含了完整的项目初始化流程：
 * 1. 创建项目记录
 * 2. 创建 Git 仓库
 * 3. 渲染模板
 * 4. 推送代码
 * 5. 部署到 K8s
 *
 * 本服务只是提供一个更友好的接口和额外的功能
 */
@Injectable()
export class OneClickDeployService {
  private readonly logger = new Logger(OneClickDeployService.name)

  constructor(private readonly projectsService: ProjectsService) {}

  /**
   * 一键部署
   * 直接调用 ProjectsService.create()，它已经实现了完整的部署流程
   */
  async deploy(config: DeployConfig): Promise<DeployResult> {
    const startTime = Date.now()

    try {
      this.logger.log(`Starting one-click deploy for project: ${config.projectName}`)

      // 调用现有的项目创建方法，它会自动处理所有步骤
      const slug = config.projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const project = await this.projectsService.create(config.userId, {
        name: config.projectName,
        slug,
        description: config.description || `Created via one-click deploy`,
        templateId: config.templateId,
        organizationId: config.organizationId,
      })

      const duration = Date.now() - startTime

      this.logger.log(
        `One-click deploy initiated in ${duration}ms for project: ${config.projectName}`,
      )

      return {
        projectId: project.id,
        jobId: project.initializationStatus?.jobId,
        status: 'success',
        duration,
        message: 'Project deployment initiated successfully',
      }
    } catch (error) {
      this.logger.error('One-click deploy failed', error)
      const duration = Date.now() - startTime

      return {
        projectId: '',
        status: 'failed',
        duration,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 获取部署状态
   * 返回简化的状态信息
   */
  async getDeployStatus(projectId: string) {
    this.logger.log(`Getting deploy status for project: ${projectId}`)

    // 简化实现：返回基本状态
    // 实际的详细状态可以通过 SSE 订阅获取
    return {
      projectId,
      message: 'Use SSE subscription for real-time status updates',
    }
  }

  /**
   * 估算部署时间
   * 基于模板类型和历史数据
   */
  estimateDeployTime(templateId: string): number {
    // 根据模板类型估算部署时间（秒）
    const estimates: Record<string, number> = {
      'nextjs-15-app': 45,
      'vue-vite': 40,
      'python-fastapi': 50,
      'go-gin': 35,
      default: 60,
    }

    return estimates[templateId] ?? 60
  }

  /**
   * 批量部署
   * 支持同时部署多个项目
   */
  async batchDeploy(configs: DeployConfig[]): Promise<DeployResult[]> {
    this.logger.log(`Starting batch deploy for ${configs.length} projects`)

    // 并行部署所有项目
    const results = await Promise.allSettled(configs.map((config) => this.deploy(config)))

    return results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      }
      return {
        projectId: '',
        status: 'failed' as const,
        duration: 0,
        message: `Failed to deploy ${configs[index]?.projectName || 'unknown'}: ${result.reason}`,
      }
    })
  }
}
