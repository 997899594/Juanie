import type { Database } from '@juanie/core/database'
import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { ProjectMembersService } from '../../projects/project-members.service'
import { ProjectsService } from '../../projects/projects.service'

/**
 * Git 平台变更同步服务
 *
 * 处理来自 Git 平台的变更事件,并同步到系统中
 *
 * Requirements: 8.2, 8.3, 8.4
 */
@Injectable()
export class GitPlatformSyncService {

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly projectMembersService: ProjectMembersService,
    readonly _projectsService: ProjectsService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(GitPlatformSyncService.name)}

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
      // 查找关联的项目
      const projects = await this.db.query.projects.findMany({
        where: and(
          eq(schema.projects.gitProvider, event.provider),
          eq(schema.projects.gitRepoUrl, event.repository.gitId),
        ),
      })

      if (projects.length === 0) {
        this.logger.warn('No projects found for deleted repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      // 更新所有关联的项目
      for (const project of projects) {
        this.logger.info('Marking project as Git disconnected', {
          projectId: project.id,
          projectName: project.name,
        })

        // 清除 Git 相关信息
        await this.db
          .update(schema.projects)
          .set({
            gitRepoUrl: null,
            gitRepoName: null,
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, project.id))

        // 记录同步日志
        await this.db.insert(schema.gitSyncLogs).values({
          syncType: 'project',
          action: 'delete',
          projectId: project.id,
          provider: event.provider,
          status: 'success',
          gitResourceId: event.repository.gitId,
          gitResourceUrl: event.repository.fullName,
          gitResourceType: 'repository',
          metadata: {
            repositoryId: event.repository.gitId,
            repositoryName: event.repository.fullName,
            action: 'disconnected',
          },
          completedAt: new Date(),
        })
      }

      this.logger.info('Successfully handled repository deleted event', {
        projectsAffected: projects.length,
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
      const project = await this.db.query.projects.findFirst({
        where: and(
          eq(schema.projects.gitProvider, event.provider),
          eq(schema.projects.gitRepoUrl, event.repository.gitId),
        ),
      })

      if (!project) {
        this.logger.warn('No project found for repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      // 查找关联的用户
      const gitAccount = await this.db.query.userGitAccounts.findFirst({
        where: and(
          eq(schema.userGitAccounts.provider, event.provider),
          eq(schema.userGitAccounts.gitUserId, event.collaborator.gitId),
        ),
      })

      if (!gitAccount) {
        this.logger.warn('No user found for Git collaborator', {
          gitLogin: event.collaborator.gitLogin,
          gitId: event.collaborator.gitId,
        })

        // 记录日志 - 用户未关联
        await this.db.insert(schema.gitSyncLogs).values({
          syncType: 'member',
          action: 'add',
          projectId: project.id,
          provider: event.provider,
          status: 'failed',
          error: 'User not linked to Git account',
          errorType: 'not_found',
          gitResourceId: event.collaborator.gitId,
          gitResourceType: 'user',
          metadata: {
            reason: 'user_not_linked',
            gitLogin: event.collaborator.gitLogin,
            gitId: event.collaborator.gitId,
          },
          completedAt: new Date(),
        })
        return
      }

      // 检查用户是否已经是项目成员
      const existingMember = await this.db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, project.id),
          eq(schema.projectMembers.userId, gitAccount.userId),
        ),
      })

      if (existingMember) {
        this.logger.info('User is already a project member', {
          userId: gitAccount.userId,
          projectId: project.id,
        })
        return
      }

      // 映射 Git 权限到项目角色
      const role = this.mapGitPermissionToProjectRole(event.collaborator.permission)

      // 添加为项目成员
      // 使用系统用户 ID 作为操作者（webhook 触发）
      await this.projectMembersService.addMember('system', project.id, {
        userId: gitAccount.userId,
        role,
      })

      this.logger.info('Successfully added collaborator as project member', {
        userId: gitAccount.userId,
        projectId: project.id,
        role,
      })

      // 记录同步日志
      await this.db.insert(schema.gitSyncLogs).values({
        syncType: 'member',
        action: 'add',
        projectId: project.id,
        userId: gitAccount.userId,
        provider: event.provider,
        status: 'success',
        gitResourceId: event.collaborator.gitId,
        gitResourceType: 'member',
        metadata: {
          gitLogin: event.collaborator.gitLogin,
          gitPermission: event.collaborator.permission,
          systemRole: role,
        },
        completedAt: new Date(),
      })
    } catch (error) {
      this.logger.error('Error handling collaborator added event:', error)

      // 记录错误日志
      await this.db.insert(schema.gitSyncLogs).values({
        syncType: 'member',
        action: 'add',
        provider: event.provider,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
        gitResourceId: event.repository.gitId,
        gitResourceType: 'repository',
        metadata: {
          gitLogin: event.collaborator.gitLogin,
        },
        completedAt: new Date(),
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
      const project = await this.db.query.projects.findFirst({
        where: and(
          eq(schema.projects.gitProvider, event.provider),
          eq(schema.projects.gitRepoUrl, event.repository.gitId),
        ),
      })

      if (!project) {
        this.logger.warn('No project found for repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      // 查找关联的用户
      const gitAccount = await this.db.query.userGitAccounts.findFirst({
        where: and(
          eq(schema.userGitAccounts.provider, event.provider),
          eq(schema.userGitAccounts.gitUserId, event.collaborator.gitId),
        ),
      })

      if (!gitAccount) {
        this.logger.warn('No user found for Git collaborator', {
          gitLogin: event.collaborator.gitLogin,
        })
        return
      }

      // 从项目成员中移除
      // 使用系统用户 ID 作为操作者（webhook 触发）
      await this.projectMembersService.removeMember('system', project.id, {
        userId: gitAccount.userId,
      })

      this.logger.info('Successfully removed collaborator from project', {
        userId: gitAccount.userId,
        projectId: project.id,
      })

      // 记录同步日志
      await this.db.insert(schema.gitSyncLogs).values({
        syncType: 'member',
        action: 'remove',
        projectId: project.id,
        userId: gitAccount.userId,
        provider: event.provider,
        status: 'success',
        gitResourceId: event.collaborator.gitId,
        gitResourceType: 'member',
        metadata: {
          gitLogin: event.collaborator.gitLogin,
        },
        completedAt: new Date(),
      })
    } catch (error) {
      this.logger.error('Error handling collaborator removed event:', error)

      // 记录错误日志
      await this.db.insert(schema.gitSyncLogs).values({
        syncType: 'member',
        action: 'remove',
        provider: event.provider,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
        gitResourceId: event.repository.gitId,
        gitResourceType: 'repository',
        metadata: {
          gitLogin: event.collaborator.gitLogin,
        },
        completedAt: new Date(),
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
      // 查找关联的项目
      const projects = await this.db.query.projects.findMany({
        where: and(
          eq(schema.projects.gitProvider, event.provider),
          eq(schema.projects.gitRepoUrl, event.repository.gitId),
        ),
      })

      if (projects.length === 0) {
        this.logger.warn('No projects found for repository', {
          repositoryId: event.repository.gitId,
        })
        return
      }

      // 更新所有关联的项目
      for (const project of projects) {
        const updates: any = {
          updatedAt: new Date(),
        }

        // 如果仓库名称变更,更新项目的 Git 仓库信息
        if (event.changes.name) {
          updates.gitRepoName = event.repository.name
          updates.gitRepoUrl = event.repository.url
        }

        // 如果默认分支变更,更新项目配置
        if (event.changes.defaultBranch) {
          // TODO: 更新项目的默认分支配置
          this.logger.info('Default branch changed', {
            projectId: project.id,
            from: event.changes.defaultBranch.from,
            to: event.changes.defaultBranch.to,
          })
        }

        // 如果可见性变更,记录日志
        if (event.changes.visibility) {
          this.logger.info('Repository visibility changed', {
            projectId: project.id,
            from: event.changes.visibility.from,
            to: event.changes.visibility.to,
          })
        }

        // 更新项目
        if (Object.keys(updates).length > 1) {
          await this.db
            .update(schema.projects)
            .set(updates)
            .where(eq(schema.projects.id, project.id))
        }

        // 记录同步日志
        await this.db.insert(schema.gitSyncLogs).values({
          syncType: 'project',
          action: 'update',
          projectId: project.id,
          provider: event.provider,
          status: 'success',
          gitResourceId: event.repository.gitId,
          gitResourceUrl: event.repository.fullName,
          gitResourceType: 'repository',
          metadata: {
            repositoryId: event.repository.gitId,
            repositoryName: event.repository.fullName,
            changes: event.changes,
          },
          completedAt: new Date(),
        })
      }

      this.logger.info('Successfully handled repository updated event', {
        projectsAffected: projects.length,
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
}
