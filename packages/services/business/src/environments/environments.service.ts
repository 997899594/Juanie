import * as schema from '@juanie/core/database'
import { DEPLOYMENT_QUEUE } from '@juanie/core/queue'
import { DATABASE } from '@juanie/core/tokens'
import type {
  CreateEnvironmentInput,
  EnvironmentUpdatedEvent,
  UpdateEnvironmentInput,
} from '@juanie/types'
import { Inject, Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'
import type { Queue } from 'bullmq'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import simpleGit from 'simple-git'

export interface GitOpsConfig {
  enabled: boolean
  autoSync: boolean
  gitBranch: string
  gitPath: string
  syncInterval: string
}

export interface ConfigureGitOpsInput {
  enabled: boolean
  autoSync?: boolean
  gitBranch: string
  gitPath: string
  syncInterval?: string
}

@Injectable()
export class EnvironmentsService {
  private readonly logger = new Logger(EnvironmentsService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(DEPLOYMENT_QUEUE) private queue: Queue,
  ) {}

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

  async list(userId: string, projectId: string): Promise<schema.Environment[]> {
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

  async get(userId: string, environmentId: string): Promise<schema.Environment | null> {
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

    // Publish environment.updated event
    if (updated) {
      const updatedFields = Object.keys(updateData).filter((key) => key !== 'updatedAt')
      await this.publishEnvironmentUpdatedEvent(updated, updatedFields, userId)
    }

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

  /**
   * Configure GitOps for an environment
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async configureGitOps(
    userId: string,
    environmentId: string,
    gitopsConfig: ConfigureGitOpsInput,
  ): Promise<schema.Environment> {
    this.logger.log(`Configuring GitOps for environment ${environmentId}`)

    // Get environment and check permissions
    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限配置 GitOps')
    }

    // Validate Git branch and path exist
    if (gitopsConfig.enabled) {
      await this.validateGitBranchAndPath(
        environment.projectId,
        gitopsConfig.gitBranch,
        gitopsConfig.gitPath,
      )
    }

    // Update environment config with GitOps settings
    const currentConfig = (environment.config as any) || {}
    const updatedConfig = {
      ...currentConfig,
      gitops: {
        enabled: gitopsConfig.enabled,
        autoSync: gitopsConfig.autoSync ?? true,
        gitBranch: gitopsConfig.gitBranch,
        gitPath: gitopsConfig.gitPath,
        syncInterval: gitopsConfig.syncInterval || '5m',
      },
    }

    const [updated] = await this.db
      .update(schema.environments)
      .set({
        config: updatedConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.environments.id, environmentId))
      .returning()

    if (!updated) {
      throw new Error('更新环境配置失败')
    }

    this.logger.log(`GitOps configured for environment ${environmentId}`)

    // Publish environment.updated event
    await this.publishEnvironmentUpdatedEvent(updated, ['gitops'], userId)

    return updated
  }

  /**
   * Get GitOps configuration for an environment
   * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5
   */
  async getGitOpsConfig(userId: string, environmentId: string): Promise<GitOpsConfig | null> {
    this.logger.log(`Getting GitOps config for environment ${environmentId}`)

    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    const config = environment.config as any
    const gitopsConfig = config?.gitops

    if (!gitopsConfig) {
      return null
    }

    return {
      enabled: gitopsConfig.enabled ?? false,
      autoSync: gitopsConfig.autoSync ?? true,
      gitBranch: gitopsConfig.gitBranch || 'main',
      gitPath: gitopsConfig.gitPath || `k8s/overlays/${environment.name}`,
      syncInterval: gitopsConfig.syncInterval || '5m',
    }
  }

  /**
   * Validate that Git branch and path exist in the repository
   * Requirements: 8.1, 8.2, 8.3
   */
  private async validateGitBranchAndPath(
    projectId: string,
    gitBranch: string,
    gitPath: string,
  ): Promise<void> {
    this.logger.log(
      `Validating Git branch ${gitBranch} and path ${gitPath} for project ${projectId}`,
    )

    // Get repository for the project
    const [repository] = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.projectId, projectId))
      .limit(1)

    if (!repository) {
      throw new Error('项目没有关联的 Git 仓库')
    }

    try {
      // Create a temporary git instance to validate
      const git = simpleGit()

      // Use ls-remote to check if branch exists without cloning
      const remoteRefs = await git.listRemote([repository.cloneUrl])

      // Check if branch exists in remote
      const branchExists = remoteRefs.includes(`refs/heads/${gitBranch}`)

      if (!branchExists) {
        throw new Error(`Git 分支 '${gitBranch}' 不存在于仓库中`)
      }

      // Note: We cannot validate the path without cloning the repository
      // Path validation will be done during actual GitOps operations
      this.logger.log(`Git branch ${gitBranch} validated successfully`)
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      this.logger.error(`Failed to validate Git branch and path:`, error)

      // If it's already our custom error, rethrow it
      if (error instanceof Error && error.message.includes('Git 分支')) {
        throw error
      }

      // Otherwise, throw a generic validation error
      throw new Error(`无法验证 Git 配置: ${errorMessage}`)
    }
  }

  /**
   * Disable GitOps for an environment
   * Requirements: 8.1, 8.2
   */
  async disableGitOps(userId: string, environmentId: string): Promise<schema.Environment> {
    this.logger.log(`Disabling GitOps for environment ${environmentId}`)

    const environment = await this.get(userId, environmentId)
    if (!environment) {
      throw new Error('环境不存在')
    }

    const hasPermission = await this.checkProjectPermission(userId, environment.projectId, 'admin')
    if (!hasPermission) {
      throw new Error('没有权限配置 GitOps')
    }

    const currentConfig = (environment.config as any) || {}
    const updatedConfig = {
      ...currentConfig,
      gitops: {
        ...(currentConfig.gitops || {}),
        enabled: false,
      },
    }

    const [updated] = await this.db
      .update(schema.environments)
      .set({
        config: updatedConfig,
        updatedAt: new Date(),
      })
      .where(eq(schema.environments.id, environmentId))
      .returning()

    if (!updated) {
      throw new Error('更新环境配置失败')
    }

    this.logger.log(`GitOps disabled for environment ${environmentId}`)

    // Publish environment.updated event
    await this.publishEnvironmentUpdatedEvent(updated, ['gitops'], userId)

    return updated
  }

  /**
   * 发布环境更新事件
   * Requirements: 11.2, 11.4
   */
  private async publishEnvironmentUpdatedEvent(
    environment: typeof schema.environments.$inferSelect,
    updatedFields: string[],
    userId: string,
  ): Promise<void> {
    try {
      const event: EnvironmentUpdatedEvent = {
        type: 'environment.updated',
        environmentId: environment.id,
        projectId: environment.projectId,
        updatedFields,
        updatedBy: userId,
        timestamp: new Date(),
      }

      // 发布到事件队列
      await this.queue.add('environment.updated', event, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      })

      this.logger.log(`Published environment.updated event for environment ${environment.id}`)
    } catch (error) {
      this.logger.error(`Failed to publish environment.updated event:`, error)
      // 不抛出错误，避免影响主流程
    }
  }
}
