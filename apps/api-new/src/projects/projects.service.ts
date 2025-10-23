import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, like, or, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { z } from "zod";
import { PG_CONNECTION } from "../db/drizzle.provider";
import {
  deployments,
  environments,
  projectMembers,
  projects,
  users,
} from "../db/schema";
import {
  CreateProjectInput,
  InviteMemberInput,
  ListProjectsInput,
  projectStatsSchema,
  projectWithOwnerSchema,
  RemoveMemberInput,
  recentActivitySchema,
  UpdateDeploySettingsInput,
  UpdateMemberRoleInput,
  UpdateProjectInput,
} from "../schemas/project.schema";

// 使用 zod 推断类型
type ProjectWithOwner = z.infer<typeof projectWithOwnerSchema>;
type ProjectStats = z.infer<typeof projectStatsSchema>;
type RecentActivity = z.infer<typeof recentActivitySchema>;

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(PG_CONNECTION)
    private readonly db: PostgresJsDatabase<typeof import("../db/schema")>
  ) {}

  // 创建项目 - 返回 ProjectWithOwner
  async create(
    input: CreateProjectInput,
    userId: number
  ): Promise<ProjectWithOwner> {
    const [project] = await this.db
      .insert(projects)
      .values({
        name: input.name,
        displayName: input.displayName,
        description: input.description,
        logo: input.logo,
        ownerId: userId,
        gitlabProjectId: input.gitlabProjectId,
        repositoryUrl: input.repositoryUrl,
        defaultBranch: input.defaultBranch,
        isPublic: input.isPublic,
        deploySettings: input.deploySettings,
      })
      .returning();

    // 添加创建者为项目所有者
    await this.db.insert(projectMembers).values({
      projectId: project.id,
      userId: userId,
      role: "owner",
    });

    // 查询并返回包含owner信息的完整项目
    const [projectWithOwner] = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        displayName: projects.displayName,
        description: projects.description,
        logo: projects.logo,
        ownerId: projects.ownerId,
        gitlabProjectId: projects.gitlabProjectId,
        repositoryUrl: projects.repositoryUrl,
        defaultBranch: projects.defaultBranch,
        isActive: projects.isActive,
        isPublic: projects.isPublic,
        deploySettings: projects.deploySettings,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerId_user: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerImage: users.image,
      })
      .from(projects)
      .leftJoin(users, eq(projects.ownerId, users.id))
      .where(eq(projects.id, project.id))
      .limit(1);

    return {
      id: projectWithOwner.id,
      name: projectWithOwner.name,
      displayName: projectWithOwner.displayName,
      description: projectWithOwner.description,
      logo: projectWithOwner.logo,
      ownerId: projectWithOwner.ownerId,
      gitlabProjectId: projectWithOwner.gitlabProjectId,
      repositoryUrl: projectWithOwner.repositoryUrl,
      defaultBranch: projectWithOwner.defaultBranch || "main",
      isActive: projectWithOwner.isActive ?? true,
      isPublic: projectWithOwner.isPublic ?? false,
      deploySettings: projectWithOwner.deploySettings,
      createdAt: projectWithOwner.createdAt,
      updatedAt: projectWithOwner.updatedAt,
      environmentsCount: 0,
      deploymentsCount: 0,
      membersCount: 1,
      owner: projectWithOwner.ownerId_user
        ? {
            id: projectWithOwner.ownerId_user,
            name: projectWithOwner.ownerName!,
            email: projectWithOwner.ownerEmail!,
            image: projectWithOwner.ownerImage,
          }
        : null,
    };
  }

  // 获取项目列表
  async list(
    input: ListProjectsInput,
    userId: number
  ): Promise<{
    projects: ProjectWithOwner[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const offset = (input.page - 1) * input.limit;

    // 构建基础条件
    const baseConditions = [
      projects.isActive,
      or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId)),
    ];

    // 添加搜索条件
    if (input.search) {
      baseConditions.push(
        or(
          like(projects.name, `%${input.search}%`),
          like(projects.displayName, `%${input.search}%`)
        )
      );
    }

    // 添加仅拥有者条件
    if (input.ownedOnly) {
      baseConditions.push(eq(projects.ownerId, userId));
    }

    // 添加公开性过滤条件
    if (input.isPublic !== undefined) {
      baseConditions.push(eq(projects.isPublic, input.isPublic));
    }

    const query = this.db
      .select({
        project: {
          id: projects.id,
          name: projects.name,
          displayName: projects.displayName,
          description: projects.description,
          logo: projects.logo,
          ownerId: projects.ownerId,
          gitlabProjectId: projects.gitlabProjectId,
          repositoryUrl: projects.repositoryUrl,
          defaultBranch: projects.defaultBranch,
          isActive: projects.isActive,
          isPublic: projects.isPublic,
          deploySettings: projects.deploySettings,
          createdAt: projects.createdAt,
          updatedAt: projects.updatedAt,
        },
        owner: sql<{
          id: number;
          name: string;
          email: string;
          image: string | null;
        } | null>`CASE WHEN ${users.id} IS NOT NULL THEN json_build_object('id', ${users.id}, 'name', ${users.name}, 'email', ${users.email}, 'image', ${users.image}) ELSE NULL END`,
        environmentsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${environments} WHERE ${environments.projectId} = ${projects.id}), 0)`,
        deploymentsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${deployments} WHERE ${deployments.projectId} = ${projects.id}), 0)`,
        membersCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${projectMembers} pm WHERE pm.project_id = ${projects.id}), 0)`,
      })
      .from(projects)
      .leftJoin(users, eq(projects.ownerId, users.id))
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(and(...baseConditions));

    const result = await query
      .orderBy(desc(projects.createdAt))
      .limit(input.limit)
      .offset(offset);

    // 获取总数
    const [{ total }] = await this.db
      .select({ total: count() })
      .from(projects)
      .leftJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(
        and(
          projects.isActive,
          or(eq(projects.ownerId, userId), eq(projectMembers.userId, userId))
        )
      );

    const projectsWithOwner: ProjectWithOwner[] = result.map((item) => ({
      id: item.project.id,
      name: item.project.name,
      displayName: item.project.displayName,
      description: item.project.description,
      logo: item.project.logo,
      ownerId: item.project.ownerId,
      gitlabProjectId: item.project.gitlabProjectId,
      repositoryUrl: item.project.repositoryUrl,
      defaultBranch: item.project.defaultBranch || "main",
      isActive: item.project.isActive ?? true,
      isPublic: item.project.isPublic ?? false,
      deploySettings: item.project.deploySettings,
      createdAt: item.project.createdAt,
      updatedAt: item.project.updatedAt,
      owner: item.owner,
      environmentsCount: item.environmentsCount,
      deploymentsCount: item.deploymentsCount,
      membersCount: item.membersCount,
    }));

    return {
      projects: projectsWithOwner,
      pagination: {
        page: input.page,
        limit: input.limit,
        total: Number(total),
        totalPages: Math.ceil(Number(total) / input.limit),
      },
    };
  }

  // 根据ID获取项目
  async getById(id: number, userId: number): Promise<ProjectWithOwner> {
    await this.checkProjectPermission(id, userId);

    const [project] = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        displayName: projects.displayName,
        description: projects.description,
        logo: projects.logo,
        ownerId: projects.ownerId,
        gitlabProjectId: projects.gitlabProjectId,
        repositoryUrl: projects.repositoryUrl,
        defaultBranch: projects.defaultBranch,
        isActive: projects.isActive,
        isPublic: projects.isPublic,
        deploySettings: projects.deploySettings,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerImage: users.image,
        environmentsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${environments} WHERE ${environments.projectId} = ${projects.id}), 0)`,
        deploymentsCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${deployments} WHERE ${deployments.projectId} = ${projects.id}), 0)`,
        membersCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${projectMembers} WHERE ${projectMembers.projectId} = ${projects.id}), 0)`,
      })
      .from(projects)
      .innerJoin(users, eq(projects.ownerId, users.id))
      .where(and(eq(projects.id, id), projects.isActive))
      .limit(1);

    if (!project) throw new NotFoundException("项目不存在");

    return {
      ...project,
      defaultBranch: project.defaultBranch ?? "main",
      isActive: project.isActive ?? true,
      isPublic: project.isPublic ?? false,
      owner: {
        id: project.ownerId,
        name: project.ownerName,
        email: project.ownerEmail,
        image: project.ownerImage,
      },
      environmentsCount: project.environmentsCount,
      deploymentsCount: project.deploymentsCount,
      membersCount: project.membersCount,
    };
  }

  // 更新项目
  async update(
    input: UpdateProjectInput,
    userId: number
  ): Promise<ProjectWithOwner> {
    await this.checkProjectPermission(input.id, userId, ["owner", "admin"]);

    const [updated] = await this.db
      .update(projects)
      .set({
        displayName: input.displayName,
        description: input.description,
        logo: input.logo,
        defaultBranch: input.defaultBranch,
        isActive: input.isActive,
        isPublic: input.isPublic,
        deploySettings: input.deploySettings,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, input.id))
      .returning();

    if (!updated) {
      throw new NotFoundException("项目不存在");
    }

    // 获取项目所有者信息
    const projectWithOwner = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        displayName: projects.displayName,
        description: projects.description,
        logo: projects.logo,
        ownerId: projects.ownerId,
        gitlabProjectId: projects.gitlabProjectId,
        repositoryUrl: projects.repositoryUrl,
        defaultBranch: projects.defaultBranch,
        isActive: projects.isActive,
        isPublic: projects.isPublic,
        deploySettings: projects.deploySettings,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        // Owner fields
        ownerId_user: users.id,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerImage: users.image,
      })
      .from(projects)
      .leftJoin(users, eq(projects.ownerId, users.id))
      .where(eq(projects.id, input.id));

    if (!projectWithOwner || projectWithOwner.length === 0) {
      throw new NotFoundException("项目不存在");
    }

    const result = projectWithOwner[0];

    return {
      id: result.id,
      name: result.name,
      displayName: result.displayName,
      description: result.description,
      logo: result.logo,
      ownerId: result.ownerId,
      gitlabProjectId: result.gitlabProjectId,
      repositoryUrl: result.repositoryUrl,
      defaultBranch: result.defaultBranch ?? "main",
      isActive: result.isActive ?? true,
      isPublic: result.isPublic ?? false,
      deploySettings: result.deploySettings,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      environmentsCount: 0,
      deploymentsCount: 0,
      membersCount: 1,
      owner: result.ownerId_user
        ? {
            id: result.ownerId_user,
            name: result.ownerName!,
            email: result.ownerEmail!,
            image: result.ownerImage,
          }
        : null,
    };
  }

  // 删除项目（软删除）
  async delete(id: number, userId: number) {
    await this.checkProjectPermission(id, userId, ["owner"]);

    const [deleted] = await this.db
      .update(projects)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))
      .returning();

    if (!deleted) {
      throw new NotFoundException("项目不存在");
    }
  }

  // 获取项目统计
  async getStats(projectId: number, userId: number): Promise<ProjectStats> {
    await this.checkProjectPermission(projectId, userId);

    const [stats] = await this.db
      .select({
        totalDeployments: count(deployments.id),
        totalEnvironments: count(environments.id),
      })
      .from(projects)
      .leftJoin(deployments, eq(projects.id, deployments.projectId))
      .leftJoin(environments, eq(projects.id, environments.projectId))
      .where(eq(projects.id, projectId))
      .groupBy(projects.id);

    // 获取最后一次部署信息
    const [lastDeployment] = await this.db
      .select({
        id: deployments.id,
        version: deployments.version,
        status: deployments.status,
        createdAt: deployments.createdAt,
        environmentName: environments.name,
        environmentDisplayName: environments.displayName,
        userName: users.name,
      })
      .from(deployments)
      .innerJoin(environments, eq(deployments.environmentId, environments.id))
      .innerJoin(users, eq(deployments.userId, users.id))
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt))
      .limit(1);

    return {
      totalDeployments: stats?.totalDeployments || 0,
      successfulDeployments: 0, // 需要根据实际状态计算
      failedDeployments: 0, // 需要根据实际状态计算
      totalEnvironments: stats?.totalEnvironments || 0,
      lastDeployment: lastDeployment
        ? {
            id: lastDeployment.id,
            version: lastDeployment.version,
            status: lastDeployment.status,
            createdAt: lastDeployment.createdAt,
            environment: {
              name: lastDeployment.environmentName,
              displayName: lastDeployment.environmentDisplayName,
            },
            user: {
              name: lastDeployment.userName,
            },
          }
        : null,
    };
  }

  // 获取项目成员
  async getMembers(projectId: number, userId: number) {
    await this.checkProjectPermission(projectId, userId);

    return await this.db
      .select({
        id: projectMembers.id,
        projectId: projectMembers.projectId,
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        user: {
          id: users.id,
          name: users.name,
          email: users.email,
          image: users.image,
        },
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(desc(projectMembers.joinedAt));
  }

  // 邀请成员
  async inviteMember(input: InviteMemberInput, userId: number) {
    await this.checkProjectPermission(input.projectId, userId, [
      "owner",
      "admin",
    ]);

    // 查找用户
    const [user] = await this.db
      .select()
      .from(users)
      .where(eq(users.email, input.email))
      .limit(1);

    if (!user) {
      throw new NotFoundException("用户不存在");
    }

    // 检查是否已经是成员
    const [existingMember] = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, user.id)
        )
      )
      .limit(1);

    if (existingMember) {
      throw new BadRequestException("用户已经是项目成员");
    }

    const [member] = await this.db
      .insert(projectMembers)
      .values({
        projectId: input.projectId,
        userId: user.id,
        role: input.role,
      })
      .returning();

    return member;
  }

  // 更新成员角色
  async updateMemberRole(input: UpdateMemberRoleInput, userId: number) {
    await this.checkProjectPermission(input.projectId, userId, [
      "owner",
      "admin",
    ]);

    // 不能修改项目所有者的角色
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);

    if (project?.ownerId === input.userId) {
      throw new BadRequestException("不能修改项目所有者的角色");
    }

    const [updated] = await this.db
      .update(projectMembers)
      .set({
        role: input.role,
      })
      .where(
        and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, input.userId)
        )
      )
      .returning();

    if (!updated) {
      throw new NotFoundException("项目成员不存在");
    }

    return updated;
  }

  // 移除成员
  async removeMember(input: RemoveMemberInput, userId: number) {
    await this.checkProjectPermission(input.projectId, userId, [
      "owner",
      "admin",
    ]);

    // 不能移除项目所有者
    const [project] = await this.db
      .select()
      .from(projects)
      .where(eq(projects.id, input.projectId))
      .limit(1);

    if (project?.ownerId === input.userId) {
      throw new BadRequestException("不能移除项目所有者");
    }

    const result = await this.db
      .delete(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, input.userId)
        )
      );

    // Drizzle ORM delete 操作返回的结果没有 rowCount 属性
    // 我们可以通过查询来验证删除是否成功
    const memberExists = await this.db
      .select({ count: count() })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, input.projectId),
          eq(projectMembers.userId, input.userId)
        )
      );

    if (memberExists[0].count > 0) {
      throw new NotFoundException("项目成员删除失败");
    }
  }

  // 更新部署设置
  async updateDeploySettings(
    input: UpdateDeploySettingsInput,
    userId: number
  ): Promise<ProjectWithOwner> {
    await this.checkProjectPermission(input.projectId, userId, [
      "owner",
      "admin",
    ]);

    const [updated] = await this.db
      .update(projects)
      .set({
        deploySettings: input.deploySettings,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, input.projectId))
      .returning();

    if (!updated) {
      throw new NotFoundException("项目不存在");
    }

    // 获取包含owner信息的完整项目数据
    const [projectWithOwner] = await this.db
      .select({
        id: projects.id,
        name: projects.name,
        displayName: projects.displayName,
        description: projects.description,
        logo: projects.logo,
        ownerId: projects.ownerId,
        gitlabProjectId: projects.gitlabProjectId,
        repositoryUrl: projects.repositoryUrl,
        defaultBranch: projects.defaultBranch,
        isActive: projects.isActive,
        isPublic: projects.isPublic,
        deploySettings: projects.deploySettings,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        ownerName: users.name,
        ownerEmail: users.email,
        ownerImage: users.image,
      })
      .from(projects)
      .innerJoin(users, eq(projects.ownerId, users.id))
      .where(eq(projects.id, input.projectId))
      .limit(1);

    if (!projectWithOwner) {
      throw new NotFoundException("项目不存在");
    }

    return {
      ...projectWithOwner,
      defaultBranch: projectWithOwner.defaultBranch ?? "main",
      isActive: projectWithOwner.isActive ?? true,
      isPublic: projectWithOwner.isPublic ?? false,
      environmentsCount: 0,
      deploymentsCount: 0,
      membersCount: 1,
      owner: {
        id: projectWithOwner.ownerId,
        name: projectWithOwner.ownerName!,
        email: projectWithOwner.ownerEmail!,
        image: projectWithOwner.ownerImage,
      },
    };
  }

  // 获取最近活动
  async getRecentActivities(
    projectId: number,
    userId: number,
    limit: number = 10
  ): Promise<RecentActivity[]> {
    await this.checkProjectPermission(projectId, userId);

    const activities = await this.db
      .select({
        id: deployments.id,
        version: deployments.version,
        status: deployments.status,
        createdAt: deployments.createdAt,
        environment: environments.name,
        userName: users.name,
        userImage: users.image,
      })
      .from(deployments)
      .innerJoin(environments, eq(deployments.environmentId, environments.id))
      .innerJoin(users, eq(deployments.userId, users.id))
      .where(eq(deployments.projectId, projectId))
      .orderBy(desc(deployments.createdAt))
      .limit(limit);

    // 转换为符合 recentActivitySchema 的格式
    return activities.map((activity) => ({
      id: activity.id,
      type: "deployment" as const,
      title: `部署 ${activity.version || "latest"} 到 ${activity.environment}`,
      description: `状态: ${activity.status}`,
      timestamp: activity.createdAt,
      user: {
        name: activity.userName,
        image: activity.userImage,
      },
      metadata: {
        version: activity.version,
        status: activity.status,
        environment: activity.environment,
      },
    }));
  }

  // 统一的权限检查方法
  private async checkProjectPermission(
    projectId: number,
    userId: number,
    requiredRoles?: string[]
  ): Promise<void> {
    const [permission] = await this.db
      .select({
        role: projectMembers.role,
        isOwner: sql<boolean>`${projects.ownerId} = ${userId}`,
      })
      .from(projects)
      .leftJoin(
        projectMembers,
        and(
          eq(projects.id, projectMembers.projectId),
          eq(projectMembers.userId, userId)
        )
      )
      .where(and(eq(projects.id, projectId), projects.isActive))
      .limit(1);

    if (!permission) throw new ForbiddenException("没有权限访问该项目");

    if (requiredRoles) {
      const hasPermission =
        permission.isOwner ||
        (permission.role && requiredRoles.includes(permission.role));
      if (!hasPermission) throw new ForbiddenException("权限不足");
    }
  }
}
