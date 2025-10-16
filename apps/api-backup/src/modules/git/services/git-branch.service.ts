import { Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DrizzleService } from '../../../drizzle/drizzle.service'
import {
  type GitBranch,
  gitBranches,
  gitRepositories,
  type NewGitBranch,
} from '../../../drizzle/schemas'
import { AppError } from '../../../lib/errors'
import { GitProviderFactory } from '../providers/git-provider.factory'

@Injectable()
export class GitBranchService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly gitProviderFactory: GitProviderFactory,
  ) {}

  async createBranch(
    repositoryId: string,
    branchName: string,
    sourceBranch: string = 'main',
    userId?: string,
  ): Promise<GitBranch> {
    const repo = await this.getRepository(repositoryId)
    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      // 在远程创建分�?
      const branchInfo = await provider.createBranch(repo.repoId, branchName, sourceBranch)

      // 保存到本地数据库
      const inserted = await this.drizzleService.db
        .insert(gitBranches)
        .values({
          repositoryId,
          name: branchName,
          sha: branchInfo.commit, // GitBranchInfo.commit is sha
          status: 'ACTIVE',
          isProtected: branchInfo.protected ?? false,
          isDefault: false,
        })
        .returning()

      const newBranch = inserted[0]
      if (!newBranch) {
        throw AppError.internal('Failed to create branch', { reason: 'Insert returned no rows' })
      }

      return newBranch
    } catch (error) {
      throw AppError.internal(`Failed to create branch`, { originalError: error })
    }
  }

  async deleteBranch(repositoryId: string, branchName: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)
    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      // 从远程删除分�?
      await provider.deleteBranch(repo.repoId, branchName)

      // 更新本地状�?
      await this.drizzleService.db
        .update(gitBranches)
        .set({
          status: 'DELETED',
          updatedAt: new Date(),
        })
        .where(and(eq(gitBranches.repositoryId, repositoryId), eq(gitBranches.name, branchName)))
    } catch (error) {
      throw AppError.internal('Failed to delete branch', { originalError: error })
    }
  }

  async syncBranches(repositoryId: string): Promise<{ synced: number; errors: string[] }> {
    const repo = await this.getRepository(repositoryId)
    const provider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)

    try {
      const remoteBranches = await provider.getBranches(repo.repoId)
      const errors: string[] = []
      let synced = 0

      for (const branch of remoteBranches) {
        try {
          await this.drizzleService.db
            .insert(gitBranches)
            .values({
              repositoryId,
              name: branch.name,
              sha: branch.commit,
              status: 'ACTIVE',
              isProtected: branch.protected ?? false,
              isDefault: false,
            })
            .onConflictDoUpdate({
              target: [gitBranches.repositoryId, gitBranches.name],
              set: {
                sha: branch.commit,
                isProtected: branch.protected ?? false,
                isDefault: false,
                updatedAt: new Date(),
              },
            })

          synced++
        } catch (error) {
          errors.push(`Failed to sync branch ${branch.name}`)
        }
      }

      // 更新仓库的最后同步时�?
      await this.drizzleService.db
        .update(gitRepositories)
        .set({ lastSyncAt: new Date() })
        .where(eq(gitRepositories.id, repositoryId))

      return { synced, errors }
    } catch (error) {
      throw AppError.internal('Failed to sync branches', { originalError: error })
    }
  }

  async getBranches(repositoryId: string): Promise<GitBranch[]> {
    return await this.drizzleService.db
      .select()
      .from(gitBranches)
      .where(eq(gitBranches.repositoryId, repositoryId))
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

