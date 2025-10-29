import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import { DATABASE } from '@juanie/core-tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 创建项目
  @Trace('projects.create')
  async create(
    userId: string,
    data: {
      organizationId: string
      name: string
      slug: string
      description?: string
      logoUrl?: string
    },
  ) {
    // 检查用户是否是组织成员
    const member = await this.getOrgMember(data.organizationId, userId)
    if (!member) {
      throw new Error('不是组织成员')
    }

    // 只有 owner 和 admin 可以创建项目
    if (!['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限创建项目')
    }

    const [project] = await this.db
      .insert(schema.projects)
      .values({
        organizationId: data.organizationId,
        name: data.name,
        slug: data.slug,
        description: data.description,
        logoUrl: data.logoUrl,
      })
      .returning()

    return project
  }

  // 上传项目 Logo
  @Trace('projects.uploadLogo')
  async uploadLogo(userId: string, projectId: string, logoUrl: string | null) {
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const member = await this.getOrgMember(project.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限上传 Logo')
    }

    const [updated] = await this.db
      .update(schema.projects)
      .set({
        logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))
      .returning()

    return updated
  }

  // 列出组织的项目
  @Trace('projects.list')
  async list(userId: string, organizationId: string) {
    // 检查用户是否是组织成员
    const member = await this.getOrgMember(organizationId, userId)
    if (!member) {
      throw new Error('不是组织成员')
    }

    const projects = await this.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        slug: schema.projects.slug,
        description: schema.projects.description,
        config: schema.projects.config,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects)
      .where(
        and(eq(schema.projects.organizationId, organizationId), isNull(schema.projects.deletedAt)),
      )

    return projects
  }

  // 获取项目详情
  @Trace('projects.get')
  async get(userId: string, projectId: string) {
    const [project] = await this.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        slug: schema.projects.slug,
        description: schema.projects.description,
        organizationId: schema.projects.organizationId,
        config: schema.projects.config,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
      .limit(1)

    if (!project) {
      return null
    }

    // 检查用户是否有权限访问（组织成员或项目成员）
    const hasAccess = await this.checkAccess(userId, projectId, project.organizationId)
    if (!hasAccess) {
      throw new Error('没有权限访问该项目')
    }

    return project
  }

  // 更新项目
  @Trace('projects.update')
  async update(
    userId: string,
    projectId: string,
    data: {
      name?: string
      slug?: string
      description?: string
      config?: {
        defaultBranch?: string
        enableCiCd?: boolean
        enableAi?: boolean
      }
    },
  ) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const member = await this.getOrgMember(project.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限更新项目')
    }

    // 合并 config
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.slug !== undefined) updateData.slug = data.slug
    if (data.description !== undefined) updateData.description = data.description

    if (data.config) {
      updateData.config = {
        defaultBranch: data.config.defaultBranch ?? project.config?.defaultBranch ?? 'main',
        enableCiCd: data.config.enableCiCd ?? project.config?.enableCiCd ?? true,
        enableAi: data.config.enableAi ?? project.config?.enableAi ?? true,
      }
    }

    const [updated] = await this.db
      .update(schema.projects)
      .set(updateData)
      .where(eq(schema.projects.id, projectId))
      .returning()

    return updated
  }

  // 软删除项目
  @Trace('projects.delete')
  async delete(userId: string, projectId: string) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限（只有 owner 和 admin 可以删除）
    const member = await this.getOrgMember(project.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限删除项目')
    }

    await this.db
      .update(schema.projects)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(schema.projects.id, projectId))

    return { success: true }
  }

  // 添加项目成员
  @Trace('projects.addMember')
  async addMember(
    userId: string,
    projectId: string,
    data: {
      memberId: string
      role: 'admin' | 'developer' | 'viewer'
    },
  ) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(project.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限添加成员')
    }

    // 检查被添加的用户是否是组织成员
    const targetOrgMember = await this.getOrgMember(project.organizationId, data.memberId)
    if (!targetOrgMember) {
      throw new Error('用户不是组织成员')
    }

    // 检查是否已经是项目成员
    const existing = await this.getProjectMember(projectId, data.memberId)
    if (existing) {
      throw new Error('用户已经是项目成员')
    }

    const [member] = await this.db
      .insert(schema.projectMembers)
      .values({
        projectId,
        userId: data.memberId,
        role: data.role,
      })
      .returning()

    return member
  }

  // 列出项目成员
  @Trace('projects.listMembers')
  async listMembers(userId: string, projectId: string) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const members = await this.db
      .select({
        id: schema.projectMembers.id,
        role: schema.projectMembers.role,
        joinedAt: schema.projectMembers.joinedAt,
        user: {
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatarUrl: schema.users.avatarUrl,
          email: schema.users.email,
        },
      })
      .from(schema.projectMembers)
      .innerJoin(schema.users, eq(schema.projectMembers.userId, schema.users.id))
      .where(eq(schema.projectMembers.projectId, projectId))

    return members
  }

  // 更新成员角色
  @Trace('projects.updateMemberRole')
  async updateMemberRole(
    userId: string,
    projectId: string,
    data: {
      memberId: string
      role: 'admin' | 'developer' | 'viewer'
    },
  ) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(project.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限更新成员角色')
    }

    const [updated] = await this.db
      .update(schema.projectMembers)
      .set({
        role: data.role,
      })
      .where(eq(schema.projectMembers.id, data.memberId))
      .returning()

    return updated
  }

  // 移除成员
  @Trace('projects.removeMember')
  async removeMember(
    userId: string,
    projectId: string,
    data: {
      memberId: string
    },
  ) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(project.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限移除成员')
    }

    await this.db.delete(schema.projectMembers).where(eq(schema.projectMembers.id, data.memberId))

    return { success: true }
  }

  // 分配团队到项目
  @Trace('projects.assignTeam')
  async assignTeam(
    userId: string,
    projectId: string,
    data: {
      teamId: string
    },
  ) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(project.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限分配团队')
    }

    // 检查团队是否属于同一组织
    const [team] = await this.db
      .select()
      .from(schema.teams)
      .where(and(eq(schema.teams.id, data.teamId), isNull(schema.teams.deletedAt)))
      .limit(1)

    if (!team || team.organizationId !== project.organizationId) {
      throw new Error('团队不存在或不属于该组织')
    }

    // 检查是否已经分配
    const existing = await this.db
      .select()
      .from(schema.teamProjects)
      .where(
        and(
          eq(schema.teamProjects.teamId, data.teamId),
          eq(schema.teamProjects.projectId, projectId),
        ),
      )
      .limit(1)

    if (existing.length > 0) {
      throw new Error('团队已经分配到该项目')
    }

    const [assignment] = await this.db
      .insert(schema.teamProjects)
      .values({
        teamId: data.teamId,
        projectId,
      })
      .returning()

    return assignment
  }

  // 列出项目的团队
  @Trace('projects.listTeams')
  async listTeams(userId: string, projectId: string) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const teams = await this.db
      .select({
        id: schema.teamProjects.id,
        role: schema.teamProjects.role,
        createdAt: schema.teamProjects.createdAt,
        team: {
          id: schema.teams.id,
          name: schema.teams.name,
          slug: schema.teams.slug,
          description: schema.teams.description,
        },
      })
      .from(schema.teamProjects)
      .innerJoin(schema.teams, eq(schema.teamProjects.teamId, schema.teams.id))
      .where(eq(schema.teamProjects.projectId, projectId))

    return teams
  }

  // 移除团队
  @Trace('projects.removeTeam')
  async removeTeam(
    userId: string,
    projectId: string,
    data: {
      teamId: string
    },
  ) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const orgMember = await this.getOrgMember(project.organizationId, userId)
    if (!orgMember || !['owner', 'admin'].includes(orgMember.role)) {
      throw new Error('没有权限移除团队')
    }

    await this.db
      .delete(schema.teamProjects)
      .where(
        and(
          eq(schema.teamProjects.teamId, data.teamId),
          eq(schema.teamProjects.projectId, projectId),
        ),
      )

    return { success: true }
  }

  // 检查用户是否有权限访问项目
  private async checkAccess(
    userId: string,
    projectId: string,
    organizationId: string,
  ): Promise<boolean> {
    // 检查是否是组织成员
    const orgMember = await this.getOrgMember(organizationId, userId)
    if (orgMember) {
      return true
    }

    // 检查是否是项目成员
    const projectMember = await this.getProjectMember(projectId, userId)
    if (projectMember) {
      return true
    }

    // 检查是否通过团队访问
    const [teamAccess] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.teamProjects)
      .innerJoin(schema.teamMembers, eq(schema.teamProjects.teamId, schema.teamMembers.teamId))
      .where(
        and(eq(schema.teamProjects.projectId, projectId), eq(schema.teamMembers.userId, userId)),
      )

    return (teamAccess?.count || 0) > 0
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

  // 辅助方法：获取项目成员信息
  private async getProjectMember(projectId: string, userId: string) {
    const [member] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    return member || null
  }
}
