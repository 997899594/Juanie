import { Trace } from '@juanie/core/observability'
import { DATABASE } from '@juanie/core/tokens'
import * as schema from '@juanie/database'
import { ProjectAlreadyExistsError, ProjectNotFoundError } from '@juanie/service-business/errors'
import {
  AuditLogsService,
  OrganizationNotFoundError,
  OrganizationsService,
  RbacService,
} from '@juanie/service-foundation'
import type { CreateProjectInput, UpdateProjectInput } from '@juanie/types'
import { InjectQueue } from '@nestjs/bullmq'
import { Inject, Injectable } from '@nestjs/common'
import type { Queue } from 'bullmq'
import { and, eq, isNull } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import { PinoLogger } from 'nestjs-pino'
import { DatabaseOperationError, ProjectOperationError } from './project-errors'

/**
 * ProjectsService (重构版 v2)
 *
 * 职责: 项目 CRUD（核心职责）
 * - 创建项目
 * - 列出项目（根据 visibility 过滤）
 * - 获取项目
 * - 更新项目
 * - 删除项目
 * - Logo 上传
 * - 归档/恢复
 *
 * 架构原则:
 * 1. ✅ Business 层可以直接注入 DATABASE（查询 Business 层表）
 * 2. ✅ 通过 Foundation 层服务访问跨领域功能（Organizations, Audit, RBAC）
 * 3. ❌ 不检查权限（Router 层用 withAbility 完成）
 * 4. ✅ 唯一例外: list() 方法注入 RbacService 用于 visibility 过滤（业务逻辑，不是权限检查）
 * 5. ✅ 使用 @InjectQueue 注入队列（@nestjs/bullmq）
 *
 * 参考文档:
 * - docs/architecture/PROJECTS-SERVICE-DEEP-ANALYSIS.md
 * - docs/architecture/PERMISSION-CONTROL-ARCHITECTURE.md
 */
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @InjectQueue('project-initialization') private initQueue: Queue,
    private rbacService: RbacService, // ✅ 仅用于 list() 方法的 visibility 过滤
    private organizationsService: OrganizationsService,
    private auditLogs: AuditLogsService,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(ProjectsService.name)
  }

  /**
   * 创建项目
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.create')
  async create(userId: string, data: CreateProjectInput) {
    try {
      // 1. 验证组织存在（业务规则）
      const organizationExists = await this.organizationsService.exists(data.organizationId)
      if (!organizationExists) {
        throw new OrganizationNotFoundError(data.organizationId)
      }

      // 2. 检查项目 slug 是否已存在（业务约束）
      const existing = await this.db.query.projects.findFirst({
        where: and(
          eq(schema.projects.organizationId, data.organizationId),
          eq(schema.projects.slug, data.slug),
          isNull(schema.projects.deletedAt),
        ),
      })
      if (existing) {
        throw new ProjectAlreadyExistsError(data.slug, data.organizationId)
      }

      // 3. 创建项目
      const [project] = await this.db
        .insert(schema.projects)
        .values({
          organizationId: data.organizationId,
          name: data.name,
          slug: data.slug,
          description: data.description,
          visibility: data.visibility ?? 'private',
          status: 'initializing',
        })
        .returning()

      if (!project) {
        throw new DatabaseOperationError('insert', 'projects')
      }

      // 4. 添加创建者为项目 maintainer
      await this.db.insert(schema.projectMembers).values({
        projectId: project.id,
        userId,
        role: 'maintainer',
      })

      // 5. 触发初始化队列
      const job = await this.initQueue.add('initialize-project', {
        projectId: project.id,
        userId,
        ...data,
      })

      // 6. 记录审计日志
      await this.auditLogs.log({
        userId,
        action: 'project.created',
        resourceType: 'project',
        resourceId: project.id,
        metadata: {
          name: project.name,
          slug: project.slug,
          organizationId: project.organizationId,
        },
      })

      return {
        ...project,
        jobId: job.id,
      }
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (
        error instanceof OrganizationNotFoundError ||
        error instanceof ProjectAlreadyExistsError
      ) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, userId, data }, 'Failed to create project')
      throw new ProjectOperationError('create', data.slug, error as Error)
    }
  }

  /**
   * 列出项目（根据 visibility 过滤）
   * ✅ 使用 RbacService 进行 visibility 过滤（业务逻辑，不是权限检查）
   */
  @Trace('projects.list')
  async list(userId: string, organizationId: string) {
    // 获取组织的所有项目
    const allProjects = await this.db.query.projects.findMany({
      where: and(
        eq(schema.projects.organizationId, organizationId),
        isNull(schema.projects.deletedAt),
      ),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    })

    // 根据 visibility 过滤
    const accessibleProjects = []
    for (const project of allProjects) {
      // public 项目: 所有人可见
      if (project.visibility === 'public') {
        accessibleProjects.push(project)
        continue
      }

      // internal/private 项目: 检查用户角色
      const role = await this.rbacService.getEffectiveProjectRoleForUser(userId, project.id)

      if (project.visibility === 'internal' && role !== null) {
        // internal 项目: 组织成员可见
        accessibleProjects.push(project)
      } else if (project.visibility === 'private' && role !== null) {
        // private 项目: 有项目角色可见
        accessibleProjects.push(project)
      }
    }

    return accessibleProjects
  }

  /**
   * 获取项目详情
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.get')
  async get(projectId: string) {
    const project = await this.db.query.projects.findFirst({
      where: and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)),
      with: {
        organization: true,
      },
    })

    if (!project) {
      throw new ProjectNotFoundError(projectId)
    }

    return project
  }

  /**
   * 更新项目
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.update')
  async update(userId: string, projectId: string, data: UpdateProjectInput) {
    try {
      // 验证项目存在
      const existing = await this.get(projectId)

      // 如果更新 slug，检查是否冲突
      if (data.slug && data.slug !== existing.slug) {
        const conflict = await this.db.query.projects.findFirst({
          where: and(
            eq(schema.projects.organizationId, existing.organizationId),
            eq(schema.projects.slug, data.slug),
            isNull(schema.projects.deletedAt),
          ),
        })
        if (conflict) {
          throw new ProjectAlreadyExistsError(data.slug, existing.organizationId)
        }
      }

      // 构建更新数据（只包含提供的字段）
      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      }

      if (data.name !== undefined) updateData.name = data.name
      if (data.slug !== undefined) updateData.slug = data.slug
      if (data.description !== undefined) updateData.description = data.description
      if (data.visibility !== undefined) updateData.visibility = data.visibility
      if (data.status !== undefined) updateData.status = data.status

      // config 需要合并现有配置
      if (data.config !== undefined) {
        const currentConfig = existing.config || {
          defaultBranch: 'main',
          enableCiCd: true,
          enableAi: true,
        }
        updateData.config = {
          defaultBranch: data.config.defaultBranch ?? currentConfig.defaultBranch,
          enableCiCd: data.config.enableCiCd ?? currentConfig.enableCiCd,
          enableAi: data.config.enableAi ?? currentConfig.enableAi,
          ...(currentConfig.quota && { quota: currentConfig.quota }),
        }
      }

      // 更新项目
      const [updated] = await this.db
        .update(schema.projects)
        .set(updateData)
        .where(eq(schema.projects.id, projectId))
        .returning()

      // 记录审计日志
      await this.auditLogs.log({
        userId,
        action: 'project.updated',
        resourceType: 'project',
        resourceId: projectId,
        metadata: data,
      })

      return updated
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof ProjectNotFoundError || error instanceof ProjectAlreadyExistsError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, userId, projectId, data }, 'Failed to update project')
      throw new ProjectOperationError('update', projectId, error as Error)
    }
  }

  /**
   * 删除项目（软删除）
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.delete')
  async delete(userId: string, projectId: string, options?: { force?: boolean }) {
    try {
      // 验证项目存在
      await this.get(projectId)

      if (options?.force) {
        // 硬删除
        await this.db.delete(schema.projects).where(eq(schema.projects.id, projectId))
      } else {
        // 软删除
        await this.db
          .update(schema.projects)
          .set({
            deletedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(schema.projects.id, projectId))
      }

      // 记录审计日志
      await this.auditLogs.log({
        userId,
        action: options?.force ? 'project.deleted.hard' : 'project.deleted.soft',
        resourceType: 'project',
        resourceId: projectId,
      })

      return { success: true }
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof ProjectNotFoundError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, userId, projectId, options }, 'Failed to delete project')
      throw new ProjectOperationError('delete', projectId, error as Error)
    }
  }

  /**
   * 上传 Logo
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.uploadLogo')
  async uploadLogo(userId: string, projectId: string, logoUrl: string | null) {
    try {
      // 验证项目存在
      await this.get(projectId)

      // 更新 logoUrl
      const [updated] = await this.db
        .update(schema.projects)
        .set({
          logoUrl,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))
        .returning()

      if (!updated) {
        throw new DatabaseOperationError('update', 'projects')
      }

      // 记录审计日志
      await this.auditLogs.log({
        userId,
        action: 'project.logo.updated',
        resourceType: 'project',
        resourceId: projectId,
        metadata: { logoUrl },
      })

      return updated
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof ProjectNotFoundError || error instanceof DatabaseOperationError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, userId, projectId, logoUrl }, 'Failed to upload logo')
      throw new ProjectOperationError('uploadLogo', projectId, error as Error)
    }
  }

  /**
   * 归档项目
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.archive')
  async archive(userId: string, projectId: string) {
    try {
      // 验证项目存在
      await this.get(projectId)

      // 归档
      const [archived] = await this.db
        .update(schema.projects)
        .set({
          status: 'archived',
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))
        .returning()

      if (!archived) {
        throw new DatabaseOperationError('update', 'projects')
      }

      // 记录审计日志
      await this.auditLogs.log({
        userId,
        action: 'project.archived',
        resourceType: 'project',
        resourceId: projectId,
      })

      return archived
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof ProjectNotFoundError || error instanceof DatabaseOperationError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, userId, projectId }, 'Failed to archive project')
      throw new ProjectOperationError('archive', projectId, error as Error)
    }
  }

  /**
   * 恢复项目
   * ✅ 不检查权限（Router 层已用 withAbility 检查）
   */
  @Trace('projects.restore')
  async restore(userId: string, projectId: string) {
    try {
      // 验证项目存在（包括已删除的）
      const project = await this.db.query.projects.findFirst({
        where: eq(schema.projects.id, projectId),
      })

      if (!project) {
        throw new ProjectNotFoundError(projectId)
      }

      // 恢复
      const [restored] = await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, projectId))
        .returning()

      if (!restored) {
        throw new DatabaseOperationError('update', 'projects')
      }

      // 记录审计日志
      await this.auditLogs.log({
        userId,
        action: 'project.restored',
        resourceType: 'project',
        resourceId: projectId,
      })

      return restored
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof ProjectNotFoundError || error instanceof DatabaseOperationError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, userId, projectId }, 'Failed to restore project')
      throw new ProjectOperationError('restore', projectId, error as Error)
    }
  }

  // ========================================
  // 内部辅助方法（用于其他服务调用）
  // ========================================

  /**
   * 根据 ID 获取项目（不需要用户上下文）
   * 用于内部服务调用（如 GitSyncService）
   */
  @Trace('projects.findById')
  async findById(projectId: string) {
    const project = await this.db.query.projects.findFirst({
      where: and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)),
    })
    return project || null
  }

  /**
   * 检查项目是否存在
   */
  @Trace('projects.exists')
  async exists(projectId: string): Promise<boolean> {
    const project = await this.findById(projectId)
    return !!project
  }

  /**
   * 根据 ID 获取项目（带错误抛出）
   */
  @Trace('projects.getById')
  async getById(projectId: string) {
    const project = await this.findById(projectId)
    if (!project) {
      throw new ProjectNotFoundError(projectId)
    }
    return project
  }

  /**
   * 获取项目的仓库信息
   * Requirements: Git Sync
   */
  @Trace('projects.getProjectRepository')
  async getProjectRepository(projectId: string) {
    try {
      const [repository] = await this.db
        .select()
        .from(schema.repositories)
        .where(eq(schema.repositories.projectId, projectId))
        .limit(1)

      if (!repository) {
        throw new ProjectNotFoundError(`No repository found for project ${projectId}`)
      }

      return repository
    } catch (error) {
      // ✅ 包装错误以添加业务上下文
      if (error instanceof ProjectNotFoundError) {
        throw error // 业务错误直接抛出
      }

      this.logger.error({ error, projectId }, 'Failed to get project repository')
      throw new ProjectOperationError('getRepository', projectId, error as Error)
    }
  }

  /**
   * 获取项目的所有成员
   * Requirements: Git Sync
   */
  @Trace('projects.getProjectMembers')
  async getProjectMembers(projectId: string) {
    return await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.projectId, projectId),
      with: {
        user: true,
      },
    })
  }
}
