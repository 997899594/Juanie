import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, ilike, sql } from "drizzle-orm";
import { InjectDatabase } from "../../common/decorators/database.decorator";
import type { Database } from "../../database/database.module";
import {
  insertOrganizationSchema,
  NewOrganization,
  Organization,
  organizations,
  selectOrganizationSchema,
  UpdateOrganization,
  updateOrganizationSchema,
} from "../../database/schemas/organizations.schema";

@Injectable()
export class OrganizationsService {
  private readonly logger = new Logger(OrganizationsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建组织
   */
  async createOrganization(data: NewOrganization): Promise<Organization> {
    try {
      const validatedData = insertOrganizationSchema.parse(data);

      const [organization] = await this.db
        .insert(organizations)
        .values({
          ...validatedData,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();

      this.logger.log(`Created organization: ${organization.id}`);
      return organization;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to create organization: ${errorMessage}`);
      throw new BadRequestException("Failed to create organization");
    }
  }

  /**
   * 根据ID获取组织
   */
  async getOrganizationById(id: string): Promise<Organization | null> {
    try {
      const [organization] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      return organization || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get organization by ID: ${errorMessage}`);
      throw new BadRequestException("Failed to get organization");
    }
  }

  /**
   * 根据slug获取组织
   */
  async getOrganizationBySlug(slug: string): Promise<Organization | null> {
    try {
      const [organization] = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      return organization || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get organization by slug: ${errorMessage}`);
      throw new BadRequestException("Failed to get organization");
    }
  }

  /**
   * 更新组织
   */
  async updateOrganization(
    id: string,
    data: UpdateOrganization
  ): Promise<Organization> {
    try {
      const validatedData = updateOrganizationSchema.parse(data);

      const [updatedOrganization] = await this.db
        .update(organizations)
        .set({
          ...validatedData,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, id))
        .returning();

      if (!updatedOrganization) {
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Updated organization: ${id}`);
      return updatedOrganization;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update organization: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update organization");
    }
  }

  /**
   * 删除组织
   */
  async deleteOrganization(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(organizations)
        .where(eq(organizations.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Deleted organization: ${id}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to delete organization: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to delete organization");
    }
  }

  /**
   * 搜索组织
   */
  async searchOrganizations(
    query?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ organizations: Organization[]; total: number }> {
    try {
      // 参数验证
      if (limit < 1 || limit > 100) {
        throw new BadRequestException("Limit must be between 1 and 100");
      }
      if (offset < 0) {
        throw new BadRequestException("Offset must be non-negative");
      }

      const conditions = [];

      if (query) {
        conditions.push(ilike(organizations.name, `%${query}%`));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [organizationsResult, totalResult] = await Promise.all([
        this.db
          .select()
          .from(organizations)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(organizations.createdAt)),

        this.db
          .select({ count: count() })
          .from(organizations)
          .where(whereClause),
      ]);

      return {
        organizations: organizationsResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to search organizations: ${errorMessage}`);
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Failed to search organizations");
    }
  }

  /**
   * 获取组织统计信息
   */
  async getOrganizationStats(): Promise<{
    totalOrganizations: number;
    activeOrganizations: number;
  }> {
    try {
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(organizations);

      const activeOrganizations = totalResult.count; // 简化实现

      return {
        totalOrganizations: totalResult.count,
        activeOrganizations,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get organization stats: ${errorMessage}`);
      throw new BadRequestException("Failed to get organization stats");
    }
  }

  /**
   * 更新组织使用情况
   */
  async updateOrganizationUsage(
    organizationId: string,
    usage: {
      currentUsers?: number;
      currentProjects?: number;
      currentStorageGb?: number;
      currentMonthlyCost?: number;
    }
  ): Promise<Organization> {
    try {
      const [updatedOrganization] = await this.db
        .update(organizations)
        .set({
          // 这里需要根据实际的组织表结构来映射使用情况字段
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .returning();

      if (!updatedOrganization) {
        throw new NotFoundException("Organization not found");
      }

      this.logger.log(`Updated organization usage: ${organizationId}`);
      return updatedOrganization;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update organization usage: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update organization usage");
    }
  }

  /**
   * 检查组织使用限制
   */
  async checkOrganizationUsageLimits(organizationId: string): Promise<{
    withinLimits: boolean;
    violations: string[];
    usage: any;
    limits: any;
  }> {
    try {
      // 这里需要根据实际的使用限制逻辑来实现
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
        `Failed to check organization usage limits: ${errorMessage}`
      );
      throw new BadRequestException(
        "Failed to check organization usage limits"
      );
    }
  }

  /**
   * 获取用户的组织列表
   */
  async getOrganizations(
    userId: string,
    options?: { limit?: number; offset?: number }
  ) {
    const limit = options?.limit || 20;
    const offset = options?.offset || 0;

    const organizationsData = await this.db
      .select()
      .from(organizations)
      .limit(limit)
      .offset(offset);

    const total = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(organizations);

    return {
      organizations: organizationsData,
      total: total[0].count,
      limit,
      offset,
    };
  }

  // 获取组织成员
  async getOrganizationMembers(organizationId: string) {
    // 这里需要根据实际的用户-组织关联表来实现
    // 暂时返回空数组
    return [];
  }

  // 添加组织成员
  async addOrganizationMember(
    organizationId: string,
    userId: string,
    role: string
  ) {
    // 这里需要根据实际的用户-组织关联表来实现
    // 暂时返回成功状态
    return { success: true };
  }

  // 移除组织成员
  async removeOrganizationMember(organizationId: string, userId: string) {
    // 这里需要根据实际的用户-组织关联表来实现
    // 暂时返回成功状态
    return { success: true };
  }

  // 更新成员角色
  async updateMemberRole(organizationId: string, userId: string, role: string) {
    // 这里需要根据实际的用户-组织关联表来实现
    // 暂时返回成功状态
    return { success: true };
  }

  /**
   * 获取用户的组织列表
   */
  async getUserOrganizations(userId: string): Promise<Organization[]> {
    try {
      // 这里需要根据实际的用户组织关联表来实现
      // 暂时返回空数组
      return [];
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get user organizations: ${errorMessage}`);
      throw new BadRequestException("Failed to get user organizations");
    }
  }

  /**
   * 检查用户权限
   */
  async checkUserPermission(
    organizationId: string,
    userId: string
  ): Promise<{
    hasPermission: boolean;
    role?: string;
    permissions: string[];
  }> {
    try {
      // 这里需要根据实际的权限系统来实现
      // 暂时返回默认值
      return {
        hasPermission: true,
        role: "member",
        permissions: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to check user permission: ${errorMessage}`);
      throw new BadRequestException("Failed to check user permission");
    }
  }

  /**
   * 验证组织设置
   */
  async validateOrganizationSettings(settings: any): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    try {
      // 这里需要根据实际的设置验证逻辑来实现
      // 暂时返回默认值
      return {
        isValid: true,
        errors: [],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to validate organization settings: ${errorMessage}`
      );
      throw new BadRequestException("Failed to validate organization settings");
    }
  }

  // 根据ID查找组织
  async findById(id: string): Promise<Organization | null> {
    try {
      const result = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.id, id))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find organization by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to find organization');
    }
  }

  // 根据slug查找组织
  async findBySlug(slug: string): Promise<Organization | null> {
    try {
      const result = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.slug, slug))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find organization by slug: ${errorMessage}`);
      throw new BadRequestException('Failed to find organization');
    }
  }

  // 根据名称查找组织
  async findByName(name: string): Promise<Organization | null> {
    try {
      const result = await this.db
        .select()
        .from(organizations)
        .where(eq(organizations.name, name))
        .limit(1);

      return result[0] || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to find organization by name: ${errorMessage}`);
      throw new BadRequestException('Failed to find organization');
    }
  }

  // 更新使用情况
  async updateUsage(organizationId: string, usage: any): Promise<Organization> {
    try {
      // 更新组织的使用情况
      const [updatedOrganization] = await this.db
        .update(organizations)
        .set({
          currentProjects: usage.currentProjects,
          currentUsers: usage.currentUsers,
          currentStorageGb: usage.currentStorage,
          currentMonthlyRuns: usage.currentMonthlyRuns,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, organizationId))
        .returning();

      if (!updatedOrganization) {
        throw new NotFoundException('Organization not found');
      }

      return updatedOrganization;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update usage: ${errorMessage}`);
      throw new BadRequestException('Failed to update usage');
    }
  }

  // 检查使用限制
  async checkUsageLimits(organizationId: string) {
    try {
      // 这里需要根据实际的使用限制逻辑来实现
      // 暂时返回默认值
      return {
        withinLimits: true,
        currentUsage: 0,
        limit: 1000,
        violations: [] as string[],
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check usage limits: ${errorMessage}`);
      throw new BadRequestException('Failed to check usage limits');
    }
  }
}
