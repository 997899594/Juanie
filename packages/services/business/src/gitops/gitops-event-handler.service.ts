import { GitOpsEvents, type GitOpsSetupRequestedEvent } from '@juanie/core/events'
import { Trace } from '@juanie/core/observability'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { FluxResourcesService } from './flux/flux-resources.service'
import { GitAuthService } from './git-auth/git-auth.service'
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
    private readonly gitAuth: GitAuthService,
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

      // 1. 创建长期有效的 Git 凭证（但不创建 K8s Secret）
      // GitLab: Project Access Token（永不过期）
      // GitHub: Deploy Key（永不过期）
      const provider = this.detectGitProvider(payload.repositoryUrl)

      this.logger.log(`Setting up ${provider} authentication for project ${payload.projectId}`)

      const authResult = await this.gitAuth.setupProjectAuth({
        projectId: payload.projectId,
        repositoryId: payload.repositoryId,
        provider: provider as 'github' | 'gitlab',
        repositoryUrl: payload.repositoryUrl,
        repositoryFullName: this.extractRepoFullName(payload.repositoryUrl),
        userId: payload.userId,
        skipK8sSecrets: true, // 先不创建 K8s Secret，等 namespace 创建后再创建
      })

      if (!authResult.success) {
        throw new Error('Failed to setup Git authentication')
      }

      // 2. 获取创建的凭证
      const credential = await this.gitAuth.getProjectCredential(payload.projectId)
      if (!credential) {
        throw new Error('Git credential not found after creation')
      }

      // 3. 转换 URL 格式（GitHub Deploy Key 需要 SSH URL）
      let gitUrl = payload.repositoryUrl
      if (credential.type === 'github_deploy_key') {
        // 转换 HTTPS URL 为 SSH URL (Flux 格式)
        // https://github.com/owner/repo.git -> ssh://git@github.com/owner/repo.git
        gitUrl = payload.repositoryUrl
          .replace('https://github.com/', 'ssh://git@github.com/')
          .replace(/\.git$/, '.git')
        this.logger.debug(`Converted URL to SSH format: ${gitUrl}`)
      }

      // 4. 使用凭证创建 GitOps 资源（包括创建 K8s Secret）
      const result = await this.fluxResources.setupProjectGitOps({
        projectId: payload.projectId,
        repositoryId: payload.repositoryId,
        repositoryUrl: gitUrl,
        repositoryBranch: payload.repositoryBranch,
        credential, // 传递完整的凭证对象
        environments: payload.environments,
      })

      if (!result.success) {
        this.logger.error('GitOps setup failed:', result.errors)
        throw new Error(`GitOps setup failed: ${result.errors.join(', ')}`)
      }

      this.logger.log('GitOps setup completed successfully:', {
        projectId: payload.projectId,
        credentialType: credential.type,
        namespaces: result.namespaces.length,
        gitRepositories: result.gitRepositories.length,
        kustomizations: result.kustomizations.length,
      })
    } catch (error) {
      this.logger.error('Failed to handle GitOps setup request:', error)
      throw error
    }
  }

  /**
   * 检测 Git 提供商
   */
  private detectGitProvider(url: string): 'github' | 'gitlab' | 'unknown' {
    if (url.includes('github.com')) return 'github'
    if (url.includes('gitlab.com') || url.includes('gitlab')) return 'gitlab'
    return 'unknown'
  }

  /**
   * 从 URL 提取仓库全名
   */
  private extractRepoFullName(url: string): string {
    // https://github.com/owner/repo.git -> owner/repo
    // https://gitlab.com/owner/repo.git -> owner/repo
    const match = url.match(/[:/]([^/]+\/[^/]+?)(\.git)?$/)
    return match?.[1] || url
  }
}
