import { GitOpsEvents, type GitOpsSetupRequestedEvent } from '@juanie/core/events'
import { Trace } from '@juanie/core/observability'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { FluxResourcesService } from './flux/flux-resources.service'
import { K3sService } from './k3s/k3s.service'

/**
 * GitOps 事件处理服务
 *
 * 职责：
 * - 监听 GitOps 相关事件
 * - 协调 GitOps 资源创建
 * - 发布结果事件
 */
@Injectable()
export class GitOpsEventHandlerService {
  private readonly logger = new Logger(GitOpsEventHandlerService.name)

  constructor(
    private readonly fluxResources: FluxResourcesService,
    private readonly k3s: K3sService,
  ) {}

  /**
   * 处理 GitOps 设置请求
   *
   * 当项目初始化 Worker 发布 gitops.setup.requested 事件时触发
   */
  @OnEvent(GitOpsEvents.SETUP_REQUESTED)
  @Trace('gitops.handleSetupRequest')
  async handleSetupRequest(payload: GitOpsSetupRequestedEvent): Promise<void> {
    this.logger.log(`Handling GitOps setup request for project: ${payload.projectId}`)

    try {
      // 检查 K3s 连接
      if (!this.k3s.isK3sConnected()) {
        this.logger.warn('K3s not connected, skipping GitOps setup')
        throw new Error('K3s cluster not connected')
      }

      // 调用 FluxResourcesService 创建资源
      const result = await this.fluxResources.setupProjectGitOps({
        projectId: payload.projectId,
        repositoryId: payload.repositoryId,
        repositoryUrl: payload.repositoryUrl,
        repositoryBranch: payload.repositoryBranch,
        accessToken: payload.accessToken,
        environments: payload.environments,
      })

      if (!result.success) {
        this.logger.error('GitOps setup failed:', result.errors)
        throw new Error(`GitOps setup failed: ${result.errors.join(', ')}`)
      }

      this.logger.log('GitOps setup completed successfully:', {
        projectId: payload.projectId,
        namespaces: result.namespaces.length,
        gitRepositories: result.gitRepositories.length,
        kustomizations: result.kustomizations.length,
      })

      // 发布成功事件
      // EventEmitter 会自动注入，但这里我们通过 FluxResourcesService 已经更新了数据库
      // 如果需要通知其他服务，可以在这里发布事件
    } catch (error) {
      this.logger.error('Failed to handle GitOps setup request:', error)

      // 发布失败事件
      // 这里可以发布事件通知其他服务
      throw error
    }
  }
}
