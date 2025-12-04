import { DomainEvents, EventPublisher } from '@juanie/core/events'
import { Logger } from '@juanie/core/logger'
import { Injectable } from '@nestjs/common'

/**
 * Webhook 事件处理器
 *
 * 负责解析和处理来自 Git 平台的具体事件
 * 将外部事件转换为内部事件并发布
 *
 * Requirements: 5.1, 5.2, 5.3, 8.2, 8.3, 8.4
 */
export interface WebhookEvent {
  eventName: string
  eventType: string
  payload: any
  timestamp: Date
}

@Injectable()
export class WebhookEventProcessor {
  private readonly logger = new Logger(WebhookEventProcessor.name)

  constructor(private readonly eventPublisher: EventPublisher) {}

  /**
   * 处理 GitHub 事件
   *
   * Requirements: 5.1, 8.2, 8.3, 8.4
   */
  async processGitHubEvent(event: WebhookEvent): Promise<void> {
    const { eventName, payload } = event

    try {
      switch (eventName) {
        case 'repository':
          await this.processGitHubRepositoryEvent(payload)
          break
        case 'member':
        case 'membership':
          await this.processGitHubMemberEvent(payload)
          break
        case 'collaborator':
          await this.processGitHubCollaboratorEvent(payload)
          break
        case 'push':
          await this.processGitHubPushEvent(payload)
          break
        case 'organization':
          await this.processGitHubOrganizationEvent(payload)
          break
        default:
          this.logger.warn(`Unsupported GitHub event: ${eventName}`)
      }
    } catch (error) {
      this.logger.error(`Error processing GitHub ${eventName} event:`, error)
      throw error
    }
  }

  /**
   * 处理 GitLab 事件
   *
   * Requirements: 5.2, 8.2, 8.3, 8.4
   */
  async processGitLabEvent(event: WebhookEvent): Promise<void> {
    const { eventName, payload } = event

    try {
      switch (eventName) {
        case 'project':
          await this.processGitLabProjectEvent(payload)
          break
        case 'group':
          await this.processGitLabGroupEvent(payload)
          break
        case 'group_member':
          await this.processGitLabGroupMemberEvent(payload)
          break
        case 'push':
          await this.processGitLabPushEvent(payload)
          break
        default:
          this.logger.warn(`Unsupported GitLab event: ${eventName}`)
      }
    } catch (error) {
      this.logger.error(`Error processing GitLab ${eventName} event:`, error)
      throw error
    }
  }

  /**
   * 处理 GitHub 仓库事件
   */
  private async processGitHubRepositoryEvent(payload: any): Promise<void> {
    const { action, repository, sender, changes } = payload

    this.logger.log(`Processing GitHub repository ${action}`, {
      repositoryName: repository.name,
      senderLogin: sender.login,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_REPOSITORY_CHANGED,
      version: 1,
      resourceId: repository.id.toString(),
      data: {
        provider: 'github',
        action,
        repository: {
          gitId: repository.id.toString(),
          name: repository.name,
          fullName: repository.full_name,
          url: repository.html_url,
          defaultBranch: repository.default_branch,
          visibility: repository.private ? 'private' : 'public',
        },
        changes: changes || {},
        triggeredBy: {
          gitId: sender.id.toString(),
          gitLogin: sender.login,
        },
      },
    })
  }

  /**
   * 处理 GitHub 协作者事件
   */
  private async processGitHubCollaboratorEvent(payload: any): Promise<void> {
    const { action, repository, collaborator, sender } = payload

    if (!collaborator || !repository) {
      this.logger.warn('Invalid GitHub collaborator event payload')
      return
    }

    this.logger.log(`Processing GitHub collaborator ${action}`, {
      repositoryName: repository.name,
      collaboratorLogin: collaborator.login,
      senderLogin: sender.login,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_COLLABORATOR_CHANGED,
      version: 1,
      resourceId: repository.id.toString(),
      data: {
        provider: 'github',
        action,
        repository: {
          gitId: repository.id.toString(),
          name: repository.name,
          fullName: repository.full_name,
        },
        collaborator: {
          gitId: collaborator.id.toString(),
          gitLogin: collaborator.login,
          gitName: collaborator.name,
          permission: payload.permission || 'read',
        },
        triggeredBy: {
          gitId: sender.id.toString(),
          gitLogin: sender.login,
        },
      },
    })
  }

  /**
   * 处理 GitHub 成员事件
   */
  private async processGitHubMemberEvent(payload: any): Promise<void> {
    const { action, organization, member, membership, sender } = payload

    if (!member || !organization) {
      this.logger.warn('Invalid GitHub member event payload')
      return
    }

    this.logger.log(`Processing GitHub member ${action}`, {
      organizationLogin: organization.login,
      memberLogin: member.login,
      role: membership?.role,
      senderLogin: sender.login,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_MEMBER_CHANGED,
      version: 1,
      resourceId: organization.id.toString(),
      data: {
        provider: 'github',
        action,
        organization: {
          gitId: organization.id.toString(),
          gitLogin: organization.login,
        },
        member: {
          gitId: member.id.toString(),
          gitLogin: member.login,
          gitName: member.name,
        },
        role: membership?.role,
        state: membership?.state,
        triggeredBy: {
          gitId: sender.id.toString(),
          gitLogin: sender.login,
        },
      },
    })
  }

  /**
   * 处理 GitHub 组织事件
   */
  private async processGitHubOrganizationEvent(payload: any): Promise<void> {
    const { action, organization, sender } = payload

    this.logger.log(`Processing GitHub organization ${action}`, {
      organizationId: organization.id,
      organizationLogin: organization.login,
      senderLogin: sender.login,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_ORGANIZATION_CHANGED,
      version: 1,
      resourceId: organization.id.toString(),
      data: {
        provider: 'github',
        action,
        organization: {
          gitId: organization.id.toString(),
          gitLogin: organization.login,
          gitName: organization.name,
          gitUrl: organization.url,
        },
        triggeredBy: {
          gitId: sender.id.toString(),
          gitLogin: sender.login,
        },
      },
    })
  }

  /**
   * 处理 GitHub 推送事件
   */
  private async processGitHubPushEvent(payload: any): Promise<void> {
    const { repository, pusher, commits, ref } = payload

    this.logger.log(`Processing GitHub push event`, {
      repositoryName: repository.name,
      pusherName: pusher.name,
      commitsCount: commits.length,
      ref,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_PUSH,
      version: 1,
      resourceId: repository.id.toString(),
      data: {
        provider: 'github',
        repository: {
          gitId: repository.id.toString(),
          name: repository.name,
          fullName: repository.full_name,
        },
        pusher: {
          name: pusher.name,
          email: pusher.email,
        },
        commits: commits.map((commit: any) => ({
          id: commit.id,
          message: commit.message,
          author: commit.author,
          timestamp: commit.timestamp,
        })),
        ref,
      },
    })
  }

  /**
   * 处理 GitLab 项目事件
   */
  private async processGitLabProjectEvent(payload: any): Promise<void> {
    const { event_type, project, user_name } = payload

    this.logger.log(`Processing GitLab project ${event_type}`, {
      projectName: project.name,
      projectPath: project.path_with_namespace,
      userName: user_name,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_REPOSITORY_CHANGED,
      version: 1,
      resourceId: project.id.toString(),
      data: {
        provider: 'gitlab',
        action: event_type,
        repository: {
          gitId: project.id.toString(),
          name: project.name,
          fullName: project.path_with_namespace,
          url: project.web_url,
          defaultBranch: project.default_branch,
          visibility: project.visibility,
        },
        changes: payload.changes || {},
      },
    })
  }

  /**
   * 处理 GitLab 组织事件
   */
  private async processGitLabGroupEvent(payload: any): Promise<void> {
    const { event_type, group } = payload

    this.logger.log(`Processing GitLab group ${event_type}`, {
      groupId: group.id,
      groupName: group.name,
      groupPath: group.path,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_ORGANIZATION_CHANGED,
      version: 1,
      resourceId: group.id.toString(),
      data: {
        provider: 'gitlab',
        action: event_type,
        organization: {
          gitId: group.id.toString(),
          gitLogin: group.path,
          gitName: group.name,
          gitUrl: `https://gitlab.com/${group.full_path}`,
        },
      },
    })
  }

  /**
   * 处理 GitLab 组成员事件
   */
  private async processGitLabGroupMemberEvent(payload: any): Promise<void> {
    const { event_type, group, user_id, user_username, user_name, group_access } = payload

    this.logger.log(`Processing GitLab group member ${event_type}`, {
      groupName: group.name,
      userName: user_name,
      userAccess: group_access,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_MEMBER_CHANGED,
      version: 1,
      resourceId: group.id.toString(),
      data: {
        provider: 'gitlab',
        action: event_type,
        organization: {
          gitId: group.id.toString(),
          gitLogin: group.path,
        },
        member: {
          gitId: user_id?.toString(),
          gitLogin: user_username,
          gitName: user_name,
        },
        accessLevel: group_access,
      },
    })
  }

  /**
   * 处理 GitLab 推送事件
   */
  private async processGitLabPushEvent(payload: any): Promise<void> {
    const { project, user_name, user_email, commits, ref } = payload

    this.logger.log(`Processing GitLab push event`, {
      projectName: project.name,
      userName: user_name,
      commitsCount: commits.length,
      ref,
    })

    // 发布内部事件
    await this.eventPublisher.publishDomain({
      type: DomainEvents.GIT_PUSH,
      version: 1,
      resourceId: project.id.toString(),
      data: {
        provider: 'gitlab',
        repository: {
          gitId: project.id.toString(),
          name: project.name,
          fullName: project.path_with_namespace,
        },
        pusher: {
          name: user_name,
          email: user_email,
        },
        commits: commits.map((commit: any) => ({
          id: commit.id,
          message: commit.message,
          author: commit.author,
          timestamp: commit.timestamp,
        })),
        ref,
      },
    })
  }
}
