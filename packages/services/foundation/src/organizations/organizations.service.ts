import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
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
        throw new Error('组织创建失败')
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
    const orgs = await this.db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        quotas: schema.organizations.quotas,
        createdAt: schema.organizations.createdAt,
        role: schema.organizationMembers.role,
        gitSyncEnabled: schema.organizations.gitSyncEnabled,
        gitProvider: schema.organizations.gitProvider,
        gitOrgName: schema.organizations.gitOrgName,
        gitOrgUrl: schema.organizations.gitOrgUrl,
        gitLastSyncAt: schema.organizations.gitLastSyncAt,
      })
      .from(schema.organizations)
      .innerJoin(
        schema.organizationMembers,
        eq(schema.organizations.id, schema.organizationMembers.organizationId),
      )
      .where(
        and(eq(schema.organizationMembers.userId, userId), isNull(schema.organizations.deletedAt)),
      )

    return orgs
  }

  // 获取组织详情
  async get(orgId: string, userId: string) {
    const [org] = await this.db
      .select({
        id: schema.organizations.id,
        name: schema.organizations.name,
        slug: schema.organizations.slug,
        displayName: schema.organizations.displayName,
        quotas: schema.organizations.quotas,
        createdAt: schema.organizations.createdAt,
        updatedAt: schema.organizations.updatedAt,
        role: schema.organizationMembers.role,
        gitSyncEnabled: schema.organizations.gitSyncEnabled,
        gitProvider: schema.organizations.gitProvider,
        gitOrgId: schema.organizations.gitOrgId,
        gitOrgName: schema.organizations.gitOrgName,
        gitOrgUrl: schema.organizations.gitOrgUrl,
        gitLastSyncAt: schema.organizations.gitLastSyncAt,
      })
      .from(schema.organizations)
      .innerJoin(
        schema.organizationMembers,
        eq(schema.organizations.id, schema.organizationMembers.organizationId),
      )
      .where(
        and(
          eq(schema.organizations.id, orgId),
          eq(schema.organizationMembers.userId, userId),
          isNull(schema.organizations.deletedAt),
        ),
      )
      .limit(1)

    return org || null
  }

  // 更新组织
  async update(orgId: string, userId: string, data: UpdateOrganizationInput) {
    // 检查权限（只有 owner 和 admin 可以更新）
    const member = await this.getMember(orgId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限更新组织')
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
      throw new Error('只有组织所有者可以删除组织')
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
      throw new Error('没有权限邀请成员')
    }

    // 检查是否已经是成员
    const existing = await this.getMember(orgId, data.invitedUserId)
    if (existing) {
      throw new Error('用户已经是组织成员')
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
      throw new Error('不是组织成员')
    }

    const members = await this.db
      .select({
        id: schema.organizationMembers.id,
        role: schema.organizationMembers.role,
        joinedAt: schema.organizationMembers.joinedAt,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          email: schema.users.email,
        },
      })
      .from(schema.organizationMembers)
      .innerJoin(schema.users, eq(schema.organizationMembers.userId, schema.users.id))
      .where(eq(schema.organizationMembers.organizationId, orgId))

    return members
  }

  // 更新成员角色
  async updateMemberRole(orgId: string, userId: string, data: UpdateMemberRoleInput) {
    // 检查权限（只有 owner 可以更改角色）
    const member = await this.getMember(orgId, userId)
    if (!member || member.role !== 'owner') {
      throw new Error('只有组织所有者可以更改成员角色')
    }

    // 获取当前角色
    const [currentMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.id, data.memberId))
      .limit(1)

    if (!currentMember) {
      throw new Error('成员不存在')
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
      throw new Error('Failed to update member role')
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
      throw new Error('没有权限移除成员')
    }

    // 不能移除 owner
    const targetMember = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(eq(schema.organizationMembers.id, data.memberId))
      .limit(1)

    if (targetMember[0]?.role === 'owner') {
      throw new Error('不能移除组织所有者')
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
      throw new Error('不是组织成员')
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

  // 辅助方法：获取成员信息
  private async getMember(orgId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, orgId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    return member || null
  }
}
