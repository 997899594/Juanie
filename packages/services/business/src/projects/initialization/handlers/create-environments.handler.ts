import { EnvironmentsService } from '../../../environments/environments.service'
import { Injectable, Logger } from '@nestjs/common'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 创建环境处理器
 */
@Injectable()
export class CreateEnvironmentsHandler implements StateHandler {
  readonly name = 'CREATING_ENVIRONMENTS' as const
  private readonly logger = new Logger(CreateEnvironmentsHandler.name)

  constructor(private environments: EnvironmentsService) {}

  canHandle(context: InitializationContext): boolean {
    // 总是需要创建环境
    return true
  }

  getProgress(): number {
    return 50
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.projectId) {
      throw new Error('Project ID is required')
    }

    this.logger.log(`Creating environments for project: ${context.projectId}`)

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

    // 🎯 逐个创建环境，推送详细进度
    for (let i = 0; i < environmentTypes.length; i++) {
      const envConfig = environmentTypes[i]!

      // 推送详细进度
      await context.publishDetail?.({
        action: `正在创建${envConfig.name}...`,
        subProgress: Math.round(((i + 1) / environmentTypes.length) * 100),
        metadata: { environmentType: envConfig.type },
      })

      try {
        const environment = await this.environments.create(context.userId, {
          projectId: context.projectId!,
          name: envConfig.name,
          type: envConfig.type,
          status: 'active',
          config: {
            approvalRequired: envConfig.approvalRequired,
            minApprovals: envConfig.minApprovals,
          },
        })

        if (environment) {
          environmentIds.push(environment.id)
          this.logger.log(`Environment created: ${environment.name} (${environment.id})`)
        }
      } catch (error) {
        this.logger.error(`Failed to create environment ${envConfig.name}:`, error)
        // 继续创建其他环境
      }
    }

    if (environmentIds.length === 0) {
      throw new Error('Failed to create any environments')
    }

    // 保存环境 ID 到上下文
    context.environmentIds = environmentIds
    this.logger.log(`Created ${environmentIds.length} environments`)
  }
}
