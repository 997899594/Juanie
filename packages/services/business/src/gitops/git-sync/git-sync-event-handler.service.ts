/**
 * Git 同步事件处理器
 *
 * 监听项目成员事件，触发 Git 平台权限同步
 * 使用事件驱动架构解耦 ProjectMembersService 和 GitSyncService
 */

import { DomainEvents } from '@juanie/core/events'
import { Logger } from '@juanie/core/logger'
import type { ProjectRole } from '@juanie/types'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { GitSyncService } from './git-sync.service'

/**
 * 项目成员添加事件
 */
export interface ProjectMemberAddedEvent {
  memberId: string
  role: ProjectRole
}

/**
 * 项目成员更新事件
 */
export interface ProjectMemberUpdatedEvent {
  memberId: string
  role: ProjectRole
  oldRole: ProjectRole
}

/**
 * 项目成员移除事件
 */
export interface ProjectMemberRemovedEvent {
  memberId: string
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
  @OnEvent(DomainEvents.PROJECT_MEMBER_ADDED)
  async handleMemberAdded(event: any): Promise<void> {
    const projectId = event.resourceId
    const userId = event.data.memberId
    this.logger.log(
      `Handling member added event: project=${projectId}, user=${userId}, role=${event.data.role}`,
    )

    try {
      await this.gitSync.syncProjectMember(projectId, userId, event.data.role)
      this.logger.log(`Successfully queued Git sync for member ${userId}`)
    } catch (error) {
      // Git 同步失败不应影响业务流程
      // 错误会被记录到 git_sync_logs 表中
      this.logger.error(`Failed to queue Git sync for member ${userId}:`, error)
    }
  }

  /**
   * 处理成员更新事件
   */
  @OnEvent(DomainEvents.PROJECT_MEMBER_UPDATED)
  async handleMemberUpdated(event: any): Promise<void> {
    const projectId = event.resourceId
    const userId = event.data.memberId

    this.logger.log(
      `Handling member updated event: project=${projectId}, user=${userId}, role=${event.data.role}`,
    )

    try {
      await this.gitSync.syncProjectMember(projectId, userId, event.data.role)
      this.logger.log(`Successfully queued Git permission update for member ${userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue Git permission update for member ${userId}:`, error)
    }
  }

  /**
   * 处理成员移除事件
   */
  @OnEvent(DomainEvents.PROJECT_MEMBER_REMOVED)
  async handleMemberRemoved(event: any): Promise<void> {
    const projectId = event.resourceId
    const userId = event.data.memberId

    this.logger.log(`Handling member removed event: project=${projectId}, user=${userId}`)

    try {
      await this.gitSync.removeMemberAccess(projectId, userId)
      this.logger.log(`Successfully queued Git access removal for member ${userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue Git access removal for member ${userId}:`, error)
    }
  }
}
