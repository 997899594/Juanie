import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray } from 'drizzle-orm';
import { 
  roles, 
  type Role,
  type NewRole,
  type UpdateRole,
  insertRoleSchema,
  updateRoleSchema,
  selectRoleSchema
} from '../../database/schemas/roles.schema';
import { z } from 'zod';

export interface CreateRoleRequest {
  organizationId?: string;
  name: string;
  slug: string;
  scope?: 'global' | 'organization' | 'team' | 'project';
  description?: string;
  permissions?: {
    allow?: string[];
    deny?: string[];
    resources?: Array<{ resource: string; actions: string[] }>;
  };
}

export interface RoleWithStats extends Role {
  assignmentCount?: number;
}

@Injectable()
export class RolesService {
  private readonly logger = new Logger(RolesService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建角色
   */
  async createRole(data: CreateRoleRequest): Promise<Role> {
    try {
      // 验证输入数据
      const validatedData = insertRoleSchema.parse(data);

      // 检查角色slug是否已存在（在同一组织内）
      const existingRole = await this.findBySlug(data.slug, data.organizationId);
      if (existingRole) {
        throw new ConflictException(`Role with slug ${data.slug} already exists`);
      }

      // 创建角色
      const [role] = await this.db
        .insert(roles)
        .values([validatedData])
        .returning();

      this.logger.log(`Role created: ${role.id}`);
      return role;
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create role: ${errorMessage}`);
      throw new BadRequestException('Failed to create role');
    }
  }

  /**
   * 根据ID查找角色
   */
  async findById(id: string): Promise<Role | null> {
    try {
      const [role] = await this.db
        .select()
        .from(roles)
        .where(eq(roles.id, id))
        .limit(1);

      return role || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find role by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to find role');
    }
  }

  /**
   * 根据slug查找角色
   */
  async findBySlug(slug: string, organizationId?: string): Promise<Role | null> {
    try {
      const conditions = [eq(roles.slug, slug)];
      
      if (organizationId) {
        conditions.push(eq(roles.organizationId, organizationId));
      }

      const [role] = await this.db
        .select()
        .from(roles)
        .where(and(...conditions))
        .limit(1);

      return role || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find role by slug: ${errorMessage}`);
      throw new BadRequestException('Failed to find role');
    }
  }

  /**
   * 获取组织角色列表
   */
  async getOrganizationRoles(options: {
    organizationId?: string;
    page?: number;
    limit?: number;
    search?: string;
    scope?: 'global' | 'organization' | 'team' | 'project';
    includeSystem?: boolean;
  }): Promise<{ roles: RoleWithStats[]; total: number }> {
    try {
      const { organizationId, page = 1, limit = 20, search, scope, includeSystem = true } = options;
      const offset = (page - 1) * limit;

      // 构建查询条件
      const conditions = [];
      
      if (organizationId) {
        conditions.push(eq(roles.organizationId, organizationId));
      }
      
      if (scope) {
        conditions.push(eq(roles.scope, scope));
      }
      
      if (!includeSystem) {
        conditions.push(eq(roles.isSystem, false));
      }
      
      if (search) {
        conditions.push(
          sql`(${roles.name} ILIKE ${`%${search}%`} OR ${roles.description} ILIKE ${`%${search}%`})`
        );
      }

      // 获取总数
      const [{ total }] = await this.db
        .select({ total: count() })
        .from(roles)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      // 获取分页数据
      const rolesList = await this.db
        .select()
        .from(roles)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(roles.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        roles: rolesList,
        total: Number(total)
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get organization roles: ${errorMessage}`);
      throw new BadRequestException('Failed to get organization roles');
    }
  }

  /**
   * 更新角色
   */
  async updateRole(id: string, data: UpdateRole): Promise<Role> {
    try {
      // 验证输入数据
      const validatedData = updateRoleSchema.parse(data);

      // 检查角色是否存在
      const existingRole = await this.findById(id);
      if (!existingRole) {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }

      // 检查是否为系统角色
      if (existingRole.isSystem && data.isSystem === false) {
        throw new BadRequestException('Cannot modify system role properties');
      }

      // 更新角色
      const [role] = await this.db
        .update(roles)
        .set(validatedData)
        .where(eq(roles.id, id))
        .returning();

      this.logger.log(`Role updated: ${id}`);
      return role;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update role: ${errorMessage}`);
      throw new BadRequestException('Failed to update role');
    }
  }

  /**
   * 删除角色
   */
  async deleteRole(id: string): Promise<boolean> {
    try {
      // 检查角色是否存在
      const existingRole = await this.findById(id);
      if (!existingRole) {
        throw new NotFoundException(`Role with ID ${id} not found`);
      }

      // 检查是否为系统角色
      if (existingRole.isSystem) {
        throw new BadRequestException('Cannot delete system role');
      }

      // TODO: 检查是否有用户正在使用此角色
      // 这里需要查询 role_assignments 表

      // 删除角色
      await this.db
        .delete(roles)
        .where(eq(roles.id, id));

      this.logger.log(`Role deleted: ${id}`);
      return true;
    } catch (error) {
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete role: ${errorMessage}`);
      throw new BadRequestException('Failed to delete role');
    }
  }

  /**
   * 获取系统预设角色
   */
  async getSystemRoles(): Promise<Role[]> {
    try {
      const systemRoles = await this.db
        .select()
        .from(roles)
        .where(eq(roles.isSystem, true))
        .orderBy(asc(roles.name));

      return systemRoles;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get system roles: ${errorMessage}`);
      throw new BadRequestException('Failed to get system roles');
    }
  }

  /**
   * 初始化系统角色
   */
  async initializeSystemRoles(): Promise<void> {
    try {
      const systemRoles = [
        {
          name: 'Super Admin',
          slug: 'super-admin',
          scope: 'global' as const,
          description: 'Platform super administrator with full access',
          isSystem: true,
          permissions: {
            allow: ['*'],
            resources: [{ resource: '*', actions: ['*'] }]
          }
        },
        {
          name: 'Organization Owner',
          slug: 'org-owner',
          scope: 'organization' as const,
          description: 'Organization owner with full organization access',
          isSystem: true,
          permissions: {
            allow: ['org.*', 'project.*', 'team.*', 'user.*'],
            resources: [
              { resource: 'organization', actions: ['read', 'write', 'delete'] },
              { resource: 'project', actions: ['read', 'write', 'delete', 'create'] },
              { resource: 'team', actions: ['read', 'write', 'delete', 'create'] }
            ]
          }
        },
        {
          name: 'Organization Admin',
          slug: 'org-admin',
          scope: 'organization' as const,
          description: 'Organization administrator with management access',
          isSystem: true,
          permissions: {
            allow: ['org.read', 'org.write', 'project.*', 'team.*'],
            resources: [
              { resource: 'organization', actions: ['read', 'write'] },
              { resource: 'project', actions: ['read', 'write', 'create'] },
              { resource: 'team', actions: ['read', 'write', 'create'] }
            ]
          }
        },
        {
          name: 'Project Manager',
          slug: 'project-manager',
          scope: 'project' as const,
          description: 'Project manager with project management access',
          isSystem: true,
          permissions: {
            allow: ['project.read', 'project.write', 'deployment.*', 'environment.*'],
            resources: [
              { resource: 'project', actions: ['read', 'write'] },
              { resource: 'deployment', actions: ['read', 'write', 'create'] },
              { resource: 'environment', actions: ['read', 'write', 'create'] }
            ]
          }
        },
        {
          name: 'Developer',
          slug: 'developer',
          scope: 'project' as const,
          description: 'Developer with development access',
          isSystem: true,
          permissions: {
            allow: ['project.read', 'repository.*', 'deployment.read', 'environment.read'],
            resources: [
              { resource: 'project', actions: ['read'] },
              { resource: 'repository', actions: ['read', 'write'] },
              { resource: 'deployment', actions: ['read'] },
              { resource: 'environment', actions: ['read'] }
            ]
          }
        },
        {
          name: 'Viewer',
          slug: 'viewer',
          scope: 'project' as const,
          description: 'Read-only access to project resources',
          isSystem: true,
          permissions: {
            allow: ['project.read', 'repository.read', 'deployment.read', 'environment.read'],
            resources: [
              { resource: 'project', actions: ['read'] },
              { resource: 'repository', actions: ['read'] },
              { resource: 'deployment', actions: ['read'] },
              { resource: 'environment', actions: ['read'] }
            ]
          }
        }
      ];

      for (const roleData of systemRoles) {
        const existingRole = await this.findBySlug(roleData.slug);
        if (!existingRole) {
          await this.createRole(roleData);
          this.logger.log(`System role created: ${roleData.name}`);
        }
      }

      this.logger.log('System roles initialization completed');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to initialize system roles: ${errorMessage}`);
      throw new BadRequestException('Failed to initialize system roles');
    }
  }

  hello(): string {
    return 'Hello from RolesService!';
  }
}