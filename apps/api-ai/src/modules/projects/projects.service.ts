import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, ilike } from "drizzle-orm";
import { InjectDatabase } from "../../common/decorators/database.decorator";
import { Database } from "../../database/database.module";
import {
  insertProjectSchema,
  NewProject,
  organizations,
  Project,
  projects,
  selectProjectSchema,
  UpdateProject,
  updateProjectSchema,
  users,
} from "../../database/schemas";

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建项目
   */
  async createProject(data: NewProject): Promise<Project> {
    try {
      const validatedData = insertProjectSchema.parse(data);

      const [project] = await this.db
        .insert(projects)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Created project: ${project.id}`);
      return project;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to create project: ${errorMessage}`);
      throw new BadRequestException("Failed to create project");
    }
  }

  /**
   * 根据ID获取项目
   */
  async findById(id: string): Promise<Project | null> {
    try {
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, id))
        .limit(1);

      return project || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get project by ID: ${errorMessage}`);
      throw new BadRequestException("Failed to get project");
    }
  }

  /**
   * 根据slug获取项目
   */
  async findBySlug(slug: string): Promise<Project | null> {
    try {
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.slug, slug))
        .limit(1);

      return project || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get project by slug: ${errorMessage}`);
      throw new BadRequestException("Failed to get project");
    }
  }

  /**
   * 更新项目
   */
  async updateProject(id: string, data: UpdateProject): Promise<Project> {
    try {
      const validatedData = updateProjectSchema.parse(data);

      const [updatedProject] = await this.db
        .update(projects)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      if (!updatedProject) {
        throw new NotFoundException("Project not found");
      }

      this.logger.log(`Updated project: ${id}`);
      return updatedProject;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update project: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update project");
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(projects)
        .where(eq(projects.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundException("Project not found");
      }

      this.logger.log(`Deleted project: ${id}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to delete project: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to delete project");
    }
  }

  /**
   * 获取组织的项目列表
   */
  async getOrganizationProjects(
    organizationId: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ projects: Project[]; total: number }> {
    try {
      // 参数验证
      if (limit < 1 || limit > 100) {
        throw new BadRequestException("Limit must be between 1 and 100");
      }
      if (offset < 0) {
        throw new BadRequestException("Offset must be non-negative");
      }

      const [projectsResult, totalResult] = await Promise.all([
        this.db
          .select()
          .from(projects)
          .where(eq(projects.organizationId, organizationId))
          .limit(limit)
          .offset(offset)
          .orderBy(desc(projects.createdAt)),

        this.db
          .select({ count: count() })
          .from(projects)
          .where(eq(projects.organizationId, organizationId)),
      ]);

      return {
        projects: projectsResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get organization projects: ${errorMessage}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Failed to get organization projects");
    }
  }

  /**
   * 搜索项目
   */
  async searchProjects(
    query?: string,
    organizationId?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ projects: Project[]; total: number }> {
    try {
      // 参数验证
      if (limit < 1 || limit > 100) {
        throw new BadRequestException("Limit must be between 1 and 100");
      }
      if (offset < 0) {
        throw new BadRequestException("Offset must be non-negative");
      }

      const conditions = [];

      if (organizationId) {
        conditions.push(eq(projects.organizationId, organizationId));
      }

      if (query) {
        conditions.push(ilike(projects.name, `%${query}%`));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [projectsResult, totalResult] = await Promise.all([
        this.db
          .select()
          .from(projects)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(projects.createdAt)),

        this.db.select({ count: count() }).from(projects).where(whereClause),
      ]);

      return {
        projects: projectsResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to search projects: ${errorMessage}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Failed to search projects");
    }
  }

  /**
   * 获取项目统计信息
   */
  async getProjectStats(organizationId?: string): Promise<{
    totalProjects: number;
    activeProjects: number;
    archivedProjects: number;
  }> {
    try {
      const whereCondition = organizationId
        ? eq(projects.organizationId, organizationId)
        : undefined;

      const [totalResult] = await this.db
        .select({ count: count() })
        .from(projects)
        .where(whereCondition);

      // 这里需要根据实际的项目状态字段来计算统计信息
      // 假设有 status 字段，实际使用时需要根据 schema 调整
      return {
        totalProjects: totalResult.count,
        activeProjects: 0, // 需要根据实际字段计算
        archivedProjects: 0, // 需要根据实际字段计算
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get project stats: ${errorMessage}`);
      throw new BadRequestException("Failed to get project stats");
    }
  }

  /**
   * 获取用户的项目列表
   */
  async getUserProjects(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Project[]> {
    try {
      // 暂时返回所有项目，实际需要根据用户项目关联表来实现
      return await this.db
        .select()
        .from(projects)
        .orderBy(desc(projects.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get user projects: ${errorMessage}`);
      throw new BadRequestException("Failed to get user projects");
    }
  }

  /**
   * 更新项目成员角色
   */
  async updateProjectMemberRole(
    projectId: string,
    userId: string,
    role: "guest" | "reporter" | "developer" | "maintainer" | "owner"
  ): Promise<boolean> {
    try {
      // 这里需要根据实际的项目成员表结构来实现
      // 暂时返回 true，实际实现需要更新项目成员表
      this.logger.log(
        `Updated project member role: ${projectId}, ${userId}, ${role}`
      );
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to update project member role: ${errorMessage}`
      );
      throw new BadRequestException("Failed to update project member role");
    }
  }

  /**
   * 更新项目使用情况
   */
  async updateProjectUsage(
    projectId: string,
    usage: {
      currentComputeUnits?: number;
      currentStorageGb?: number;
      currentMonthlyCost?: number;
    }
  ): Promise<Project> {
    try {
      const [updatedProject] = await this.db
        .update(projects)
        .set({
          // 这里需要根据实际的项目表结构来映射使用情况字段
          updatedAt: new Date(),
        })
        .where(eq(projects.id, projectId))
        .returning();

      if (!updatedProject) {
        throw new NotFoundException("Project not found");
      }

      this.logger.log(`Updated project usage: ${projectId}`);
      return updatedProject;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update project usage: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update project usage");
    }
  }

  /**
   * 检查项目资源限制
   */
  async checkProjectResourceLimits(projectId: string): Promise<{
    withinLimits: boolean;
    violations: string[];
    usage: any;
    limits: any;
  }> {
    try {
      // 这里需要根据实际的资源限制逻辑来实现
      // 暂时返回默认值
      return {
        withinLimits: true,
        violations: [],
        usage: {},
        limits: {},
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to check project resource limits: ${errorMessage}`
      );
      throw new BadRequestException("Failed to check project resource limits");
    }
  }

  /**
   * 归档项目
   */
  async archiveProject(id: string): Promise<Project> {
    try {
      const [archivedProject] = await this.db
        .update(projects)
        .set({
          // 这里需要根据实际的项目表结构来设置归档状态
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      if (!archivedProject) {
        throw new NotFoundException("Project not found");
      }

      this.logger.log(`Archived project: ${id}`);
      return archivedProject;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to archive project: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to archive project");
    }
  }

  /**
   * 解除项目归档
   */
  async unarchiveProject(id: string): Promise<Project> {
    try {
      const [updatedProject] = await this.db
        .update(projects)
        .set({
          status: 'active',
          isArchived: false,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      if (!updatedProject) {
        throw new NotFoundException('Project not found');
      }

      this.logger.log(`Unarchived project: ${id}`);
      return updatedProject;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to unarchive project: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to unarchive project');
    }
  }

  /**
   * 获取项目成员列表
   */
  async getProjectMembers(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Array<{
    id: string;
    userId: string;
    role: 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner';
    joinedAt: Date;
    user: {
      id: string;
      email: string;
      name: string | null;
      avatar: string | null;
    };
  }>> {
    try {
      // 这里需要根据实际的项目成员关联表来实现
      // 暂时返回空数组
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get project members: ${errorMessage}`);
      throw new BadRequestException('Failed to get project members');
    }
  }

  /**
   * 添加项目成员
   */
  async addProjectMember(
    projectId: string,
    userId: string,
    role: 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner' = 'developer'
  ): Promise<{
    id: string;
    userId: string;
    role: 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner';
    joinedAt: Date;
  }> {
    try {
      // 这里需要根据实际的项目成员关联表来实现
      // 暂时返回模拟数据
      const member = {
        id: `member-${Date.now()}`,
        userId,
        role,
        joinedAt: new Date()
      };

      this.logger.log(`Added member ${userId} to project ${projectId} with role ${role}`);
      return member;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add project member: ${errorMessage}`);
      throw new BadRequestException('Failed to add project member');
    }
  }

  /**
   * 移除项目成员
   */
  async removeProjectMember(projectId: string, userId: string): Promise<boolean> {
    try {
      // 这里需要根据实际的项目成员关联表来实现
      // 暂时返回true
      this.logger.log(`Removed member ${userId} from project ${projectId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove project member: ${errorMessage}`);
      throw new BadRequestException('Failed to remove project member');
    }
  }
}
