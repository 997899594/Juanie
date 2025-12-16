import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { EnvironmentsService } from '../../../environments/environments.service'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 创建环境处理器
 *
 * 智能判断:
 * - 如果模板已定义环境，跳过默认环境创建
 * - 如果模板未定义环境，创建默认环境
 */
@Injectable()
export class CreateEnvironmentsHandler implements StateHandler {
  readonly name = 'CREATING_ENVIRONMENTS' as const

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private environments: EnvironmentsService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(CreateEnvironmentsHandler.name)}

  canHandle(context: InitializationContext): boolean {
    // 智能判断: 如果模板已定义环境，跳过默认环境创建
    if (context.templateId && context.templateConfig?.environments) {
      this.logger.info('Template defines environments, skipping default creation')
      return false
    }
    return true
  }

  getProgress(): number {
    return 50
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.projectId) {
      throw new Error('Project ID is required')
    }

    this.logger.info(`Creating environments for project: ${context.projectId}`)

    const db = context.tx || this.db

    // 检查模板是否已创建环境
    const existingEnvs = await db.query.environments.findMany({
      where: eq(schema.environments.projectId, context.projectId),
    })

    if (existingEnvs.length > 0) {
      this.logger.info(`Template already created ${existingEnvs.length} environments`)
      context.environmentIds = existingEnvs.map((e: { id: string }) => e.id)
      return
    }

    // 创建默认环境
    const environmentTypes: Array<{
      name: string
      type: 'development' | 'staging' | 'production'
      approvalRequired: boolean
      minApprovals: number
    }> = [
      {
        name: '开发环境',
        type: 'development',
        approvalRequired: false,
        minApprovals: 0,
      },
      {
        name: '预发布环境',
        type: 'staging',
        approvalRequired: true,
        minApprovals: 1,
      },
      {
        name: '生产环境',
        type: 'production',
        approvalRequired: true,
        minApprovals: 2,
      },
    ]

    const environmentIds: string[] = []

    for (let i = 0; i < environmentTypes.length; i++) {
      const envConfig = environmentTypes[i]!

      await context.publishDetail?.({
        action: `正在创建${envConfig.name}...`,
        subProgress: Math.round(((i + 1) / environmentTypes.length) * 100),
        metadata: { environmentType: envConfig.type },
      })

      try {
        const environment = await this.environments.create(
          context.userId,
          {
            projectId: context.projectId!,
            name: envConfig.name,
            type: envConfig.type,
            status: 'active',
            config: {
              approvalRequired: envConfig.approvalRequired,
              minApprovals: envConfig.minApprovals,
            },
          },
          context.tx, // 传入事务，确保权限检查在同一事务中
        )

        if (environment) {
          environmentIds.push(environment.id)
          this.logger.info(`Environment created: ${environment.name} (${environment.id})`)
        }
      } catch (error) {
        this.logger.error(`Failed to create environment ${envConfig.name}:`, error)
      }
    }

    if (environmentIds.length === 0) {
      throw new Error('Failed to create any environments')
    }

    context.environmentIds = environmentIds
    this.logger.info(`Created ${environmentIds.length} default environments`)
  }
}
