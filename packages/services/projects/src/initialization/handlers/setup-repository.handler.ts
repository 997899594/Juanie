import { PROJECT_INITIALIZATION_QUEUE } from '@juanie/core-queue'
import { OAuthAccountsService } from '@juanie/service-auth'
import { RepositoriesService } from '@juanie/service-repositories'
import { Inject, Injectable, Logger } from '@nestjs/common'
import type { Queue } from 'bullmq'
import type { InitializationContext, StateHandler } from '../types'

/**
 * 设置仓库处理器
 *
 * 策略：
 * - 快速路径：关联现有仓库（同步）
 * - 慢速路径：创建新仓库（异步，通过队列）
 */
@Injectable()
export class SetupRepositoryHandler implements StateHandler {
  readonly name = 'SETTING_UP_REPOSITORY' as const
  private readonly logger = new Logger(SetupRepositoryHandler.name)

  constructor(
    private repositories: RepositoriesService,
    private oauthAccounts: OAuthAccountsService,
    @Inject(PROJECT_INITIALIZATION_QUEUE) private queue: Queue,
  ) {}

  canHandle(context: InitializationContext): boolean {
    // 只有配置了仓库才需要处理
    return !!context.repository
  }

  getProgress(): number {
    return 70
  }

  async execute(context: InitializationContext): Promise<void> {
    if (!context.repository || !context.projectId) {
      return
    }

    this.logger.log(`Setting up repository for project: ${context.projectId}`)

    // 解析访问令牌
    const resolvedConfig = await this.resolveAccessToken(context)

    if (resolvedConfig.mode === 'existing') {
      // 快速路径：关联现有仓库
      await this.connectExistingRepository(context, resolvedConfig)
    } else {
      // 慢速路径：创建新仓库（异步）
      await this.queueRepositoryCreation(context, resolvedConfig)
    }
  }

  /**
   * 关联现有仓库（快速路径）
   */
  private async connectExistingRepository(
    context: InitializationContext,
    config: any,
  ): Promise<void> {
    this.logger.log('Connecting existing repository')

    const repository = await this.repositories.connect(context.userId, {
      projectId: context.projectId!,
      provider: config.provider,
      fullName: config.url?.split('/').slice(-2).join('/') || 'unknown/repo',
      cloneUrl: config.url || '',
      defaultBranch: config.defaultBranch || 'main',
    })

    if (repository) {
      context.repositoryId = repository.id
      this.logger.log(`Repository connected: ${repository.id}`)
    }
  }

  /**
   * 队列化仓库创建（慢速路径）
   */
  private async queueRepositoryCreation(
    context: InitializationContext,
    config: any,
  ): Promise<void> {
    this.logger.log('Queueing repository creation')

    const job = await this.queue.add('create-repository', {
      projectId: context.projectId,
      userId: context.userId,
      organizationId: context.organizationId,
      repository: config,
      environmentIds: context.environmentIds,
    })

    // 保存 jobId 供前端监听
    context.jobIds = context.jobIds || []
    context.jobIds.push(job.id!)

    this.logger.log(`Repository creation queued: ${job.id}`)
  }

  /**
   * 解析访问令牌
   */
  private async resolveAccessToken(context: InitializationContext): Promise<any> {
    const repository = context.repository!

    // 如果不是使用 OAuth，直接返回
    if (repository.accessToken !== '__USE_OAUTH__') {
      return repository
    }

    this.logger.log(`Resolving OAuth token for provider: ${repository.provider}`)

    const oauthAccount = await this.oauthAccounts.getAccountByProvider(
      context.userId,
      repository.provider,
    )

    if (!oauthAccount) {
      const providerName = repository.provider === 'github' ? 'GitHub' : 'GitLab'
      throw new Error(
        `未找到 ${providerName} OAuth 连接。请前往"设置 > 账户连接"页面连接您的 ${providerName} 账户。`,
      )
    }

    if (!oauthAccount.accessToken || oauthAccount.status !== 'active') {
      const providerName = repository.provider === 'github' ? 'GitHub' : 'GitLab'
      throw new Error(`${providerName} 访问令牌无效，请重新连接账户`)
    }

    return {
      ...repository,
      accessToken: oauthAccount.accessToken,
    }
  }
}
