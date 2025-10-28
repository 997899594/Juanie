import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { 
  roleAssignments, 
  type RoleAssignment,
  type NewRoleAssignment,
  type UpdateRoleAssignment,
  insertRoleAssignmentSchema,
  updateRoleAssignmentSchema,
  selectRoleAssignmentSchema
} from '../../database/schemas/role-assignments.schema';
import { roles } from '../../database/schemas/roles.schema';
import { users } from '../../database/schemas/users.schema';
import { organizations } from '../../database/schemas/organizations.schema';
import { projects } from '../../database/schemas/projects.schema';
import { z } from 'zod';

export interface CreateRoleAssignmentRequest {
  userId: string;
  roleId: string;
  organizationId?: string;
  projectId?: string;
  teamId?: string;
  resourceType?: 'organization' | 'project' | 'team' | 'global';
  resourceId?: string;
  assignedBy?: string;
  expiresAt?: Date;
}

export interface RoleAssignmentWithDetails extends RoleAssignment {
  user?: {
    id: string;
    email: string;
    displayName: string | null;
  } | null;
  role?: {
    id: string;
    name: string;
    slug: string;
    scope: string;
  } | null;
  organization?: {
    id: string;
    name: string;
  } | null;
  project?: {
    id: string;
    name: string;
  } | null;
}

@Injectable()
export class RoleAssignmentsService {
  private readonly logger = new Logger(RoleAssignmentsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建角色分配
   */
  async createRoleAssignment(data: CreateRoleAssignmentRequest): Promise<RoleAssignment> {
    try {
      // 验证输入数据
      const validatedData = insertRoleAssignmentSchema.parse(data);

      // 检查是否已存在相同的角色分配
      const existingAssignment = await this.findExistingAssignment(
        data.userId,
        data.roleId,
        data.organizationId,
        data.projectId,
        data.teamId,
        data.resourceType,
        data.resourceId
      );

      if (existingAssignment) {
        throw new ConflictException('Role assignment already exists');
      }

      // 创建角色分配
      const [assignment] = await this.db
        .insert(roleAssignments)
        .values([validatedData])
        .returning();

      this.logger.log(`Role assignment created: ${assignment.id}`);
      return assignment;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create role assignment: ${errorMessage}`);
      throw new BadRequestException('Failed to create role assignment');
    }
  }

  /**
   * 查找已存在的角色分配
   */
  private async findExistingAssignment(
    userId: string,
    roleId: string,
    organizationId?: string,
    projectId?: string,
    teamId?: string,
    resourceType?: string,
    resourceId?: string
  ): Promise<RoleAssignment | null> {
    try {
      const conditions = [
        eq(roleAssignments.userId, userId),
        eq(roleAssignments.roleId, roleId)
      ];

      if (organizationId) {
        conditions.push(eq(roleAssignments.organizationId, organizationId));
      }
      if (projectId) {
        conditions.push(eq(roleAssignments.projectId, projectId));
      }
      if (teamId) {
        conditions.push(eq(roleAssignments.teamId, teamId));
      }
      if (resourceType && ['organization', 'project', 'team', 'global'].includes(resourceType)) {
        conditions.push(eq(roleAssignments.scopeType, resourceType as 'organization' | 'project' | 'team' | 'global'));
      }
      // 移除 resourceId 相关的条件，因为 schema 中没有这个字段
      // if (resourceId) {
      //   conditions.push(eq(roleAssignments.resourceId, resourceId));
      // }

      const [assignment] = await this.db
        .select()
        .from(roleAssignments)
        .where(and(...conditions))
        .limit(1);

      return assignment || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find existing assignment: ${errorMessage}`);
      return null;
    }
  }

  /**
   * 根据ID查找角色分配
   */
  async findById(id: string): Promise<RoleAssignment | null> {
    try {
      const [assignment] = await this.db
        .select()
        .from(roleAssignments)
        .where(eq(roleAssignments.id, id))
        .limit(1);

      return assignment || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find role assignment by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to find role assignment');
    }
  }

  /**
   * 获取用户的角色分配
   */
  async getUserRoleAssignments(options: {
    userId: string;
    organizationId?: string;
    projectId?: string;
    teamId?: string;
    resourceType?: 'organization' | 'project' | 'team' | 'global';
    includeExpired?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ assignments: RoleAssignmentWithDetails[]; total: number }> {
    try {
      const { 
        userId, 
        organizationId, 
        projectId, 
        teamId, 
        resourceType, 
        includeExpired = false,
        page = 1, 
        limit = 20 
      } = options;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const conditions = [eq(roleAssignments.userId, userId)];
      
      if (organizationId) {
        conditions.push(eq(roleAssignments.organizationId, organizationId));
      }
      if (projectId) {
        conditions.push(eq(roleAssignments.projectId, projectId));
      }
      if (teamId) {
        conditions.push(eq(roleAssignments.teamId, teamId));
      }
      if (resourceType) {
        conditions.push(eq(roleAssignments.scopeType, resourceType));
      }
      if (!includeExpired) {
        conditions.push(
          sql`(${roleAssignments.expiresAt} IS NULL OR ${roleAssignments.expiresAt} > NOW())`
        );
      }

      // 获取总数
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(roleAssignments)
        .where(and(...conditions));

      // 获取分页数据（包含关联信息）
      const assignmentsList = await this.db
        .select({
          assignment: roleAssignments,
          user: {
            id: users.id,
            email: users.email,
            displayName: users.displayName
          },
          role: {
            id: roles.id,
            name: roles.name,
            slug: roles.slug,
            scope: roles.scope
          },
          organization: {
            id: organizations.id,
            name: organizations.name
          },
          project: {
            id: projects.id,
            name: projects.name
          }
        })
        .from(roleAssignments)
        .leftJoin(users, eq(roleAssignments.userId, users.id))
        .leftJoin(roles, eq(roleAssignments.roleId, roles.id))
        .leftJoin(organizations, eq(roleAssignments.organizationId, organizations.id))
        .leftJoin(projects, eq(roleAssignments.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(roleAssignments.createdAt))
        .limit(limit)
        .offset(offset);

      const assignments: RoleAssignmentWithDetails[] = assignmentsList.map(item => ({
        ...item.assignment,
        user: item.user,
        role: item.role,
        organization: item.organization,
        project: item.project
      }));

      return {
        assignments,
        total: Number(total)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user role assignments: ${errorMessage}`);
      throw new BadRequestException('Failed to get user role assignments');
    }
  }

  /**
   * 获取角色的分配情况
   */
  async getRoleAssignments(options: {
    roleId: string;
    organizationId?: string;
    projectId?: string;
    teamId?: string;
    includeExpired?: boolean;
    page?: number;
    limit?: number;
  }): Promise<{ assignments: RoleAssignmentWithDetails[]; total: number }> {
    try {
      const { 
        roleId, 
        organizationId, 
        projectId, 
        teamId, 
        includeExpired = false,
        page = 1, 
        limit = 20 
      } = options;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const conditions = [eq(roleAssignments.roleId, roleId)];
      
      if (organizationId) {
        conditions.push(eq(roleAssignments.organizationId, organizationId));
      }
      if (projectId) {
        conditions.push(eq(roleAssignments.projectId, projectId));
      }
      if (teamId) {
        conditions.push(eq(roleAssignments.teamId, teamId));
      }
      if (!includeExpired) {
        conditions.push(
          sql`(${roleAssignments.expiresAt} IS NULL OR ${roleAssignments.expiresAt} > NOW())`
        );
      }

      // 获取总数
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(roleAssignments)
        .where(and(...conditions));

      // 获取分页数据（包含关联信息）
      const assignmentsList = await this.db
        .select({
          assignment: roleAssignments,
          user: {
            id: users.id,
            email: users.email,
            displayName: users.displayName
          },
          role: {
            id: roles.id,
            name: roles.name,
            slug: roles.slug,
            scope: roles.scope
          },
          organization: {
            id: organizations.id,
            name: organizations.name
          },
          project: {
            id: projects.id,
            name: projects.name
          }
        })
        .from(roleAssignments)
        .leftJoin(users, eq(roleAssignments.userId, users.id))
        .leftJoin(roles, eq(roleAssignments.roleId, roles.id))
        .leftJoin(organizations, eq(roleAssignments.organizationId, organizations.id))
        .leftJoin(projects, eq(roleAssignments.projectId, projects.id))
        .where(and(...conditions))
        .orderBy(desc(roleAssignments.createdAt))
        .limit(limit)
        .offset(offset);

      const assignments: RoleAssignmentWithDetails[] = assignmentsList.map(item => ({
        ...item.assignment,
        user: item.user,
        role: item.role,
        organization: item.organization,
        project: item.project
      }));

      return {
        assignments,
        total: Number(total)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get role assignments: ${errorMessage}`);
      throw new BadRequestException('Failed to get role assignments');
    }
  }

  /**
   * 更新角色分配
   */
  async updateRoleAssignment(id: string, data: UpdateRoleAssignment): Promise<RoleAssignment> {
    try {
      // 验证输入数据
      const validatedData = updateRoleAssignmentSchema.parse(data);

      // 检查角色分配是否存在
      const existingAssignment = await this.findById(id);
      if (!existingAssignment) {
        throw new NotFoundException(`Role assignment with ID ${id} not found`);
      }

      // 更新角色分配
      const [assignment] = await this.db
        .update(roleAssignments)
        .set(validatedData)
        .where(eq(roleAssignments.id, id))
        .returning();

      this.logger.log(`Role assignment updated: ${id}`);
      return assignment;
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update role assignment: ${errorMessage}`);
      throw new BadRequestException('Failed to update role assignment');
    }
  }

  /**
   * 删除角色分配
   */
  async deleteRoleAssignment(id: string): Promise<void> {
    try {
      // 检查角色分配是否存在
      const existingAssignment = await this.findById(id);
      if (!existingAssignment) {
        throw new NotFoundException(`Role assignment with ID ${id} not found`);
      }

      // 删除角色分配
      await this.db
        .delete(roleAssignments)
        .where(eq(roleAssignments.id, id));

      this.logger.log(`Role assignment deleted: ${id}`);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete role assignment: ${errorMessage}`);
      throw new BadRequestException('Failed to delete role assignment');
    }
  }

  /**
   * 批量删除用户的角色分配
   */
  async deleteUserRoleAssignments(userId: string, options?: {
    organizationId?: string;
    projectId?: string;
    teamId?: string;
    roleIds?: string[];
  }): Promise<void> {
    try {
      const conditions = [eq(roleAssignments.userId, userId)];
      
      if (options?.organizationId) {
        conditions.push(eq(roleAssignments.organizationId, options.organizationId));
      }
      if (options?.projectId) {
        conditions.push(eq(roleAssignments.projectId, options.projectId));
      }
      if (options?.teamId) {
        conditions.push(eq(roleAssignments.teamId, options.teamId));
      }
      if (options?.roleIds && options.roleIds.length > 0) {
        conditions.push(inArray(roleAssignments.roleId, options.roleIds));
      }

      await this.db
        .delete(roleAssignments)
        .where(and(...conditions));

      this.logger.log(`User role assignments deleted for user: ${userId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete user role assignments: ${errorMessage}`);
      throw new BadRequestException('Failed to delete user role assignments');
    }
  }

  /**
   * 检查用户是否有特定权限
   */
  async checkUserPermission(
    userId: string,
    permission: string,
    options?: {
      organizationId?: string;
      projectId?: string;
      teamId?: string;
      resourceType?: 'organization' | 'project' | 'team' | 'global';
      resourceId?: string;
    }
  ): Promise<boolean> {
    try {
      // 获取用户的角色分配
      const { assignments } = await this.getUserRoleAssignments({
        userId,
        organizationId: options?.organizationId,
        projectId: options?.projectId,
        teamId: options?.teamId,
        resourceType: options?.resourceType as any,
        includeExpired: false,
        limit: 100 // 获取足够多的角色分配
      });

      // 检查每个角色的权限
      for (const assignment of assignments) {
        if (assignment.role && this.hasPermission(assignment.role, permission)) {
          return true;
        }
      }

      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check user permission: ${errorMessage}`);
      return false;
    }
  }

  /**
   * 检查角色是否有特定权限
   */
  private hasPermission(role: any, permission: string): boolean {
    if (!role.permissions) {
      return false;
    }

    const permissions = role.permissions;

    // 检查 allow 列表
    if (permissions.allow) {
      for (const allowedPermission of permissions.allow) {
        if (allowedPermission === '*' || allowedPermission === permission) {
          return true;
        }
        // 支持通配符匹配
        if (allowedPermission.endsWith('*')) {
          const prefix = allowedPermission.slice(0, -1);
          if (permission.startsWith(prefix)) {
            return true;
          }
        }
      }
    }

    // 检查 resources 列表
    if (permissions.resources) {
      for (const resource of permissions.resources) {
        if (resource.resource === '*' || resource.actions.includes('*')) {
          return true;
        }
        // 这里可以添加更复杂的资源权限检查逻辑
      }
    }

    // 检查 deny 列表
    if (permissions.deny) {
      for (const deniedPermission of permissions.deny) {
        if (deniedPermission === '*' || deniedPermission === permission) {
          return false;
        }
        if (deniedPermission.endsWith('*')) {
          const prefix = deniedPermission.slice(0, -1);
          if (permission.startsWith(prefix)) {
            return false;
          }
        }
      }
    }

    return false;
  }

  hello(): string {
    return 'Hello from RoleAssignmentsService!';
  }
}