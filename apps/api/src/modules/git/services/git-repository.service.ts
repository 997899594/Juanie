import { Injectable } from '@nestjs/common'
import { and, eq, like } from 'drizzle-orm'
import {
  type GitRepository,
  gitRepositories,
  type NewGitRepository,
  projects,
} from '../../../drizzle/schemas'
import type { DatabaseService } from '../../database/services/database.service'
import type { GitProviderFactory } from '../providers/git-provider.factory'

interface ConnectRepositoryInput {
  projectId: string
  provider: 'GITHUB' | 'GITLAB' | 'GITEA'
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
    private readonly db: DatabaseService,
    private readonly gitProviderFactory: GitProviderFactory,
  ) {}

  async connectRepository(input: ConnectRepositoryInput, userId: string): Promise<GitRepository> {
    const { projectId, provider, repoUrl, accessToken } = input

    try {
      // 验证项目是否存在
      const [project] = await this.db.drizzle
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1)

      if (!project) {
        throw new Error('Project not found')
      }

      // 解析仓库 URL 获取仓库信息
      const repoInfo = this.parseRepositoryUrl(repoUrl, provider)

      // 验证访问令牌并获取仓库详情
      const gitProvider = this.gitProviderFactory.create(provider, accessToken)
      const repoDetails = await gitProvider.getRepository(repoInfo.repoId)

      // 检查仓库是否已连接
      const [existingRepo] = await this.db.drizzle
        .select()
        .from(gitRepositories)
        .where(
          and(eq(gitRepositories.repoId, repoInfo.repoId), eq(gitRepositories.provider, provider)),
        )
        .limit(1)

      if (existingRepo) {
        throw new Error('Repository already connected')
      }

      // 创建仓库记录
      const [newRepo] = await this.db.drizzle
        .insert(gitRepositories)
        .values({
          projectId,
          provider,
          repoId: repoInfo.repoId,
          name: repoDetails.name,
          fullName: repoDetails.fullName,
          description: repoDetails.description,
          url: repoUrl,
          defaultBranch: repoDetails.defaultBranch,
          isPrivate: repoDetails.private,
          accessToken,
          webhookUrl: null,
          webhookSecret: null,
          isActive: true,
          createdBy: userId,
        })
        .returning()

      return newRepo
    } catch (error) {
      throw new Error(`Failed to connect repository: ${error.message}`)
    }
  }

  async getRepositories(
    input: GetRepositoriesInput,
    userId: string,
  ): Promise<RepositoryListResult> {
    const { projectId, page, limit } = input
    const offset = (page - 1) * limit

    let query = this.db.drizzle
      .select({
        id: gitRepositories.id,
        projectId: gitRepositories.projectId,
        provider: gitRepositories.provider,
        repoId: gitRepositories.repoId,
        name: gitRepositories.name,
        fullName: gitRepositories.fullName,
        description: gitRepositories.description,
        url: gitRepositories.url,
        defaultBranch: gitRepositories.defaultBranch,
        isPrivate: gitRepositories.isPrivate,
        isActive: gitRepositories.isActive,
        lastSyncAt: gitRepositories.lastSyncAt,
        createdAt: gitRepositories.createdAt,
        updatedAt: gitRepositories.updatedAt,
        projectName: projects.name,
      })
      .from(gitRepositories)
      .leftJoin(projects, eq(gitRepositories.projectId, projects.id))
      .where(eq(gitRepositories.isActive, true))

    if (projectId) {
      query = query.where(eq(gitRepositories.projectId, projectId))
    }

    const repositories = await query.limit(limit).offset(offset).orderBy(gitRepositories.createdAt)

    // 获取总数
    let countQuery = this.db.drizzle
      .select({ count: gitRepositories.id })
      .from(gitRepositories)
      .where(eq(gitRepositories.isActive, true))

    if (projectId) {
      countQuery = countQuery.where(eq(gitRepositories.projectId, projectId))
    }

    const [{ count }] = await countQuery

    return {
      repositories: repositories as GitRepository[],
      total: Number(count),
      page,
      limit,
    }
  }

  async getRepository(repositoryId: string): Promise<GitRepository | null> {
    const [repo] = await this.db.drizzle
      .select()
      .from(gitRepositories)
      .where(and(eq(gitRepositories.id, repositoryId), eq(gitRepositories.isActive, true)))
      .limit(1)

    return repo || null
  }

  async syncRepository(repositoryId: string): Promise<void> {
    const repo = await this.getRepository(repositoryId)
    if (!repo) {
      throw new Error('Repository not found')
    }

    try {
      const gitProvider = this.gitProviderFactory.create(repo.provider, repo.accessToken!)
      const repoDetails = await gitProvider.getRepository(repo.repoId)

      // 更新仓库信息
      await this.db.drizzle
        .update(gitRepositories)
        .set({
          name: repoDetails.name,
          fullName: repoDetails.fullName,
          description: repoDetails.description,
          defaultBranch: repoDetails.defaultBranch,
          isPrivate: repoDetails.private,
          lastSyncAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(gitRepositories.id, repositoryId))
    } catch (error) {
      throw new Error(`Failed to sync repository: ${error.message}`)
    }
  }

  async disconnectRepository(repositoryId: string): Promise<void> {
    await this.db.drizzle
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
        // GitHub: https://github.com/owner/repo
        if (pathParts.length >= 2) {
          return { repoId: `${pathParts[0]}/${pathParts[1]}` }
        }
      } else if (provider === 'GITLAB') {
        // GitLab: https://gitlab.com/owner/repo 或 https://gitlab.example.com/owner/repo
        if (pathParts.length >= 2) {
          return { repoId: `${pathParts[0]}/${pathParts[1]}` }
        }
      } else if (provider === 'GITEA') {
        // Gitea: https://gitea.example.com/owner/repo
        if (pathParts.length >= 2) {
          return { repoId: `${pathParts[0]}/${pathParts[1]}` }
        }
      }

      throw new Error('Invalid repository URL format')
    } catch (error) {
      throw new Error(`Failed to parse repository URL: ${error.message}`)
    }
  }
}
