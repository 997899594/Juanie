/**
 * 组织同步服务
 *
 * 负责同步组织成员到 Git 平台
 * 支持个人工作空间和团队工作空间两种模式
 *
 * Requirements: 2.1, 2.2, 4.1
 */

import { DomainEvents } from '@juanie/core/events'
import {
  GitConnectionsService,
  GitHubClientService,
  GitLabClientService,
  type OrganizationMemberAddedEvent,
  type OrganizationMemberRemovedEvent,
  type OrganizationMemberRoleUpdatedEvent,
  OrganizationsService,
} from '@juanie/service-foundation'
import { InjectQueue } from '@nestjs/bullmq'
import { Injectable } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import type { Queue } from 'bullmq'
import { PinoLogger } from 'nestjs-pino'

export interface OrganizationSyncResult {
  success: boolean
  syncedMembers: number
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
export class OrganizationSyncService {
  constructor(
    @InjectQueue('git-sync') private readonly gitSyncQueue: Queue,
    private readonly organizationsService: OrganizationsService,
    private readonly gitConnectionsService: GitConnectionsService,
    private readonly githubClient: GitHubClientService,
    private readonly gitlabClient: GitLabClientService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(OrganizationSyncService.name)
  }

  /**
   * 事件监听器: 组织成员添加
   * 自动将成员添加到 Git 组织
   * Requirements: 2.2, 4.1
   */
  @OnEvent(DomainEvents.ORGANIZATION_MEMBER_ADDED)
  async handleMemberAdded(event: OrganizationMemberAddedEvent) {
    this.logger.info(
      `Event received: Member added to organization ${event.organizationId}, user ${event.userId}`,
    )

    try {
      // 检查组织是否启用了 Git 同步
      const organization = await this.organizationsService.get(event.organizationId, 'system')

      if (!organization) {
        this.logger.warn(`Organization ${event.organizationId} not found, skipping sync`)
        return
      }

      // 个人工作空间不需要同步组织成员
      if (organization.type === 'personal') {
        this.logger.info('Personal workspace does not sync organization members')
        return
      }

      // 检查是否启用了 Git 同步
      if (!organization.gitSyncEnabled || !organization.gitProvider || !organization.gitOrgId) {
        this.logger.info('Git sync not enabled for this organization, skipping')
        return
      }

      // 添加到队列进行异步处理
      await this.gitSyncQueue.add(
        'sync-org-member-add',
        {
          organizationId: event.organizationId,
          userId: event.userId,
          role: event.role,
          triggeredBy: event.addedBy,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      )

      this.logger.info(`Queued member add sync for user ${event.userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue member add sync:`, error)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 事件监听器: 组织成员移除
   * 自动从 Git 组织移除成员
   * Requirements: 4.1
   */
  @OnEvent(DomainEvents.ORGANIZATION_MEMBER_REMOVED)
  async handleMemberRemoved(event: OrganizationMemberRemovedEvent) {
    this.logger.info(
      `Event received: Member removed from organization ${event.organizationId}, user ${event.userId}`,
    )

    try {
      // 检查组织是否启用了 Git 同步
      const organization = await this.organizationsService.get(event.organizationId, 'system')

      if (!organization) {
        this.logger.warn(`Organization ${event.organizationId} not found, skipping sync`)
        return
      }

      // 个人工作空间不需要同步组织成员
      if (organization.type === 'personal') {
        this.logger.info('Personal workspace does not sync organization members')
        return
      }

      // 检查是否启用了 Git 同步
      if (!organization.gitSyncEnabled || !organization.gitProvider || !organization.gitOrgId) {
        this.logger.info('Git sync not enabled for this organization, skipping')
        return
      }

      // 添加到队列进行异步处理
      await this.gitSyncQueue.add(
        'sync-org-member-remove',
        {
          organizationId: event.organizationId,
          userId: event.userId,
          triggeredBy: event.removedBy,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      )

      this.logger.info(`Queued member remove sync for user ${event.userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue member remove sync:`, error)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 事件监听器: 组织成员角色更新
   * 自动更新 Git 组织成员权限
   * Requirements: 4.1
   */
  @OnEvent(DomainEvents.ORGANIZATION_MEMBER_ROLE_UPDATED)
  async handleMemberRoleUpdated(event: OrganizationMemberRoleUpdatedEvent) {
    this.logger.info(
      `Event received: Member role updated in organization ${event.organizationId}, user ${event.userId}`,
    )

    try {
      // 检查组织是否启用了 Git 同步
      const organization = await this.organizationsService.get(event.organizationId, 'system')

      if (!organization) {
        this.logger.warn(`Organization ${event.organizationId} not found, skipping sync`)
        return
      }

      // 个人工作空间不需要同步组织成员
      if (organization.type === 'personal') {
        this.logger.info('Personal workspace does not sync organization members')
        return
      }

      // 检查是否启用了 Git 同步
      if (!organization.gitSyncEnabled || !organization.gitProvider || !organization.gitOrgId) {
        this.logger.info('Git sync not enabled for this organization, skipping')
        return
      }

      // 添加到队列进行异步处理
      await this.gitSyncQueue.add(
        'sync-org-member-role-update',
        {
          organizationId: event.organizationId,
          userId: event.userId,
          oldRole: event.oldRole,
          newRole: event.newRole,
          triggeredBy: event.updatedBy,
        },
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      )

      this.logger.info(`Queued member role update sync for user ${event.userId}`)
    } catch (error) {
      this.logger.error(`Failed to queue member role update sync:`, error)
      // 不抛出错误，避免影响主流程
    }
  }

  /**
   * 同步组织成员到 Git 平台
   * 根据工作空间类型采用不同的同步策略
   * Requirements: 2.1, 2.2, 4.1
   */
  async syncOrganizationMembers(organizationId: string): Promise<OrganizationSyncResult> {
    this.logger.info(`Starting organization sync for: ${organizationId}`)

    try {
      // ✅ 使用 Foundation 层服务获取组织信息
      const organization = await this.organizationsService.get(organizationId, 'system')

      if (!organization) {
        throw new Error(`Organization not found: ${organizationId}`)
      }

      // 根据工作空间类型选择同步策略
      if (organization.type === 'personal') {
        return await this.syncPersonalWorkspace(organization)
      }

      return await this.syncTeamWorkspace(organization)
    } catch (error) {
      this.logger.error(`Organization sync failed for ${organizationId}:`, error)

      return {
        success: false,
        syncedMembers: 0,
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
   * 同步个人工作空间
   * 个人工作空间不需要同步组织成员，因为协作是项目级的
   * Requirements: Personal Workspace Design
   */
  private async syncPersonalWorkspace(organization: any): Promise<OrganizationSyncResult> {
    this.logger.info(`Skipping sync for personal workspace: ${organization.name}`)

    return {
      success: true,
      syncedMembers: 0,
      errors: [],
      skipped: {
        reason:
          'Personal workspace does not sync organization members. Use project-level collaboration instead.',
        count: 0,
      },
    }
  }

  /**
   * 同步团队工作空间
   * 团队工作空间需要同步所有成员到 Git 组织
   * Requirements: 2.1, 2.2, 4.1
   */
  private async syncTeamWorkspace(organization: any): Promise<OrganizationSyncResult> {
    this.logger.info(`Syncing team workspace: ${organization.name}`)

    // 检查是否启用了 Git 同步
    if (!organization.gitSyncEnabled || !organization.gitProvider || !organization.gitOrgId) {
      return {
        success: true,
        syncedMembers: 0,
        errors: [],
        skipped: {
          reason: 'Git sync is not enabled for this organization',
          count: 0,
        },
      }
    }

    // ✅ 使用 Foundation 层服务获取组织成员
    const members = await this.organizationsService.listMembers(
      organization.id,
      'system', // 使用系统用户 ID
    )

    if (members.length === 0) {
      return {
        success: true,
        syncedMembers: 0,
        errors: [],
        skipped: {
          reason: 'No members found in organization',
          count: 0,
        },
      }
    }

    const results: OrganizationSyncResult = {
      success: true,
      syncedMembers: 0,
      errors: [],
    }

    // 获取组织所有者
    const owner = members.find((m) => m.role === 'owner')
    if (!owner) {
      throw new Error('Organization owner not found')
    }

    // ✅ 使用 Foundation 层服务获取所有者的 Git 连接
    const ownerGitConnection = await this.gitConnectionsService.getConnectionByProvider(
      owner.user.id,
      organization.gitProvider as 'github' | 'gitlab',
    )

    if (!ownerGitConnection) {
      throw new Error(`Owner does not have ${organization.gitProvider} account linked`)
    }

    // 解密 token
    const ownerConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
      owner.user.id,
      organization.gitProvider as 'github' | 'gitlab',
    )

    if (!ownerConnection) {
      throw new Error(`Failed to decrypt owner's Git connection`)
    }

    // 同步每个成员
    for (const member of members) {
      try {
        // 跳过所有者 (已经是组织成员)
        if (member.role === 'owner') {
          continue
        }

        // ✅ 使用 Foundation 层服务获取成员的 Git 连接
        const memberGitConnection =
          await this.gitConnectionsService.getConnectionWithDecryptedTokens(
            member.user.id,
            organization.gitProvider as 'github' | 'gitlab',
          )

        if (!memberGitConnection) {
          results.errors.push({
            userId: member.user.id,
            error: `User does not have ${organization.gitProvider} account linked`,
          })
          continue
        }

        // 映射角色到 Git 权限
        const gitRole = this.mapOrgRoleToGitPermission(member.role, organization.gitProvider!)

        // 添加成员到 Git 组织
        if (organization.gitProvider === 'github') {
          const octokit = this.githubClient.createClient(ownerConnection.accessToken)
          await octokit.orgs.setMembershipForUser({
            org: organization.gitOrgName!,
            username: memberGitConnection.username,
            role: gitRole as 'admin' | 'member',
          })
        } else if (organization.gitProvider === 'gitlab') {
          const gitlab = this.gitlabClient.createClient(ownerConnection.accessToken)
          await gitlab.GroupMembers.add(organization.gitOrgId!, gitRole as 10 | 20 | 30 | 40 | 50, {
            userId: Number.parseInt(memberGitConnection.providerAccountId!, 10),
          })
        }

        results.syncedMembers++
        this.logger.info(
          `Synced member ${member.user.displayName || member.user.email} to ${organization.gitProvider} organization`,
        )
      } catch (error) {
        this.logger.error(
          `Failed to sync member ${member.user.displayName || member.user.email}:`,
          error,
        )

        results.errors.push({
          userId: member.user.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        results.success = false
      }
    }

    // ✅ 使用 Foundation 层服务更新最后同步时间
    await this.organizationsService.update(organization.id, 'system', {
      gitLastSyncAt: new Date(),
    })

    this.logger.info(
      `Organization sync completed. Synced: ${results.syncedMembers}, Errors: ${results.errors.length}`,
    )

    return results
  }

  /**
   * 移除组织成员的 Git 访问权限
   * Requirements: 4.1
   */
  async removeOrganizationMember(
    organizationId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    this.logger.info(`Removing member ${userId} from organization ${organizationId}`)

    try {
      // ✅ 使用 Foundation 层服务获取组织信息
      const organization = await this.organizationsService.get(organizationId, 'system')

      if (!organization) {
        throw new Error(`Organization not found: ${organizationId}`)
      }

      // 个人工作空间不需要移除组织成员
      if (organization.type === 'personal') {
        this.logger.info('Personal workspace does not sync organization members')
        return { success: true }
      }

      // 检查是否启用了 Git 同步
      if (!organization.gitSyncEnabled || !organization.gitProvider || !organization.gitOrgId) {
        this.logger.info('Git sync is not enabled, skipping Git removal')
        return { success: true }
      }

      // ✅ 使用 Foundation 层服务获取用户的 Git 连接
      const userGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        userId,
        organization.gitProvider as 'github' | 'gitlab',
      )

      if (!userGitConnection) {
        this.logger.info(`User ${userId} does not have ${organization.gitProvider} account`)
        return { success: true }
      }

      // ✅ 使用 Foundation 层服务获取组织所有者
      const members = await this.organizationsService.listMembers(organizationId, 'system')
      const owner = members.find((m) => m.role === 'owner')

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      // ✅ 使用 Foundation 层服务获取所有者的 Git 连接
      const ownerGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        owner.user.id,
        organization.gitProvider as 'github' | 'gitlab',
      )

      if (!ownerGitConnection) {
        throw new Error('Organization owner Git connection not found')
      }

      // 从 Git 组织移除成员
      if (organization.gitProvider === 'github') {
        const octokit = this.githubClient.createClient(ownerGitConnection.accessToken)
        await octokit.orgs.removeMembershipForUser({
          org: organization.gitOrgName!,
          username: userGitConnection.username,
        })
      } else if (organization.gitProvider === 'gitlab') {
        const gitlab = this.gitlabClient.createClient(ownerGitConnection.accessToken)
        await gitlab.GroupMembers.remove(
          organization.gitOrgId!,
          Number.parseInt(userGitConnection.providerAccountId!, 10),
        )
      }

      this.logger.info(`Successfully removed user from ${organization.gitProvider} organization`)

      return { success: true }
    } catch (error) {
      this.logger.error(`Failed to remove organization member:`, error)

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * 创建组织时的初始同步
   * Requirements: 2.1, 2.2
   */
  async syncNewOrganization(organizationId: string): Promise<OrganizationSyncResult> {
    this.logger.info(`Initial sync for new organization: ${organizationId}`)

    // ✅ 使用 Foundation 层服务获取组织信息
    const organization = await this.organizationsService.get(organizationId, 'system')

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    // 个人工作空间不需要初始同步
    if (organization.type === 'personal') {
      this.logger.info('Personal workspace created, no Git organization sync needed')
      return {
        success: true,
        syncedMembers: 0,
        errors: [],
        skipped: {
          reason: 'Personal workspace does not require Git organization sync',
          count: 0,
        },
      }
    }

    // 团队工作空间需要同步
    return await this.syncOrganizationMembers(organizationId)
  }

  /**
   * 获取组织同步状态
   * Requirements: 监控和状态查询
   */
  async getOrganizationSyncStatus(organizationId: string): Promise<{
    enabled: boolean
    lastSyncAt: Date | null
    memberCount: number
    syncedMemberCount: number
    pendingErrors: number
    workspaceType: 'personal' | 'team'
  }> {
    // ✅ 使用 Foundation 层服务获取组织信息
    const organization = await this.organizationsService.get(organizationId, 'system')

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    // ✅ 使用 Foundation 层服务获取成员列表
    const members = await this.organizationsService.listMembers(organizationId, 'system')
    const memberCount = members.length

    // 个人工作空间的状态
    if (organization.type === 'personal') {
      return {
        enabled: false,
        lastSyncAt: null,
        memberCount,
        syncedMemberCount: 0,
        pendingErrors: 0,
        workspaceType: 'personal',
      }
    }

    // 团队工作空间的状态
    const pendingErrors = 0 // TODO: 实现错误统计（可以从日志系统查询）

    return {
      enabled: organization.gitSyncEnabled || false,
      lastSyncAt: organization.gitLastSyncAt || null,
      memberCount,
      syncedMemberCount: organization.gitSyncEnabled ? memberCount - 1 : 0, // 减去 owner
      pendingErrors,
      workspaceType: 'team',
    }
  }

  /**
   * 创建 Git 组织 (单个操作)
   * Requirements: 2.1
   */
  async createGitOrganization(
    organizationId: string,
    gitProvider: string,
    gitOrgName: string,
    triggeredBy: string,
  ) {
    this.logger.info(
      `Creating Git organization: ${gitOrgName} (provider: ${gitProvider}, triggered by: ${triggeredBy})`,
    )

    try {
      // ✅ 使用 Foundation 层服务获取组织信息
      const org = await this.organizationsService.get(organizationId, 'system')

      if (!org) {
        throw new Error('Organization not found')
      }

      // TODO: 创建 Git 组织
      // GitHub 个人账号无法通过 API 创建组织,需要用户手动创建后关联
      // GitLab 可以通过 API 创建 Group
      // 暂时跳过自动创建,标记为需要手动配置
      this.logger.warn(
        `Git organization creation not yet implemented for ${gitProvider}. User needs to manually create and link the organization.`,
      )

      // ✅ 使用 Foundation 层服务更新组织的 Git 信息
      await this.organizationsService.update(organizationId, 'system', {
        gitOrgId: gitOrgName,
        gitOrgUrl: `https://${gitProvider === 'github' ? 'github.com' : 'gitlab.com'}/${gitOrgName}`,
        gitLastSyncAt: new Date(),
      })

      this.logger.info(`Marked Git organization for manual setup: ${gitOrgName}`)
    } catch (error) {
      this.logger.error(`Failed to create Git organization:`, error)
      throw error
    }
  }

  /**
   * 添加成员到 Git 组织 (单个操作)
   * Requirements: 2.2, 4.1
   */
  async addMemberToGitOrganization(
    organizationId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member',
    triggeredBy: string,
  ) {
    this.logger.info(
      `Adding member ${userId} to Git organization (role: ${role}, triggered by: ${triggeredBy})`,
    )

    // ✅ 使用 Foundation 层服务获取组织信息
    const org = await this.organizationsService.get(organizationId, 'system')

    if (!org || !org.gitSyncEnabled || !org.gitProvider || !org.gitOrgId) {
      throw new Error('Organization Git sync not configured')
    }

    try {
      // ✅ 使用 Foundation 层服务获取用户的 Git 连接
      const gitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        userId,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!gitConnection) {
        throw new Error(`User does not have ${org.gitProvider} account linked`)
      }

      // ✅ 使用 Foundation 层服务获取组织所有者
      const members = await this.organizationsService.listMembers(organizationId, 'system')
      const owner = members.find((m) => m.role === 'owner')

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      // ✅ 使用 Foundation 层服务获取所有者的 Git 连接
      const ownerGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        owner.user.id,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!ownerGitConnection) {
        throw new Error(`Owner does not have ${org.gitProvider} account linked`)
      }

      // 映射角色到 Git 权限
      const gitRole = this.mapOrgRoleToGitPermission(role, org.gitProvider as 'github' | 'gitlab')

      // 添加成员到 Git 组织
      if (org.gitProvider === 'github') {
        const octokit = this.githubClient.createClient(ownerGitConnection.accessToken)
        await octokit.orgs.setMembershipForUser({
          org: org.gitOrgName!,
          username: gitConnection.username,
          role: gitRole as 'admin' | 'member',
        })
      } else if (org.gitProvider === 'gitlab') {
        const gitlab = this.gitlabClient.createClient(ownerGitConnection.accessToken)
        await gitlab.GroupMembers.add(org.gitOrgId, gitRole as 10 | 20 | 30 | 40 | 50, {
          userId: Number.parseInt(gitConnection.providerAccountId!, 10),
        })
      }

      this.logger.info(`Added member ${userId} to Git organization ${org.gitOrgName}`)
    } catch (error) {
      this.logger.error(`Failed to add member to Git organization:`, error)
      throw error
    }
  }

  /**
   * 从 Git 组织移除成员 (单个操作)
   * Requirements: 4.1
   */
  async removeMemberFromGitOrganization(
    organizationId: string,
    userId: string,
    triggeredBy: string,
  ) {
    this.logger.info(
      `Removing member ${userId} from Git organization (triggered by: ${triggeredBy})`,
    )

    // ✅ 使用 Foundation 层服务获取组织信息
    const org = await this.organizationsService.get(organizationId, 'system')

    if (!org || !org.gitSyncEnabled || !org.gitProvider || !org.gitOrgId) {
      throw new Error('Organization Git sync not configured')
    }

    try {
      // ✅ 使用 Foundation 层服务获取用户的 Git 连接
      const gitConnection = await this.gitConnectionsService.getConnectionByProvider(
        userId,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!gitConnection) {
        // 用户没有关联 Git 账号,无需移除
        this.logger.info(`User ${userId} does not have ${org.gitProvider} account, skipping`)
        return
      }

      // ✅ 使用 Foundation 层服务获取组织所有者
      const members = await this.organizationsService.listMembers(organizationId, 'system')
      const owner = members.find((m) => m.role === 'owner')

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      // ✅ 使用 Foundation 层服务获取所有者的 Git 连接
      const ownerGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        owner.user.id,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!ownerGitConnection) {
        throw new Error(`Owner does not have ${org.gitProvider} account linked`)
      }

      // 解密用户的 Git 连接
      const userGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        userId,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!userGitConnection) {
        throw new Error('Failed to decrypt user Git connection')
      }

      // 从 Git 组织移除成员
      if (org.gitProvider === 'github') {
        const octokit = this.githubClient.createClient(ownerGitConnection.accessToken)
        await octokit.orgs.removeMembershipForUser({
          org: org.gitOrgName!,
          username: userGitConnection.username,
        })
      } else if (org.gitProvider === 'gitlab') {
        const gitlab = this.gitlabClient.createClient(ownerGitConnection.accessToken)
        await gitlab.GroupMembers.remove(
          org.gitOrgId,
          Number.parseInt(userGitConnection.providerAccountId!, 10),
        )
      }

      this.logger.info(`Removed member ${userId} from Git organization ${org.gitOrgName}`)
    } catch (error) {
      this.logger.error(`Failed to remove member from Git organization:`, error)
      throw error
    }
  }

  /**
   * 更新 Git 组织成员角色 (单个操作)
   * Requirements: 4.1
   */
  async updateMemberRoleInGitOrganization(
    organizationId: string,
    userId: string,
    newRole: 'owner' | 'admin' | 'member',
    triggeredBy: string,
  ) {
    this.logger.info(
      `Updating member ${userId} role to ${newRole} in Git organization (triggered by: ${triggeredBy})`,
    )

    // ✅ 使用 Foundation 层服务获取组织信息
    const org = await this.organizationsService.get(organizationId, 'system')

    if (!org || !org.gitSyncEnabled || !org.gitProvider || !org.gitOrgId) {
      throw new Error('Organization Git sync not configured')
    }

    try {
      // ✅ 使用 Foundation 层服务获取用户的 Git 连接
      const gitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        userId,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!gitConnection) {
        throw new Error(`User does not have ${org.gitProvider} account linked`)
      }

      // ✅ 使用 Foundation 层服务获取组织所有者
      const members = await this.organizationsService.listMembers(organizationId, 'system')
      const owner = members.find((m) => m.role === 'owner')

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      // ✅ 使用 Foundation 层服务获取所有者的 Git 连接
      const ownerGitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
        owner.user.id,
        org.gitProvider as 'github' | 'gitlab',
      )

      if (!ownerGitConnection) {
        throw new Error(`Owner does not have ${org.gitProvider} account linked`)
      }

      // 映射角色到 Git 权限
      const gitRole = this.mapOrgRoleToGitPermission(
        newRole,
        org.gitProvider as 'github' | 'gitlab',
      )

      // 更新 Git 组织成员角色
      if (org.gitProvider === 'github') {
        const octokit = this.githubClient.createClient(ownerGitConnection.accessToken)
        // GitHub 需要先移除再添加来更新角色
        await octokit.orgs.removeMembershipForUser({
          org: org.gitOrgName!,
          username: gitConnection.username,
        })
        await octokit.orgs.setMembershipForUser({
          org: org.gitOrgName!,
          username: gitConnection.username,
          role: gitRole as 'admin' | 'member',
        })
      } else if (org.gitProvider === 'gitlab') {
        const gitlab = this.gitlabClient.createClient(ownerGitConnection.accessToken)
        // GitLab 也需要先移除再添加来更新角色
        await gitlab.GroupMembers.remove(
          org.gitOrgId,
          Number.parseInt(gitConnection.providerAccountId!, 10),
        )
        await gitlab.GroupMembers.add(org.gitOrgId, gitRole as 10 | 20 | 30 | 40 | 50, {
          userId: Number.parseInt(gitConnection.providerAccountId!, 10),
        })
      }

      this.logger.info(`Updated member ${userId} role in Git organization ${org.gitOrgName}`)
    } catch (error) {
      this.logger.error(`Failed to update member role in Git organization:`, error)
      throw error
    }
  }

  /**
   * 映射组织角色到 Git 权限
   * Requirements: 4.3, 4.4, 4.5, 4.6
   */
  private mapOrgRoleToGitPermission(
    role: string,
    provider: 'github' | 'gitlab',
  ): 'admin' | 'member' | 10 | 20 | 30 | 40 | 50 {
    if (provider === 'github') {
      // GitHub 组织角色映射
      const githubRoleMap: Record<string, 'admin' | 'member'> = {
        owner: 'admin',
        admin: 'admin',
        maintainer: 'admin',
        member: 'member',
        developer: 'member',
        viewer: 'member',
      }
      return githubRoleMap[role.toLowerCase()] || 'member'
    }

    // GitLab 组织角色映射
    const gitlabRoleMap: Record<string, 10 | 20 | 30 | 40 | 50> = {
      owner: 50, // Owner
      admin: 40, // Maintainer
      maintainer: 40, // Maintainer
      member: 30, // Developer
      developer: 30, // Developer
      viewer: 20, // Reporter
    }
    return gitlabRoleMap[role.toLowerCase()] || 30
  }
}
