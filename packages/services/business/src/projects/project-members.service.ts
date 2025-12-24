import * as schema from '@juanie/core/database'
import { DomainEvents, EventPublisher } from '@juanie/core/events'
import { Logger } from '@juanie/core/logger'
import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import { AuditLogsService } from '@juanie/service-foundation'
import type { ProjectRole } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

/**
 * ProjectMembersService
 *
 * 职责：项目成员管理
 * - 添加/移除成员
 * - 更新成员角色
 * - 列出成员
 * - 权限检查
 *
 * 使用事件驱动架构与 GitSyncService 解耦
 */
@Injectable()
export class ProjectMembersService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private auditLogs: AuditLogsService,
    private eventPublisher: EventPublisher,
    private readonly logger: Logger,
  ) {
    this.logger.setContext(ProjectMembersService.name)
  }

  /**
   * 添加项目成员
   */
  @Trace('projectMembers.add')
  async addMember(
    userId: string,
    projectId: string,
    data: { userId: string; role: 'owner' | 'admin' | 'member' | 'viewer' },
  ) {
    // 检查是否已经是成员
    const [existing] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, data.userId),
        ),
      )
      .limit(1)

    if (existing) {
      throw new Error('用户已经是项目成员')
    }

    // 添加成员
    const [member] = await this.db
      .insert(schema.projectMembers)
      .values({
        projectId,
        userId: data.userId,
        role: data.role,
      })
      .returning()

    // 获取项目信息用于审计日志
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (project) {
      await this.auditLogs.log({
        userId,
        organizationId: project.organizationId,
        action: 'project.member.added',
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          memberId: data.userId,
          role: data.role,
        },
      })
    }

    // 触发 Git 平台权限同步事件
    // Requirements: 4.2 - 使用事件驱动架构解耦
    await this.eventPublisher.publishDomain({
      type: DomainEvents.PROJECT_MEMBER_ADDED,
      version: 1,
      resourceId: projectId,
      userId,
      data: {
        memberId: data.userId,
        role: this.mapRoleToProjectRole(data.role),
      },
    })
    this.logger.info(`Published member added event for ${data.userId} in project ${projectId}`)

    return member
  }

  /**
   * 列出项目成员
   */
  @Trace('projectMembers.list')
  async listMembers(projectId: string) {
    // 使用 Relational Query 自动加载关联的 user
    const members = await this.db.query.projectMembers.findMany({
      where: (members, { eq }) => eq(members.projectId, projectId),
      columns: {
        id: true,
        userId: true,
        role: true,
        joinedAt: true,
      },
      with: {
        user: {
          columns: {
            id: true,
            email: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
        },
      },
    })

    return members
  }

  /**
   * 更新成员角色
   */
  @Trace('projectMembers.updateRole')
  async updateMemberRole(
    userId: string,
    projectId: string,
    data: { userId: string; role: 'owner' | 'admin' | 'member' | 'viewer' },
  ) {
    // 检查成员是否存在
    const [existing] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, data.userId),
        ),
      )
      .limit(1)

    if (!existing) {
      throw new Error('成员不存在')
    }

    // 更新角色
    const [updated] = await this.db
      .update(schema.projectMembers)
      .set({
        role: data.role,
      })
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, data.userId),
        ),
      )
      .returning()

    // 获取项目信息用于审计日志
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (project) {
      await this.auditLogs.log({
        userId,
        organizationId: project.organizationId,
        action: 'project.member.role_updated',
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          memberId: data.userId,
          oldRole: existing.role,
          newRole: data.role,
        },
      })
    }

    // 触发 Git 平台权限更新事件
    // Requirements: 4.7 - 使用事件驱动架构解耦
    await this.eventPublisher.publishDomain({
      type: DomainEvents.PROJECT_MEMBER_UPDATED,
      version: 1,
      resourceId: projectId,
      userId,
      data: {
        memberId: data.userId,
        role: this.mapRoleToProjectRole(data.role),
        oldRole: this.mapRoleToProjectRole(existing.role),
      },
    })
    this.logger.info(`Published member updated event for ${data.userId} in project ${projectId}`)

    return updated
  }

  /**
   * 移除成员
   */
  @Trace('projectMembers.remove')
  async removeMember(userId: string, projectId: string, data: { userId: string }) {
    // 检查成员是否存在
    const [existing] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, data.userId),
        ),
      )
      .limit(1)

    if (!existing) {
      throw new Error('成员不存在')
    }

    // 删除成员
    await this.db
      .delete(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, data.userId),
        ),
      )

    // 获取项目信息用于审计日志
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (project) {
      await this.auditLogs.log({
        userId,
        organizationId: project.organizationId,
        action: 'project.member.removed',
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          memberId: data.userId,
          role: existing.role,
        },
      })
    }

    // 触发 Git 平台权限移除事件
    // Requirements: 4.8 - 使用事件驱动架构解耦
    await this.eventPublisher.publishDomain({
      type: DomainEvents.PROJECT_MEMBER_REMOVED,
      version: 1,
      resourceId: projectId,
      userId,
      data: {
        memberId: data.userId,
      },
    })
    this.logger.info(`Published member removed event for ${data.userId} in project ${projectId}`)

    return { success: true }
  }

  /**
   * 分配团队到项目
   */
  @Trace('projectMembers.assignTeam')
  async assignTeam(userId: string, projectId: string, data: { teamId: string }) {
    // 检查团队是否已经分配
    const [existing] = await this.db
      .select()
      .from(schema.teamProjects)
      .where(
        and(
          eq(schema.teamProjects.teamId, data.teamId),
          eq(schema.teamProjects.projectId, projectId),
        ),
      )
      .limit(1)

    if (existing) {
      throw new Error('团队已经分配到此项目')
    }

    // 分配团队
    const [assignment] = await this.db
      .insert(schema.teamProjects)
      .values({
        teamId: data.teamId,
        projectId,
      })
      .returning()

    // 获取项目信息用于审计日志
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (project) {
      await this.auditLogs.log({
        userId,
        organizationId: project.organizationId,
        action: 'project.team.assigned',
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          teamId: data.teamId,
        },
      })
    }

    return assignment
  }

  /**
   * 列出项目的团队
   */
  @Trace('projectMembers.listTeams')
  async listTeams(projectId: string) {
    // 使用 Relational Query 自动加载关联的 team
    const teams = await this.db.query.teamProjects.findMany({
      where: (teamProjects, { eq }) => eq(teamProjects.projectId, projectId),
      columns: {
        id: true,
        teamId: true,
        createdAt: true,
      },
      with: {
        team: {
          columns: {
            id: true,
            name: true,
            description: true,
          },
        },
      },
    })

    return teams
  }

  /**
   * 移除团队
   */
  @Trace('projectMembers.removeTeam')
  async removeTeam(userId: string, projectId: string, data: { teamId: string }) {
    // 检查团队是否已分配
    const [existing] = await this.db
      .select()
      .from(schema.teamProjects)
      .where(
        and(
          eq(schema.teamProjects.teamId, data.teamId),
          eq(schema.teamProjects.projectId, projectId),
        ),
      )
      .limit(1)

    if (!existing) {
      throw new Error('团队未分配到此项目')
    }

    // 移除团队
    await this.db
      .delete(schema.teamProjects)
      .where(
        and(
          eq(schema.teamProjects.teamId, data.teamId),
          eq(schema.teamProjects.projectId, projectId),
        ),
      )

    // 获取项目信息用于审计日志
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (project) {
      await this.auditLogs.log({
        userId,
        organizationId: project.organizationId,
        action: 'project.team.removed',
        resourceType: 'project',
        resourceId: projectId,
        metadata: {
          teamId: data.teamId,
        },
      })
    }

    return { success: true }
  }

  /**
   * 检查用户是否有项目访问权限
   */
  async hasAccess(userId: string, projectId: string): Promise<boolean> {
    // 检查是否是项目成员
    const [projectMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(
        and(
          eq(schema.projectMembers.projectId, projectId),
          eq(schema.projectMembers.userId, userId),
        ),
      )
      .limit(1)

    if (projectMember) {
      return true
    }

    // 检查是否通过团队有访问权限
    const [teamAccess] = await this.db
      .select()
      .from(schema.teamProjects)
      .innerJoin(schema.teamMembers, eq(schema.teamProjects.teamId, schema.teamMembers.teamId))
      .where(
        and(eq(schema.teamProjects.projectId, projectId), eq(schema.teamMembers.userId, userId)),
      )
      .limit(1)

    return !!teamAccess
  }

  /**
   * 获取用户在项目中的角色
   */
  async getUserRole(userId: string, projectId: string): Promise<string | null> {
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

    return member?.role || null
  }

  /**
   * 映射项目成员角色到 Git 同步角色
   *
   * @param role - 项目成员角色
   * @returns Git 同步角色
   */
  private mapRoleToProjectRole(role: string): ProjectRole {
    // 映射项目角色到 Git 同步支持的角色
    switch (role) {
      case 'owner':
      case 'admin':
        return 'maintainer'
      case 'member':
        return 'developer'
      case 'viewer':
        return 'viewer'
      default:
        return 'viewer' // 默认最低权限
    }
  }
}
