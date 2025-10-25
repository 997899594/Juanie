import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { eq, and, or, ilike, desc } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { DATABASE_CONNECTION } from '../../database';
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

  constructor(@InjectDatabase() private readonly db: NodePgDatabase<typeof schema>) {}

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
      this.logger.error(`Failed to create organization: ${error}`);
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
      this.logger.error(`Failed to find organization by ID ${id}: ${error}`);
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
      this.logger.error(`Failed to find organization by name ${name}: ${error}`);
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
      this.logger.error(`Failed to find organization by slug ${slug}: ${error}`);
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
      this.logger.error(`Failed to update organization ${id}: ${error}`);
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
      this.logger.error(`Failed to delete organization ${id}: ${error}`);
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
      this.logger.error(`Failed to search organizations: ${error}`);
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
      this.logger.error(`Failed to get organizations: ${error}`);
      throw error;
    }
  }

  /**
   * 更新组织使用量
   */
  async updateUsage(id: string, usageData: {
    currentProjects?: number;
    currentUsers?: number;
    currentStorageGb?: number;
    currentMonthlyRuns?: number;
  }): Promise<Organization> {
    try {
      const existingOrg = await this.findById(id);
      if (!existingOrg) {
        throw new NotFoundException('Organization not found');
      }

      const [updatedOrg] = await this.db
        .update(organizations)
        .set({ 
          ...usageData,
          updatedAt: new Date()
        })
        .where(eq(organizations.id, id))
        .returning();

      this.logger.log(`Organization usage updated: ${id}`);
      return updatedOrg;
    } catch (error) {
      this.logger.error(`Failed to update organization usage ${id}: ${error}`);
      throw error;
    }
  }

  /**
   * 检查组织是否超出使用限制
   */
  async checkUsageLimits(id: string): Promise<{
    withinLimits: boolean;
    violations: string[];
  }> {
    try {
      const org = await this.findById(id);
      if (!org) {
        throw new NotFoundException('Organization not found');
      }

      const violations: string[] = [];

      if ((org.currentProjects ?? 0) > (org.maxProjects ?? 0)) {
        violations.push(`Projects: ${org.currentProjects}/${org.maxProjects}`);
      }

      if ((org.currentUsers ?? 0) > (org.maxUsers ?? 0)) {
        violations.push(`Users: ${org.currentUsers}/${org.maxUsers}`);
      }

      if ((org.currentStorageGb ?? 0) > (org.maxStorageGb ?? 0)) {
        violations.push(`Storage: ${org.currentStorageGb}GB/${org.maxStorageGb}GB`);
      }

      if ((org.currentMonthlyRuns ?? 0) > (org.maxMonthlyRuns ?? 0)) {
        violations.push(`Monthly runs: ${org.currentMonthlyRuns}/${org.maxMonthlyRuns}`);
      }

      return {
        withinLimits: violations.length === 0,
        violations,
      };
    } catch (error) {
      this.logger.error(`Failed to check usage limits for organization ${id}: ${error}`);
      throw error;
    }
  }
}