import { Injectable } from '@nestjs/common'
import { and, eq, sql } from 'drizzle-orm'
import type { DrizzleService } from '../../../drizzle/drizzle.service'
import {
  type GitRepository,
  gitRepositories,
  type NewGitRepository,
  projects,
} from '../../../drizzle/schemas'
import { AppError } from '../../../lib/errors'
import type { GitProviderFactory } from '../providers/git-provider.factory'

interface ConnectRepositoryInput {
  projectId: string
  provider: 'GITHUB' | 'GITLAB' | 'GITEA' | 'BITBUCKET'
  repoUrl: string
  accessToken: string
}

interface GetRepositoriesInput {
  projectId?: string
  page: number
  limit: number
}

interface RepositoryListResult {
  repositories: GitRepository[]
  total: number
  page: number
  limit: number
}

@Injectable()
export class GitRepositoryService {
  constructor(
    private readonly drizzleService: DrizzleService,
    private readonly gitProviderFactory: GitProviderFactory,
  ) {}

  async connectRepository(input: ConnectRepositoryInput, userId: string): Promise<GitRepository> {
    const { projectId, provider, repoUrl, accessToken } = input

    try {
      // 验证项目是否存在
      const [project] = await this.drizzleService.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)

      if (!project) {
        throw AppError.notFound('Project not found')
      }

      // 解析仓库 URL 获取仓库信息
      const repoInfo = this.parseRepositoryUrl(repoUrl, provider)

      // 验证访问令牌并获取仓库详情
      const gitProvider = this.gitProviderFactory.create(provider, accessToken)
      const repoDetails = await gitProvider.getRepository(repoInfo.repoId)

      // 检查仓库是否已连接
      const [existingRepo] = await this.drizzleService.db
        .select()
        .from(gitRepositories)
        .where(
          and(eq(gitRepositories.repoId, repoInfo.repoId), eq(gitRepositories.provider, provider)),
        )
        .limit(1)

      if (existingRepo) {
        throw AppError.conflict('Repository already connected')
      }

      // 创建仓库记录
      const [newRepo] = await this.drizzleService.db
        .insert(gitRepositories)
        .values({
          projectId,
          provider,
          repoUrl,
          repoId: repoInfo.repoId,
          repoName: repoDetails.name,
          defaultBranch: repoDetails.defaultBranch,
          accessToken,
          webhookUrl: null,
          webhookSecret: null,
          config: {},
          isActive: true,
          createdBy: userId,
        } as NewGitRepository)
        .returning()

      return newRepo as GitRepository
    } catch (error) {
      throw AppError.internal('Failed to connect repository', { originalError: error })
    }
  }

  async getRepositories(
    input: GetRepositoriesInput,
    userId: string,
  ): Promise<RepositoryListResult> {
    const { projectId, page, limit } = input
    const offset = (page - 1) * limit

    const whereClause = projectId
      ? and(eq(gitRepositories.isActive, true), eq(gitRepositories.projectId, projectId))
      : eq(gitRepositories.isActive, true)

    const query = this.drizzleService.db.select().from(gitRepositories).where(whereClause)

    const repositories = await query.limit(limit).offset(offset).orderBy(gitRepositories.createdAt)

    // 获取总数
    const countRows = await this.drizzleService.db
      .select({ count: sql<number>`count(*)` })
      .from(gitRepositories)
      .where(whereClause)
    const total = Number(countRows[0]?.count ?? 0)

    return {
      repositories: repositories as GitRepository[],
      total,
      page,
      limit,
    }
  }

  async getRepository(repositoryId: string): Promise<GitRepository | null> {
    const [repo] = await this.drizzleService.db
      .select()
      .from(gitRepositories)
      .where(and(eq(gitRepositories.id, repositoryId), eq(gitRepositories.isActive, true)))
      .limit(1)

    return (repo as GitRepository) || null
  }

  async syncRepository(repositoryId: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)
    if (!repo) {
      throw AppError.notFound('Repository not found')
    }

    try {
      const gitProvider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)
      const repoDetails = await gitProvider.getRepository(repo.repoId)

      // 更新仓库信息
      await this.drizzleService.db
        .update(gitRepositories)
        .set({
          defaultBranch: repoDetails.defaultBranch,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gitRepositories.id, repositoryId))
    } catch (error) {
      throw AppError.internal('Failed to sync repository', { originalError: error })
    }
  }

  async disconnectRepository(repositoryId: string): Promise<void> {
    await this.drizzleService.db
      .update(gitRepositories)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(gitRepositories.id, repositoryId))
  }

  private parseRepositoryUrl(url: string, provider: string): { repoId: string } {
    try {
      const urlObj = new URL(url)
      const pathParts = urlObj.pathname.split('/').filter(Boolean)

      if (provider === 'GITHUB') {
        if (pathParts.length >= 2) {
          return { repoId: `${pathParts[0]}/${pathParts[1]}` }
        }
      } else if (provider === 'GITLAB') {
        if (pathParts.length >= 2) {
          return { repoId: `${pathParts[0]}/${pathParts[1]}` }
        }
      } else if (provider === 'GITEA') {
        if (pathParts.length >= 2) {
          return { repoId: `${pathParts[0]}/${pathParts[1]}` }
        }
      }

      throw new Error('Invalid repository URL')
    } catch (_error) {
      throw new Error('Invalid repository URL')
    }
  }
}
