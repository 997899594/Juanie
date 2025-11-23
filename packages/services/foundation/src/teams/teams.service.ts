import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DATABASE } from '@juanie/core-tokens'
import type {
  AddTeamMemberInput,
  CreateTeamInput,
  RemoveTeamMemberInput,
  UpdateTeamInput,
  UpdateTeamMemberRoleInput,
} from '@juanie/core-types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class TeamsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 创建团队
  @Trace('teams.create')
  async create(userId: string, data: CreateTeamInput) {
    // 检查用户是否是组织成员
    const member = await this.getOrgMember(data.organizationId, userId)
    if (!member) {
      throw new Error('不是组织成员')
    }

    // 只有 owner 和 admin 可以创建团队
    if (!['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限创建团队')
    }

    const [team] = await this.db
      .insert(schema.teams)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        description: data.description,
      })
      .returning()

    return team
  }

  // 列出组织的团队
  @Trace('teams.list')
  async list(userId: string, organizationId: string) {
    // 检查用户是否是组织成员
    const member = await this.getOrgMember(organizationId, userId)
    if (!member) {
      throw new Error('不是组织成员')
    }

    const teams = await this.db
      .select({
        id: schema.teams.id,
        name: schema.teams.name,
        slug: schema.teams.slug,
        description: schema.teams.description,
        createdAt: schema.teams.createdAt,
        updatedAt: schema.teams.updatedAt,
      })
      .from(schema.teams)
      .where(and(eq(schema.teams.organizationId, organizationId), isNull(schema.teams.deletedAt)))

    return teams
  }

  // 获取团队详情
  @Trace('teams.get')
  async get(userId: string, teamId: string) {
    const [team] = await this.db
      .select({
        id: schema.teams.id,
        name: schema.teams.name,
        slug: schema.teams.slug,
        description: schema.teams.description,
        organizationId: schema.teams.organizationId,
        createdAt: schema.teams.createdAt,
        updatedAt: schema.teams.updatedAt,
      })
      .from(schema.teams)
      .where(and(eq(schema.teams.id, teamId), isNull(schema.teams.deletedAt)))
      .limit(1)

    if (!team) {
      return null
    }

    // 检查用户是否是组织成员
    const member = await this.getOrgMember(team.organizationId, userId)
    if (!member) {
      throw new Error('不是组织成员')
    }

    return team
  }

  // 更新团队
  @Trace('teams.update')
  async update(userId: string, teamId: string, data: UpdateTeamInput) {
    // 获取团队信息
    const team = await this.get(userId, teamId)
    if (!team) {
      throw new Error('团队不存在')
    }

    // 检查权限
    const member = await this.getOrgMember(team.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限更新团队')
    }

    const [updated] = await this.db
      .update(schema.teams)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(schema.teams.id, teamId))
      .returning()

    return updated
  }

  // 软删除团队
  @Trace('teams.delete')
  async delete(userId: string, teamId: string) {
    // 获取团队信息
    const team = await this.get(userId, teamId)
    if (!team) {
      throw new Error('团队不存在')
    }

    // 检查权限（只有 owner 和 admin 可以删除）
    const member = await this.getOrgMember(team.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限删除团队')
    }

    await this.db
      .update(schema.teams)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(schema.teams.id, teamId))

    return { success: true }
  }

  // 添加成员
  @Trace('teams.addMember')
  async addMember(userId: string, teamId: string, data: AddTeamMemberInput) {
    // 获取团队信息
    const team = await this.get(userId, teamId)
    if (!team) {
      throw new Error('团队不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(team.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限添加成员')
    }

    // 检查被添加的用户是否是组织成员
    const targetOrgMember = await this.getOrgMember(team.organizationId, data.userId)
    if (!targetOrgMember) {
      throw new Error('用户不是组织成员')
    }

    // 检查是否已经是团队成员
    const existing = await this.getTeamMember(teamId, data.userId)
    if (existing) {
      throw new Error('用户已经是团队成员')
    }

    const [member] = await this.db
      .insert(schema.teamMembers)
      .values({
        teamId,
        userId: data.userId,
        role: data.role,
      })
      .returning()

    return member
  }

  // 列出团队成员
  @Trace('teams.listMembers')
  async listMembers(userId: string, teamId: string) {
    // 获取团队信息
    const team = await this.get(userId, teamId)
    if (!team) {
      throw new Error('团队不存在')
    }

    const members = await this.db
      .select({
        id: schema.teamMembers.id,
        role: schema.teamMembers.role,
        joinedAt: schema.teamMembers.joinedAt,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          email: schema.users.email,
        },
      })
      .from(schema.teamMembers)
      .innerJoin(schema.users, eq(schema.teamMembers.userId, schema.users.id))
      .where(eq(schema.teamMembers.teamId, teamId))

    return members
  }

  // 更新成员角色
  @Trace('teams.updateMemberRole')
  async updateMemberRole(userId: string, teamId: string, data: UpdateTeamMemberRoleInput) {
    // 获取团队信息
    const team = await this.get(userId, teamId)
    if (!team) {
      throw new Error('团队不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(team.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限更新成员角色')
    }

    const [updated] = await this.db
      .update(schema.teamMembers)
      .set({
        role: data.role,
      })
      .where(eq(schema.teamMembers.id, data.memberId))
      .returning()

    return updated
  }

  // 移除成员
  @Trace('teams.removeMember')
  async removeMember(userId: string, teamId: string, data: RemoveTeamMemberInput) {
    // 获取团队信息
    const team = await this.get(userId, teamId)
    if (!team) {
      throw new Error('团队不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(team.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限移除成员')
    }

    await this.db.delete(schema.teamMembers).where(eq(schema.teamMembers.id, data.memberId))

    return { success: true }
  }

  // 辅助方法：获取组织成员信息
  private async getOrgMember(organizationId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    return member || null
  }

  // 辅助方法：获取团队成员信息
  private async getTeamMember(teamId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(schema.teamMembers)
      .where(and(eq(schema.teamMembers.teamId, teamId), eq(schema.teamMembers.userId, userId)))
      .limit(1)

    return member || null
  }
}
