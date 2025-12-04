import { Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import { OnEvent } from '@nestjs/event-emitter'
import { GitSyncService } from './git-sync.service'
import { OrganizationSyncService } from './organization-sync.service'

// 事件类型定义
export interface OrganizationCreatedEvent {
  organizationId: string
  name: string
  gitSyncEnabled: boolean
  gitProvider?: string
  gitOrgName?: string
  createdBy: string
}

export interface OrganizationMemberAddedEvent {
  organizationId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
  addedBy: string
}

export interface OrganizationMemberRemovedEvent {
  organizationId: string
  userId: string
  removedBy: string
}

export interface OrganizationMemberRoleUpdatedEvent {
  organizationId: string
  userId: string
  oldRole: 'owner' | 'admin' | 'member'
  newRole: 'owner' | 'admin' | 'member'
  updatedBy: string
}

@Injectable()
export class OrganizationEventHandler {
  private readonly logger = new Logger(OrganizationEventHandler.name)

  constructor(
    private organizationSyncService: OrganizationSyncService,
    private gitSyncService: GitSyncService,
  ) {}

  @OnEvent('organization.created')
  async handleOrganizationCreated(event: OrganizationCreatedEvent) {
    // 只有启用了 Git 同步的组织才进行同步
    if (!event.gitSyncEnabled || !event.gitProvider || !event.gitOrgName) {
      return
    }

    try {
      // TODO: 实现组织同步功能
      // 异步创建 Git 组织
      // await this.gitSyncService.queueOrganizationSync({
      //   type: 'create_organization',
      //   organizationId: event.organizationId,
      //   gitProvider: event.gitProvider,
      //   gitOrgName: event.gitOrgName,
      //   triggeredBy: event.createdBy,
      // })

      this.logger.log(`Organization sync not yet implemented for: ${event.name}`)
    } catch (error) {
      this.logger.error('Failed to queue organization creation:', error)
    }
  }

  @OnEvent('organization.member.added')
  async handleMemberAdded(event: OrganizationMemberAddedEvent) {
    try {
      // TODO: 实现组织成员同步功能
      // 异步同步成员到 Git 平台
      // await this.gitSyncService.queueMemberSync({
      //   type: 'add_member',
      //   organizationId: event.organizationId,
      //   userId: event.userId,
      //   role: event.role,
      //   triggeredBy: event.addedBy,
      // })

      this.logger.log(`Organization member sync not yet implemented for user: ${event.userId}`)
    } catch (error) {
      this.logger.error('Failed to queue member addition sync:', error)
    }
  }

  @OnEvent('organization.member.removed')
  async handleMemberRemoved(event: OrganizationMemberRemovedEvent) {
    try {
      // TODO: 实现组织成员移除同步功能
      // 异步从 Git 平台移除成员
      // await this.gitSyncService.queueMemberSync({
      //   type: 'remove_member',
      //   organizationId: event.organizationId,
      //   userId: event.userId,
      //   triggeredBy: event.removedBy,
      // })

      this.logger.log(
        `Organization member removal sync not yet implemented for user: ${event.userId}`,
      )
    } catch (error) {
      this.logger.error('Failed to queue member removal sync:', error)
    }
  }

  @OnEvent('organization.member.role.updated')
  async handleMemberRoleUpdated(event: OrganizationMemberRoleUpdatedEvent) {
    try {
      // TODO: 实现组织成员角色更新同步功能
      // 异步更新 Git 平台的成员权限
      // await this.gitSyncService.queueMemberSync({
      //   type: 'update_member_role',
      //   organizationId: event.organizationId,
      //   userId: event.userId,
      //   role: event.newRole,
      //   oldRole: event.oldRole,
      //   triggeredBy: event.updatedBy,
      // })

      this.logger.log(`Queued member role update sync for user: ${event.userId}`)
    } catch (error) {
      this.logger.error('Failed to queue member role update sync:', error)
    }
  }
}
