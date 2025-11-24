import * as schema from '@juanie/core/database'
import { Trace } from '@juanie/core/observability'
import { DATABASE, REDIS } from '@juanie/core/tokens'
import type {
  CreateProjectInput,
  CreateProjectWithTemplateInputType,
  ProjectStatus,
  UpdateProjectInput,
} from '@juanie/core-types'
import { AuditLogsService } from '@juanie/service-extensions'
import { Inject, Injectable, Logger } from '@nestjs/common'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import type { Redis } from 'ioredis'
import { ProjectOrchestrator } from './project-orchestrator.service'

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name)

  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    private orchestrator: ProjectOrchestrator,
    @Inject(REDIS) private redis: Redis,
    private auditLogs: AuditLogsService,
  ) {}

  // 创建项目
  @Trace('projects.create')
  async create(
    userId: string,
    data: CreateProjectInput | CreateProjectWithTemplateInputType,
  ): Promise<typeof schema.projects.$inferSelect & { jobIds?: string[] }> {
    // 检查用户是否是组织成员
    const member = await this.getOrgMember(data.organizationId, userId)
    if (!member) {
      throw new Error('不是组织成员')
    }

    // 只有 owner 和 admin 可以创建项目
    if (!['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限创建项目')
    }

    // 类型守卫：检查是否是扩展输入类型
    const extendedData = data as CreateProjectWithTemplateInputType

    // 如果提供了模板或仓库配置，使用 orchestrator 进行完整初始化
    if (extendedData.templateId || extendedData.repository) {
      // 确保 visibility 有默认值
      const dataWithDefaults = {
        ...extendedData,
        visibility: extendedData.visibility ?? ('private' as const),
      }
      const result = await this.orchestrator.createAndInitialize(userId, dataWithDefaults)

      // 如果初始化失败，抛出错误
      if (!result.success || !result.projectId || result.projectId.trim() === '') {
        throw new Error(result.error || '项目初始化失败')
      }

      // 记录审计日志
      await this.auditLogs.log({
        userId,
        organizationId: data.organizationId,
        action: 'project.created',
        resourceType: 'project',
        resourceId: result.projectId,
        metadata: {
          templateId: extendedData.templateId,
          hasRepository: !!extendedData.repository,
        },
      })

      // 返回项目信息（需要从数据库查询）
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, result.projectId))
        .limit(1)

      if (!project) {
        throw new Error('项目创建成功但查询失败')
      }

      return { ...project, jobIds: result.jobIds }
    }

    // 否则使用简单创建（向后兼容）
    const baseData = data as CreateProjectInput
    // 自动生成 slug
    const slug = `project-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`

    const [project] = await this.db
      .insert(schema.projects)
      .values({
        organizationId: baseData.organizationId,
        name: baseData.name,
        slug,
        description: baseData.description,
        logoUrl: baseData.logoUrl,
        visibility: baseData.visibility ?? 'private',
      })
      .returning()

    if (!project) {
      throw new Error('创建项目失败')
    }

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: data.organizationId,
      action: 'project.created',
      resourceType: 'project',
      resourceId: project.id,
      metadata: {
        name: project.name,
        slug: project.slug,
      },
    })

    return project
  }

  // 上传项目 Logo
  @Trace('projects.uploadLogo')
  async uploadLogo(
    userId: string,
    projectId: string,
    logoUrl: string | null,
  ): Promise<typeof schema.projects.$inferSelect> {
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

    if (!updated) {
      throw new Error('更新 Logo 失败')
    }

    return updated
  }

  // 列出组织的项目（基于 visibility 过滤）
  @Trace('projects.list')
  async list(userId: string, organizationId: string) {
    // 获取用户的组织成员信息
    const member = await this.getOrgMember(organizationId, userId)
    const isOrgAdmin = member && ['owner', 'admin'].includes(member.role)

    // 获取所有项目
    const allProjects = await this.db
      .select({
        id: schema.projects.id,
        name: schema.projects.name,
        slug: schema.projects.slug,
        description: schema.projects.description,
        logoUrl: schema.projects.logoUrl,
        visibility: schema.projects.visibility,
        status: schema.projects.status,
        config: schema.projects.config,
        createdAt: schema.projects.createdAt,
        updatedAt: schema.projects.updatedAt,
      })
      .from(schema.projects)
      .where(
        and(eq(schema.projects.organizationId, organizationId), isNull(schema.projects.deletedAt)),
      )

    // 根据 visibility 过滤项目
    const filteredProjects = []
    for (const project of allProjects) {
      // public 项目：所有人可见
      if (project.visibility === 'public') {
        filteredProjects.push(project)
        continue
      }

      // internal 项目：组织成员可见
      if (project.visibility === 'internal' && member) {
        filteredProjects.push(project)
        continue
      }

      // private 项目：需要检查具体权限
      if (project.visibility === 'private') {
        // 组织管理员可以看到所有 private 项目
        if (isOrgAdmin) {
          filteredProjects.push(project)
          continue
        }

        // 检查是否是项目成员
        const projectMember = await this.getProjectMember(project.id, userId)
        if (projectMember) {
          filteredProjects.push(project)
          continue
        }

        // 检查是否通过团队访问
        const [teamAccess] = await this.db
          .select({ count: sql<number>`count(*)` })
          .from(schema.teamProjects)
          .innerJoin(schema.teamMembers, eq(schema.teamProjects.teamId, schema.teamMembers.teamId))
          .where(
            and(
              eq(schema.teamProjects.projectId, project.id),
              eq(schema.teamMembers.userId, userId),
            ),
          )

        if ((teamAccess?.count || 0) > 0) {
          filteredProjects.push(project)
        }
      }
    }

    return filteredProjects
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
        logoUrl: schema.projects.logoUrl,
        visibility: schema.projects.visibility,
        status: schema.projects.status,
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

    // 检查用户是否有权限访问（基于 visibility）
    const hasAccess = await this.checkAccess(
      userId,
      projectId,
      project.organizationId,
      project.visibility,
    )
    if (!hasAccess) {
      throw new Error('没有权限访问该项目')
    }

    return project
  }

  // 获取项目完整状态（包括所有关联资源）
  @Trace('projects.getStatus')
  async getStatus(userId: string, projectId: string): Promise<ProjectStatus> {
    // 先检查基本权限
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 获取环境列表
    const environments = await this.db
      .select()
      .from(schema.environments)
      .where(eq(schema.environments.projectId, projectId))

    // 获取仓库列表
    const repositories = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.projectId, projectId))

    // 获取部署列表
    const { desc } = await import('drizzle-orm')
    const deployments = await this.db
      .select()
      .from(schema.deployments)
      .where(eq(schema.deployments.projectId, projectId))
      .orderBy(desc(schema.deployments.createdAt))
      .limit(50)

    // 计算统计数据
    const totalDeployments = deployments.length
    const successfulDeployments = deployments.filter((d) => d.status === 'success').length
    const failedDeployments = deployments.filter((d) => d.status === 'failed').length
    const lastDeployment = deployments[0]

    // 获取 GitOps 资源
    const gitopsResources = await this.db
      .select()
      .from(schema.gitopsResources)
      .where(eq(schema.gitopsResources.projectId, projectId))

    return {
      project: project as any,
      environments: environments.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type as 'development' | 'staging' | 'production' | 'testing',
        config: e.config,
      })),
      repositories: repositories.map((r) => ({
        id: r.id,
        provider: r.provider as 'github' | 'gitlab',
        fullName: r.fullName,
        cloneUrl: r.cloneUrl,
        defaultBranch: r.defaultBranch,
      })),
      gitopsResources: gitopsResources.map((g) => ({
        id: g.id,
        type: g.type as 'kustomization' | 'helm',
        name: g.name,
        namespace: g.namespace,
        status: g.status,
        errorMessage: g.errorMessage,
      })),
      stats: {
        totalDeployments,
        successfulDeployments,
        failedDeployments,
        lastDeploymentAt: lastDeployment?.createdAt,
      },
      health: {
        score:
          totalDeployments > 0 ? Math.round((successfulDeployments / totalDeployments) * 100) : 0,
        status: 'healthy' as const,
        factors: {
          deploymentSuccessRate:
            totalDeployments > 0 ? Math.round((successfulDeployments / totalDeployments) * 100) : 0,
          gitopsSyncStatus: 'healthy' as const,
          podHealthStatus: 'healthy' as const,
          lastDeploymentAge: 0,
        },
        issues: [],
        recommendations: [],
      },
      resourceUsage: {
        pods: 0,
        cpu: '0',
        memory: '0',
      },
    }
  }

  // 更新项目
  @Trace('projects.update')
  async update(
    userId: string,
    projectId: string,
    data: UpdateProjectInput,
  ): Promise<typeof schema.projects.$inferSelect> {
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
    if (data.visibility !== undefined) updateData.visibility = data.visibility
    if (data.status !== undefined) updateData.status = data.status

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

    if (!updated) {
      throw new Error('更新项目失败')
    }

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.updated',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        changes: data,
        previousValues: {
          name: project.name,
          slug: project.slug,
          description: project.description,
          visibility: project.visibility,
          status: project.status,
        },
      },
    })

    return updated
  }

  // 软删除项目
  @Trace('projects.delete')
  async delete(
    userId: string,
    projectId: string,
    options?: { repositoryAction?: 'keep' | 'archive' | 'delete' },
  ) {
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    const member = await this.getOrgMember(project.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限删除项目')
    }

    // 软删除项目
    await this.db
      .update(schema.projects)
      .set({ deletedAt: new Date() })
      .where(eq(schema.projects.id, projectId))

    // 处理关联的 Git 仓库
    const repositoryAction = options?.repositoryAction || 'keep'
    const jobIds: string[] = []

    // TODO: 实现 handleRepositoryOnDelete
    if (repositoryAction !== 'keep') {
      this.logger.log(`Repository action: ${repositoryAction} (not implemented yet)`)
    }

    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.deleted',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        projectName: project.name,
        projectSlug: project.slug,
        repositoryAction,
        jobIds,
      },
    })

    return { success: true, jobIds }
  }

  // 归档项目
  @Trace('projects.archive')
  async archive(userId: string, projectId: string) {
    // 获取项目信息
    const project = await this.get(userId, projectId)
    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const member = await this.getOrgMember(project.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限归档项目')
    }

    // 归档项目
    await this.db
      .update(schema.projects)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId))

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.archived',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        projectName: project.name,
      },
    })

    return { success: true }
  }

  // 恢复项目
  @Trace('projects.restore')
  async restore(userId: string, projectId: string) {
    // 获取项目信息（需要特殊查询，因为归档的项目 status 是 archived）
    const [project] = await this.db
      .select()
      .from(schema.projects)
      .where(and(eq(schema.projects.id, projectId), isNull(schema.projects.deletedAt)))
      .limit(1)

    if (!project) {
      throw new Error('项目不存在')
    }

    // 检查权限
    const member = await this.getOrgMember(project.organizationId, userId)
    if (!member || !['owner', 'admin'].includes(member.role)) {
      throw new Error('没有权限恢复项目')
    }

    // 恢复项目
    await this.db
      .update(schema.projects)
      .set({ status: 'active', updatedAt: new Date() })
      .where(eq(schema.projects.id, projectId))

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.restored',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        projectName: project.name,
      },
    })

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

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.member.added',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        memberId: data.memberId,
        role: data.role,
      },
    })

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

    // 获取当前成员信息用于审计
    const [currentMember] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(eq(schema.projectMembers.id, data.memberId))
      .limit(1)

    const [updated] = await this.db
      .update(schema.projectMembers)
      .set({
        role: data.role,
      })
      .where(eq(schema.projectMembers.id, data.memberId))
      .returning()

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.member.role_updated',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        memberId: data.memberId,
        previousRole: currentMember?.role,
        newRole: data.role,
      },
    })

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

    // 获取成员信息用于审计
    const [member] = await this.db
      .select()
      .from(schema.projectMembers)
      .where(eq(schema.projectMembers.id, data.memberId))
      .limit(1)

    await this.db.delete(schema.projectMembers).where(eq(schema.projectMembers.id, data.memberId))

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.member.removed',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        memberId: data.memberId,
        memberUserId: member?.userId,
        memberRole: member?.role,
      },
    })

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

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.team.assigned',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        teamId: data.teamId,
        teamName: team.name,
      },
    })

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

    // 获取团队信息用于审计
    const [team] = await this.db
      .select()
      .from(schema.teams)
      .where(eq(schema.teams.id, data.teamId))
      .limit(1)

    await this.db
      .delete(schema.teamProjects)
      .where(
        and(
          eq(schema.teamProjects.teamId, data.teamId),
          eq(schema.teamProjects.projectId, projectId),
        ),
      )

    // 记录审计日志
    await this.auditLogs.log({
      userId,
      organizationId: project.organizationId,
      action: 'project.team.removed',
      resourceType: 'project',
      resourceId: projectId,
      metadata: {
        teamId: data.teamId,
        teamName: team?.name,
      },
    })

    return { success: true }
  }

  // 检查用户是否有权限访问项目（基于 visibility）
  private async checkAccess(
    userId: string,
    projectId: string,
    organizationId: string,
    visibility?: string,
  ): Promise<boolean> {
    // 获取项目的 visibility（如果没有传入）
    let projectVisibility = visibility
    if (!projectVisibility) {
      const [project] = await this.db
        .select({ visibility: schema.projects.visibility })
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)
      projectVisibility = project?.visibility || 'private'
    }

    // public 项目：所有人都可以访问
    if (projectVisibility === 'public') {
      return true
    }

    // internal 项目：组织内所有成员都可以访问
    if (projectVisibility === 'internal') {
      const orgMember = await this.getOrgMember(organizationId, userId)
      if (orgMember) {
        return true
      }
    }

    // private 项目：只有项目成员、团队成员或组织管理员可以访问
    if (projectVisibility === 'private') {
      // 检查是否是组织管理员
      const orgMember = await this.getOrgMember(organizationId, userId)
      if (orgMember && ['owner', 'admin'].includes(orgMember.role)) {
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

    return false
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

  /**
   * 订阅项目初始化进度
   * 使用 tRPC subscription 实时推送进度
   */
  async *subscribeToProgress(projectId: string) {
    const eventPattern = `project.${projectId}.initialization.*`
    const eventQueue: any[] = []
    let resolve: ((value: any) => void) | null = null
    let isActive = true

    // 创建 Redis 订阅客户端
    const subscriber = this.redis.duplicate()
    await subscriber.connect()

    // 监听消息事件
    subscriber.on('pmessage', (pattern: string, channel: string, message: string) => {
      try {
        const eventData = JSON.parse(message)
        this.logger.log(`Received subscription event on ${channel}:`, eventData)

        if (resolve) {
          resolve(eventData)
          resolve = null
        } else {
          eventQueue.push(eventData)
        }

        // 收到完成或失败事件后标记为不活跃
        if (
          eventData.type === 'initialization.completed' ||
          eventData.type === 'initialization.failed'
        ) {
          isActive = false
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.error(`Error processing subscription event: ${errorMessage}`)
      }
    })

    // 订阅项目初始化事件
    await subscriber.psubscribe(eventPattern)

    try {
      // 1. 先发送当前项目状态
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, projectId))
        .limit(1)

      if (project) {
        const initStatus = project.initializationStatus as any
        yield {
          type: 'init',
          data: {
            status: project.status,
            progress: initStatus?.progress || 0,
            state: initStatus?.state || 'IDLE',
          },
        }

        // 2. 如果已经完成或失败，直接结束
        if (project.status === 'active' || project.status === 'failed') {
          return
        }
      }

      // 3. 持续监听事件
      while (isActive) {
        const event =
          eventQueue.length > 0
            ? eventQueue.shift()
            : await new Promise<any>((r) => {
                resolve = r
                // 设置超时，避免永久等待
                setTimeout(() => {
                  if (resolve === r) {
                    r({ type: 'heartbeat' })
                    resolve = null
                  }
                }, 30000) // 30 秒心跳
              })

        // 跳过心跳事件
        if (event.type === 'heartbeat') {
          continue
        }

        yield event

        // 收到完成或失败事件后结束
        if (event.type === 'initialization.completed' || event.type === 'initialization.failed') {
          break
        }
      }
    } finally {
      try {
        await subscriber.punsubscribe(eventPattern)
        await subscriber.disconnect()
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error)
        this.logger.error(`Error closing Redis subscription: ${errorMessage}`)
      }
    }
  }
  /**
   * 订阅任务进度（通用）
   * 使用 tRPC subscription 实时推送任务进度
   */
  async *subscribeToJobProgress(jobId: string) {
    const channel = `job:${jobId}`
    const eventQueue: any[] = []
    let isComplete = false

    // 监听事件
    const listener = (event: any) => {
      if (event.channel === channel) {
        eventQueue.push(event)
      }
    }

    // 注册监听器（这里需要实际的事件总线实现）
    // eventBus.on('job.progress', listener)
    // eventBus.on('job.completed', listener)
    // eventBus.on('job.failed', listener)

    try {
      // 发送初始事件
      yield {
        type: 'init',
        data: { jobId, progress: 0, state: 'waiting' },
      }

      // 持续推送事件
      while (!isComplete) {
        if (eventQueue.length > 0) {
          const event = eventQueue.shift()
          yield event

          // 检查是否完成
          if (event.type === 'job.completed' || event.type === 'job.failed') {
            isComplete = true
          }
        }

        // 等待一小段时间再检查
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    } finally {
      // 清理监听器
      // eventBus.off('job.progress', listener)
      // eventBus.off('job.completed', listener)
      // eventBus.off('job.failed', listener)
    }
  }
}
