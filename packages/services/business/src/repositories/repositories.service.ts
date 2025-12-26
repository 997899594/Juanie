import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { GitConnectionsService, GitProviderService } from '@juanie/service-foundation'
import type { ConnectRepositoryInput } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class RepositoriesService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private readonly config: ConfigService,
    private readonly gitProvider: GitProviderService,
    private readonly gitConnections: GitConnectionsService,
  ) {}

  // 连接仓库
  async connect(userId: string, data: ConnectRepositoryInput) {
    // 检查用户是否有项目权限
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, data.projectId))
      .limit(1)

    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查用户是否是组织成员
    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限连接仓库')
    }

    // 检查仓库是否已连接
    const [existing] = await this.db
      .select()
      .from(schema.repositories)
      .where(
        and(
          eq(schema.repositories.projectId, data.projectId),
          eq(schema.repositories.fullName, data.fullName),
        ),
      )
      .limit(1)

    if (existing) {
      throw new Error('仓库已连接到该项目')
    }

    const [repository] = await this.db
      .insert(schema.repositories)
      .values({
        projectId: data.projectId,
        provider: data.provider,
        fullName: data.fullName,
        cloneUrl: data.cloneUrl,
        defaultBranch: data.defaultBranch || 'main',
      })
      .returning()

    return repository
  }

  // 列出项目的仓库
  async list(userId: string, projectId: string) {
    // 检查用户是否有项目访问权限
    const hasAccess = await this.checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该项目')
    }

    const repositories = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.projectId, projectId))

    return repositories
  }

  // 获取仓库详情
  async get(userId: string, repositoryId: string) {
    const [repository] = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.id, repositoryId))
      .limit(1)

    if (!repository) {
      return null
    }

    // 检查用户是否有项目访问权限
    const hasAccess = await this.checkProjectAccess(userId, repository.projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该仓库')
    }

    return repository
  }

  // 同步仓库元数据
  async sync(userId: string, repositoryId: string) {
    const repository = await this.get(userId, repositoryId)
    if (!repository) {
      throw new Error('仓库不存在')
    }

    // 检查用户是否有权限
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, repository.projectId))
      .limit(1)

    if (!project) {
      throw new Error('项目不存在')
    }

    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限同步仓库')
    }

    // 获取用户的 Git 连接
    const [gitConnection] = await this.db
      .select()
      .from(schema.gitConnections)
      .where(
        and(
          eq(schema.gitConnections.userId, userId),
          eq(schema.gitConnections.provider, repository.provider),
        ),
      )
      .limit(1)

    if (!gitConnection) {
      throw new Error(`未找到 ${repository.provider} Git 连接`)
    }

    try {
      // 调用 GitHub/GitLab API 获取仓库信息
      let repoData: {
        default_branch?: string
        clone_url?: string
        ssh_url?: string
        http_url_to_repo?: string
      } = {}

      if (repository.provider === 'github') {
        const response = await fetch(`https://api.github.com/repos/${repository.fullName}`, {
          headers: {
            Authorization: `Bearer ${gitConnection.accessToken}`,
            Accept: 'application/vnd.github.v3+json',
            'User-Agent': 'AI-DevOps-Platform',
          },
        })

        if (!response.ok) {
          throw new Error(`GitHub API 错误: ${response.status} ${response.statusText}`)
        }

        repoData = (await response.json()) as {
          default_branch?: string
          clone_url?: string
        }
      } else if (repository.provider === 'gitlab') {
        // GitLab API: 需要先获取项目 ID
        const projectPath = encodeURIComponent(repository.fullName)
        const gitlabBase = (
          this.config.get<string>('GITLAB_BASE_URL') || 'https://gitlab.com'
        ).replace(/\/+$/, '')
        const response = await fetch(`${gitlabBase}/api/v4/projects/${projectPath}`, {
          headers: {
            Authorization: `Bearer ${gitConnection.accessToken}`,
            'User-Agent': 'AI-DevOps-Platform',
          },
        })

        if (!response.ok) {
          throw new Error(`GitLab API 错误: ${response.status} ${response.statusText}`)
        }

        repoData = (await response.json()) as {
          default_branch?: string
          http_url_to_repo?: string
        }
      } else {
        throw new Error(`不支持的 provider: ${repository.provider}`)
      }

      // 更新仓库信息
      const [updated] = await this.db
        .update(schema.repositories)
        .set({
          defaultBranch: repoData.default_branch || repository.defaultBranch,
          cloneUrl: repoData.clone_url || repoData.http_url_to_repo || repository.cloneUrl,
          lastSyncAt: new Date(),
          status: 'success',
        })
        .where(eq(schema.repositories.id, repositoryId))
        .returning()

      return updated
    } catch (error) {
      // 同步失败，更新状态
      await this.db
        .update(schema.repositories)
        .set({
          status: 'failed',
          lastSyncAt: new Date(),
        })
        .where(eq(schema.repositories.id, repositoryId))

      throw new Error(`同步仓库失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  // 断开仓库连接
  async disconnect(userId: string, repositoryId: string) {
    const repository = await this.get(userId, repositoryId)
    if (!repository) {
      throw new Error('仓库不存在')
    }

    // 检查用户是否有权限
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, repository.projectId))
      .limit(1)

    if (!project) {
      throw new Error('项目不存在')
    }

    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限断开仓库')
    }

    await this.db.delete(schema.repositories).where(eq(schema.repositories.id, repositoryId))

    return { success: true }
  }

  // ==================== GitOps 相关方法 ====================

  /**
   * 为仓库启用 GitOps
   * 需求: 2.1, 2.2, 2.3, 2.4, 2.5
   */
  async enableGitOps(
    userId: string,
    repositoryId: string,
    config: {
      fluxNamespace?: string
      fluxResourceName?: string
      syncInterval?: string
      secretRef?: string
      timeout?: string
    },
  ) {
    const repository = await this.get(userId, repositoryId)
    if (!repository) {
      throw new Error('仓库不存在')
    }

    // 检查用户是否有权限（需要 maintainer 或更高权限）
    const hasPermission = await this.checkMaintainerPermission(userId, repository.projectId)
    if (!hasPermission) {
      throw new Error('没有权限启用 GitOps，需要 maintainer 或更高权限')
    }

    // 构建 GitOps 配置
    const gitopsConfig = {
      enabled: true,
      fluxNamespace: config.fluxNamespace || 'flux-system',
      fluxResourceName: config.fluxResourceName || `${repository.fullName.replace('/', '-')}-repo`,
      syncInterval: config.syncInterval || '1m',
      secretRef: config.secretRef,
      timeout: config.timeout || '60s',
    }

    // 更新仓库配置
    const [updated] = await this.db
      .update(schema.repositories)
      .set({
        gitopsConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.repositories.id, repositoryId))
      .returning()

    return updated
  }

  /**
   * 禁用仓库的 GitOps
   * 需求: 2.1, 2.2
   */
  async disableGitOps(userId: string, repositoryId: string) {
    const repository = await this.get(userId, repositoryId)
    if (!repository) {
      throw new Error('仓库不存在')
    }

    // 检查用户是否有权限
    const hasPermission = await this.checkMaintainerPermission(userId, repository.projectId)
    if (!hasPermission) {
      throw new Error('没有权限禁用 GitOps，需要 maintainer 或更高权限')
    }

    // 更新配置，将 enabled 设为 false，保留其他配置
    const currentConfig = repository.gitopsConfig
    if (!currentConfig) {
      throw new Error('仓库未启用 GitOps')
    }

    const [updated] = await this.db
      .update(schema.repositories)
      .set({
        gitopsConfig: {
          ...currentConfig,
          enabled: false,
        },
        status: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.repositories.id, repositoryId))
      .returning()

    return updated
  }

  /**
   * 获取仓库的 Flux 同步状态
   * 需求: 2.3, 2.4, 2.5
   */
  async getFluxStatus(userId: string, repositoryId: string) {
    const repository = await this.get(userId, repositoryId)
    if (!repository) {
      throw new Error('仓库不存在')
    }

    // 检查是否启用了 GitOps
    if (!repository.gitopsConfig?.enabled) {
      return {
        enabled: false,
        status: null,
        lastSyncCommit: null,
        lastSyncTime: null,
        errorMessage: null,
      }
    }

    return {
      enabled: true,
      status: repository.status || 'pending',
      lastSyncTime: repository.lastSyncAt,
      config: repository.gitopsConfig,
    }
  }

  /**
   * 更新 Flux 同步状态（由 Flux Watcher 调用）
   * 需求: 2.3, 2.4, 2.5
   */
  async updateFluxStatus(
    repositoryId: string,
    status: {
      status: 'ready' | 'reconciling' | 'failed'
      lastSyncCommit?: string
      errorMessage?: string
    },
  ) {
    const [repository] = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.id, repositoryId))
      .limit(1)

    if (!repository) {
      throw new Error('仓库不存在')
    }

    // 更新同步状态
    const [updated] = await this.db
      .update(schema.repositories)
      .set({
        status: status.status,
        lastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.repositories.id, repositoryId))
      .returning()

    return updated
  }

  /**
   * 通过 Flux 资源名称查找仓库
   * 用于 Flux Watcher 根据 K8s 资源名称更新状态
   */
  async findByFluxResourceName(fluxResourceName: string, fluxNamespace: string) {
    const repositories = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.gitopsConfig, { fluxResourceName, fluxNamespace } as any))

    // 由于 JSONB 查询的限制，我们需要在应用层过滤
    return repositories.find(
      (repo) =>
        repo.gitopsConfig?.fluxResourceName === fluxResourceName &&
        repo.gitopsConfig?.fluxNamespace === fluxNamespace,
    )
  }

  // ==================== 私有辅助方法 ====================

  /**
   * 检查用户是否有 maintainer 或更高权限
   */
  private async checkMaintainerPermission(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    // 检查组织成员角色
    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember && ['owner', 'admin'].includes(orgMember.role)) {
      return true
    }

    // 检查项目成员角色
    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return projectMember ? ['owner', 'maintainer'].includes(projectMember.role) : false
  }

  /**
   * 检查用户是否有项目访问权限
   */
  private async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    // 检查是否是组织成员
    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember) {
      return true
    }

    // 检查是否是项目成员
    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return !!projectMember
  }

  // 获取用户在 Git 平台上的仓库列表
  async listUserRepositories(provider: 'github' | 'gitlab', accessToken: string) {
    return await this.gitProvider.listUserRepositories(provider, accessToken)
  }

  // 从 Git 连接解析访问令牌（解密）
  async resolveOAuthToken(userId: string, provider: 'github' | 'gitlab'): Promise<string> {
    const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
      userId,
      provider,
    )

    if (!gitConnection) {
      const providerName = provider === 'github' ? 'GitHub' : 'GitLab'
      throw new Error(
        `未找到 ${providerName} Git 连接。请前往"设置 > 账户连接"页面连接您的 ${providerName} 账户。`,
      )
    }

    if (!gitConnection.accessToken || gitConnection.status !== 'active') {
      const providerName = provider === 'github' ? 'GitHub' : 'GitLab'
      throw new Error(`${providerName} 访问令牌无效，请重新连接账户`)
    }

    return gitConnection.accessToken
  }

  /**
   * 根据项目 ID 查找仓库
   */
  async findByProjectId(projectId: string): Promise<schema.Repository | null> {
    const [repository] = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.projectId, projectId))
      .limit(1)

    return repository || null
  }
}
