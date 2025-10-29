import * as schema from '@juanie/core-database/schemas'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { DATABASE } from '@/database/database.module'

@Injectable()
export class EnvironmentsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  // 创建环境
  async create(
    userId: string,
    data: {
      projectId: string
      name: string
      type: 'development' | 'staging' | 'production'
      description?: string
      config?: {
        url?: string
        autoDeployBranch?: string
        requiresApproval?: boolean
      }
    },
  ) {
    // 检查用户权限
    const hasPermission = await this.checkProjectPermission(userId, data.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限创建环境')
    }

    const [environment] = await this.db
      .insert(schema.environments)
      .values({
        projectId: data.projectId,
        name: data.name,
        type: data.type,
        description: data.description,
        config: data.config || {},
      })
      .returning()

    return environment
  }

  // 列出项目的环境
  async list(userId: string, projectId: string) {
    // 检查用户是否有项目访问权限
    const hasAccess = await this.checkProjectAccess(userId, projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该项目')
    }

    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(
        and(eq(schema.environments.projectId, projectId), isNull(schema.environments.deletedAt)),
      )

    return environments
  }

  // 获取环境详情
  async get(userId: string, environmentId: string) {
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(and(eq(schema.environments.id, environmentId), isNull(schema.environments.deletedAt)))
      .limit(1)

    if (!environment) {
      return null
    }

    // 检查用户是否有项目访问权限
    const hasAccess = await this.checkProjectAccess(userId, environment.projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该环境')
    }

    return environment
  }

  // 更新环境
  async update(
    userId: string,
    environmentId: string,
    data: {
      name?: string
      description?: string
      config?: {
        url?: string
        autoDeployBranch?: string
        requiresApproval?: boolean
      }
    },
  ) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    // 检查用户权限
    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限更新环境')
    }

    // 合并 config
    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name
    if (data.description !== undefined) updateData.description = data.description

    if (data.config) {
      updateData.config = {
        ...(environment.config || {}),
        ...data.config,
      }
    }

    const [updated] = await this.db
      .update(schema.environments)
      .set(updateData)
      .where(eq(schema.environments.id, environmentId))
      .returning()

    return updated
  }

  // 软删除环境
  async delete(userId: string, environmentId: string) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    // 检查用户权限
    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限删除环境')
    }

    await this.db
      .update(schema.environments)
      .set({
        deletedAt: new Date(),
      })
      .where(eq(schema.environments.id, environmentId))

    return { success: true }
  }

  // 授予环境权限
  async grantPermission(
    userId: string,
    environmentId: string,
    data: {
      userId: string
      canDeploy: boolean
      canApprove: boolean
    },
  ) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    // 检查用户权限
    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限管理环境权限')
    }

    // 更新 permissions JSONB
    const currentPermissions = (environment.permissions as any) || {}
    const updatedPermissions = {
      ...currentPermissions,
      [data.userId]: {
        canDeploy: data.canDeploy,
        canApprove: data.canApprove,
      },
    }

    const [updated] = await this.db
      .update(schema.environments)
      .set({
        permissions: updatedPermissions,
      })
      .where(eq(schema.environments.id, environmentId))
      .returning()

    return updated
  }

  // 撤销环境权限
  async revokePermission(
    userId: string,
    environmentId: string,
    data: {
      userId: string
    },
  ) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    // 检查用户权限
    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限管理环境权限')
    }

    // 从 permissions JSONB 中删除
    const currentPermissions = (environment.permissions as any) || {}
    delete currentPermissions[data.userId]

    const [updated] = await this.db
      .update(schema.environments)
      .set({
        permissions: currentPermissions,
      })
      .where(eq(schema.environments.id, environmentId))
      .returning()

    return updated
  }

  // 列出环境权限
  async listPermissions(userId: string, environmentId: string) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    const permissions = (environment.permissions as any) || {}

    // 转换为数组格式
    const permissionList = Object.entries(permissions).map(([userId, perms]: [string, any]) => ({
      userId,
      canDeploy: perms.canDeploy,
      canApprove: perms.canApprove,
    }))

    return permissionList
  }

  // 检查用户是否有环境部署权限
  async checkDeployPermission(userId: string, environmentId: string): Promise<boolean> {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      return false
    }

    // 项目 admin 自动有权限
    const isAdmin = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (isAdmin) {
      return true
    }

    // 检查环境特定权限
    const permissions = (environment.permissions as any) || {}
    return permissions[userId]?.canDeploy === true
  }

  // 辅助方法：检查项目访问权限
  private async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    // 检查是否是组织成员
    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember) {
      return true
    }

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

    return !!projectMember
  }

  // 辅助方法：检查项目权限级别
  private async checkProjectPermission(
    userId: string,
    projectId: string,
    requiredRole: 'admin' | 'developer',
  ): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

    // 检查组织权限
    const [orgMember] = await this.db
      .select()
      .from(schema.organizationMembers)
      .where(
        and(
          eq(schema.organizationMembers.organizationId, project.organizationId),
          eq(schema.organizationMembers.userId, userId),
        ),
      )
      .limit(1)

    if (orgMember && ['owner', 'admin'].includes(orgMember.role)) {
      return true
    }

    // 检查项目权限
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

    if (!projectMember) {
      return false
    }

    if (requiredRole === 'admin') {
      return projectMember.role === 'admin'
    }

    return ['admin', 'developer'].includes(projectMember.role)
  }
}
