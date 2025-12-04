import { DomainEvents } from '@juanie/core/events'
import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { GitSyncService } from './git-sync.service'
import { OrganizationSyncService } from './organization-sync.service'

@Injectable()
export class OrganizationEventHandler {
  private readonly logger = new Logger(OrganizationEventHandler.name)

  constructor(_organizationSyncService: OrganizationSyncService, _gitSyncService: GitSyncService) {}

  @OnEvent(DomainEvents.ORGANIZATION_CREATED)
  async handleOrganizationCreated(event: any) {
    const { name, gitSyncEnabled, gitProvider, gitOrgName } = event.data

    // 只有启用了 Git 同步的组织才进行同步
    if (!gitSyncEnabled || !gitProvider || !gitOrgName) {
      return
    }

    try {
      // TODO: 实现组织同步功能
      // 异步创建 Git 组织
      // await this.gitSyncService.queueOrganizationSync({
      //   type: 'create_organization',
      //   organizationId: event.resourceId,
      //   gitProvider: gitProvider,
      //   gitOrgName: gitOrgName,
      //   triggeredBy: event.userId,
      // })

      this.logger.log(`Organization sync not yet implemented for: ${name}`)
    } catch (error) {
      this.logger.error('Failed to queue organization creation:', error)
    }
  }

  @OnEvent(DomainEvents.ORGANIZATION_MEMBER_ADDED)
  async handleMemberAdded(event: any) {
    try {
      // TODO: 实现组织成员同步功能
      // 异步同步成员到 Git 平台
      // await this.gitSyncService.queueMemberSync({
      //   type: 'add_member',
      //   organizationId: event.resourceId,
      //   userId: event.data.memberId,
      //   role: event.data.role,
      //   triggeredBy: event.userId,
      // })

      this.logger.log(
        `Organization member sync not yet implemented for user: ${event.data.memberId}`,
      )
    } catch (error) {
      this.logger.error('Failed to queue member addition sync:', error)
    }
  }

  @OnEvent(DomainEvents.ORGANIZATION_MEMBER_REMOVED)
  async handleMemberRemoved(event: any) {
    try {
      // TODO: 实现组织成员移除同步功能
      // 异步从 Git 平台移除成员
      // await this.gitSyncService.queueMemberSync({
      //   type: 'remove_member',
      //   organizationId: event.resourceId,
      //   userId: event.data.memberId,
      //   triggeredBy: event.userId,
      // })

      this.logger.log(
        `Organization member removal sync not yet implemented for user: ${event.data.memberId}`,
      )
    } catch (error) {
      this.logger.error('Failed to queue member removal sync:', error)
    }
  }

  @OnEvent(DomainEvents.ORGANIZATION_MEMBER_ROLE_UPDATED)
  async handleMemberRoleUpdated(event: any) {
    try {
      // TODO: 实现组织成员角色更新同步功能
      // 异步更新 Git 平台的成员权限
      // await this.gitSyncService.queueMemberSync({
      //   type: 'update_member_role',
      //   organizationId: event.resourceId,
      //   userId: event.data.memberId,
      //   role: event.data.newRole,
      //   oldRole: event.data.oldRole,
      //   triggeredBy: event.userId,
      // })

      this.logger.log(`Queued member role update sync for user: ${event.data.memberId}`)
    } catch (error) {
      this.logger.error('Failed to queue member role update sync:', error)
    }
  }
}
