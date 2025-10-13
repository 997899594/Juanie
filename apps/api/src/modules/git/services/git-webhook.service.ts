import { Injectable } from '@nestjs/common'
import { createHmac } from 'crypto'
import { eq } from 'drizzle-orm'
import { gitBranches, gitMergeRequests, gitRepositories } from '../../../drizzle/schemas'
import type { DatabaseService } from '../../database/services/database.service'
import type { GitProviderFactory } from '../providers/git-provider.factory'

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
    private readonly db: DatabaseService,
    private readonly gitProviderFactory: GitProviderFactory,
  ) {}

  async setupWebhook(repositoryId: string, webhookUrl: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)
    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      // 生成 webhook 密钥
      const webhookSecret = this.generateWebhookSecret()

      // 在远程设置 webhook
      const webhookId = await provider.createWebhook(repo.repoId, {
        url: webhookUrl,
        secret: webhookSecret,
        events: ['push', 'pull_request', 'merge_request'],
      })

      // 更新仓库记录
      await this.db.drizzle
        .update(gitRepositories)
        .set({
          webhookUrl,
          webhookSecret,
          webhookId,
          updatedAt: new Date(),
        })
        .where(eq(gitRepositories.id, repositoryId))
    } catch (error) {
      throw new Error(`Failed to setup webhook: ${error.message}`)
    }
  }

  async removeWebhook(repositoryId: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)

    if (!repo.webhookId) {
      return // 没有设置 webhook
    }

    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      // 删除远程 webhook
      await provider.deleteWebhook(repo.repoId, repo.webhookId)

      // 清除仓库记录中的 webhook 信息
      await this.db.drizzle
        .update(gitRepositories)
        .set({
          webhookUrl: null,
          webhookSecret: null,
          webhookId: null,
          updatedAt: new Date(),
        })
        .where(eq(gitRepositories.id, repositoryId))
    } catch (error) {
      throw new Error(`Failed to remove webhook: ${error.message}`)
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
      throw new Error('Invalid webhook signature')
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
      throw new Error(`Failed to process webhook: ${error.message}`)
    }
  }

  private async handlePushEvent(repositoryId: string, payload: WebhookPayload): Promise<void> {
    if (!payload.branch || !payload.commit) {
      return
    }

    // 更新分支信息
    await this.db.drizzle
      .update(gitBranches)
      .set({
        sha: payload.branch.sha,
        lastCommit: {
          sha: payload.commit.sha,
          message: payload.commit.message,
          author: payload.commit.author,
          date: payload.commit.timestamp,
        },
        updatedAt: new Date(),
      })
      .where(
        eq(gitBranches.repositoryId, repositoryId) && eq(gitBranches.name, payload.branch.name),
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

    // 更新合并请求状态
    await this.db.drizzle
      .update(gitMergeRequests)
      .set({
        status: mergeRequest.status as 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
        mergedAt: mergeRequest.status === 'MERGED' ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(
        eq(gitMergeRequests.repositoryId, repositoryId) &&
          eq(gitMergeRequests.mrId, mergeRequest.id),
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
    const [repo] = await this.db.drizzle
      .select()
      .from(gitRepositories)
      .where(eq(gitRepositories.id, repositoryId))
      .limit(1)

    if (!repo) {
      throw new Error('Repository not found')
    }

    return repo
  }
}
