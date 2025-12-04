import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PermissionDeniedError } from '../errors'
import {
  Action,
  hasPermission,
  ORGANIZATION_PERMISSIONS,
  OrganizationRole,
  type Permission,
  PROJECT_PERMISSIONS,
  ProjectRole,
  Resource,
} from './permissions'

/**
 * RBAC 权限检查服务
 *
 * 提供统一的权限检查接口，支持：
 * - 组织级权限检查
 * - 项目级权限检查
 * - 资源级权限检查
 * - 角色查询
 */
@Injectable()
export class RBACService {
  constructor(@Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  /**
   * 检查用户是否有权限
   *
   * @param userId - 用户 ID
   * @param resource - 资源类型
   * @param action - 操作类型
   * @param resourceId - 资源 ID
   * @returns 是否有权限
   */
  async can(
    userId: string,
    resource: Resource,
    action: Action,
    resourceId: string,
  ): Promise<boolean> {
    // 1. 检查组织级权限
    if (resource === Resource.ORGANIZATION) {
      return this.canOrganization(userId, action, resourceId)
    }

    // 2. 检查项目级权限
    if (resource === Resource.PROJECT) {
      return this.canProject(userId, action, resourceId)
    }

    // 3. 检查环境权限
    if (resource === Resource.ENVIRONMENT) {
      return this.canEnvironment(userId, action, resourceId)
    }

    // 4. 检查部署权限
    if (resource === Resource.DEPLOYMENT) {
      return this.canDeployment(userId, action, resourceId)
    }

    // 5. 检查成员管理权限
    if (resource === Resource.MEMBER) {
      return this.canMember(userId, action, resourceId)
    }

    // 6. 检查团队权限
    if (resource === Resource.TEAM) {
      return this.canTeam(userId, action, resourceId)
    }

    return false
  }

  /**
   * 断言用户有权限（无权限则抛出错误）
   *
   * @param userId - 用户 ID
   * @param resource - 资源类型
   * @param action - 操作类型
   * @param resourceId - 资源 ID
   * @throws PermissionDeniedError 如果没有权限
   */
  async assert(
    userId: string,
    resource: Resource,
    action: Action,
    resourceId: string,
  ): Promise<void> {
    const hasPermission = await this.can(userId, resource, action, resourceId)

    if (!hasPermission) {
      throw new PermissionDeniedError(resource, action)
    }
  }

  /**
   * 获取用户在资源上的角色
   *
   * @param userId - 用户 ID
   * @param resource - 资源类型
   * @param resourceId - 资源 ID
   * @returns 角色名称，如果不是成员则返回 null
   */
  async getRole(userId: string, resource: Resource, resourceId: string): Promise<string | null> {
    if (resource === Resource.PROJECT) {
      const member = await this.db.query.projectMembers.findFirst({
        where: and(
          eq(schema.projectMembers.projectId, resourceId),
          eq(schema.projectMembers.userId, userId),
        ),
      })
      return member?.role || null
    }

    if (resource === Resource.ORGANIZATION) {
      const member = await this.db.query.organizationMembers.findFirst({
        where: and(
          eq(schema.organizationMembers.organizationId, resourceId),
          eq(schema.organizationMembers.userId, userId),
        ),
      })
      return member?.role || null
    }

    return null
  }

  /**
   * 获取用户的所有权限
   *
   * @param userId - 用户 ID
   * @param resource - 资源类型
   * @param resourceId - 资源 ID
   * @returns 权限列表
   */
  async getPermissions(
    userId: string,
    resource: Resource,
    resourceId: string,
  ): Promise<Permission[]> {
    const role = await this.getRole(userId, resource, resourceId)
    if (!role) return []

    if (resource === Resource.PROJECT) {
      return PROJECT_PERMISSIONS[role as ProjectRole] || []
    }

    if (resource === Resource.ORGANIZATION) {
      return ORGANIZATION_PERMISSIONS[role as OrganizationRole] || []
    }

    return []
  }

  // ==================== 私有方法 ====================

  /**
   * 检查组织权限
   */
  private async canOrganization(
    userId: string,
    action: Action,
    organizationId: string,
  ): Promise<boolean> {
    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })

    if (!member) return false

    const permissions = ORGANIZATION_PERMISSIONS[member.role as OrganizationRole]
    return hasPermission(permissions, Resource.ORGANIZATION, action)
  }

  /**
   * 检查项目权限
   */
  private async canProject(userId: string, action: Action, projectId: string): Promise<boolean> {
    // 1. 检查项目成员权限
    const projectMember = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId),
      ),
    })

    if (projectMember) {
      const permissions = PROJECT_PERMISSIONS[projectMember.role as ProjectRole]
      if (hasPermission(permissions, Resource.PROJECT, action)) {
        return true
      }
    }

    // 2. 检查组织管理员权限
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    if (!project) return false

    const orgMember = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, project.organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })

    if (!orgMember) return false

    // 组织 Owner 和 Admin 有所有项目权限
    if (
      [OrganizationRole.OWNER, OrganizationRole.ADMIN].includes(orgMember.role as OrganizationRole)
    ) {
      const orgPermissions = ORGANIZATION_PERMISSIONS[orgMember.role as OrganizationRole]
      return hasPermission(orgPermissions, Resource.PROJECT, action)
    }

    return false
  }

  /**
   * 检查环境权限
   */
  private async canEnvironment(
    userId: string,
    action: Action,
    environmentId: string,
  ): Promise<boolean> {
    // 获取环境所属项目
    const environment = await this.db.query.environments.findFirst({
      where: eq(schema.environments.id, environmentId),
    })

    if (!environment) return false

    // 检查项目权限
    return this.canProject(userId, action, environment.projectId)
  }

  /**
   * 检查部署权限
   */
  private async canDeployment(
    userId: string,
    action: Action,
    deploymentId: string,
  ): Promise<boolean> {
    // 获取部署所属环境
    const deployment = await this.db.query.deployments.findFirst({
      where: eq(schema.deployments.id, deploymentId),
    })

    if (!deployment) return false

    // 获取环境所属项目
    const environment = await this.db.query.environments.findFirst({
      where: eq(schema.environments.id, deployment.environmentId),
    })

    if (!environment) return false

    // 检查项目权限
    return this.canProject(userId, action, environment.projectId)
  }

  /**
   * 检查成员管理权限
   */
  private async canMember(userId: string, _action: Action, resourceId: string): Promise<boolean> {
    // resourceId 格式: "project:{projectId}" 或 "organization:{organizationId}"
    const [resourceType, id] = resourceId.split(':')

    if (!id) return false

    if (resourceType === 'project') {
      return this.can(userId, Resource.PROJECT, Action.MANAGE_MEMBERS, id)
    }

    if (resourceType === 'organization') {
      return this.can(userId, Resource.ORGANIZATION, Action.MANAGE_MEMBERS, id)
    }

    return false
  }

  /**
   * 检查团队权限
   */
  private async canTeam(userId: string, _action: Action, teamId: string): Promise<boolean> {
    // 获取团队所属组织
    const team = await this.db.query.teams.findFirst({
      where: eq(schema.teams.id, teamId),
    })

    if (!team || !team.organizationId) return false

    // 检查组织权限
    return this.can(userId, Resource.ORGANIZATION, Action.MANAGE_TEAMS, team.organizationId)
  }

  /**
   * 批量检查权限
   *
   * @param userId - 用户 ID
   * @param checks - 权限检查列表
   * @returns 每个检查的结果
   */
  async canBatch(
    userId: string,
    checks: Array<{ resource: Resource; action: Action; resourceId: string }>,
  ): Promise<boolean[]> {
    return Promise.all(
      checks.map((check) => this.can(userId, check.resource, check.action, check.resourceId)),
    )
  }

  /**
   * 检查用户是否是组织成员
   */
  async isOrganizationMember(userId: string, organizationId: string): Promise<boolean> {
    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })
    return !!member
  }

  /**
   * 检查用户是否是项目成员
   */
  async isProjectMember(userId: string, projectId: string): Promise<boolean> {
    const member = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId),
      ),
    })
    return !!member
  }

  /**
   * 检查用户是否是组织 Owner
   */
  async isOrganizationOwner(userId: string, organizationId: string): Promise<boolean> {
    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.organizationId, organizationId),
        eq(schema.organizationMembers.userId, userId),
      ),
    })
    return member?.role === OrganizationRole.OWNER
  }

  /**
   * 检查用户是否是项目管理员
   */
  async isProjectAdmin(userId: string, projectId: string): Promise<boolean> {
    const member = await this.db.query.projectMembers.findFirst({
      where: and(
        eq(schema.projectMembers.projectId, projectId),
        eq(schema.projectMembers.userId, userId),
      ),
    })
    return member?.role === ProjectRole.ADMIN
  }
}
