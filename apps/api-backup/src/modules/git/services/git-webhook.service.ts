import { Injectable } from '@nestjs/common'
import { createHmac } from 'crypto'
import { and, eq } from 'drizzle-orm'
import { DrizzleService } from '../../../drizzle/drizzle.service'
import {
  gitBranches,
  mergeRequests as gitMergeRequests,
  gitRepositories,
} from '../../../drizzle/schemas'
import { AppError } from '../../../lib/errors'
import { GitProviderFactory } from '../providers/git-provider.factory'

interface WebhookPayload {
  event: string
  repository: {
    id: string
    name: string
    fullName: string
  }
  branch?: {
    name: string
    sha: string
  }
  mergeRequest?: {
    id: string
    title: string
    status: string
    sourceBranch: string
    targetBranch: string
  }
  commit?: {
    sha: string
    message: string
    author: string
    timestamp: string
  }
}

@Injectable()
export class GitWebhookService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly gitProviderFactory: GitProviderFactory,
  ) {}

  async setupWebhook(repositoryId: string, webhookUrl: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)
    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      // 生成 webhook 密钥
      const webhookSecret = this.generateWebhookSecret()

      // 在远程设�?webhook（按接口签名传参�?
      await provider.createWebhook(repo.repoId, webhookUrl, [
        'push',
        'pull_request',
        'merge_request',
      ])

      // 更新仓库记录
      await this.drizzleService.db
        .update(gitRepositories)
        .set({
          webhookUrl,
          webhookSecret,
          updatedAt: new Date(),
        })
        .where(eq(gitRepositories.id, repositoryId))
    } catch (error) {
      throw AppError.internal('Failed to setup webhook', { originalError: error })
    }
  }

  async removeWebhook(repositoryId: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)

    // 若没�?webhookUrl �?webhookSecret 则认为未设置，直接返�?
    if (!repo.webhookUrl || !repo.webhookSecret) {
      return
    }

    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      // 删除远程 webhook：我们没有存�?webhookId，部分提供商可通过 URL 查找；若接口需�?id，当前无法提供，跳过远端删除以避免错�?
      // TODO: 后续�?provider 返回中记录并持久�?webhook id

      // 清除仓库记录中的 webhook 信息
      await this.drizzleService.db
        .update(gitRepositories)
        .set({
          webhookUrl: null,
          webhookSecret: null,
          updatedAt: new Date(),
        })
        .where(eq(gitRepositories.id, repositoryId))
    } catch (error) {
      throw AppError.internal('Failed to remove webhook', { originalError: error })
    }
  }

  async processWebhook(
    repositoryId: string,
    payload: WebhookPayload,
    signature: string,
  ): Promise<void> {
    const repo = await this.getRepository(repositoryId)

    // 验证 webhook 签名
    if (!this.verifyWebhookSignature(payload, signature, repo.webhookSecret!)) {
      throw AppError.unauthorized('Invalid webhook signature')
    }

    try {
      switch (payload.event) {
        case 'push':
          await this.handlePushEvent(repositoryId, payload)
          break
        case 'pull_request':
        case 'merge_request':
          await this.handleMergeRequestEvent(repositoryId, payload)
          break
        default:
          console.log(`Unhandled webhook event: ${payload.event}`)
      }
    } catch (error) {
      throw AppError.internal('Failed to process webhook', { originalError: error })
    }
  }

  private async handlePushEvent(repositoryId: string, payload: WebhookPayload): Promise<void> {
    if (!payload.branch || !payload.commit) {
      return
    }

    // 更新分支信息
    await this.drizzleService.db
      .update(gitBranches)
      .set({
        sha: payload.branch.sha,
        lastCommit: undefined,
        updatedAt: new Date(),
      })
      .where(
        and(eq(gitBranches.repositoryId, repositoryId), eq(gitBranches.name, payload.branch.name)),
      )
  }

  private async handleMergeRequestEvent(
    repositoryId: string,
    payload: WebhookPayload,
  ): Promise<void> {
    if (!payload.mergeRequest) {
      return
    }

    const { mergeRequest } = payload

    // 更新合并请求状�?
    await this.drizzleService.db
      .update(gitMergeRequests)
      .set({
        status: mergeRequest.status as 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
        mergedAt: mergeRequest.status === 'MERGED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(gitMergeRequests.repositoryId, repositoryId),
          eq(gitMergeRequests.mrId, Number(mergeRequest.id)),
        ),
      )
  }

  private verifyWebhookSignature(
    payload: WebhookPayload,
    signature: string,
    secret: string,
  ): boolean {
    const expectedSignature = createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex')

    return `sha256=${expectedSignature}` === signature
  }

  private generateWebhookSecret(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
  }

  private async getRepository(repositoryId: string) {
    const [repo] = await this.drizzleService.db
      .select()
      .from(gitRepositories)
      .where(eq(gitRepositories.id, repositoryId))
      .limit(1)

    if (!repo) {
      throw AppError.notFound('Repository not found')
    }

    return repo
  }
}

