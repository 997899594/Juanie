import type { Database } from '@juanie/core/database'
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { and, eq } from 'drizzle-orm'
import { GitProviderService } from '../git-providers/git-provider.service'
import { mapProjectRoleToGitPermission } from './permission-mapper'

/**
 * 冲突解决服务
 *
 * 检测和解决 Git 平台与系统之间的权限冲突
 * 以系统权限为准,同步到 Git 平台
 *
 * Requirements: 8.3
 */
@Injectable()
export class ConflictResolutionService {
  private readonly logger = new Logger(ConflictResolutionService.name)

  constructor(
    @Inject(DATABASE) private readonly db: Database,
    private readonly gitProvider: GitProviderService,
  ) {}

  /**
   * 检测项目成员的权限冲突
   *
   * 比较系统中的项目成员权限与 Git 平台上的协作者权限
   * 返回存在冲突的成员列表
   *
   * Requirements: 8.3
   */
  async detectProjectMemberConflicts(
    projectId: string,
    accessToken: string,
  ): Promise<
    Array<{
      userId: string
      userName: string
      gitLogin: string
      systemRole: string
      gitPermission: string
      expectedGitPermission: string
      conflictType: 'permission_mismatch' | 'missing_on_git' | 'extra_on_git'
    }>
  > {
    this.logger.log('Detecting project member conflicts', { projectId })

    try {
      // 获取项目信息
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      })

      if (!project || !project.gitProvider || !project.gitRepoUrl) {
        this.logger.warn('Project not linked to Git repository', { projectId })
        return []
      }

      // 获取系统中的项目成员
      const systemMembers = await this.db.query.projectMembers.findMany({
        where: eq(schema.projectMembers.projectId, projectId),
        with: {
          user: true,
        },
      })

      // 获取成员的 Git 账号
      const membersWithGitAccounts = await Promise.all(
        systemMembers.map(async (member) => {
          const gitAccount = await this.db.query.userGitAccounts.findFirst({
            where: and(
              eq(schema.userGitAccounts.userId, member.userId),
              eq(schema.userGitAccounts.provider, project.gitProvider!),
            ),
          })
          return {
            ...member,
            gitAccount,
          }
        }),
      )

      // 过滤出有 Git 账号的成员
      const membersWithGit = membersWithGitAccounts.filter((m) => m.gitAccount)

      if (membersWithGit.length === 0) {
        this.logger.log('No members with Git accounts found', { projectId })
        return []
      }

      // 获取 Git 平台上的协作者列表
      const gitCollaborators = await this.gitProvider.listCollaborators(
        project.gitProvider,
        project.gitRepoUrl,
        accessToken,
      )

      // 创建 Git 协作者映射 (gitUsername -> permission)
      const gitCollaboratorMap = new Map(
        gitCollaborators.map((c) => [c.username.toLowerCase(), c.permission]),
      )

      // 检测冲突
      const conflicts: Array<{
        userId: string
        userName: string
        gitLogin: string
        systemRole: string
        gitPermission: string
        expectedGitPermission: string
        conflictType: 'permission_mismatch' | 'missing_on_git' | 'extra_on_git'
      }> = []

      for (const member of membersWithGit) {
        const gitUsername = member.gitAccount!.gitUsername.toLowerCase()
        const systemRole = member.role
        const expectedGitPermission = mapProjectRoleToGitPermission(systemRole as any)

        const actualGitPermission = gitCollaboratorMap.get(gitUsername)

        if (!actualGitPermission) {
          // 成员在系统中但不在 Git 平台上
          conflicts.push({
            userId: member.userId,
            userName: member.user.displayName || member.user.email,
            gitLogin: member.gitAccount!.gitUsername,
            systemRole,
            gitPermission: 'none',
            expectedGitPermission,
            conflictType: 'missing_on_git',
          })
        } else if (actualGitPermission !== expectedGitPermission) {
          // 权限不匹配
          conflicts.push({
            userId: member.userId,
            userName: member.user.displayName || member.user.email,
            gitLogin: member.gitAccount!.gitUsername,
            systemRole,
            gitPermission: actualGitPermission,
            expectedGitPermission,
            conflictType: 'permission_mismatch',
          })
        }
      }

      // 检测 Git 平台上多余的协作者
      const systemGitUsernames = new Set(
        membersWithGit.map((m) => m.gitAccount!.gitUsername.toLowerCase()),
      )

      for (const collaborator of gitCollaborators) {
        if (!systemGitUsernames.has(collaborator.username.toLowerCase())) {
          // 协作者在 Git 平台上但不在系统中
          conflicts.push({
            userId: '',
            userName: collaborator.username,
            gitLogin: collaborator.username,
            systemRole: 'none',
            gitPermission: collaborator.permission,
            expectedGitPermission: 'none',
            conflictType: 'extra_on_git',
          })
        }
      }

      this.logger.log('Conflict detection completed', {
        projectId,
        conflictsFound: conflicts.length,
      })

      return conflicts
    } catch (error) {
      this.logger.error('Error detecting conflicts:', error)
      throw error
    }
  }

  /**
   * 解决项目成员的权限冲突
   *
   * 以系统权限为准,同步到 Git 平台
   *
   * Requirements: 8.3
   */
  async resolveProjectMemberConflicts(
    projectId: string,
    accessToken: string,
    options: {
      autoResolve?: boolean // 是否自动解决所有冲突
      conflictTypes?: Array<'permission_mismatch' | 'missing_on_git' | 'extra_on_git'> // 要解决的冲突类型
    } = {},
  ): Promise<{
    resolved: number
    failed: number
    skipped: number
    details: Array<{
      gitLogin: string
      conflictType: string
      action: string
      status: 'success' | 'failed' | 'skipped'
      error?: string
    }>
  }> {
    this.logger.log('Resolving project member conflicts', { projectId, options })

    const { autoResolve = true, conflictTypes = ['permission_mismatch', 'missing_on_git'] } =
      options

    try {
      // 检测冲突
      const conflicts = await this.detectProjectMemberConflicts(projectId, accessToken)

      if (conflicts.length === 0) {
        this.logger.log('No conflicts found', { projectId })
        return {
          resolved: 0,
          failed: 0,
          skipped: 0,
          details: [],
        }
      }

      // 获取项目信息
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      })

      if (!project || !project.gitProvider || !project.gitRepoUrl) {
        throw new Error('Project not linked to Git repository')
      }

      // 过滤要解决的冲突
      const conflictsToResolve = conflicts.filter((c) => conflictTypes.includes(c.conflictType))

      let resolved = 0
      let failed = 0
      let skipped = 0
      const details: Array<{
        gitLogin: string
        conflictType: string
        action: string
        status: 'success' | 'failed' | 'skipped'
        error?: string
      }> = []

      for (const conflict of conflictsToResolve) {
        try {
          let action = ''
          let status: 'success' | 'failed' | 'skipped' = 'skipped'

          if (!autoResolve) {
            // 不自动解决,只记录
            skipped++
            details.push({
              gitLogin: conflict.gitLogin,
              conflictType: conflict.conflictType,
              action: 'none',
              status: 'skipped',
            })
            continue
          }

          // 根据冲突类型执行相应操作
          switch (conflict.conflictType) {
            case 'missing_on_git':
              // 添加协作者到 Git 平台
              action = 'add_collaborator'
              await this.gitProvider.addCollaborator(
                project.gitProvider,
                project.gitRepoUrl,
                accessToken,
                conflict.gitLogin,
                conflict.expectedGitPermission,
              )
              status = 'success'
              resolved++
              break

            case 'permission_mismatch':
              // 更新协作者权限
              action = 'update_permission'
              await this.gitProvider.updateCollaboratorPermission(
                project.gitProvider,
                project.gitRepoUrl,
                accessToken,
                conflict.gitLogin,
                conflict.expectedGitPermission,
              )
              status = 'success'
              resolved++
              break

            case 'extra_on_git':
              // 从 Git 平台移除协作者
              // 注意: 这个操作比较危险,默认跳过
              action = 'remove_collaborator'
              status = 'skipped'
              skipped++
              this.logger.warn('Skipping removal of extra collaborator', {
                gitLogin: conflict.gitLogin,
                reason: 'potentially_dangerous',
              })
              break
          }

          details.push({
            gitLogin: conflict.gitLogin,
            conflictType: conflict.conflictType,
            action,
            status,
          })

          // 记录冲突解决日志
          await this.db.insert(schema.gitSyncLogs).values({
            gitResourceType: 'repository',
            gitResourceId: projectId,
            action: 'sync',
            syncType: 'member',
            provider: project.gitProvider!,
            status: status === 'success' ? 'success' : 'failed',
            metadata: {
              conflictType: conflict.conflictType,
              action,
              systemRole: conflict.systemRole,
              gitPermission: conflict.gitPermission,
              expectedGitPermission: conflict.expectedGitPermission,
              gitLogin: conflict.gitLogin,
            } as any,
            completedAt: new Date(),
          })
        } catch (error) {
          failed++
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'

          details.push({
            gitLogin: conflict.gitLogin,
            conflictType: conflict.conflictType,
            action: 'failed',
            status: 'failed',
            error: errorMessage,
          })

          // 记录错误日志
          await this.db.insert(schema.gitSyncLogs).values({
            gitResourceType: 'repository',
            gitResourceId: projectId,
            action: 'sync',
            syncType: 'member',
            provider: project.gitProvider!,
            status: 'failed',
            error: errorMessage,
            metadata: {
              gitLogin: conflict.gitLogin,
              conflictType: conflict.conflictType,
            } as any,
            completedAt: new Date(),
          })

          this.logger.error('Error resolving conflict:', {
            gitLogin: conflict.gitLogin,
            error: errorMessage,
          })
        }
      }

      this.logger.log('Conflict resolution completed', {
        projectId,
        resolved,
        failed,
        skipped,
      })

      return {
        resolved,
        failed,
        skipped,
        details,
      }
    } catch (error) {
      this.logger.error('Error resolving conflicts:', error)
      throw error
    }
  }

  /**
   * 获取项目的冲突历史
   *
   * 查询项目的冲突解决日志
   */
  async getConflictHistory(
    projectId: string,
    options: {
      limit?: number
      offset?: number
    } = {},
  ): Promise<
    Array<{
      id: string
      syncType: string
      status: string
      details: any
      error: string | null
      syncedAt: Date
    }>
  > {
    const { limit = 50, offset = 0 } = options

    try {
      const logs = await this.db.query.gitSyncLogs.findMany({
        where: and(
          eq(schema.gitSyncLogs.gitResourceType, 'repository'),
          eq(schema.gitSyncLogs.gitResourceId, projectId),
          eq(schema.gitSyncLogs.action, 'sync'),
        ),
        orderBy: (logs, { desc }) => [desc(logs.completedAt)],
        limit,
        offset,
      })

      return logs as any
    } catch (error) {
      this.logger.error('Error getting conflict history:', error)
      throw error
    }
  }

  /**
   * 获取冲突统计信息
   *
   * 统计项目的冲突数量和类型
   */
  async getConflictStats(
    projectId: string,
    accessToken: string,
  ): Promise<{
    total: number
    byType: {
      permission_mismatch: number
      missing_on_git: number
      extra_on_git: number
    }
    lastChecked: Date | null
  }> {
    try {
      const conflicts = await this.detectProjectMemberConflicts(projectId, accessToken)

      const stats = {
        total: conflicts.length,
        byType: {
          permission_mismatch: 0,
          missing_on_git: 0,
          extra_on_git: 0,
        },
        lastChecked: new Date(),
      }

      for (const conflict of conflicts) {
        stats.byType[conflict.conflictType]++
      }

      return stats
    } catch (error) {
      this.logger.error('Error getting conflict stats:', error)
      throw error
    }
  }
}
