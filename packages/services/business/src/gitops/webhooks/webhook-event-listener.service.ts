import { DomainEvents } from '@juanie/core/events'
import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
// import { GitPlatformSyncService } from './git-platform-sync.service'

/**
 * Webhook 事件监听器
 *
 * 监听来自 webhook 的 Git 平台事件
 * 触发相应的同步操作
 *
 * Requirements: 5.1, 5.2, 5.3, 8.2, 8.3, 8.4
 *
 * 注意：GitPlatformSyncService 暂时禁用，webhook 事件处理功能暂不可用
 */
@Injectable()
export class WebhookEventListener {
  private readonly logger = new Logger(WebhookEventListener.name)

  /**
   * 处理 Git 仓库变更事件
   *
   * Requirements: 8.2, 8.4
   */
  @OnEvent(DomainEvents.GIT_REPOSITORY_CHANGED)
  async handleRepositoryChanged(event: any) {
    this.logger.log('Received repository changed event', {
      provider: event.provider,
      action: event.action,
      repositoryId: event.repository.gitId,
    })

    // TODO: 重新启用 GitPlatformSyncService 后恢复此功能
    this.logger.warn('GitPlatformSyncService disabled, repository sync not available')
  }

  /**
   * 处理 Git 协作者变更事件
   *
   * Requirements: 8.3
   */
  @OnEvent(DomainEvents.GIT_COLLABORATOR_CHANGED)
  async handleCollaboratorChanged(event: any) {
    this.logger.log('Received collaborator changed event', {
      provider: event.provider,
      action: event.action,
      repositoryId: event.repository.gitId,
      collaboratorLogin: event.collaborator.gitLogin,
    })

    // TODO: 重新启用 GitPlatformSyncService 后恢复此功能
    this.logger.warn('GitPlatformSyncService disabled, collaborator sync not available')
  }

  /**
   * 处理 Git 推送事件
   *
   * 推送事件可以触发 CI/CD 或其他自动化流程
   * 这里主要记录日志,具体的 CI/CD 处理由其他模块负责
   */
  @OnEvent(DomainEvents.GIT_PUSH)
  async handlePushEvent(event: any) {
    this.logger.log('Received push event', {
      provider: event.provider,
      repositoryId: event.repository.gitId,
      commitsCount: event.commits.length,
      ref: event.ref,
    })

    try {
      // 推送事件主要用于触发 CI/CD
      // 这里只记录日志,具体处理由其他模块负责
      this.logger.debug('Push event processed', {
        repository: event.repository.fullName,
        commits: event.commits.map((c: any) => c.id),
      })
    } catch (error) {
      this.logger.error('Error handling push event:', error)
    }
  }

  /**
   * 处理 Git 组织变更事件
   *
   * 组织级别的变更事件
   */
  @OnEvent(DomainEvents.GIT_ORGANIZATION_CHANGED)
  async handleOrganizationChanged(event: any) {
    this.logger.log('Received organization changed event', {
      provider: event.provider,
      action: event.action,
      organizationId: event.organization.gitId,
    })

    try {
      // 组织变更事件暂时只记录日志
      // 具体的组织同步逻辑由 OrganizationSyncService 处理
      this.logger.debug('Organization event logged', {
        organization: event.organization.gitLogin,
        action: event.action,
      })
    } catch (error) {
      this.logger.error('Error handling organization changed event:', error)
    }
  }

  /**
   * 处理 Git 成员变更事件
   *
   * 组织成员级别的变更事件
   */
  @OnEvent(DomainEvents.GIT_MEMBER_CHANGED)
  async handleMemberChanged(event: any) {
    this.logger.log('Received member changed event', {
      provider: event.provider,
      action: event.action,
      organizationId: event.organization.gitId,
      memberId: event.member.gitId,
    })

    try {
      // 成员变更事件暂时只记录日志
      // 具体的成员同步逻辑由 OrganizationSyncService 处理
      this.logger.debug('Member event logged', {
        member: event.member.gitLogin,
        action: event.action,
      })
    } catch (error) {
      this.logger.error('Error handling member changed event:', error)
    }
  }
}
