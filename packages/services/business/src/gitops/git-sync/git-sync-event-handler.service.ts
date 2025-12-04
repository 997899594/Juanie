/**
 * Git 同步事件处理器
 *
 * 监听项目成员事件，触发 Git 平台权限同步
 * 使用事件驱动架构解耦 ProjectMembersService 和 GitSyncService
 */

import type { ProjectRole } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { OnEvent } from '@nestjs/event-emitter'
import { GitSyncService } from './git-sync.service'

/**
 * 项目成员添加事件
 */
export interface ProjectMemberAddedEvent {
  projectId: string
  userId: string
  role: ProjectRole
}

/**
 * 项目成员更新事件
 */
export interface ProjectMemberUpdatedEvent {
  projectId: string
  userId: string
  role: ProjectRole
  oldRole: ProjectRole
}

/**
 * 项目成员移除事件
 */
export interface ProjectMemberRemovedEvent {
  projectId: string
  userId: string
}

/**
 * Git 同步事件处理器
 *
 * 监听项目成员变更事件，自动触发 Git 平台权限同步
 */
@Injectable()
export class GitSyncEventHandler {
  private readonly logger = new Logger(GitSyncEventHandler.name)

  constructor(private readonly gitSync: GitSyncService) {}

  /**
   * 处理成员添加事件
   */
  @OnEvent('project.member.added')
  async handleMemberAdded(event: ProjectMemberAddedEvent): Promise<void> {
    this.logger.log(
      `Handling member added event: project=${event.projectId}, user=${event.userId}, role=${event.role}`,
    )

    try {
      await this.gitSync.syncProjectMember(event.projectId, event.userId, event.role)
      this.logger.log(`Successfully queued Git sync for member ${event.userId}`)
    } catch (error) {
      // Git 同步失败不应影响业务流程
      // 错误会被记录到 git_sync_logs 表中
      this.logger.error(`Failed to queue Git sync for member ${event.userId}:`, error)
    }
  }

  /**
   * 处理成员更新事件
   */
  @OnEvent('project.member.updated')
  async handleMemberUpdated(event: ProjectMemberUpdatedEvent): Promise<void> {
    this.logger.log(
      `Handling member updated event: project=${event.projectId}, user=${event.userId}, role=${event.role}`,
    )

    try {
      await this.gitSync.syncProjectMember(event.projectId, event.userId, event.role)
      this.logger.log(`Successfully queued Git permission update for member ${event.userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue Git permission update for member ${event.userId}:`, error)
    }
  }

  /**
   * 处理成员移除事件
   */
  @OnEvent('project.member.removed')
  async handleMemberRemoved(event: ProjectMemberRemovedEvent): Promise<void> {
    this.logger.log(
      `Handling member removed event: project=${event.projectId}, user=${event.userId}`,
    )

    try {
      await this.gitSync.removeMemberAccess(event.projectId, event.userId)
      this.logger.log(`Successfully queued Git access removal for member ${event.userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue Git access removal for member ${event.userId}:`, error)
    }
  }
}
