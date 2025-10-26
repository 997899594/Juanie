import { Injectable, Logger, BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, or, desc, asc, count, sql, ilike, inArray, gte, lte, isNull, gt } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../../database/schemas';
import { 
  organizations, 
  Organization, 
  NewOrganization, 
  UpdateOrganization,
  insertOrganizationSchema,
  updateOrganizationSchema 
} from '../../database/schemas/organizations.schema';

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建新组织
   */
  async createOrganization(orgData: NewOrganization): Promise<Organization> {
    try {
      // 验证输入数据
      const validatedData = insertOrganizationSchema.parse(orgData);
      
      // 检查组织名称是否已存在
      if (validatedData.name) {
        const existingOrg = await this.findByName(validatedData.name);
        if (existingOrg) {
          throw new ConflictException('Organization name already exists');
        }
      }

      // 检查slug是否已存在
      if (validatedData.slug) {
        const existingOrg = await this.findBySlug(validatedData.slug);
        if (existingOrg) {
          throw new ConflictException('Organization slug already exists');
        }
      }

      const [newOrganization] = await this.db
        .insert(organizations)
        .values(validatedData as any)
        .returning();

      this.logger.log(`Organization created: ${newOrganization.id}`);
      return newOrganization;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create organization: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据ID查找组织
   */
  async findById(id: string): Promise<Organization | null> {
    try {
      const [org] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      return org || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find organization by ID ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据名称查找组织
   */
  async findByName(name: string): Promise<Organization | null> {
    try {
      const [org] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.name, name))
        .limit(1);

      return org || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find organization by name ${name}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 根据slug查找组织
   */
  async findBySlug(slug: string): Promise<Organization | null> {
    try {
      const [org] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      return org || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find organization by slug ${slug}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新组织信息
   */
  async updateOrganization(id: string, updateData: Partial<UpdateOrganization>): Promise<Organization> {
    try {
      // 验证输入数据
      const validatedData = updateOrganizationSchema.parse(updateData);

      // 检查组织是否存在
      const existingOrg = await this.findById(id);
      if (!existingOrg) {
        throw new NotFoundException('Organization not found');
      }

      // 检查名称冲突
      if (validatedData.name && validatedData.name !== existingOrg.name) {
        const nameOrg = await this.findByName(validatedData.name);
        if (nameOrg && nameOrg.id !== id) {
          throw new ConflictException('Organization name already exists');
        }
      }

      // 检查slug冲突
      if (validatedData.slug && validatedData.slug !== existingOrg.slug) {
        const slugOrg = await this.findBySlug(validatedData.slug);
        if (slugOrg && slugOrg.id !== id) {
          throw new ConflictException('Organization slug already exists');
        }
      }

      const [updatedOrg] = await this.db
        .update(organizations)
        .set({ ...validatedData, updatedAt: new Date() })
        .where(eq(organizations.id, id))
        .returning();

      this.logger.log(`Organization updated: ${id}`);
      return updatedOrg;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update organization ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 删除组织
   */
  async deleteOrganization(id: string): Promise<void> {
    try {
      const existingOrg = await this.findById(id);
      if (!existingOrg) {
        throw new NotFoundException('Organization not found');
      }

      await this.db
        .delete(organizations)
        .where(eq(organizations.id, id));

      this.logger.log(`Organization deleted: ${id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to delete organization ${id}: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 搜索组织
   */
  async searchOrganizations(query: string, limit = 20, offset = 0): Promise<Organization[]> {
    try {
      const searchPattern = `%${query}%`;
      
      return await this.db
        .select()
        .from(organizations)
        .where(
          or(
            ilike(organizations.name, searchPattern),
            ilike(organizations.slug, searchPattern),
            ilike(organizations.displayName, searchPattern),
            ilike(organizations.description, searchPattern)
          )
        )
        .orderBy(desc(organizations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to search organizations: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取组织列表
   */
  async getOrganizations(limit = 20, offset = 0): Promise<Organization[]> {
    try {
      return await this.db
        .select()
        .from(organizations)
        .orderBy(desc(organizations.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get organizations: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新组织使用量（新版本）
   */
  async updateOrganizationUsage(organizationId: string, usage: {
    currentProjects?: number;
    currentUsers?: number;
    currentStorageGb?: number;
    currentMonthlyRuns?: number;
  }) {
    try {
      const updateData: any = { updatedAt: new Date() };

      // 构建增量更新
      if (usage.currentProjects !== undefined) {
        updateData.currentProjects = sql`${schema.organizations.currentProjects} + ${usage.currentProjects}`;
      }
      if (usage.currentUsers !== undefined) {
        updateData.currentUsers = sql`${schema.organizations.currentUsers} + ${usage.currentUsers}`;
      }
      if (usage.currentStorageGb !== undefined) {
        updateData.currentStorageGb = sql`${schema.organizations.currentStorageGb} + ${usage.currentStorageGb}`;
      }
      if (usage.currentMonthlyRuns !== undefined) {
        updateData.currentMonthlyRuns = sql`${schema.organizations.currentMonthlyRuns} + ${usage.currentMonthlyRuns}`;
      }

      const [updatedOrg] = await this.db
        .update(schema.organizations)
        .set(updateData)
        .where(eq(schema.organizations.id, organizationId))
        .returning();

      return updatedOrg;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update organization usage: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 检查组织是否超出使用限制（新版本）
   */
  async checkOrganizationUsageLimits(organizationId: string): Promise<{
    withinLimits: boolean;
    violations: string[];
    usage: any;
    limits: any;
  }> {
    try {
      const organization = await this.findById(organizationId);
      if (!organization) {
        throw new Error('Organization not found');
      }

      const violations: string[] = [];

      // 检查项目数限制
      if ((organization.currentProjects ?? 0) > (organization.maxProjects ?? 0)) {
        violations.push(`Project count (${organization.currentProjects ?? 0}) exceeds limit (${organization.maxProjects ?? 0})`);
      }

      // 检查用户数限制
      if ((organization.currentUsers ?? 0) > (organization.maxUsers ?? 0)) {
        violations.push(`User count (${organization.currentUsers ?? 0}) exceeds limit (${organization.maxUsers ?? 0})`);
      }

      // 检查存储限制
      if ((organization.currentStorageGb ?? 0) > (organization.maxStorageGb ?? 0)) {
        violations.push(`Storage usage (${organization.currentStorageGb ?? 0}GB) exceeds limit (${organization.maxStorageGb ?? 0}GB)`);
      }

      // 检查月度运行次数限制
      if ((organization.currentMonthlyRuns ?? 0) > (organization.maxMonthlyRuns ?? 0)) {
        violations.push(`Monthly runs (${organization.currentMonthlyRuns ?? 0}) exceeds limit (${organization.maxMonthlyRuns ?? 0})`);
      }

      return {
        withinLimits: violations.length === 0,
        violations,
        usage: {
          currentProjects: organization.currentProjects,
          currentUsers: organization.currentUsers,
          currentStorageGb: organization.currentStorageGb,
          currentMonthlyRuns: organization.currentMonthlyRuns,
        },
        limits: {
          maxProjects: organization.maxProjects,
          maxUsers: organization.maxUsers,
          maxStorageGb: organization.maxStorageGb,
          maxMonthlyRuns: organization.maxMonthlyRuns,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check usage limits: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取组织成员列表
   */
  async getOrganizationMembers(organizationId: string, limit = 20, offset = 0) {
    try {
      const members = await this.db
        .select({
          id: schema.roleAssignments.id,
          userId: schema.roleAssignments.userId,
          roleId: schema.roleAssignments.roleId,
          assignedAt: schema.roleAssignments.assignedAt,
          expiresAt: schema.roleAssignments.expiresAt,
          user: {
            id: schema.users.id,
            email: schema.users.email,
            username: schema.users.username,
            displayName: schema.users.displayName,
            avatarUrl: schema.users.avatarUrl,
          },
          role: {
            id: schema.roles.id,
            name: schema.roles.name,
            slug: schema.roles.slug,
            scope: schema.roles.scope,
          }
        })
        .from(schema.roleAssignments)
        .leftJoin(schema.users, eq(schema.roleAssignments.userId, schema.users.id))
        .leftJoin(schema.roles, eq(schema.roleAssignments.roleId, schema.roles.id))
        .where(
          and(
            eq(schema.roleAssignments.organizationId, organizationId),
            eq(schema.roleAssignments.scopeType, 'organization')
          )
        )
        .orderBy(desc(schema.roleAssignments.assignedAt))
        .limit(limit)
        .offset(offset);

      return members;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get organization members: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 添加组织成员
   */
  async addOrganizationMember(organizationId: string, userId: string, roleId: string, assignedBy?: string) {
    try {
      // 检查用户是否已经是组织成员
      const existingMember = await this.db
        .select()
        .from(schema.roleAssignments)
        .where(
          and(
            eq(schema.roleAssignments.userId, userId),
            eq(schema.roleAssignments.organizationId, organizationId),
            eq(schema.roleAssignments.scopeType, 'organization')
          )
        )
        .limit(1);

      if (existingMember.length > 0) {
        throw new Error('User is already a member of this organization');
      }

      // 添加角色分配
      const [newMember] = await this.db
        .insert(schema.roleAssignments)
        .values({
          userId,
          roleId,
          organizationId,
          scopeType: 'organization',
          assignedBy,
        })
        .returning();

      // 更新组织当前用户数
      await this.updateOrganizationUsage(organizationId, { currentUsers: 1 });

      return newMember;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to add organization member: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 移除组织成员
   */
  async removeOrganizationMember(organizationId: string, userId: string) {
    try {
      const deletedMember = await this.db
        .delete(schema.roleAssignments)
        .where(
          and(
            eq(schema.roleAssignments.userId, userId),
            eq(schema.roleAssignments.organizationId, organizationId),
            eq(schema.roleAssignments.scopeType, 'organization')
          )
        )
        .returning();

      if (deletedMember.length === 0) {
        throw new Error('User is not a member of this organization');
      }

      // 更新组织当前用户数
      await this.updateOrganizationUsage(organizationId, { currentUsers: -1 });

      return deletedMember[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove organization member: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 更新组织成员角色
   */
  async updateMemberRole(organizationId: string, userId: string, newRoleId: string) {
    try {
      const updatedMember = await this.db
        .update(schema.roleAssignments)
        .set({
          roleId: newRoleId,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.roleAssignments.userId, userId),
            eq(schema.roleAssignments.organizationId, organizationId),
            eq(schema.roleAssignments.scopeType, 'organization')
          )
        )
        .returning();

      if (updatedMember.length === 0) {
        throw new Error('User is not a member of this organization');
      }

      return updatedMember[0];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update member role: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 检查用户在组织中的权限
   */
  async checkUserPermission(organizationId: string, userId: string): Promise<{ hasAccess: boolean; role?: any }> {
    try {
      const userRole = await this.db
        .select({
          roleId: schema.roleAssignments.roleId,
          role: {
            id: schema.roles.id,
            name: schema.roles.name,
            slug: schema.roles.slug,
            scope: schema.roles.scope,
            permissions: schema.roles.permissions,
          }
        })
        .from(schema.roleAssignments)
        .leftJoin(schema.roles, eq(schema.roleAssignments.roleId, schema.roles.id))
        .where(
          and(
            eq(schema.roleAssignments.userId, userId),
            eq(schema.roleAssignments.organizationId, organizationId),
            eq(schema.roleAssignments.scopeType, 'organization'),
            or(
              isNull(schema.roleAssignments.expiresAt),
              gt(schema.roleAssignments.expiresAt, new Date())
            )
          )
        )
        .limit(1);

      return {
        hasAccess: userRole.length > 0,
        role: userRole.length > 0 ? userRole[0].role : undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check user permission: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取组织统计信息
   */
  async getOrganizationStats(organizationId: string) {
    try {
      // 获取成员数量
      const memberCount = await this.db
        .select({ count: count() })
        .from(schema.roleAssignments)
        .where(
          and(
            eq(schema.roleAssignments.organizationId, organizationId),
            eq(schema.roleAssignments.scopeType, 'organization')
          )
        );

      // 获取项目数量
      const projectCount = await this.db
        .select({ count: count() })
        .from(schema.projects)
        .where(eq(schema.projects.organizationId, organizationId));

      // 获取团队数量
      const teamCount = await this.db
        .select({ count: count() })
        .from(schema.teams)
        .where(eq(schema.teams.organizationId, organizationId));

      return {
        memberCount: memberCount[0]?.count || 0,
        projectCount: projectCount[0]?.count || 0,
        teamCount: teamCount[0]?.count || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get organization stats: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 获取用户所属的组织列表
   */
  async getUserOrganizations(userId: string) {
    try {
      const organizations = await this.db
        .select({
          id: schema.organizations.id,
          name: schema.organizations.name,
          slug: schema.organizations.slug,
          displayName: schema.organizations.displayName,
          description: schema.organizations.description,
          logoUrl: schema.organizations.logoUrl,
          roleId: schema.roleAssignments.roleId,
          assignedAt: schema.roleAssignments.assignedAt,
          role: {
            id: schema.roles.id,
            name: schema.roles.name,
            slug: schema.roles.slug,
          }
        })
        .from(schema.roleAssignments)
        .leftJoin(schema.organizations, eq(schema.roleAssignments.organizationId, schema.organizations.id))
        .leftJoin(schema.roles, eq(schema.roleAssignments.roleId, schema.roles.id))
        .where(
          and(
            eq(schema.roleAssignments.userId, userId),
            eq(schema.roleAssignments.scopeType, 'organization'),
            or(
              isNull(schema.roleAssignments.expiresAt),
              gt(schema.roleAssignments.expiresAt, new Date())
            )
          )
        )
        .orderBy(desc(schema.roleAssignments.assignedAt));

      return organizations;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get user organizations: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * 验证组织设置
   */
  async validateOrganizationSettings(settings: any): Promise<{ isValid: boolean; errors: string[] }> {
    const errors: string[] = [];

    // 验证时区
    if (settings.timezone && !Intl.supportedValuesOf('timeZone').includes(settings.timezone)) {
      errors.push('Invalid timezone');
    }

    // 验证语言
    if (settings.language && !['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'].includes(settings.language)) {
      errors.push('Unsupported language');
    }

    // 验证邮件域名格式
    if (settings.emailDomain && !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(settings.emailDomain)) {
      errors.push('Invalid email domain format');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * 更新组织使用量（别名方法）
   */
  async updateUsage(organizationId: string, usage: {
    currentProjects?: number;
    currentUsers?: number;
    currentStorageGb?: number;
    currentMonthlyRuns?: number;
  }) {
    return this.updateOrganizationUsage(organizationId, usage);
  }

  /**
   * 检查组织使用限制（别名方法）
   */
  async checkUsageLimits(organizationId: string) {
    return this.checkOrganizationUsageLimits(organizationId);
  }

}