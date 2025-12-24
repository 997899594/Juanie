import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { GitConnectionsService } from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { TemplateRenderer } from '../../template-renderer.service'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 渲染模板处理器
 */
@Injectable()
export class RenderTemplateHandler implements StateHandler {
  readonly name = 'RENDERING_TEMPLATE' as const

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private renderer: TemplateRenderer,
    private gitConnections: GitConnectionsService,
    private config: ConfigService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(RenderTemplateHandler.name)
  }

  canHandle(context: InitializationContext): boolean {
    // 只有有模板且有仓库配置时才需要渲染
    return !!context.templatePath && !!context.repository
  }

  getProgress(): number {
    return 30
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.templatePath || !context.projectId) {
      return
    }

    this.logger.info(`Rendering template: ${context.templatePath}`)

    const db = context.tx || this.db

    const [project] = await db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, context.projectId))
      .limit(1)

    if (!project) {
      throw new Error('Project not found')
    }

    // 获取 GitHub 用户名（从用户的 Git 连接中）
    let githubUsername = 'unknown'

    if (context.repository?.provider === 'github') {
      try {
        const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
          context.userId,
          'github',
        )

        if (gitConnection?.username) {
          githubUsername = gitConnection.username
          this.logger.info(`✅ Retrieved GitHub username: ${githubUsername}`)
        } else {
          this.logger.warn('No GitHub username found, using placeholder')
        }
      } catch (error) {
        this.logger.warn('Failed to retrieve GitHub username:', error)
      }
    }

    const outputDir = `/tmp/projects/${context.projectId}`

    // 准备模板变量（与 Worker 保持一致）
    const result = await this.renderer.renderTemplate(
      context.templatePath,
      {
        // 项目信息
        projectId: project.id,
        projectName: project.name,
        description: project.description || `${project.name} - AI DevOps Platform`,

        // GitHub 信息（用于镜像路径）
        githubUsername,

        // K8s 配置
        appName: project.name,
        registry: 'ghcr.io',
        port: 3000,
        domain: this.config.get('APP_DOMAIN') || 'example.com',
        replicas: 1,

        // 平台 API 配置（用于 CI/CD 回调）
        platformApiUrl: this.config.get('PLATFORM_API_URL') || 'http://localhost:3000',

        // 可选功能
        enableDatabase: false,
        enableCache: false,
        enableAuth: false,
        enableSentry: false,

        // 资源配置
        resources: {
          requests: { cpu: '200m', memory: '512Mi' },
          limits: { cpu: '1000m', memory: '1Gi' },
        },

        // 仓库信息（如果有）
        repository: context.repository
          ? {
              url: context.repository.url || '',
              branch: context.repository.defaultBranch || 'main',
            }
          : undefined,

        // 合并用户自定义配置
        ...context.templateConfig,
      },
      outputDir,
    )

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Template rendering failed: ${result.errors.join(', ')}`)
    }

    this.logger.info(`Template rendered to: ${result.outputDir}`)
  }
}
