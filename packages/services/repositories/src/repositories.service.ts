import * as schema from '@juanie/core-database/schemas'
import { DATABASE } from '@juanie/core-tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class RepositoriesService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 连接仓库
  async connect(
    userId: string,
    data: {
      projectId: string
      provider: 'github' | 'gitlab'
      fullName: string
      cloneUrl: string
      defaultBranch?: string
    },
  ) {
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

    // 获取用户的 OAuth token
    const [oauthAccount] = await this.db
      .select()
      .from(schema.oauthAccounts)
      .where(
        and(
          eq(schema.oauthAccounts.userId, userId),
          eq(schema.oauthAccounts.provider, repository.provider),
        ),
      )
      .limit(1)

    if (!oauthAccount) {
      throw new Error(`未找到 ${repository.provider} OAuth 授权`)
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
            Authorization: `Bearer ${oauthAccount.accessToken}`,
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
        const response = await fetch(`https://gitlab.com/api/v4/projects/${projectPath}`, {
          headers: {
            Authorization: `Bearer ${oauthAccount.accessToken}`,
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
          syncStatus: 'success',
        })
        .where(eq(schema.repositories.id, repositoryId))
        .returning()

      return updated
    } catch (error) {
      // 同步失败，更新状态
      await this.db
        .update(schema.repositories)
        .set({
          syncStatus: 'failed',
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

  // 检查用户是否有项目访问权限
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
}
