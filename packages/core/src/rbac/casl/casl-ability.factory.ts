import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { defineAbilitiesFor } from './abilities'
import type { AbilityOrgMember, AbilityProjectMember, AppAbility } from './types'

/**
 * CASL Ability Factory
 *
 * 负责为用户创建权限对象
 */
@Injectable()
export class CaslAbilityFactory {
  constructor(@Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 为用户创建权限对象
   *
   * @param userId - 用户 ID
   * @param organizationId - 组织 ID（可选）
   * @returns 权限对象
   */
  async createForUser(userId: string, organizationId?: string): Promise<AppAbility> {
    // 查询组织成员信息
    let orgMember: AbilityOrgMember | undefined
    if (organizationId) {
      const member = await this.db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.userId, userId),
          eq(schema.organizationMembers.organizationId, organizationId),
        ),
      })

      if (member) {
        orgMember = {
          userId,
          organizationId,
          role: member.role as 'owner' | 'admin' | 'member',
        }
      }
    }

    // 查询所有项目成员信息
    const projectMemberships = await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.userId, userId),
    })

    const projectMembers: AbilityProjectMember[] = projectMemberships.map((pm) => ({
      userId,
      projectId: pm.projectId,
      role: pm.role as 'owner' | 'maintainer' | 'admin' | 'developer' | 'member' | 'viewer',
    }))

    return defineAbilitiesFor({ id: userId }, orgMember, projectMembers)
  }

  /**
   * 为用户创建项目特定的权限对象
   *
   * @param userId - 用户 ID
   * @param projectId - 项目 ID
   * @returns 权限对象
   */
  async createForProject(userId: string, projectId: string): Promise<AppAbility> {
    // 获取项目信息
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) {
      return defineAbilitiesFor({ id: userId })
    }

    // 查询组织成员信息
    const orgMember = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, project.organizationId),
      ),
    })

    // 查询项目成员信息
    const projectMember = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.userId, userId),
        eq(schema.projectMembers.projectId, projectId),
      ),
    })

    const orgMemberData: AbilityOrgMember | undefined = orgMember
      ? {
          userId,
          organizationId: project.organizationId,
          role: orgMember.role as 'owner' | 'admin' | 'member',
        }
      : undefined

    const projectMemberData: AbilityProjectMember[] = projectMember
      ? [
          {
            userId,
            projectId,
            role: projectMember.role as
              | 'owner'
              | 'maintainer'
              | 'admin'
              | 'developer'
              | 'member'
              | 'viewer',
          },
        ]
      : []

    return defineAbilitiesFor({ id: userId }, orgMemberData, projectMemberData)
  }
}
