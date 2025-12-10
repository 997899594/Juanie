import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 创建项目记录处理器
 */
@Injectable()
export class CreateProjectHandler implements StateHandler {
  readonly name = 'CREATING_PROJECT' as const
  private readonly logger = new Logger(CreateProjectHandler.name)

  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  canHandle(_context: InitializationContext): boolean {
    // 总是需要创建项目
    return true
  }

  getProgress(): number {
    return 10
  }

  async execute(context: InitializationContext): Promise<void> {
    this.logger.log(`Creating project: ${context.projectData.name}`)

    const db = context.tx || this.db

    try {
      const slug = `project-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

      const [project] = await db
        .insert(schema.projects)
        .values({
          organizationId: context.organizationId,
          name: context.projectData.name,
          slug,
          description: context.projectData.description,
          logoUrl: context.projectData.logoUrl,
          visibility: context.projectData.visibility ?? 'private',
          status: 'initializing',
          templateId: context.templateId,
          templateConfig: context.templateConfig,
          initializationStatus: {
            step: 'create_project',
            progress: 10,
            completedSteps: [],
          },
          config: {
            defaultBranch: 'main',
            enableCiCd: true,
            enableAi: true,
          },
        })
        .returning()

      if (!project) {
        throw new Error('Failed to create project record')
      }

      context.projectId = project.id
      this.logger.log(`Project created: ${project.id}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : '数据库错误'
      throw new Error(`创建项目失败: ${message}`)
    }
  }
}
