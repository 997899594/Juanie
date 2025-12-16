import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
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
    private readonly logger: Logger,
  ) {
    this.logger.setContext(RenderTemplateHandler.name)}

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

    this.logger.info(`Template rendered to: ${result.outputDir}`)
  }
}
