import * as schema from '@juanie/core-database/schemas'
import { DATABASE } from '@juanie/core-tokens'
import type { CreateEnvironmentInput, UpdateEnvironmentInput } from '@juanie/core-types'
import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

@Injectable()
export class EnvironmentsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  async create(userId: string, data: CreateEnvironmentInput) {
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
        config: data.config
          ? {
              cloudProvider: data.config.cloudProvider,
              region: data.config.region,
              approvalRequired: data.config.approvalRequired ?? false,
              minApprovals: data.config.minApprovals ?? 1,
            }
          : { approvalRequired: false, minApprovals: 1 },
      })
      .returning()

    return environment
  }

  async list(userId: string, projectId: string) {
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

  async get(userId: string, environmentId: string) {
    const [environment] = await this.db
      .select()
      .from(schema.environments)
      .where(and(eq(schema.environments.id, environmentId), isNull(schema.environments.deletedAt)))
      .limit(1)

    if (!environment) {
      return null
    }

    const hasAccess = await this.checkProjectAccess(userId, environment.projectId)
    if (!hasAccess) {
      throw new Error('没有权限访问该环境')
    }

    return environment
  }

  async update(userId: string, environmentId: string, data: UpdateEnvironmentInput) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限更新环境')
    }

    const updateData: any = {
      updatedAt: new Date(),
    }

    if (data.name !== undefined) updateData.name = data.name

    if (data.config) {
      const currentConfig = environment.config as any
      updateData.config = {
        cloudProvider: data.config.cloudProvider ?? currentConfig?.cloudProvider,
        region: data.config.region ?? currentConfig?.region,
        approvalRequired: data.config.approvalRequired ?? currentConfig?.approvalRequired ?? false,
        minApprovals: data.config.minApprovals ?? currentConfig?.minApprovals ?? 1,
      }
    }

    const [updated] = await this.db
      .update(schema.environments)
      .set(updateData)
      .where(eq(schema.environments.id, environmentId))
      .returning()

    return updated
  }

  async delete(userId: string, environmentId: string) {
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

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

  private async checkProjectAccess(userId: string, projectId: string): Promise<boolean> {
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(eq(schema.projects.id, projectId))
      .limit(1)

    if (!project) {
      return false
    }

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
