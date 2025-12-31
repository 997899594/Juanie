/**
 * RBAC 服务
 *
 * 负责查询用户角色并生成权限对象
 *
 * @packageDocumentation
 */

import type { DatabaseClient } from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import type { Action, ProjectRole, Subject } from '@juanie/types'
import { mapTeamRoleToProjectRole } from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { PinoLogger } from 'nestjs-pino'
import {
  type AbilityOrgMember,
  type AbilityProjectMember,
  type AbilityTeamMember,
  type AbilityUser,
  defineAbilitiesFor,
  serializeAbility,
} from './abilities/abilities'
import type { AppAbility } from './types'

@Injectable()
export class RbacService {
  constructor(
    @Inject(DATABASE) private readonly db: DatabaseClient,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(RbacService.name)
  }

  /**
   * 为用户生成权限对象
   *
   * @param userId - 用户 ID
   * @param organizationId - 组织 ID（可选）
   * @param projectId - 项目 ID（可选）
   * @returns 权限对象
   */
  async defineAbilitiesForUser(
    userId: string,
    organizationId?: string,
    projectId?: string,
  ): Promise<AppAbility> {
    const user: AbilityUser = { id: userId }

    // 查询组织成员角色
    let orgMember: AbilityOrgMember | undefined
    if (organizationId) {
      // ✅ 使用 Relational Query 关联查询组织，检查是否被软删除
      const orgMemberRecord = await this.db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.userId, userId),
          eq(schema.organizationMembers.organizationId, organizationId),
        ),
        with: {
          organization: {
            columns: {
              id: true,
              deletedAt: true,
            },
          },
        },
      })

      // ✅ 添加调试日志
      console.log('[RBAC defineAbilities] Organization member query:', {
        userId,
        organizationId,
        found: !!orgMemberRecord,
        role: orgMemberRecord?.role,
        orgDeleted: orgMemberRecord?.organization?.deletedAt !== null,
      })

      // ✅ 只有组织未被删除时，才使用该角色
      if (
        orgMemberRecord &&
        orgMemberRecord.organization &&
        !orgMemberRecord.organization.deletedAt
      ) {
        orgMember = {
          userId: orgMemberRecord.userId,
          organizationId: orgMemberRecord.organizationId,
          role: orgMemberRecord.role as AbilityOrgMember['role'],
        }
      }
    }

    // 查询项目成员角色（直接分配）
    let projectMembers: AbilityProjectMember[] = []
    if (projectId) {
      const projectMemberRecords = await this.db.query.projectMembers.findMany({
        where: eq(schema.projectMembers.userId, userId),
      })

      projectMembers = projectMemberRecords.map((record) => ({
        userId: record.userId,
        projectId: record.projectId,
        role: record.role as AbilityProjectMember['role'],
      }))

      // ✅ Phase 3: 添加团队继承的项目权限
      const teamInheritedMembers = await this.getTeamInheritedProjectMembers(userId, projectId)
      projectMembers = this.mergeProjectMembers(projectMembers, teamInheritedMembers)
    }

    // 查询团队成员角色
    const teamMemberRecords = await this.db.query.teamMembers.findMany({
      where: eq(schema.teamMembers.userId, userId),
    })

    const teamMembers: AbilityTeamMember[] = teamMemberRecords.map((record) => ({
      userId: record.userId,
      teamId: record.teamId,
      role: record.role as AbilityTeamMember['role'],
    }))

    // 生成权限对象
    const ability = defineAbilitiesFor(user, orgMember, projectMembers, teamMembers)

    this.logger.debug(
      {
        userId,
        organizationId,
        projectId,
        orgRole: orgMember?.role,
        directProjectRoles: projectMembers
          .filter((m) => m.projectId === projectId)
          .map((m) => ({ projectId: m.projectId, role: m.role, source: 'direct' })),
        teamRoles: teamMembers.map((m) => m.role),
      },
      'Generated abilities for user',
    )

    return ability
  }

  /**
   * 序列化权限规则（用于传输到前端）
   *
   * @param ability - 权限对象
   * @returns 序列化的权限规则
   */
  serializeAbility(ability: AppAbility): any[] {
    return serializeAbility(ability)
  }

  /**
   * 检查用户是否有特定权限
   *
   * @param userId - 用户 ID
   * @param action - 操作
   * @param subject - 资源
   * @param organizationId - 组织 ID（可选）
   * @param projectId - 项目 ID（可选）
   * @returns 是否有权限
   */
  async can(
    userId: string,
    action: Action,
    subject: Subject,
    organizationId?: string,
    projectId?: string,
  ): Promise<boolean> {
    const ability = await this.defineAbilitiesForUser(userId, organizationId, projectId)
    return ability.can(action, subject)
  }

  // ==================== Phase 3: 团队-项目权限继承 ====================

  /**
   * 获取用户通过团队继承的项目权限
   *
   * 权限继承规则：
   * - 查询用户所属的所有团队
   * - 查询这些团队可以访问的项目
   * - 将团队成员角色映射为项目角色
   *
   * 映射规则：
   * - team owner/maintainer → project maintainer
   * - team member → project developer
   *
   * @param userId - 用户 ID
   * @param projectId - 项目 ID
   * @returns 团队继承的项目成员列表
   */
  private async getTeamInheritedProjectMembers(
    userId: string,
    projectId: string,
  ): Promise<AbilityProjectMember[]> {
    // 1. 查询用户所属的团队及其角色
    const userTeams = await this.db.query.teamMembers.findMany({
      where: eq(schema.teamMembers.userId, userId),
    })

    if (userTeams.length === 0) {
      return []
    }

    const teamIds = userTeams.map((tm) => tm.teamId)

    // 2. 查询这些团队可以访问的项目
    const teamProjects = await this.db.query.teamProjects.findMany({
      where: and(
        eq(schema.teamProjects.projectId, projectId),
        // teamId in teamIds
        // Drizzle doesn't have inArray for query API, so we'll use raw SQL or filter in memory
      ),
    })

    // 过滤出可以访问目标项目的团队
    const accessibleTeamIds = new Set(
      teamProjects.filter((tp) => teamIds.includes(tp.teamId)).map((tp) => tp.teamId),
    )

    if (accessibleTeamIds.size === 0) {
      return []
    }

    // 3. 将团队成员角色映射为项目角色
    const inheritedMembers: AbilityProjectMember[] = []

    for (const userTeam of userTeams) {
      if (accessibleTeamIds.has(userTeam.teamId)) {
        const teamRole = userTeam.role as AbilityTeamMember['role']
        const projectRole = mapTeamRoleToProjectRole(teamRole)

        inheritedMembers.push({
          userId: userTeam.userId,
          projectId,
          role: projectRole,
        })
      }
    }

    this.logger.debug(
      {
        userId,
        projectId,
        userTeams: userTeams.map((t) => ({ teamId: t.teamId, role: t.role })),
        accessibleTeams: Array.from(accessibleTeamIds),
        inheritedRoles: inheritedMembers.map((m) => m.role),
      },
      'Calculated team-inherited project permissions',
    )

    return inheritedMembers
  }

  /**
   * 合并直接项目成员和团队继承的项目成员
   *
   * 权限优先级：直接项目角色 > 团队继承角色
   * 如果用户既是直接项目成员，又通过团队访问项目，使用直接项目角色
   *
   * @param directMembers - 直接项目成员
   * @param inheritedMembers - 团队继承的项目成员
   * @returns 合并后的项目成员列表
   */
  private mergeProjectMembers(
    directMembers: AbilityProjectMember[],
    inheritedMembers: AbilityProjectMember[],
  ): AbilityProjectMember[] {
    // 创建 projectId → role 的映射（直接成员优先）
    const memberMap = new Map<string, AbilityProjectMember>()

    // 先添加继承的成员
    for (const member of inheritedMembers) {
      memberMap.set(member.projectId, member)
    }

    // 直接成员覆盖继承的成员（优先级更高）
    for (const member of directMembers) {
      memberMap.set(member.projectId, member)
    }

    return Array.from(memberMap.values())
  }

  /**
   * 获取用户对项目的有效角色
   *
   * 考虑所有权限来源：
   * 1. 组织角色（owner → maintainer, admin → developer）
   * 2. 直接项目成员角色
   * 3. 团队继承的项目角色
   *
   * 返回权限最高的角色
   *
   * @param userId - 用户 ID
   * @param projectId - 项目 ID
   * @returns 有效的项目角色，如果无权限则返回 null
   */
  async getEffectiveProjectRoleForUser(
    userId: string,
    projectId: string,
  ): Promise<ProjectRole | null> {
    // 1. 查询项目所属组织
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) {
      return null
    }

    // 2. 查询组织成员角色
    const orgMember = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, project.organizationId),
      ),
    })

    // 组织 owner → project maintainer
    if (orgMember?.role === 'owner') {
      return 'maintainer'
    }

    // 组织 admin → project developer
    if (orgMember?.role === 'admin') {
      return 'developer'
    }

    // 3. 查询直接项目成员角色
    const directMember = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.userId, userId),
        eq(schema.projectMembers.projectId, projectId),
      ),
    })

    if (directMember) {
      return directMember.role as ProjectRole
    }

    // 4. 查询团队继承的项目角色
    const teamInheritedMembers = await this.getTeamInheritedProjectMembers(userId, projectId)

    if (teamInheritedMembers.length > 0) {
      // 如果用户通过多个团队访问同一个项目，返回权限最高的角色
      // 这里简化处理：返回第一个（因为通常一个用户不会通过多个团队访问同一个项目）
      const firstRole = teamInheritedMembers[0]
      if (firstRole) {
        return firstRole.role
      }
    }

    // 5. 检查项目可见性
    if (project.visibility === 'public') {
      return 'viewer' // 公开项目，所有人可见
    }

    if (project.visibility === 'internal' && orgMember) {
      return 'viewer' // 内部项目，组织成员可见
    }

    // 6. 无权限
    return null
  }

  /**
   * 检查团队是否可以访问项目
   *
   * @param teamId - 团队 ID
   * @param projectId - 项目 ID
   * @returns 是否有访问权限
   */
  async checkTeamProjectAccess(teamId: string, projectId: string): Promise<boolean> {
    const teamProject = await this.db.query.teamProjects.findFirst({
      where: and(
        eq(schema.teamProjects.teamId, teamId),
        eq(schema.teamProjects.projectId, projectId),
      ),
    })

    return !!teamProject
  }
}
