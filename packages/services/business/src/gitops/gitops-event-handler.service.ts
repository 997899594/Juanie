import { GitOpsEvents, type GitOpsSetupRequestedEvent } from '@juanie/core/events'
import { Trace } from '@juanie/core/observability'
import { Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { OnEvent } from '@nestjs/event-emitter'
import { FluxResourcesService } from './flux/flux-resources.service'
import { K3sService } from './k3s/k3s.service'

/**
 * GitOps 事件处理服务
 *
 * 职责：
 * - 监听 GitOps 相关事件
 * - 协调 GitOps 资源创建
 * - 使用长期有效的 Git 凭证（Project Access Token / Deploy Key）
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
   * 使用长期有效的 Git 凭证（Project Access Token / Deploy Key）
   */
  @OnEvent(GitOpsEvents.SETUP_REQUESTED)
  @Trace('gitops.handleSetupRequest')
  async handleSetupRequest(payload: GitOpsSetupRequestedEvent): Promise<void> {
    this.logger.log(`Handling GitOps setup request for project: ${payload.projectId}`)

    try {
      // 检查 K3s 连接和认证
      if (!this.k3s.isK3sConnected()) {
        this.logger.warn('K3s not connected, skipping GitOps setup')
        throw new Error('K3s cluster not connected')
      }

      // 验证 K3s 认证（尝试列出 namespaces）
      try {
        await this.k3s.listNamespaces()
        this.logger.debug('K3s authentication verified')
      } catch (error: any) {
        this.logger.error('K3s authentication failed:', error.message)
        throw new Error(`K3s authentication failed: ${error.message}`)
      }

      this.logger.log(`Setting up GitOps for project ${payload.projectId}`)

      // 创建 GitOps 资源（凭证由 FluxResourcesService 内部自动创建）
      const result = await this.fluxResources.setupProjectGitOps({
        projectId: payload.projectId,
        repositoryId: payload.repositoryId,
        repositoryUrl: payload.repositoryUrl,
        repositoryBranch: payload.repositoryBranch,
        userId: payload.userId,
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
    } catch (error) {
      this.logger.error('Failed to handle GitOps setup request:', error)
      throw error
    }
  }
}
