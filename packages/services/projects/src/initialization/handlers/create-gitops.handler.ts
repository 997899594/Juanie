import { EnvironmentsService } from '@juanie/service-environments'
import { FluxService } from '@juanie/service-flux'
import { Injectable, Logger } from '@nestjs/common'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 创建 GitOps 资源处理器
 */
@Injectable()
export class CreateGitOpsHandler implements StateHandler {
  readonly name = 'CREATING_GITOPS' as const
  private readonly logger = new Logger(CreateGitOpsHandler.name)

  constructor(
    private flux: FluxService,
    private environments: EnvironmentsService,
  ) {}

  canHandle(context: InitializationContext): boolean {
    // 只有有仓库且 Flux 已安装时才创建 GitOps 资源
    return !!context.repositoryId && this.flux.isInstalled()
  }

  getProgress(): number {
    return 85
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.projectId || !context.repositoryId) {
      return
    }

    this.logger.log(`Creating GitOps resources for project: ${context.projectId}`)

    // 获取所有环境
    const environments = await this.environments.list(context.userId, context.projectId)

    const gitopsResourceIds: string[] = []

    // 为每个环境创建 GitOps 资源
    const results = await Promise.allSettled(
      environments.map((environment) =>
        this.flux.createGitOpsResource({
          projectId: context.projectId!,
          environmentId: environment.id,
          repositoryId: context.repositoryId!,
          type: 'kustomization',
          name: `${context.projectId}-${environment.type}`,
          namespace: 'default',
          config: {
            gitRepositoryName: context.projectData.slug,
            path: `k8s/overlays/${environment.type}`,
            interval: '5m',
            prune: true,
            timeout: '2m',
          },
        }),
      ),
    )

    // 收集成功创建的资源 ID
    for (const result of results) {
      if (result.status === 'fulfilled') {
        gitopsResourceIds.push(result.value.id)
        this.logger.log(`GitOps resource created: ${result.value.id}`)
      } else {
        this.logger.error(`Failed to create GitOps resource:`, result.reason)
      }
    }

    context.gitopsResourceIds = gitopsResourceIds
    this.logger.log(`Created ${gitopsResourceIds.length} GitOps resources`)
  }
}
