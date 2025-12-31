import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import type {
  CreateOrganizationInput,
  InviteMemberInput,
  RemoveMemberInput,
  SuccessResponse,
  UpdateMemberRoleInput,
  UpdateOrganizationInput,
} from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import {
  CannotRemoveOwnerError,
  NotOrganizationMemberError,
  OperationFailedError,
  OrganizationMemberAlreadyExistsError,
  OrganizationNotFoundError,
  PermissionDeniedError,
} from '../errors'
import { OrganizationEventsService } from './organization-events.service'

@Injectable()
export class OrganizationsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private organizationEvents: OrganizationEventsService,
  ) {}

  // 创建组织（自动添加创建者为 owner）
  @Trace('organizations.create')
  async create(userId: string, data: CreateOrganizationInput) {
    return await this.db.transaction(async (tx) => {
      // 创建组织，slug 使用时间戳 + 随机数保证唯一性（用户不可见）
      const slug = `org-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

      const [org] = await tx
        .insert(schema.organizations)
        .values({
          name: data.name,
          slug,
          displayName: data.displayName,
          gitSyncEnabled: data.gitSyncEnabled || false,
          gitProvider: data.gitProvider || null,
          gitOrgName: data.gitOrgName || null,
        })
        .returning()

      if (!org) {
        throw new OperationFailedError('create_organization', 'Database insert returned no result')
      }

      // 添加创建者为 owner
      await tx.insert(schema.organizationMembers).values({
        organizationId: org.id,
        userId,
        role: 'owner',
      })

      // 发布组织创建事件 (用于自动同步)
      this.organizationEvents.emitOrganizationCreated({
        organizationId: org.id,
        name: org.name,
        gitSyncEnabled: org.gitSyncEnabled || false,
        gitProvider: org.gitProvider || undefined,
        gitOrgName: org.gitOrgName || undefined,
        createdBy: userId,
      })

      return org
    })
  }

  // 列出用户的组织
  async list(userId: string) {
    // 使用 Relational Query 加载关联数据
    const memberships = await this.db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.userId, userId),
      columns: {
        role: true,
      },
      with: {
        organization: true,
      },
    })

    // 过滤软删除的组织，并扁平化结构
    return memberships
      .filter((m) => m.organization && !m.organization.deletedAt)
      .map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        displayName: m.organization.displayName,
        type: m.organization.type, // ✅ 添加 type 字段
        quotas: m.organization.quotas,
        createdAt: m.organization.createdAt,
        gitSyncEnabled: m.organization.gitSyncEnabled,
        gitProvider: m.organization.gitProvider,
        gitOrgName: m.organization.gitOrgName,
        gitOrgUrl: m.organization.gitOrgUrl,
        gitLastSyncAt: m.organization.gitLastSyncAt,
        role: m.role,
      }))
  }

  // 获取组织详情
  async get(orgId: string, userId: string) {
    // 使用 Relational Query 的 with + where（回调函数方式）
    const org = await this.db.query.organizations.findFirst({
      where: (orgs, { eq, and, isNull }) => and(eq(orgs.id, orgId), isNull(orgs.deletedAt)),
      with: {
        members: {
          where: (members, { eq }) => eq(members.userId, userId),
        },
      },
    })

    if (!org || !org.members || org.members.length === 0) {
      return null
    }

    const member = org.members[0]
    if (!member) {
      return null
    }

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      displayName: org.displayName,
      type: org.type, // ✅ 添加 type 字段
      quotas: org.quotas,
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
      role: member.role,
      gitSyncEnabled: org.gitSyncEnabled,
      gitProvider: org.gitProvider,
      gitOrgId: org.gitOrgId,
      gitOrgName: org.gitOrgName,
      gitOrgUrl: org.gitOrgUrl,
      gitLastSyncAt: org.gitLastSyncAt,
    }
  }

  // 更新组织
  async update(orgId: string, userId: string, data: UpdateOrganizationInput) {
    // 检查权限（只有 owner 和 admin 可以更新）
    const member = await this.getMember(orgId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new PermissionDeniedError('organization', 'update')
    }

    const [org] = await this.db
      .update(schema.organizations)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(and(eq(schema.organizations.id, orgId), isNull(schema.organizations.deletedAt)))
      .returning()

    return org
  }

  // 软删除组织
  async delete(orgId: string, userId: string): Promise<SuccessResponse> {
    // 检查权限（只有 owner 可以删除）
    const member = await this.getMember(orgId, userId)
    if (!member || member.role !== 'owner') {
      throw new PermissionDeniedError('organization', 'delete')
    }

    await this.db
      .update(schema.organizations)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(schema.organizations.id, orgId))

    return { success: true }
  }

  // 邀请成员
  async inviteMember(orgId: string, userId: string, data: InviteMemberInput) {
    // 检查权限（owner 和 admin 可以邀请）
    const member = await this.getMember(orgId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new PermissionDeniedError('organization', 'invite_member')
    }

    // 检查是否已经是成员
    const existing = await this.getMember(orgId, data.invitedUserId)
    if (existing) {
      throw new OrganizationMemberAlreadyExistsError(orgId, data.invitedUserId)
    }

    const [newMember] = await this.db
      .insert(schema.organizationMembers)
      .values({
        organizationId: orgId,
        userId: data.invitedUserId,
        role: data.role,
      })
      .returning()

    // 发布成员添加事件 (用于自动同步)
    this.organizationEvents.emitMemberAdded({
      organizationId: orgId,
      userId: data.invitedUserId,
      role: data.role,
      addedBy: userId,
    })

    return newMember
  }

  // 列出成员
  async listMembers(orgId: string, userId: string) {
    // 检查用户是否是组织成员
    const member = await this.getMember(orgId, userId)
    if (!member) {
      throw new NotOrganizationMemberError(orgId, userId)
    }

    // 使用 Relational Query 加载用户信息
    const members = await this.db.query.organizationMembers.findMany({
      where: eq(schema.organizationMembers.organizationId, orgId),
      with: {
        user: {
          columns: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            email: true,
          },
        },
      },
    })

    return members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: m.user,
    }))
  }

  // 更新成员角色
  async updateMemberRole(orgId: string, userId: string, data: UpdateMemberRoleInput) {
    // 检查权限（只有 owner 可以更改角色）
    const member = await this.getMember(orgId, userId)
    if (!member || member.role !== 'owner') {
      throw new PermissionDeniedError('organization', 'update_member_role')
    }

    // 获取当前角色
    const [currentMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.id, data.memberId))
      .limit(1)

    if (!currentMember) {
      throw new OrganizationNotFoundError(data.memberId)
    }

    const oldRole = currentMember.role

    const [updatedMember] = await this.db
      .update(schema.organizationMembers)
      .set({
        role: data.role,
      })
      .where(eq(schema.organizationMembers.id, data.memberId))
      .returning()

    if (!updatedMember) {
      throw new OperationFailedError('update_member_role', 'Database update returned no result')
    }

    // 发布角色更新事件 (用于自动同步)
    this.organizationEvents.emitMemberRoleUpdated({
      organizationId: orgId,
      userId: updatedMember.userId,
      oldRole: oldRole as 'owner' | 'admin' | 'member',
      newRole: data.role as 'owner' | 'admin' | 'member',
      updatedBy: userId,
    })

    return updatedMember
  }

  // 移除成员
  async removeMember(
    orgId: string,
    userId: string,
    data: RemoveMemberInput,
  ): Promise<SuccessResponse> {
    // 检查权限（owner 和 admin 可以移除成员）
    const member = await this.getMember(orgId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new PermissionDeniedError('organization', 'remove_member')
    }

    // 不能移除 owner
    const targetMember = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.id, data.memberId))
      .limit(1)

    if (targetMember[0]?.role === 'owner') {
      throw new CannotRemoveOwnerError(orgId)
    }

    await this.db
      .delete(schema.organizationMembers)
      .where(eq(schema.organizationMembers.id, data.memberId))

    // 发布成员移除事件 (用于自动同步)
    if (targetMember[0]) {
      this.organizationEvents.emitMemberRemoved({
        organizationId: orgId,
        userId: targetMember[0].userId,
        removedBy: userId,
      })
    }

    return { success: true }
  }

  // 获取配额使用情况（动态计算）
  async getQuotaUsage(orgId: string, userId: string) {
    // 检查权限
    const member = await this.getMember(orgId, userId)
    if (!member) {
      throw new NotOrganizationMemberError(orgId, userId)
    }

    // 获取组织配额
    const [org] = await this.db
      .select({ quotas: schema.organizations.quotas })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .limit(1)

    // 计算当前使用量
    const [projectCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.projects)
      .where(and(eq(schema.projects.organizationId, orgId), isNull(schema.projects.deletedAt)))

    const [teamCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.teams)
      .where(and(eq(schema.teams.organizationId, orgId), isNull(schema.teams.deletedAt)))

    const [memberCount] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.organizationId, orgId))

    return {
      quotas: org?.quotas || { maxProjects: 10, maxUsers: 50, maxStorageGb: 100 },
      usage: {
        projects: projectCount?.count || 0,
        teams: teamCount?.count || 0,
        members: memberCount?.count || 0,
      },
    }
  }

  // 检查配额
  async checkQuota(orgId: string, resource: 'projects' | 'teams' | 'members'): Promise<boolean> {
    const [org] = await this.db
      .select({ quotas: schema.organizations.quotas })
      .from(schema.organizations)
      .where(eq(schema.organizations.id, orgId))
      .limit(1)

    const quotas = org?.quotas || { maxProjects: 10, maxUsers: 50, maxStorageGb: 100 }

    let count = 0
    if (resource === 'projects') {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.projects)
        .where(and(eq(schema.projects.organizationId, orgId), isNull(schema.projects.deletedAt)))
      count = result?.count || 0
      return count < quotas.maxProjects
    } else if (resource === 'teams') {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.teams)
        .where(and(eq(schema.teams.organizationId, orgId), isNull(schema.teams.deletedAt)))
      count = result?.count || 0
      // teams 没有配额限制，返回 true
      return true
    } else if (resource === 'members') {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.organizationMembers)
        .where(eq(schema.organizationMembers.organizationId, orgId))
      count = result?.count || 0
      return count < quotas.maxUsers
    }

    return false
  }

  // ========================================
  // 公共方法：供 Business 层使用
  // ========================================

  /**
   * 检查组织是否存在
   * @param organizationId 组织 ID
   * @returns 是否存在
   */
  @Trace('organizations.exists')
  async exists(organizationId: string): Promise<boolean> {
    const org = await this.db.query.organizations.findFirst({
      where: and(
        eq(schema.organizations.id, organizationId),
        isNull(schema.organizations.deletedAt),
      ),
      columns: { id: true },
    })

    // ✅ 添加调试日志
    console.log('[OrganizationsService.exists]', {
      organizationId,
      found: !!org,
      org,
    })

    return !!org
  }

  /**
   * 获取组织成员信息（公共方法）
   * @param organizationId 组织 ID
   * @param userId 用户 ID
   * @returns 成员信息或 null
   */
  @Trace('organizations.getMember')
  async getMember(
    organizationId: string,
    userId: string,
  ): Promise<typeof schema.organizationMembers.$inferSelect | null> {
    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })
    return member || null
  }

  /**
   * 检查用户是否是组织成员
   * @param organizationId 组织 ID
   * @param userId 用户 ID
   * @returns 是否是成员
   */
  @Trace('organizations.isMember')
  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(organizationId, userId)
    return !!member
  }

  /**
   * 检查用户是否是组织管理员（owner 或 admin）
   * @param organizationId 组织 ID
   * @param userId 用户 ID
   * @returns 是否是管理员
   */
  @Trace('organizations.isAdmin')
  async isAdmin(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.getMember(organizationId, userId)
    return member ? ['owner', 'admin'].includes(member.role) : false
  }

  /**
   * 获取组织的所有管理员
   * @param organizationId 组织 ID
   * @returns 管理员列表
   */
  @Trace('organizations.getAdmins')
  async getAdmins(
    organizationId: string,
  ): Promise<Array<typeof schema.organizationMembers.$inferSelect>> {
    return this.db.query.organizationMembers.findMany({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        sql`${schema.organizationMembers.role} IN ('owner', 'admin')`,
      ),
    })
  }

  // ========================================
  // 私有辅助方法
  // ========================================
}
