import * as schema from '@juanie/core-database/schemas'
import { DATABASE } from '@juanie/core-tokens'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { eq } from 'drizzle-orm'
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

  canHandle(context: InitializationContext): boolean {
    // 总是需要创建项目
    return true
  }

  getProgress(): number {
    return 10
  }

  async execute(context: InitializationContext): Promise<void> {
    this.logger.log(`Creating project: ${context.projectData.name}`)

    try {
      const [project] = await this.db
        .insert(schema.projects)
        .values({
          organizationId: context.organizationId,
          name: context.projectData.name,
          slug: context.projectData.slug,
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

      // 保存项目 ID 到上下文
      context.projectId = project.id
      this.logger.log(`Project created: ${project.id}`)
    } catch (error: any) {
      // 处理唯一约束冲突
      const pgError = error.cause || error
      const errorCode = pgError.code || error.code

      if (errorCode === '23505' || error.message?.includes('unique')) {
        throw new Error(`项目标识 "${context.projectData.slug}" 已存在，请使用其他标识`)
      }

      throw new Error(`创建项目失败: ${error.message || '数据库错误'}`)
    }
  }
}
