import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { GitSyncLogsService } from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'
import { ProjectMembersService } from '../../projects/members/project-members.service'

/**
 * Git 平台变更同步服务
 *
 * 处理来自 Git 平台的变更事件,并同步到系统中
 *
 * Requirements: 8.2, 8.3, 8.4
 *
 * ⚠️ 架构说明:
 * 本服务保留了部分数据库访问用于简单的关联查询:
 * - repositories 表: 通过 Git 仓库信息查找项目 (一对一关联)
 * - gitConnections 表: 通过 Git 账号 ID 查找用户 (一对一关联)
 * - projectMembers 表: 检查用户是否已是项目成员 (简单查询)
 *
 * 这些是简单的关联查询,不包含业务逻辑,不需要通过 Service 层增加复杂度。
 * 所有的日志记录都通过 GitSyncLogsService (Foundation 层) 完成。
 */
@Injectable()
export class GitPlatformSyncService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly projectMembersService: ProjectMembersService,
    private readonly gitSyncLogs: GitSyncLogsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitPlatformSyncService.name)
  }

  /**
   * 处理仓库删除事件
   *
   * 当 Git 平台上的仓库被删除时:
   * 1. 查找关联的项目
   * 2. 标记项目为已删除或断开 Git 连接
   * 3. 记录日志
   *
   * Requirements: 8.2
   */
  async handleRepositoryDeleted(event: {
    provider: 'github' | 'gitlab'
    repository: {
      gitId: string
      name: string
      fullName: string
    }
    timestamp: Date
  }): Promise<void> {
    this.logger.info('Handling repository deleted event', {
      provider: event.provider,
      repositoryId: event.repository.gitId,
      repositoryName: event.repository.fullName,
    })

    try {
      // 查找关联的仓库
      const repositories = await this.db.query.repositories.findMany({
        where: and(
          eq(schema.repositories.provider, event.provider),
          eq(schema.repositories.fullName, event.repository.fullName),
        ),
      })

      if (repositories.length === 0) {
        this.logger.warn('No repositories found for deleted repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      // 更新所有关联的仓库和项目
      for (const repository of repositories) {
        const project = await this.db.query.projects.findFirst({
          where: eq(schema.projects.id, repository.projectId),
        })

        if (!project) continue

        this.logger.info('Marking project as Git disconnected', {
          projectId: project.id,
          projectName: project.name,
        })

        // 删除仓库记录
        await this.db.delete(schema.repositories).where(eq(schema.repositories.id, repository.id))

        // ✅ 使用 GitSyncLogsService 记录同步日志
        await this.gitSyncLogs.create({
          projectId: project.id,
          syncType: 'project',
          action: 'delete',
          status: 'success',
          gitProvider: event.provider,
          gitResourceId: event.repository.gitId,
          gitResourceType: 'repository',
          metadata: {
            repositoryId: event.repository.gitId,
            repositoryName: event.repository.fullName,
            action: 'disconnected',
          },
        })
      }

      this.logger.info('Successfully handled repository deleted event', {
        projectsAffected: repositories.length,
      })
    } catch (error) {
      this.logger.error('Error handling repository deleted event:', error)
      throw error
    }
  }

  /**
   * 处理协作者添加事件
   *
   * 当 Git 平台上添加协作者时:
   * 1. 查找对应的用户和项目
   * 2. 如果用户已关联 Git 账号,自动添加为项目成员
   * 3. 记录日志
   *
   * Requirements: 8.3
   */
  async handleCollaboratorAdded(event: {
    provider: 'github' | 'gitlab'
    repository: {
      gitId: string
      name: string
      fullName: string
    }
    collaborator: {
      gitId: string
      gitLogin: string
      gitName?: string
      permission: string
    }
    timestamp: Date
  }): Promise<void> {
    this.logger.info('Handling collaborator added event', {
      provider: event.provider,
      repositoryId: event.repository.gitId,
      collaboratorLogin: event.collaborator.gitLogin,
      permission: event.collaborator.permission,
    })

    try {
      // 查找关联的项目
      const result = await this.findProjectByRepository(event.provider, event.repository.fullName)

      if (!result) {
        this.logger.warn('No project found for repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      const { project } = result

      // 查找关联的用户
      const gitConnection = await this.db.query.gitConnections.findFirst({
        where: and(
          eq(schema.gitConnections.provider, event.provider),
          eq(schema.gitConnections.providerAccountId, event.collaborator.gitId),
        ),
      })

      if (!gitConnection) {
        this.logger.warn('No user found for Git collaborator', {
          gitLogin: event.collaborator.gitLogin,
          gitId: event.collaborator.gitId,
        })

        // ✅ 使用 GitSyncLogsService 记录日志 - 用户未关联
        await this.gitSyncLogs.create({
          projectId: project.id,
          syncType: 'member',
          action: 'add',
          status: 'failed',
          gitProvider: event.provider,
          gitResourceId: event.collaborator.gitId,
          gitResourceType: 'user',
          error: 'User not linked to Git account',
          metadata: {
            reason: 'user_not_linked',
            gitLogin: event.collaborator.gitLogin,
            gitId: event.collaborator.gitId,
          },
        })
        return
      }

      // 检查用户是否已经是项目成员
      const existingMember = await this.db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, project.id),
          eq(schema.projectMembers.userId, gitConnection.userId),
        ),
      })

      if (existingMember) {
        this.logger.info('User is already a project member', {
          userId: gitConnection.userId,
          projectId: project.id,
        })
        return
      }

      // 映射 Git 权限到项目角色
      const role = this.mapGitPermissionToProjectRole(event.collaborator.permission)

      // 添加为项目成员
      // 使用系统用户 ID 作为操作者（webhook 触发）
      await this.projectMembersService.addMember('system', project.id, {
        userId: gitConnection.userId,
        role,
      })

      this.logger.info('Successfully added collaborator as project member', {
        userId: gitConnection.userId,
        projectId: project.id,
        role,
      })

      // ✅ 使用 GitSyncLogsService 记录同步日志
      await this.gitSyncLogs.create({
        projectId: project.id,
        syncType: 'member',
        action: 'add',
        status: 'success',
        gitProvider: event.provider,
        gitResourceId: event.collaborator.gitId,
        gitResourceType: 'member',
        metadata: {
          userId: gitConnection.userId,
          gitLogin: event.collaborator.gitLogin,
          gitPermission: event.collaborator.permission,
          systemRole: role,
        },
      })
    } catch (error) {
      this.logger.error('Error handling collaborator added event:', error)

      // ✅ 使用 GitSyncLogsService 记录错误日志
      // 注意: 这里没有 projectId,因为可能在查找项目时就失败了
      // 我们需要尝试获取 projectId,如果没有就记录为 null
      let projectId: string | undefined
      try {
        const result = await this.findProjectByRepository(event.provider, event.repository.fullName)
        projectId = result?.project.id
      } catch {
        // 忽略错误,继续记录日志
      }

      await this.gitSyncLogs.create({
        projectId: projectId || 'unknown',
        syncType: 'member',
        action: 'add',
        status: 'failed',
        gitProvider: event.provider,
        gitResourceId: event.repository.gitId,
        gitResourceType: 'repository',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          gitLogin: event.collaborator.gitLogin,
        },
      })

      throw error
    }
  }

  /**
   * 处理协作者移除事件
   *
   * 当 Git 平台上移除协作者时:
   * 1. 查找对应的用户和项目
   * 2. 从项目成员中移除
   * 3. 记录日志
   *
   * Requirements: 8.3
   */
  async handleCollaboratorRemoved(event: {
    provider: 'github' | 'gitlab'
    repository: {
      gitId: string
      name: string
      fullName: string
    }
    collaborator: {
      gitId: string
      gitLogin: string
    }
    timestamp: Date
  }): Promise<void> {
    this.logger.info('Handling collaborator removed event', {
      provider: event.provider,
      repositoryId: event.repository.gitId,
      collaboratorLogin: event.collaborator.gitLogin,
    })

    try {
      // 查找关联的项目
      const result = await this.findProjectByRepository(event.provider, event.repository.fullName)

      if (!result) {
        this.logger.warn('No project found for repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      const { project } = result

      // 查找关联的用户
      const gitConnection = await this.db.query.gitConnections.findFirst({
        where: and(
          eq(schema.gitConnections.provider, event.provider),
          eq(schema.gitConnections.providerAccountId, event.collaborator.gitId),
        ),
      })

      if (!gitConnection) {
        this.logger.warn('No user found for Git collaborator', {
          gitLogin: event.collaborator.gitLogin,
        })
        return
      }

      // 从项目成员中移除
      // 使用系统用户 ID 作为操作者（webhook 触发）
      await this.projectMembersService.removeMember('system', project.id, {
        userId: gitConnection.userId,
      })

      this.logger.info('Successfully removed collaborator from project', {
        userId: gitConnection.userId,
        projectId: project.id,
      })

      // ✅ 使用 GitSyncLogsService 记录同步日志
      await this.gitSyncLogs.create({
        projectId: project.id,
        syncType: 'member',
        action: 'remove',
        status: 'success',
        gitProvider: event.provider,
        gitResourceId: event.collaborator.gitId,
        gitResourceType: 'member',
        metadata: {
          userId: gitConnection.userId,
          gitLogin: event.collaborator.gitLogin,
        },
      })
    } catch (error) {
      this.logger.error('Error handling collaborator removed event:', error)

      // ✅ 使用 GitSyncLogsService 记录错误日志
      let projectId: string | undefined
      try {
        const result = await this.findProjectByRepository(event.provider, event.repository.fullName)
        projectId = result?.project.id
      } catch {
        // 忽略错误,继续记录日志
      }

      await this.gitSyncLogs.create({
        projectId: projectId || 'unknown',
        syncType: 'member',
        action: 'remove',
        status: 'failed',
        gitProvider: event.provider,
        gitResourceId: event.repository.gitId,
        gitResourceType: 'repository',
        error: error instanceof Error ? error.message : 'Unknown error',
        metadata: {
          gitLogin: event.collaborator.gitLogin,
        },
      })

      throw error
    }
  }

  /**
   * 处理仓库设置变更事件
   *
   * 当 Git 平台上的仓库设置变更时:
   * 1. 查找关联的项目
   * 2. 更新项目的 Git 相关信息
   * 3. 记录日志
   *
   * Requirements: 8.4
   */
  async handleRepositoryUpdated(event: {
    provider: 'github' | 'gitlab'
    repository: {
      gitId: string
      name: string
      fullName: string
      url: string
      defaultBranch?: string
      visibility?: 'public' | 'private' | 'internal'
    }
    changes: {
      name?: { from: string; to: string }
      visibility?: { from: string; to: string }
      defaultBranch?: { from: string; to: string }
    }
    timestamp: Date
  }): Promise<void> {
    this.logger.info('Handling repository updated event', {
      provider: event.provider,
      repositoryId: event.repository.gitId,
      changes: Object.keys(event.changes),
    })

    try {
      // 查找关联的项目和仓库
      const results = await this.findProjectsByRepository(event.provider, event.repository.fullName)

      if (results.length === 0) {
        this.logger.warn('No projects found for repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      // 更新所有关联的仓库
      for (const { project, repository } of results) {
        const updates: any = {
          updatedAt: new Date(),
        }

        // 如果仓库名称变更,更新仓库信息
        if (event.changes.name) {
          updates.fullName = event.repository.fullName
          updates.cloneUrl = event.repository.url
        }

        // 如果默认分支变更,更新仓库配置
        if (event.changes.defaultBranch) {
          updates.defaultBranch = event.changes.defaultBranch.to
          this.logger.info('Default branch changed', {
            projectId: project.id,
            repositoryId: repository.id,
            from: event.changes.defaultBranch.from,
            to: event.changes.defaultBranch.to,
          })
        }

        // 如果可见性变更,记录日志
        if (event.changes.visibility) {
          this.logger.info('Repository visibility changed', {
            projectId: project.id,
            repositoryId: repository.id,
            from: event.changes.visibility.from,
            to: event.changes.visibility.to,
          })
        }

        // 更新仓库
        if (Object.keys(updates).length > 1) {
          await this.db
            .update(schema.repositories)
            .set(updates)
            .where(eq(schema.repositories.id, repository.id))
        }

        // ✅ 使用 GitSyncLogsService 记录同步日志
        await this.gitSyncLogs.create({
          projectId: project.id,
          syncType: 'project',
          action: 'update',
          status: 'success',
          gitProvider: event.provider,
          gitResourceId: event.repository.gitId,
          gitResourceType: 'repository',
          metadata: {
            repositoryId: event.repository.gitId,
            repositoryName: event.repository.fullName,
            changes: event.changes,
          },
        })
      }

      this.logger.info('Successfully handled repository updated event', {
        projectsAffected: results.length,
      })
    } catch (error) {
      this.logger.error('Error handling repository updated event:', error)
      throw error
    }
  }

  /**
   * 映射 Git 权限到项目角色
   */
  private mapGitPermissionToProjectRole(
    gitPermission: string,
  ): 'owner' | 'admin' | 'member' | 'viewer' {
    const permission = gitPermission.toLowerCase()

    // GitHub 权限映射
    if (permission === 'admin') return 'admin'
    if (permission === 'write' || permission === 'push') return 'member'
    if (permission === 'read' || permission === 'pull') return 'viewer'

    // GitLab 权限映射
    if (permission === 'owner' || permission === 'maintainer') return 'admin'
    if (permission === 'developer') return 'member'
    if (permission === 'reporter' || permission === 'guest') return 'viewer'

    // 默认为 viewer
    return 'viewer'
  }

  /**
   * 通过 Git 仓库信息查找项目
   * @private
   */
  private async findProjectByRepository(
    provider: 'github' | 'gitlab',
    repositoryFullName: string,
  ): Promise<{ project: any; repository: any } | null> {
    const repository = await this.db.query.repositories.findFirst({
      where: and(
        eq(schema.repositories.provider, provider),
        eq(schema.repositories.fullName, repositoryFullName),
      ),
    })

    if (!repository) {
      return null
    }

    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, repository.projectId),
    })

    if (!project) {
      return null
    }

    return { project, repository }
  }

  /**
   * 通过 Git 仓库信息查找所有关联的项目
   * @private
   */
  private async findProjectsByRepository(
    provider: 'github' | 'gitlab',
    repositoryFullName: string,
  ): Promise<Array<{ project: any; repository: any }>> {
    const repositories = await this.db.query.repositories.findMany({
      where: and(
        eq(schema.repositories.provider, provider),
        eq(schema.repositories.fullName, repositoryFullName),
      ),
    })

    const results = []
    for (const repository of repositories) {
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, repository.projectId),
      })

      if (project) {
        results.push({ project, repository })
      }
    }

    return results
  }
}
