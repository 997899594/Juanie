/**
 * 组织同步服务
 *
 * 负责同步组织成员到 Git 平台
 * 支持个人工作空间和团队工作空间两种模式
 *
 * Requirements: 2.1, 2.2, 4.1
 */

import * as schema from '@juanie/core/database'
import { Logger } from '@juanie/core/logger'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { GitProviderService } from '../git-providers/git-provider.service'
import { GitSyncErrorService } from './git-sync-errors'

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
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly gitProvider: GitProviderService,
    private readonly errorService: GitSyncErrorService,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(OrganizationSyncService.name)
  }

  /**
   * 同步组织成员到 Git 平台
   * 根据工作空间类型采用不同的同步策略
   * Requirements: 2.1, 2.2, 4.1
   */
  async syncOrganizationMembers(organizationId: string): Promise<OrganizationSyncResult> {
    this.logger.info(`Starting organization sync for: ${organizationId}`)

    try {
      // 获取组织信息
      const orgResult = await this.db.query.organizations.findFirst({
        where: eq(schema.organizations.id, organizationId),
      })

      if (!orgResult) {
        throw new Error(`Organization not found: ${organizationId}`)
      }

      // 类型断言 - Drizzle 查询返回类型推断问题
      const organization = orgResult as typeof schema.organizations.$inferSelect

      // 根据工作空间类型选择同步策略
      if (organization.type === 'personal') {
        return await this.syncPersonalWorkspace(organization)
      }

      return await this.syncTeamWorkspace(organization)
    } catch (error) {
      this.logger.error(`Organization sync failed for ${organizationId}:`, error)

      await this.errorService.recordError({
        syncType: 'organization',
        action: 'sync',
        provider: 'github', // 默认，实际应该从组织获取
        organizationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
      })

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
  private async syncPersonalWorkspace(
    organization: typeof schema.organizations.$inferSelect,
  ): Promise<OrganizationSyncResult> {
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
  private async syncTeamWorkspace(
    organization: typeof schema.organizations.$inferSelect,
  ): Promise<OrganizationSyncResult> {
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

    // 获取组织成员
    const membersResult = await this.db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.organizationId, organization.id),
      with: {
        user: {
          with: {
            gitConnections: true,
          },
        },
      },
    })

    // 类型断言 - 确保关系类型正确
    type MemberWithUser = typeof schema.organizationMembers.$inferSelect & {
      user: typeof schema.users.$inferSelect & {
        gitConnections: Array<typeof schema.gitConnections.$inferSelect>
      }
    }
    const members = membersResult as unknown as MemberWithUser[]

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

    // 获取组织所有者的访问令牌
    const owner = members.find((m) => m.role === 'owner')
    if (!owner) {
      throw new Error('Organization owner not found')
    }

    const ownerGitConnection = owner.user.gitConnections?.find(
      (conn: typeof schema.gitConnections.$inferSelect) =>
        conn.provider === organization.gitProvider,
    )
    if (!ownerGitConnection) {
      throw new Error(`Owner does not have ${organization.gitProvider} account linked`)
    }

    // 同步每个成员
    for (const member of members) {
      try {
        // 跳过所有者 (已经是组织成员)
        if (member.role === 'owner') {
          continue
        }

        const memberGitConnection = member.user.gitConnections?.find(
          (conn: typeof schema.gitConnections.$inferSelect) =>
            conn.provider === organization.gitProvider,
        )

        if (!memberGitConnection) {
          results.errors.push({
            userId: member.userId,
            error: `User does not have ${organization.gitProvider} account linked`,
          })
          continue
        }

        // 映射角色到 Git 权限
        const gitRole = this.mapOrgRoleToGitPermission(member.role, organization.gitProvider!)

        // 添加成员到 Git 组织
        if (organization.gitProvider === 'github') {
          await this.gitProvider.addGitHubOrgMember(
            ownerGitConnection.accessToken,
            organization.gitOrgName!,
            memberGitConnection.username,
            gitRole as 'admin' | 'member',
          )
        } else if (organization.gitProvider === 'gitlab') {
          await this.gitProvider.addGitLabGroupMember(
            ownerGitConnection.accessToken,
            organization.gitOrgId!,
            Number.parseInt(memberGitConnection.providerAccountId!, 10),
            gitRole as 10 | 20 | 30 | 40 | 50,
          )
        }

        results.syncedMembers++
        this.logger.info(
          `Synced member ${member.user.displayName || member.user.email} to ${organization.gitProvider} organization`,
        )

        // 记录成功
        await this.errorService.recordSuccess({
          syncType: 'member',
          action: 'create',
          provider: organization.gitProvider as 'github' | 'gitlab',
          organizationId: organization.id,
          userId: member.userId,
          gitResourceId: memberGitConnection.providerAccountId,
          gitResourceType: 'user',
        })
      } catch (error) {
        this.logger.error(
          `Failed to sync member ${member.user.displayName || member.user.email}:`,
          error,
        )

        results.errors.push({
          userId: member.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
        results.success = false

        // 记录错误
        await this.errorService.recordError({
          syncType: 'member',
          action: 'create',
          provider: organization.gitProvider as 'github' | 'gitlab',
          organizationId: organization.id,
          userId: member.userId,
          error: error instanceof Error ? error.message : 'Unknown error',
          errorType: 'unknown',
        })
      }
    }

    // 更新最后同步时间
    await this.db
      .update(schema.organizations)
      .set({
        gitLastSyncAt: new Date(),
      })
      .where(eq(schema.organizations.id, organization.id))

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
      // 获取组织信息
      const organization = await this.db.query.organizations.findFirst({
        where: eq(schema.organizations.id, organizationId),
      })

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

      // 获取用户的 Git 账号
      const user = await this.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        with: {
          gitConnections: true,
        },
      })

      if (!user) {
        throw new Error(`User not found: ${userId}`)
      }

      const userGitConnection = user.gitConnections?.find(
        (conn: typeof schema.gitConnections.$inferSelect) =>
          conn.provider === organization.gitProvider,
      )

      if (!userGitConnection) {
        this.logger.info(`User ${userId} does not have ${organization.gitProvider} account`)
        return { success: true }
      }

      // 获取组织所有者的访问令牌
      const owner = await this.db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.role, 'owner'),
        ),
        with: {
          user: {
            with: {
              gitConnections: true,
            },
          },
        },
      })

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      const ownerGitConnection = owner.user.gitConnections?.find(
        (conn: typeof schema.gitConnections.$inferSelect) =>
          conn.provider === organization.gitProvider,
      )

      if (!ownerGitConnection) {
        throw new Error('Organization owner Git connection not found')
      }

      // 从 Git 组织移除成员
      if (organization.gitProvider === 'github') {
        await this.gitProvider.removeGitHubOrgMember(
          ownerGitConnection.accessToken,
          organization.gitOrgName!,
          userGitConnection.username,
        )
      } else if (organization.gitProvider === 'gitlab') {
        await this.gitProvider.removeGitLabGroupMember(
          ownerGitConnection.accessToken,
          organization.gitOrgId!,
          Number.parseInt(userGitConnection.providerAccountId!, 10),
        )
      }

      this.logger.info(
        `Successfully removed ${user.displayName || user.email} from ${organization.gitProvider} organization`,
      )

      // 记录成功
      await this.errorService.recordSuccess({
        syncType: 'member',
        action: 'delete',
        provider: organization.gitProvider as 'github' | 'gitlab',
        organizationId,
        userId,
        gitResourceId: userGitConnection.providerAccountId,
        gitResourceType: 'user',
      })

      return { success: true }
    } catch (error) {
      this.logger.error(`Failed to remove organization member:`, error)

      await this.errorService.recordError({
        syncType: 'member',
        action: 'delete',
        provider: 'github', // 默认
        organizationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorType: 'unknown',
      })

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

    const organization = await this.db.query.organizations.findFirst({
      where: eq(schema.organizations.id, organizationId),
    })

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
    const organization = await this.db.query.organizations.findFirst({
      where: eq(schema.organizations.id, organizationId),
    })

    if (!organization) {
      throw new Error(`Organization not found: ${organizationId}`)
    }

    const members = await this.db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.organizationId, organizationId),
    })

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
    const pendingErrors = await this.errorService.getErrorCount({
      syncType: 'member',
      organizationId,
      status: 'failed',
      resolved: false,
    })

    return {
      enabled: organization.gitSyncEnabled || false,
      lastSyncAt: organization.gitLastSyncAt,
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
    const logId = await this.errorService.startSync({
      syncType: 'organization',
      action: 'create',
      provider: gitProvider as 'github' | 'gitlab',
      organizationId,
      metadata: {
        triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
      },
    })

    try {
      // 获取组织信息
      const [org] = await this.db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, organizationId))
        .limit(1)

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

      // 更新组织的 Git 信息(使用占位符)
      await this.db
        .update(schema.organizations)
        .set({
          gitOrgId: gitOrgName,
          gitOrgUrl: `https://${gitProvider === 'github' ? 'github.com' : 'gitlab.com'}/${gitOrgName}`,
          gitLastSyncAt: new Date(),
        })
        .where(eq(schema.organizations.id, organizationId))

      await this.errorService.updateSyncLog(logId, {
        status: 'success',
      })

      this.logger.info(`Marked Git organization for manual setup: ${gitOrgName}`)
    } catch (error) {
      await this.errorService.updateSyncLog(logId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
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
    // 获取组织信息
    const [org] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1)

    if (!org || !org.gitSyncEnabled || !org.gitProvider || !org.gitOrgId) {
      throw new Error('Organization Git sync not configured')
    }

    const logId = await this.errorService.startSync({
      syncType: 'member',
      action: 'create',
      provider: org.gitProvider as 'github' | 'gitlab',
      organizationId,
      userId,
      metadata: {
        triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
      },
    })

    try {
      // 获取用户的 Git 账号
      const [gitConnection] = await this.db
        .select()
        .from(schema.gitConnections)
        .where(
          and(
            eq(schema.gitConnections.userId, userId),
            eq(schema.gitConnections.provider, org.gitProvider),
          ),
        )
        .limit(1)

      if (!gitConnection) {
        throw new Error(`User does not have ${org.gitProvider} account linked`)
      }

      // 获取组织所有者的访问令牌
      const [owner] = await this.db
        .select()
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, organizationId),
            eq(schema.organizationMembers.role, 'owner'),
          ),
        )
        .limit(1)

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      const [ownerGitConnection] = await this.db
        .select()
        .from(schema.gitConnections)
        .where(
          and(
            eq(schema.gitConnections.userId, owner.userId),
            eq(schema.gitConnections.provider, org.gitProvider),
          ),
        )
        .limit(1)

      if (!ownerGitConnection) {
        throw new Error(`Owner does not have ${org.gitProvider} account linked`)
      }

      // 映射角色到 Git 权限
      const gitRole = this.mapOrgRoleToGitPermission(role, org.gitProvider as 'github' | 'gitlab')

      // 添加成员到 Git 组织
      if (org.gitProvider === 'github') {
        await this.gitProvider.addGitHubOrgMember(
          ownerGitConnection.accessToken,
          org.gitOrgName!,
          gitConnection.username,
          gitRole as 'admin' | 'member',
        )
      } else if (org.gitProvider === 'gitlab') {
        await this.gitProvider.addGitLabGroupMember(
          ownerGitConnection.accessToken,
          org.gitOrgId,
          Number.parseInt(gitConnection.providerAccountId!, 10),
          gitRole as 10 | 20 | 30 | 40 | 50,
        )
      }

      await this.errorService.updateSyncLog(logId, {
        status: 'success',
      })

      this.logger.info(`Added member ${userId} to Git organization ${org.gitOrgName}`)
    } catch (error) {
      await this.errorService.updateSyncLog(logId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
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
    // 获取组织信息
    const [org] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1)

    if (!org || !org.gitSyncEnabled || !org.gitProvider || !org.gitOrgId) {
      throw new Error('Organization Git sync not configured')
    }

    const logId = await this.errorService.startSync({
      syncType: 'member',
      action: 'delete',
      provider: org.gitProvider as 'github' | 'gitlab',
      organizationId,
      userId,
      metadata: {
        triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
      },
    })

    try {
      // 获取用户的 Git 账号
      const [gitConnection] = await this.db
        .select()
        .from(schema.gitConnections)
        .where(
          and(
            eq(schema.gitConnections.userId, userId),
            eq(schema.gitConnections.provider, org.gitProvider),
          ),
        )
        .limit(1)

      if (!gitConnection) {
        // 用户没有关联 Git 账号,无需移除
        await this.errorService.updateSyncLog(logId, {
          status: 'success',
        })
        return
      }

      // 获取组织所有者的访问令牌
      const [owner] = await this.db
        .select()
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, organizationId),
            eq(schema.organizationMembers.role, 'owner'),
          ),
        )
        .limit(1)

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      const [ownerGitConnection] = await this.db
        .select()
        .from(schema.gitConnections)
        .where(
          and(
            eq(schema.gitConnections.userId, owner.userId),
            eq(schema.gitConnections.provider, org.gitProvider),
          ),
        )
        .limit(1)

      if (!ownerGitConnection) {
        throw new Error(`Owner does not have ${org.gitProvider} account linked`)
      }

      // 从 Git 组织移除成员
      if (org.gitProvider === 'github') {
        await this.gitProvider.removeGitHubOrgMember(
          ownerGitConnection.accessToken,
          org.gitOrgName!,
          gitConnection.username,
        )
      } else if (org.gitProvider === 'gitlab') {
        await this.gitProvider.removeGitLabGroupMember(
          ownerGitConnection.accessToken,
          org.gitOrgId,
          Number.parseInt(gitConnection.providerAccountId!, 10),
        )
      }

      await this.errorService.updateSyncLog(logId, {
        status: 'success',
      })

      this.logger.info(`Removed member ${userId} from Git organization ${org.gitOrgName}`)
    } catch (error) {
      await this.errorService.updateSyncLog(logId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
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
    // 获取组织信息
    const [org] = await this.db
      .select()
      .from(schema.organizations)
      .where(eq(schema.organizations.id, organizationId))
      .limit(1)

    if (!org || !org.gitSyncEnabled || !org.gitProvider || !org.gitOrgId) {
      throw new Error('Organization Git sync not configured')
    }

    const logId = await this.errorService.startSync({
      syncType: 'member',
      action: 'update',
      provider: org.gitProvider as 'github' | 'gitlab',
      organizationId,
      userId,
      metadata: {
        triggeredBy: triggeredBy as 'user' | 'system' | 'webhook',
      },
    })

    try {
      // 获取用户的 Git 账号
      const [gitConnection] = await this.db
        .select()
        .from(schema.gitConnections)
        .where(
          and(
            eq(schema.gitConnections.userId, userId),
            eq(schema.gitConnections.provider, org.gitProvider),
          ),
        )
        .limit(1)

      if (!gitConnection) {
        throw new Error(`User does not have ${org.gitProvider} account linked`)
      }

      // 获取组织所有者的访问令牌
      const [owner] = await this.db
        .select()
        .from(schema.organizationMembers)
        .where(
          and(
            eq(schema.organizationMembers.organizationId, organizationId),
            eq(schema.organizationMembers.role, 'owner'),
          ),
        )
        .limit(1)

      if (!owner) {
        throw new Error('Organization owner not found')
      }

      const [ownerGitConnection] = await this.db
        .select()
        .from(schema.gitConnections)
        .where(
          and(
            eq(schema.gitConnections.userId, owner.userId),
            eq(schema.gitConnections.provider, org.gitProvider),
          ),
        )
        .limit(1)

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
        // GitHub 需要先移除再添加来更新角色
        await this.gitProvider.removeGitHubOrgMember(
          ownerGitConnection.accessToken,
          org.gitOrgName!,
          gitConnection.username,
        )
        await this.gitProvider.addGitHubOrgMember(
          ownerGitConnection.accessToken,
          org.gitOrgName!,
          gitConnection.username,
          gitRole as 'admin' | 'member',
        )
      } else if (org.gitProvider === 'gitlab') {
        // GitLab 也需要先移除再添加来更新角色
        await this.gitProvider.removeGitLabGroupMember(
          ownerGitConnection.accessToken,
          org.gitOrgId,
          Number.parseInt(gitConnection.providerAccountId!, 10),
        )
        await this.gitProvider.addGitLabGroupMember(
          ownerGitConnection.accessToken,
          org.gitOrgId,
          Number.parseInt(gitConnection.providerAccountId!, 10),
          gitRole as 10 | 20 | 30 | 40 | 50,
        )
      }

      await this.errorService.updateSyncLog(logId, {
        status: 'success',
      })

      this.logger.info(`Updated member ${userId} role in Git organization ${org.gitOrgName}`)
    } catch (error) {
      await this.errorService.updateSyncLog(logId, {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
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
