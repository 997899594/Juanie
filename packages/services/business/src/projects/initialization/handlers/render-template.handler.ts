import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
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
  private readonly logger = new Logger(RenderTemplateHandler.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private renderer: TemplateRenderer,
  ) {}

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

    this.logger.log(`Rendering template: ${context.templatePath}`)

    // 获取项目信息
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, context.projectId))
      .limit(1)

    if (!project) {
      throw new Error('Project not found')
    }

    // 渲染模板
    const outputDir = `/tmp/projects/${context.projectId}`
    const result = await this.renderer.renderTemplate(
      context.templatePath,
      {
        projectName: project.name,
        projectSlug: project.slug,
        description: project.description || undefined,
        ...context.templateConfig,
      },
      outputDir,
    )

    if (result.errors && result.errors.length > 0) {
      throw new Error(`Template rendering failed: ${result.errors.join(', ')}`)
    }

    this.logger.log(`Template rendered to: ${result.outputDir}`)
  }
}
