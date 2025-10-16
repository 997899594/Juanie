import { Injectable } from '@nestjs/common'
import { and, desc, eq, sql } from 'drizzle-orm'
import { DrizzleService } from '../../../drizzle/drizzle.service'
import {
  type MergeRequest as GitMergeRequest,
  mergeRequests as gitMergeRequests,
  gitRepositories,
} from '../../../drizzle/schemas'
import { AppError } from '../../../lib/errors'
import { GitProviderFactory } from '../providers/git-provider.factory'

interface CreateMergeRequestInput {
  repositoryId: string
  title: string
  description?: string
  sourceBranch: string
  targetBranch: string
  assigneeId?: string
  reviewerIds?: string[]
  labels?: string[]
}

interface GetMergeRequestsInput {
  repositoryId: string
  status?: 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT'
  page: number
  limit: number
}

interface MergeRequestListResult {
  mergeRequests: GitMergeRequest[]
  total: number
  page: number
  limit: number
}

@Injectable()
export class GitMergeRequestService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly gitProviderFactory: GitProviderFactory,
  ) {}

  async createMergeRequest(
    input: CreateMergeRequestInput,
    userId: string,
  ): Promise<GitMergeRequest> {
    const {
      repositoryId,
      title,
      description,
      sourceBranch,
      targetBranch,
      assigneeId,
      reviewerIds,
      labels,
    } = input

    try {
      // 获取仓库信息
      const repo = await this.getRepository(repositoryId)
      const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

      // 在远程创建合并请�?
      const mrInfo = await provider.createMergeRequest(repo.repoId, {
        title,
        description: description || '',
        sourceBranch,
        targetBranch,
        assigneeId,
        reviewerIds,
        labels,
      })

      // 保存到本地数据库
      const [newMr] = await this.drizzleService.db
        .insert(gitMergeRequests)
        .values({
          repositoryId,
          mrId: Number(mrInfo.id),
          title,
          description: description || '',
          sourceBranch,
          targetBranch,
          status: 'OPEN',
          authorId: userId,
          assigneeId,
          reviewers: reviewerIds || [],
          labels: labels || [],
        })
        .returning()

      return newMr as GitMergeRequest
    } catch (error) {
      throw AppError.internal('Failed to create merge request', { originalError: error })
    }
  }

  async getMergeRequests(input: GetMergeRequestsInput): Promise<MergeRequestListResult> {
    const { repositoryId, status, page, limit } = input
    const offset = (page - 1) * limit

    const whereClause = status
      ? and(eq(gitMergeRequests.repositoryId, repositoryId), eq(gitMergeRequests.status, status))
      : eq(gitMergeRequests.repositoryId, repositoryId)

    const query = this.drizzleService.db.select().from(gitMergeRequests).where(whereClause)

    const mergeRequests = await query
      .limit(limit)
      .offset(offset)
      .orderBy(desc(gitMergeRequests.createdAt))

    // 获取总数
    const countRows = await this.drizzleService.db
      .select({ count: sql<number>`count(*)` })
      .from(gitMergeRequests)
      .where(whereClause)
    const total = Number(countRows[0]?.count ?? 0)

    return {
      mergeRequests: mergeRequests as GitMergeRequest[],
      total,
      page,
      limit,
    }
  }

  async getMergeRequest(repositoryId: string, mrId: number): Promise<GitMergeRequest | null> {
    const [mr] = await this.drizzleService.db
      .select()
      .from(gitMergeRequests)
      .where(and(eq(gitMergeRequests.repositoryId, repositoryId), eq(gitMergeRequests.mrId, mrId)))
      .limit(1)

    return (mr as GitMergeRequest) || null
  }

  async updateMergeRequestStatus(
    repositoryId: string,
    mrId: number,
    status: 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
  ): Promise<void> {
    await this.drizzleService.db
      .update(gitMergeRequests)
      .set({
        status,
        updatedAt: new Date(),
      })
      .where(and(eq(gitMergeRequests.repositoryId, repositoryId), eq(gitMergeRequests.mrId, mrId)))
  }

  async mergeMergeRequest(repositoryId: string, mrId: number, userId: string): Promise<void> {
    try {
      const repo = await this.getRepository(repositoryId)
      const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

      // 在远程合�?
      await provider.mergeMergeRequest(repo.repoId, mrId)

      // 更新本地状�?
      await this.drizzleService.db
        .update(gitMergeRequests)
        .set({
          status: 'MERGED',
          mergedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(gitMergeRequests.repositoryId, repositoryId), eq(gitMergeRequests.mrId, mrId)),
        )
    } catch (error) {
      throw AppError.internal('Failed to merge merge request', { originalError: error })
    }
  }

  async closeMergeRequest(repositoryId: string, mrId: number): Promise<void> {
    try {
      const repo = await this.getRepository(repositoryId)
      const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

      // 在远程关�?
      await provider.closeMergeRequest(repo.repoId, mrId)

      // 更新本地状�?
      await this.updateMergeRequestStatus(repositoryId, mrId, 'CLOSED')
    } catch (error) {
      throw AppError.internal('Failed to close merge request', { originalError: error })
    }
  }

  async syncMergeRequests(repositoryId: string): Promise<{ synced: number; errors: string[] }> {
    const repo = await this.getRepository(repositoryId)
    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      const remoteMRs = await provider.getMergeRequests(repo.repoId)
      const errors: string[] = []
      let synced = 0

      for (const mr of remoteMRs) {
        try {
          await this.drizzleService.db
            .insert(gitMergeRequests)
            .values({
              repositoryId,
              mrId: Number(mr.id),
              title: mr.title,
              description: mr.description,
              sourceBranch: mr.sourceBranch,
              targetBranch: mr.targetBranch,
              status: mr.status as 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
              labels: mr.labels || [],
              mergedAt: mr.mergedAt ?? undefined,
            })
            .onConflictDoUpdate({
              target: [gitMergeRequests.repositoryId, gitMergeRequests.mrId],
              set: {
                title: mr.title,
                description: mr.description,
                status: mr.status as 'OPEN' | 'MERGED' | 'CLOSED' | 'DRAFT',
                labels: mr.labels || [],
                mergedAt: mr.mergedAt ?? undefined,
                updatedAt: new Date(),
              },
            })

          synced++
        } catch (_error) {
          errors.push(`Failed to sync MR ${mr.id}`)
        }
      }

      return { synced, errors }
    } catch (error) {
      throw AppError.internal('Failed to sync merge requests', { originalError: error })
    }
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

