import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import {
  projectMemberships,
  ProjectMembership,
  NewProjectMembership,
  UpdateProjectMembership,
  ProjectMemberRole,
  ProjectMemberStatus,
  insertProjectMembershipSchema,
  updateProjectMembershipSchema,
} from '../../database/schemas/project-memberships.schema';
import { users } from '../../database/schemas/users.schema';
import { projects } from '../../database/schemas/projects.schema';

@Injectable()
export class ProjectMembershipsService {
  private readonly logger = new Logger(ProjectMembershipsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  async hello(): Promise<string> {
    this.logger.log('Hello from ProjectMembershipsService');
    return 'Hello from ProjectMembershipsService';
  }

  /**
   * 添加项目成员
   */
  async addProjectMember(data: NewProjectMembership): Promise<ProjectMembership> {
    try {
      const validatedData = insertProjectMembershipSchema.parse(data);

      // 检查项目是否存在
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, validatedData.projectId))
        .limit(1);

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // 检查用户是否存在
      const [user] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, validatedData.userId))
        .limit(1);

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // 检查是否已经是项目成员
      const [existingMember] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, validatedData.projectId),
            eq(projectMemberships.userId, validatedData.userId)
          )
        )
        .limit(1);

      if (existingMember) {
        throw new ConflictException('User is already a member of this project');
      }

      const [membership] = await this.db
        .insert(projectMemberships)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Added member ${validatedData.userId} to project ${validatedData.projectId}`);
      return membership;
    } catch (error) {
      this.logger.error(`Failed to add project member: ${error}`);
      throw error;
    }
  }

  /**
   * 获取项目成员列表
   */
  async getProjectMembers(
    projectId: string,
    options: { limit?: number; offset?: number; status?: ProjectMemberStatus } = {}
  ): Promise<{ members: Array<ProjectMembership & { user: any }>; total: number }> {
    try {
      const { limit = 50, offset = 0, status } = options;

      const conditions = [eq(projectMemberships.projectId, projectId)];
      if (status) {
        conditions.push(eq(projectMemberships.status, status));
      }

      const [membersResult, totalResult] = await Promise.all([
        this.db
          .select({
            id: projectMemberships.id,
            projectId: projectMemberships.projectId,
            userId: projectMemberships.userId,
            teamId: projectMemberships.teamId,
            role: projectMemberships.role,
            status: projectMemberships.status,
            invitedBy: projectMemberships.invitedBy,
            joinedAt: projectMemberships.joinedAt,
            createdAt: projectMemberships.createdAt,
            updatedAt: projectMemberships.updatedAt,
            user: {
              id: users.id,
              email: users.email,
              displayName: users.displayName,
              username: users.username,
              avatarUrl: users.avatarUrl,
            },
          })
          .from(projectMemberships)
          .leftJoin(users, eq(projectMemberships.userId, users.id))
          .where(and(...conditions))
          .orderBy(desc(projectMemberships.joinedAt))
          .limit(limit)
          .offset(offset),
        
        this.db
          .select({ count: count() })
          .from(projectMemberships)
          .where(and(...conditions))
      ]);

      return {
        members: membersResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get project members: ${error}`);
      throw new BadRequestException('Failed to get project members');
    }
  }

  /**
   * 获取用户的项目成员身份
   */
  async getUserProjectMembership(projectId: string, userId: string): Promise<ProjectMembership | null> {
    try {
      const [membership] = await this.db
        .select()
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, projectId),
            eq(projectMemberships.userId, userId)
          )
        )
        .limit(1);

      return membership || null;
    } catch (error) {
      this.logger.error(`Failed to get user project membership: ${error}`);
      throw new BadRequestException('Failed to get user project membership');
    }
  }

  /**
   * 更新项目成员角色
   */
  async updateMemberRole(
    projectId: string,
    userId: string,
    role: ProjectMemberRole
  ): Promise<ProjectMembership> {
    try {
      const membership = await this.getUserProjectMembership(projectId, userId);
      if (!membership) {
        throw new NotFoundException('Project membership not found');
      }

      const [updatedMembership] = await this.db
        .update(projectMemberships)
        .set({
          role,
          updatedAt: new Date(),
        })
        .where(eq(projectMemberships.id, membership.id))
        .returning();

      this.logger.log(`Updated member role: ${userId} in project ${projectId} to ${role}`);
      return updatedMembership;
    } catch (error) {
      this.logger.error(`Failed to update member role: ${error}`);
      throw error;
    }
  }

  /**
   * 移除项目成员
   */
  async removeMember(projectId: string, userId: string): Promise<boolean> {
    try {
      const membership = await this.getUserProjectMembership(projectId, userId);
      if (!membership) {
        throw new NotFoundException('Project membership not found');
      }

      await this.db
        .delete(projectMemberships)
        .where(eq(projectMemberships.id, membership.id));

      this.logger.log(`Removed member ${userId} from project ${projectId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove member: ${error}`);
      throw error;
    }
  }

  /**
   * 获取用户参与的项目列表
   */
  async getUserProjects(
    userId: string,
    options: { limit?: number; offset?: number; role?: ProjectMemberRole } = {}
  ): Promise<{ projects: Array<ProjectMembership & { project: any }>; total: number }> {
    try {
      const { limit = 50, offset = 0, role } = options;

      const conditions = [
        eq(projectMemberships.userId, userId),
        eq(projectMemberships.status, 'active')
      ];
      if (role) {
        conditions.push(eq(projectMemberships.role, role));
      }

      const [projectsResult, totalResult] = await Promise.all([
        this.db
          .select({
            id: projectMemberships.id,
            projectId: projectMemberships.projectId,
            userId: projectMemberships.userId,
            teamId: projectMemberships.teamId,
            role: projectMemberships.role,
            status: projectMemberships.status,
            invitedBy: projectMemberships.invitedBy,
            joinedAt: projectMemberships.joinedAt,
            createdAt: projectMemberships.createdAt,
            updatedAt: projectMemberships.updatedAt,
            project: {
              id: projects.id,
              name: projects.name,
              slug: projects.slug,
              description: projects.description,
              visibility: projects.visibility,
              status: projects.status,
            },
          })
          .from(projectMemberships)
          .leftJoin(projects, eq(projectMemberships.projectId, projects.id))
          .where(and(...conditions))
          .orderBy(desc(projectMemberships.joinedAt))
          .limit(limit)
          .offset(offset),
        
        this.db
          .select({ count: count() })
          .from(projectMemberships)
          .where(and(...conditions))
      ]);

      return {
        projects: projectsResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get user projects: ${error}`);
      throw new BadRequestException('Failed to get user projects');
    }
  }

  /**
   * 批量添加项目成员
   */
  async batchAddMembers(
    projectId: string,
    userIds: string[],
    role: ProjectMemberRole = 'developer',
    invitedBy?: string
  ): Promise<ProjectMembership[]> {
    try {
      // 检查项目是否存在
      const [project] = await this.db
        .select()
        .from(projects)
        .where(eq(projects.id, projectId))
        .limit(1);

      if (!project) {
        throw new NotFoundException('Project not found');
      }

      // 检查哪些用户已经是项目成员
      const existingMembers = await this.db
        .select({ userId: projectMemberships.userId })
        .from(projectMemberships)
        .where(
          and(
            eq(projectMemberships.projectId, projectId),
            inArray(projectMemberships.userId, userIds)
          )
        );

      const existingUserIds = existingMembers.map(m => m.userId);
      const newUserIds = userIds.filter(id => !existingUserIds.includes(id));

      if (newUserIds.length === 0) {
        throw new ConflictException('All users are already members of this project');
      }

      const membershipsToInsert = newUserIds.map(userId => ({
        projectId,
        userId,
        role,
        invitedBy,
        status: 'active' as ProjectMemberStatus,
        joinedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const newMemberships = await this.db
        .insert(projectMemberships)
        .values(membershipsToInsert)
        .returning();

      this.logger.log(`Batch added ${newMemberships.length} members to project ${projectId}`);
      return newMemberships;
    } catch (error) {
      this.logger.error(`Failed to batch add members: ${error}`);
      throw error;
    }
  }

  /**
   * 获取项目成员统计
   */
  async getProjectMemberStats(projectId: string): Promise<{
    totalMembers: number;
    activeMembers: number;
    pendingMembers: number;
    roleDistribution: Record<ProjectMemberRole, number>;
  }> {
    try {
      const [totalResult, activeResult, pendingResult, roleResults] = await Promise.all([
        this.db
          .select({ count: count() })
          .from(projectMemberships)
          .where(eq(projectMemberships.projectId, projectId)),
        
        this.db
          .select({ count: count() })
          .from(projectMemberships)
          .where(
            and(
              eq(projectMemberships.projectId, projectId),
              eq(projectMemberships.status, 'active')
            )
          ),
        
        this.db
          .select({ count: count() })
          .from(projectMemberships)
          .where(
            and(
              eq(projectMemberships.projectId, projectId),
              eq(projectMemberships.status, 'pending')
            )
          ),
        
        this.db
          .select({
            role: projectMemberships.role,
            count: count(),
          })
          .from(projectMemberships)
          .where(
            and(
              eq(projectMemberships.projectId, projectId),
              eq(projectMemberships.status, 'active')
            )
          )
          .groupBy(projectMemberships.role)
      ]);

      const roleDistribution: Record<ProjectMemberRole, number> = {
        guest: 0,
        reporter: 0,
        developer: 0,
        maintainer: 0,
        owner: 0,
      };

      roleResults.forEach(result => {
        roleDistribution[result.role] = result.count;
      });

      return {
        totalMembers: totalResult[0]?.count || 0,
        activeMembers: activeResult[0]?.count || 0,
        pendingMembers: pendingResult[0]?.count || 0,
        roleDistribution,
      };
    } catch (error) {
      this.logger.error(`Failed to get project member stats: ${error}`);
      throw new BadRequestException('Failed to get project member stats');
    }
  }
}
