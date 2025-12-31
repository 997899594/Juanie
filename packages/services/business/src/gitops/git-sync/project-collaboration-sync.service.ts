/**
 * 项目协作同步服务
 *
 * 负责同步项目协作者到 Git 仓库
 * 适用于个人工作空间的项目级协作
 *
 * Requirements: Personal Workspace Collaboration
 */

import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import {
  GitConnectionsService,
  GitProviderService,
  GitSyncLogsService,
} from '@juanie/service-foundation'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'

export interface ProjectCollaborationSyncResult {
  success: boolean
  syncedCollaborators: number
  errors: Array<{
    userId: string
    error: string
  }>
  skipped?: {
    reason: string
    count: number
  }
}

@Injectable()
export class ProjectCollaborationSyncService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gitProvider: GitProviderService,
    private readonly gitSyncLogs: GitSyncLogsService,
    private readonly gitConnectionsService: GitConnectionsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectCollaborationSyncService.name)
  }

  /**
   * 同步项目协作者到 Git 仓库
   * 适用于个人工作空间的项目级协作
   * Requirements: Personal Workspace Collaboration
   */
  async syncProjectCollaborators(projectId: string): Promise<ProjectCollaborationSyncResult> {
    this.logger.info(`Starting project collaboration sync for: ${projectId}`)

    try {
      // 获取项目信息
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        with: {
          organization: true,
        },
      })

      if (!project) {
        throw new Error(`Project not found: ${projectId}`)
      }

      // 获取项目的 Git 仓库信息
      const repository = await this.db.query.repositories.findFirst({
        where: eq(schema.repositories.projectId, projectId),
      })

      if (!repository) {
        return {
          success: true,
          syncedCollaborators: 0,
          errors: [],
          skipped: {
            reason: 'Project does not have Git repository configured',
            count: 0,
          },
        }
      }

      const gitProvider = repository.provider as 'github' | 'gitlab'
      const gitRepoUrl = repository.cloneUrl

      // 获取项目成员
      const members = await this.db.query.projectMembers.findMany({
        where: eq(schema.projectMembers.projectId, projectId),
        with: {
          user: true,
        },
      })

      if (members.length <= 1) {
        // 只有项目所有者，没有协作者
        return {
          success: true,
          syncedCollaborators: 0,
          errors: [],
          skipped: {
            reason: 'No collaborators found in project',
            count: 0,
          },
        }
      }

      const results: ProjectCollaborationSyncResult = {
        success: true,
        syncedCollaborators: 0,
        errors: [],
      }

      // 获取项目所有者的访问令牌
      const owner = members.find((m) => m.role === 'owner' || m.role === 'maintainer')
      if (!owner) {
        throw new Error('Project owner not found')
      }

      const ownerGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        owner.userId,
        gitProvider,
      )
      if (!ownerGitConnection) {
        throw new Error(`Owner does not have ${gitProvider} account linked`)
      }

      // 解析仓库信息
      const repoInfo = this.parseGitRepoUrl(gitRepoUrl)
      if (!repoInfo) {
        throw new Error(`Invalid Git repository URL: ${gitRepoUrl}`)
      }

      // 同步每个协作者
      for (const member of members) {
        try {
          // 跳过项目所有者
          if (member.role === 'owner' || member.role === 'maintainer') {
            continue
          }

          const memberGitConnection =
            await this.gitConnectionsService.getConnectionWithDecryptedTokens(
              member.userId,
              gitProvider,
            )

          if (!memberGitConnection) {
            results.errors.push({
              userId: member.userId,
              error: `User does not have ${gitProvider} account linked`,
            })

            // 更新同步状态为失败
            await this.db
              .update(schema.projectMembers)
              .set({
                status: 'failed',
                syncError: `User does not have ${gitProvider} account linked`,
                syncedAt: new Date(),
              })
              .where(
                and(
                  eq(schema.projectMembers.projectId, projectId),
                  eq(schema.projectMembers.userId, member.userId),
                ),
              )

            continue
          }

          // 映射角色到 Git 权限
          const gitPermission = this.mapProjectRoleToGitPermission(member.role, gitProvider)

          // 添加协作者到 Git 仓库
          const repoPath = `${repoInfo.owner}/${repoInfo.repo}`

          // 使用统一的 addCollaborator 方法
          if (gitProvider === 'github') {
            await this.gitProvider.addCollaborator(
              gitProvider,
              ownerGitConnection.accessToken,
              repoPath,
              memberGitConnection.username,
              gitPermission as string,
            )
          } else {
            // GitLab 使用用户 ID
            await this.gitProvider.addCollaborator(
              gitProvider,
              ownerGitConnection.accessToken,
              repoPath,
              Number.parseInt(memberGitConnection.providerAccountId!, 10),
              String(gitPermission),
            )
          }

          // 更新同步状态
          await this.db
            .update(schema.projectMembers)
            .set({
              status: 'synced',
              syncedAt: new Date(),
              syncError: null,
            })
            .where(
              and(
                eq(schema.projectMembers.projectId, projectId),
                eq(schema.projectMembers.userId, member.userId),
              ),
            )

          results.syncedCollaborators++
          this.logger.info(
            `Synced collaborator ${member.user.displayName || member.user.email} to ${gitProvider} repository`,
          )

          // ✅ 使用 GitSyncLogsService 记录成功
          await this.gitSyncLogs.create({
            projectId,
            syncType: 'member',
            action: 'add',
            status: 'success',
            gitProvider,
            gitResourceId: memberGitConnection.providerAccountId,
            gitResourceType: 'member',
          })
        } catch (error) {
          this.logger.error(
            `Failed to sync collaborator ${member.user.displayName || member.user.email}:`,
            error,
          )

          // 更新同步状态为失败
          await this.db
            .update(schema.projectMembers)
            .set({
              status: 'failed',
              syncError: error instanceof Error ? error.message : 'Unknown error',
              syncedAt: new Date(),
            })
            .where(
              and(
                eq(schema.projectMembers.projectId, projectId),
                eq(schema.projectMembers.userId, member.userId),
              ),
            )

          results.errors.push({
            userId: member.userId,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          results.success = false

          // ✅ 使用 GitSyncLogsService 记录错误
          await this.gitSyncLogs.create({
            projectId,
            syncType: 'member',
            action: 'add',
            status: 'failed',
            gitProvider,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        }
      }

      this.logger.info(
        `Project collaboration sync completed. Synced: ${results.syncedCollaborators}, Errors: ${results.errors.length}`,
      )

      return results
    } catch (error) {
      this.logger.error(`Project collaboration sync failed for ${projectId}:`, error)

      await this.gitSyncLogs.create({
        projectId,
        syncType: 'project',
        action: 'sync',
        status: 'failed',
        gitProvider: 'github', // 默认
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        success: false,
        syncedCollaborators: 0,
        errors: [
          {
            userId: 'system',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        ],
      }
    }
  }

  /**
   * 添加项目协作者并同步到 Git
   * Requirements: Personal Workspace Collaboration
   */
  async addProjectCollaborator(
    projectId: string,
    userId: string,
    role: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info(`Adding collaborator ${userId} to project ${projectId} with role ${role}`)

    try {
      // 获取项目信息
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
        with: {
          organization: true,
        },
      })

      if (!project) {
        throw new Error(`Project not found: ${projectId}`)
      }

      // 添加到数据库
      await this.db.insert(schema.projectMembers).values({
        projectId,
        userId,
        role,
        status: 'pending',
      })

      // 如果项目有 Git 仓库，同步到 Git
      const repository = await this.db.query.repositories.findFirst({
        where: eq(schema.repositories.projectId, projectId),
      })

      if (repository) {
        const syncResult = await this.syncProjectCollaborators(projectId)
        if (!syncResult.success) {
          this.logger.warn(`Git sync failed for new collaborator, but database record created`)
        }
      }

      this.logger.info(`Successfully added collaborator ${userId} to project ${projectId}`)
      return { success: true }
    } catch (error) {
      this.logger.error(`Failed to add project collaborator:`, error)

      await this.gitSyncLogs.create({
        projectId,
        syncType: 'member',
        action: 'add',
        status: 'failed',
        gitProvider: 'github', // 默认
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 移除项目协作者并从 Git 移除
   * Requirements: Personal Workspace Collaboration
   */
  async removeProjectCollaborator(
    projectId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info(`Removing collaborator ${userId} from project ${projectId}`)

    try {
      // 获取项目信息
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      })

      if (!project) {
        throw new Error(`Project not found: ${projectId}`)
      }

      // 获取协作者信息
      const member = await this.db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
        with: {
          user: true,
        },
      })

      if (!member) {
        throw new Error(`Project member not found`)
      }

      // 从 Git 仓库移除协作者
      const repository = await this.db.query.repositories.findFirst({
        where: eq(schema.repositories.projectId, projectId),
      })

      if (repository) {
        const gitProvider = repository.provider as 'github' | 'gitlab'
        const gitRepoUrl = repository.cloneUrl

        const memberGitConnection =
          await this.gitConnectionsService.getConnectionWithDecryptedTokens(
            member.userId,
            gitProvider,
          )

        if (memberGitConnection) {
          const repoInfo = this.parseGitRepoUrl(gitRepoUrl)
          if (repoInfo) {
            // 获取项目所有者的访问令牌
            const owner = await this.db.query.projectMembers.findFirst({
              where: and(
                eq(schema.projectMembers.projectId, projectId),
                eq(schema.projectMembers.role, 'owner'),
              ),
              with: {
                user: true,
              },
            })

            if (owner) {
              const ownerGitConnection =
                await this.gitConnectionsService.getConnectionWithDecryptedTokens(
                  owner.userId,
                  gitProvider,
                )

              if (ownerGitConnection && repoInfo.owner && repoInfo.repo) {
                const repoPath = `${repoInfo.owner}/${repoInfo.repo}`

                // 使用统一的 removeCollaborator 方法
                if (gitProvider === 'github') {
                  await this.gitProvider.removeCollaborator(
                    gitProvider,
                    ownerGitConnection.accessToken,
                    repoPath,
                    memberGitConnection.username,
                  )
                } else {
                  // GitLab 使用用户 ID
                  await this.gitProvider.removeCollaborator(
                    gitProvider,
                    ownerGitConnection.accessToken,
                    repoPath,
                    Number.parseInt(memberGitConnection.providerAccountId!, 10),
                  )
                }
              }
            }
          }
        }
      }

      // 从数据库移除
      await this.db
        .delete(schema.projectMembers)
        .where(
          and(
            eq(schema.projectMembers.projectId, projectId),
            eq(schema.projectMembers.userId, userId),
          ),
        )

      this.logger.info(`Successfully removed collaborator ${userId} from project ${projectId}`)

      // ✅ 使用 GitSyncLogsService 记录成功（如果有 repository）
      if (repository) {
        const gitProvider = repository.provider as 'github' | 'gitlab'
        await this.gitSyncLogs.create({
          projectId,
          syncType: 'member',
          action: 'remove',
          status: 'success',
          gitProvider,
        })
      }

      return { success: true }
    } catch (error) {
      this.logger.error(`Failed to remove project collaborator:`, error)

      await this.gitSyncLogs.create({
        projectId,
        syncType: 'member',
        action: 'remove',
        status: 'failed',
        gitProvider: 'github', // 默认
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 获取项目协作同步状态
   * Requirements: 监控和状态查询
   */
  async getProjectCollaborationStatus(projectId: string): Promise<{
    enabled: boolean
    collaboratorCount: number
    syncedCollaboratorCount: number
    pendingCollaborators: number
    failedCollaborators: number
    lastSyncAt: Date | null
  }> {
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) {
      throw new Error(`Project not found: ${projectId}`)
    }

    const members = await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.projectId, projectId),
    })

    const collaborators = members.filter((m) => m.role !== 'owner' && m.role !== 'maintainer')
    const syncedCollaborators = collaborators.filter((m) => m.status === 'synced')
    const pendingCollaborators = collaborators.filter((m) => m.status === 'pending')
    const failedCollaborators = collaborators.filter((m) => m.status === 'failed')

    const lastSyncAt =
      collaborators
        .map((m) => m.syncedAt)
        .filter(Boolean)
        .sort((a, b) => b!.getTime() - a!.getTime())[0] || null

    // 检查是否有 Git 仓库
    const repository = await this.db.query.repositories.findFirst({
      where: eq(schema.repositories.projectId, projectId),
    })

    return {
      enabled: !!repository,
      collaboratorCount: collaborators.length,
      syncedCollaboratorCount: syncedCollaborators.length,
      pendingCollaborators: pendingCollaborators.length,
      failedCollaborators: failedCollaborators.length,
      lastSyncAt,
    }
  }

  /**
   * 映射项目角色到 Git 权限
   * Requirements: 4.3, 4.4, 4.5, 4.6
   */
  private mapProjectRoleToGitPermission(
    role: string,
    provider: 'github' | 'gitlab',
  ): string | number {
    if (provider === 'github') {
      // GitHub 仓库权限映射
      const githubPermissionMap: Record<string, 'pull' | 'push' | 'admin'> = {
        maintainer: 'admin',
        developer: 'push',
        contributor: 'push',
        viewer: 'pull',
        reader: 'pull',
      }
      return githubPermissionMap[role.toLowerCase()] || 'push'
    }

    // GitLab 项目权限映射
    const gitlabPermissionMap: Record<string, number> = {
      maintainer: 40, // Maintainer
      developer: 30, // Developer
      contributor: 30, // Developer
      viewer: 20, // Reporter
      reader: 20, // Reporter
    }
    return gitlabPermissionMap[role.toLowerCase()] || 30
  }

  /**
   * 解析 Git 仓库 URL
   * 支持 GitHub 和 GitLab 的各种 URL 格式
   */
  private parseGitRepoUrl(url: string): { owner: string; repo: string } | null {
    try {
      // 移除 .git 后缀
      const cleanUrl = url.replace(/\.git$/, '')

      // 支持的格式:
      // https://github.com/owner/repo
      // https://gitlab.com/owner/repo
      // git@github.com:owner/repo
      // git@gitlab.com:owner/repo
      let match: RegExpMatchArray | null = null

      // HTTPS 格式
      match = cleanUrl.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+)/)
      if (match?.[1] && match[2]) {
        return { owner: match[1], repo: match[2] }
      }

      // SSH 格式
      match = cleanUrl.match(/git@[^:]+:([^/]+)\/(.+)/)
      if (match?.[1] && match[2]) {
        return { owner: match[1], repo: match[2] }
      }

      return null
    } catch (error) {
      this.logger.error(`Failed to parse Git repository URL: ${url}`, error)
      return null
    }
  }
}
