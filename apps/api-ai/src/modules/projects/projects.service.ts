import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, or, isNull, gt } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import * as schema from '../../database/schemas';
import { 
  Project, 
  NewProject, 
  UpdateProject, 
  ProjectStatus, 
  ProjectVisibility,
  insertProjectSchema,
  updateProjectSchema 
} from '../../database/schemas/projects.schema';

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建项目
   */
  async createProject(projectData: NewProject): Promise<Project> {
    try {
      // 验证输入数据
      const validatedData = insertProjectSchema.parse(projectData);

      // 检查组织是否存在
      const organization = await this.db
        .select()
        .from(schema.organizations)
        .where(eq(schema.organizations.id, validatedData.organizationId))
        .limit(1);

      if (organization.length === 0) {
        throw new NotFoundException('Organization not found');
      }

      // 检查项目名称和slug是否在组织内唯一
      const existingProject = await this.db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, validatedData.organizationId),
            or(
              eq(schema.projects.name, validatedData.name),
              eq(schema.projects.slug, validatedData.slug)
            )
          )
        )
        .limit(1);

      if (existingProject.length > 0) {
        throw new BadRequestException('Project name or slug already exists in this organization');
      }

      const [newProject] = await this.db
        .insert(schema.projects)
        .values({
          ...validatedData,
          maxMonthlyCost: validatedData.maxMonthlyCost?.toString(),
        })
        .returning();

      this.logger.log(`Project created: ${newProject.id}`);
      return newProject;
    } catch (error) {
      this.logger.error(`Failed to create project: ${error}`);
      throw error;
    }
  }

  /**
   * 根据ID查找项目
   */
  async findById(id: string): Promise<Project | null> {
    try {
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(eq(schema.projects.id, id))
        .limit(1);

      return project || null;
    } catch (error) {
      this.logger.error(`Failed to find project by id ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 根据组织ID和slug查找项目
   */
  async findBySlug(organizationId: string, slug: string): Promise<Project | null> {
    try {
      const [project] = await this.db
        .select()
        .from(schema.projects)
        .where(
          and(
            eq(schema.projects.organizationId, organizationId),
            eq(schema.projects.slug, slug)
          )
        )
        .limit(1);

      return project || null;
    } catch (error) {
      this.logger.error(`Failed to find project by slug ${slug}: ${error}`);
      throw error;
    }
  }

  /**
   * 更新项目
   */
  async updateProject(id: string, updateData: UpdateProject): Promise<Project> {
    try {
      const validatedData = updateProjectSchema.parse(updateData);
      
      const existingProject = await this.findById(id);
      if (!existingProject) {
        throw new NotFoundException('Project not found');
      }

      // 如果更新名称或slug，检查唯一性
      if (validatedData.name || validatedData.slug) {
        const conflictingProject = await this.db
          .select()
          .from(schema.projects)
          .where(
            and(
              eq(schema.projects.organizationId, existingProject.organizationId),
              or(
                validatedData.name ? eq(schema.projects.name, validatedData.name) : sql`false`,
                validatedData.slug ? eq(schema.projects.slug, validatedData.slug) : sql`false`
              ),
              sql`${schema.projects.id} != ${id}`
            )
          )
          .limit(1);

        if (conflictingProject.length > 0) {
          throw new BadRequestException('Project name or slug already exists in this organization');
        }
      }

      const [updatedProject] = await this.db
        .update(schema.projects)
        .set({ 
          ...validatedData,
          updatedAt: new Date()
        })
        .where(eq(schema.projects.id, id))
        .returning();

      this.logger.log(`Project updated: ${id}`);
      return updatedProject;
    } catch (error) {
      this.logger.error(`Failed to update project ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 删除项目
   */
  async deleteProject(id: string): Promise<void> {
    try {
      const existingProject = await this.findById(id);
      if (!existingProject) {
        throw new NotFoundException('Project not found');
      }

      await this.db
        .delete(schema.projects)
        .where(eq(schema.projects.id, id));

      this.logger.log(`Project deleted: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete project ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 获取组织的项目列表
   */
  async getOrganizationProjects(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: ProjectStatus;
      visibility?: ProjectVisibility;
      search?: string;
      sortBy?: 'name' | 'createdAt' | 'updatedAt';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ) {
    try {
      const {
        limit = 20,
        offset = 0,
        status,
        visibility,
        search,
        sortBy = 'updatedAt',
        sortOrder = 'desc'
      } = options;

      // 构建过滤条件
      const conditions = [eq(schema.projects.organizationId, organizationId)];

      if (status) {
        conditions.push(eq(schema.projects.status, status));
      }

      if (visibility) {
        conditions.push(eq(schema.projects.visibility, visibility));
      }

      if (search) {
        conditions.push(
          or(
            sql`${schema.projects.name} ILIKE ${`%${search}%`}`,
            sql`${schema.projects.description} ILIKE ${`%${search}%`}`
          )!
        );
      }

      // 构建查询
      const sortColumn = schema.projects[sortBy];
      const projects = await this.db
        .select()
        .from(schema.projects)
        .where(and(...conditions))
        .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
        .limit(limit)
        .offset(offset);

      // 获取总数
      const [{ count: total }] = await this.db
        .select({ count: count() })
        .from(schema.projects)
        .where(and(...conditions));

      return {
        projects,
        total,
        limit,
        offset,
      };
    } catch (error) {
      this.logger.error(`Failed to get organization projects: ${error}`);
      throw error;
    }
  }

  /**
   * 获取项目成员列表
   */
  async getProjectMembers(projectId: string, limit = 20, offset = 0) {
    try {
      const members = await this.db
        .select({
          id: schema.projectMemberships.id,
          userId: schema.projectMemberships.userId,
          role: schema.projectMemberships.role,
          status: schema.projectMemberships.status,
          joinedAt: schema.projectMemberships.joinedAt,
          user: {
            id: schema.users.id,
            email: schema.users.email,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatarUrl: schema.users.avatarUrl,
          }
        })
        .from(schema.projectMemberships)
        .leftJoin(schema.users, eq(schema.projectMemberships.userId, schema.users.id))
        .where(eq(schema.projectMemberships.projectId, projectId))
        .orderBy(desc(schema.projectMemberships.joinedAt))
        .limit(limit)
        .offset(offset);

      return members;
    } catch (error) {
      this.logger.error(`Failed to get project members: ${error}`);
      throw error;
    }
  }

  /**
   * 添加项目成员
   */
  async addProjectMember(projectId: string, userId: string, role: 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner') {
    try {
      // 检查项目是否存在
      const project = await this.findById(projectId);
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // 检查用户是否已经是项目成员
      const existingMember = await this.db
        .select()
        .from(schema.projectMemberships)
        .where(
          and(
            eq(schema.projectMemberships.projectId, projectId),
            eq(schema.projectMemberships.userId, userId)
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new BadRequestException('User is already a member of this project');
      }

      const [newMember] = await this.db
        .insert(schema.projectMemberships)
        .values({
          projectId,
          userId,
          role,
        })
        .returning();

      return newMember;
    } catch (error) {
      this.logger.error(`Failed to add project member: ${error}`);
      throw error;
    }
  }

  /**
   * 移除项目成员
   */
  async removeProjectMember(projectId: string, userId: string) {
    try {
      const deletedMember = await this.db
        .delete(schema.projectMemberships)
        .where(
          and(
            eq(schema.projectMemberships.projectId, projectId),
            eq(schema.projectMemberships.userId, userId)
          )
        )
        .returning();

      if (deletedMember.length === 0) {
        throw new NotFoundException('Project member not found');
      }

      return deletedMember[0];
    } catch (error) {
      this.logger.error(`Failed to remove project member: ${error}`);
      throw error;
    }
  }

  /**
   * 更新项目成员角色
   */
  async updateProjectMemberRole(projectId: string, userId: string, role: 'guest' | 'reporter' | 'developer' | 'maintainer' | 'owner') {
    try {
      const [updatedMember] = await this.db
        .update(schema.projectMemberships)
        .set({
          role,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.projectMemberships.projectId, projectId),
            eq(schema.projectMemberships.userId, userId)
          )
        )
        .returning();

      if (!updatedMember) {
        throw new NotFoundException('Project member not found');
      }

      return updatedMember;
    } catch (error) {
      this.logger.error(`Failed to update project member role: ${error}`);
      throw error;
    }
  }

  /**
   * 更新项目资源使用量
   */
  async updateProjectUsage(projectId: string, usage: {
    currentComputeUnits?: number;
    currentStorageGb?: number;
    currentMonthlyCost?: number;
  }) {
    try {
      const updateData: any = { updatedAt: new Date() };

      // 构建增量更新
      if (usage.currentComputeUnits !== undefined) {
        updateData.currentComputeUnits = sql`${schema.projects.currentComputeUnits} + ${usage.currentComputeUnits}`;
      }
      if (usage.currentStorageGb !== undefined) {
        updateData.currentStorageGb = sql`${schema.projects.currentStorageGb} + ${usage.currentStorageGb}`;
      }
      if (usage.currentMonthlyCost !== undefined) {
        updateData.currentMonthlyCost = sql`${schema.projects.currentMonthlyCost} + ${usage.currentMonthlyCost}`;
      }

      const [updatedProject] = await this.db
        .update(schema.projects)
        .set(updateData)
        .where(eq(schema.projects.id, projectId))
        .returning();

      return updatedProject;
    } catch (error) {
      this.logger.error(`Failed to update project usage: ${error}`);
      throw error;
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
      const project = await this.findById(projectId);
      if (!project) {
        throw new NotFoundException('Project not found');
      }

      const violations: string[] = [];

      // 检查计算单元限制
      if ((project.currentComputeUnits ?? 0) > (project.maxComputeUnits ?? 0)) {
        violations.push(`Compute units (${project.currentComputeUnits ?? 0}) exceeds limit (${project.maxComputeUnits ?? 0})`);
      }

      // 检查存储限制
      if ((project.currentStorageGb ?? 0) > (project.maxStorageGb ?? 0)) {
        violations.push(`Storage usage (${project.currentStorageGb ?? 0}GB) exceeds limit (${project.maxStorageGb ?? 0}GB)`);
      }

      // 检查月度成本限制
      const currentCost = parseFloat(project.currentMonthlyCost?.toString() ?? '0');
      const maxCost = parseFloat(project.maxMonthlyCost?.toString() ?? '0');
      if (currentCost > maxCost) {
        violations.push(`Monthly cost ($${currentCost}) exceeds limit ($${maxCost})`);
      }

      return {
        withinLimits: violations.length === 0,
        violations,
        usage: {
          currentComputeUnits: project.currentComputeUnits ?? 0,
          currentStorageGb: project.currentStorageGb ?? 0,
          currentMonthlyCost: currentCost,
        },
        limits: {
          maxComputeUnits: project.maxComputeUnits ?? 0,
          maxStorageGb: project.maxStorageGb ?? 0,
          maxMonthlyCost: maxCost,
        },
      };
    } catch (error) {
      this.logger.error(`Failed to check project resource limits: ${error}`);
      throw error;
    }
  }

  /**
   * 获取项目统计信息
   */
  async getProjectStats(projectId: string) {
    try {
      // 获取成员数量
      const memberCount = await this.db
        .select({ count: count() })
        .from(schema.projectMemberships)
        .where(eq(schema.projectMemberships.projectId, projectId));

      return {
        memberCount: memberCount[0]?.count || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get project stats: ${error}`);
      throw error;
    }
  }

  /**
   * 获取用户参与的项目列表
   */
  async getUserProjects(userId: string) {
    try {
      const projects = await this.db
        .select({
          id: schema.projects.id,
          name: schema.projects.name,
          slug: schema.projects.slug,
          displayName: schema.projects.displayName,
          description: schema.projects.description,
          status: schema.projects.status,
          visibility: schema.projects.visibility,
          organizationId: schema.projects.organizationId,
          role: schema.projectMemberships.role,
          joinedAt: schema.projectMemberships.joinedAt,
          organization: {
            id: schema.organizations.id,
            name: schema.organizations.name,
            slug: schema.organizations.slug,
          }
        })
        .from(schema.projectMemberships)
        .leftJoin(schema.projects, eq(schema.projectMemberships.projectId, schema.projects.id))
        .leftJoin(schema.organizations, eq(schema.projects.organizationId, schema.organizations.id))
        .where(eq(schema.projectMemberships.userId, userId))
        .orderBy(desc(schema.projectMemberships.joinedAt));

      return projects;
    } catch (error) {
      this.logger.error(`Failed to get user projects: ${error}`);
      throw error;
    }
  }

  /**
   * 归档项目
   */
  async archiveProject(id: string): Promise<Project> {
    try {
      const [archivedProject] = await this.db
        .update(schema.projects)
        .set({
          status: 'archived',
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, id))
        .returning();

      if (!archivedProject) {
        throw new NotFoundException('Project not found');
      }

      this.logger.log(`Project archived: ${id}`);
      return archivedProject;
    } catch (error) {
      this.logger.error(`Failed to archive project ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 恢复归档的项目
   */
  async unarchiveProject(id: string): Promise<Project> {
    try {
      const [unarchivedProject] = await this.db
        .update(schema.projects)
        .set({
          status: 'active',
          isArchived: false,
          updatedAt: new Date(),
        })
        .where(eq(schema.projects.id, id))
        .returning();

      if (!unarchivedProject) {
        throw new NotFoundException('Project not found');
      }

      this.logger.log(`Project unarchived: ${id}`);
      return unarchivedProject;
    } catch (error) {
      this.logger.error(`Failed to unarchive project ${id}: ${error}`);
      throw error;
    }
  }
}