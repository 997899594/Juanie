import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { eq, and, desc, asc, count, sql, ilike, inArray, gte, lte } from 'drizzle-orm';
import { 
  securityPolicies,
  SecurityPolicy,
  NewSecurityPolicy,
  UpdateSecurityPolicy,
  SecurityPolicyType,
  SecurityPolicyStatus
} from '../../database/schemas/security-policies.schema';
import { projects } from '../../database/schemas/projects.schema';
import { environments } from '../../database/schemas/environments.schema';

export interface SecurityPolicyStats {
  total: number;
  byType: Record<SecurityPolicyType, number>;
  byStatus: Record<SecurityPolicyStatus, number>;
  enforcedCount: number;
  enforcementRate: number;
}

export interface SecurityPolicySearchFilters {
  projectId?: string;
  environmentId?: string;
  policyType?: SecurityPolicyType;
  status?: SecurityPolicyStatus;
  isEnforced?: boolean;
  createdBy?: string;
  minPriority?: number;
  maxPriority?: number;
  dateFrom?: Date;
  dateTo?: Date;
}

@Injectable()
export class SecurityPoliciesService {
  private readonly logger = new Logger(SecurityPoliciesService.name);

  constructor(
    @InjectDatabase() private readonly db: Database,
  ) {}

  // 创建安全策略
  async createSecurityPolicy(data: NewSecurityPolicy): Promise<SecurityPolicy> {
    const [policy] = await this.db
      .insert(securityPolicies)
      .values(data)
      .returning();
    return policy;
  }

  // 根据ID获取安全策略
  async getSecurityPolicyById(id: string): Promise<SecurityPolicy | null> {
    const [policy] = await this.db
      .select()
      .from(securityPolicies)
      .where(eq(securityPolicies.id, id))
      .limit(1);
    return policy || null;
  }

  // 根据项目ID获取安全策略列表
  async getPoliciesByProject(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityPolicy[]> {
    return await this.db
      .select()
      .from(securityPolicies)
      .where(eq(securityPolicies.projectId, projectId))
      .orderBy(desc(securityPolicies.priority), desc(securityPolicies.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 根据环境ID获取安全策略列表
  async getPoliciesByEnvironment(
    environmentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityPolicy[]> {
    return await this.db
      .select()
      .from(securityPolicies)
      .where(eq(securityPolicies.environmentId, environmentId))
      .orderBy(desc(securityPolicies.priority), desc(securityPolicies.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 根据策略类型获取安全策略列表
  async getPoliciesByType(
    policyType: SecurityPolicyType,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityPolicy[]> {
    return await this.db
      .select()
      .from(securityPolicies)
      .where(eq(securityPolicies.policyType, policyType))
      .orderBy(desc(securityPolicies.priority), desc(securityPolicies.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 根据状态获取安全策略列表
  async getPoliciesByStatus(
    status: SecurityPolicyStatus,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityPolicy[]> {
    return await this.db
      .select()
      .from(securityPolicies)
      .where(eq(securityPolicies.status, status))
      .orderBy(desc(securityPolicies.priority), desc(securityPolicies.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 获取强制执行的安全策略
  async getEnforcedPolicies(
    projectId?: string,
    environmentId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityPolicy[]> {
    let whereConditions = [eq(securityPolicies.isEnforced, true)];

    if (projectId) {
      whereConditions.push(eq(securityPolicies.projectId, projectId));
    }
    if (environmentId) {
      whereConditions.push(eq(securityPolicies.environmentId, environmentId));
    }

    return await this.db
      .select()
      .from(securityPolicies)
      .where(and(...whereConditions))
      .orderBy(desc(securityPolicies.priority), desc(securityPolicies.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 搜索安全策略
  async searchPolicies(
    query: string,
    filters?: SecurityPolicySearchFilters,
    limit: number = 50,
    offset: number = 0
  ): Promise<SecurityPolicy[]> {
    let whereConditions = [];

    // 文本搜索
    if (query) {
      whereConditions.push(
        sql`(${securityPolicies.name} ILIKE ${`%${query}%`} OR ${securityPolicies.description} ILIKE ${`%${query}%`})`
      );
    }

    // 应用过滤器
    if (filters) {
      if (filters.projectId) {
        whereConditions.push(eq(securityPolicies.projectId, filters.projectId));
      }
      if (filters.environmentId) {
        whereConditions.push(eq(securityPolicies.environmentId, filters.environmentId));
      }
      if (filters.policyType) {
        whereConditions.push(eq(securityPolicies.policyType, filters.policyType));
      }
      if (filters.status) {
        whereConditions.push(eq(securityPolicies.status, filters.status));
      }
      if (filters.isEnforced !== undefined) {
        whereConditions.push(eq(securityPolicies.isEnforced, filters.isEnforced));
      }
      if (filters.createdBy) {
        whereConditions.push(eq(securityPolicies.createdBy, filters.createdBy));
      }
      if (filters.minPriority !== undefined) {
        whereConditions.push(gte(securityPolicies.priority, filters.minPriority));
      }
      if (filters.maxPriority !== undefined) {
        whereConditions.push(lte(securityPolicies.priority, filters.maxPriority));
      }
      if (filters.dateFrom) {
        whereConditions.push(gte(securityPolicies.createdAt, filters.dateFrom));
      }
      if (filters.dateTo) {
        whereConditions.push(lte(securityPolicies.createdAt, filters.dateTo));
      }
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    return await this.db
      .select()
      .from(securityPolicies)
      .where(whereClause)
      .orderBy(desc(securityPolicies.priority), desc(securityPolicies.createdAt))
      .limit(limit)
      .offset(offset);
  }

  // 更新安全策略
  async updateSecurityPolicy(
    id: string,
    data: UpdateSecurityPolicy
  ): Promise<SecurityPolicy | null> {
    const [policy] = await this.db
      .update(securityPolicies)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(securityPolicies.id, id))
      .returning();
    return policy || null;
  }

  // 切换策略状态
  async togglePolicyStatus(
    id: string,
    status: SecurityPolicyStatus
  ): Promise<boolean> {
    const result = await this.db
      .update(securityPolicies)
      .set({ status, updatedAt: new Date() })
      .where(eq(securityPolicies.id, id));
    return Array.isArray(result) ? result.length > 0 : true;
  }

  // 切换强制执行状态
  async toggleEnforcement(
    id: string,
    isEnforced: boolean
  ): Promise<boolean> {
    const result = await this.db
      .update(securityPolicies)
      .set({ isEnforced, updatedAt: new Date() })
      .where(eq(securityPolicies.id, id));
    return Array.isArray(result) ? result.length > 0 : true;
  }

  // 删除安全策略
  async deleteSecurityPolicy(id: string): Promise<boolean> {
    const result = await this.db
      .delete(securityPolicies)
      .where(eq(securityPolicies.id, id));
    return Array.isArray(result) ? result.length > 0 : true;
  }

  // 批量删除安全策略
  async batchDeletePolicies(ids: string[]): Promise<boolean> {
    const result = await this.db
      .delete(securityPolicies)
      .where(inArray(securityPolicies.id, ids));
    return Array.isArray(result) ? result.length > 0 : true;
  }

  // 批量更新策略状态
  async batchUpdatePolicyStatus(ids: string[], status: SecurityPolicyStatus): Promise<number> {
    const result = await this.db
      .update(securityPolicies)
      .set({ status, updatedAt: new Date() })
      .where(inArray(securityPolicies.id, ids));
    return Array.isArray(result) ? result.length : 0;
  }



  // 获取安全策略统计信息
  async getPolicyStats(
    projectId?: string,
    environmentId?: string
  ): Promise<SecurityPolicyStats> {
    let whereConditions = [];

    if (projectId) {
      whereConditions.push(eq(securityPolicies.projectId, projectId));
    }
    if (environmentId) {
      whereConditions.push(eq(securityPolicies.environmentId, environmentId));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    // 总数统计
    const [totalResult] = await this.db
      .select({ count: count() })
      .from(securityPolicies)
      .where(whereClause);

    // 按类型统计
    const typeStats = await this.db
      .select({
        policyType: securityPolicies.policyType,
        count: count(),
      })
      .from(securityPolicies)
      .where(whereClause)
      .groupBy(securityPolicies.policyType);

    // 按状态统计
    const statusStats = await this.db
      .select({
        status: securityPolicies.status,
        count: count(),
      })
      .from(securityPolicies)
      .where(whereClause)
      .groupBy(securityPolicies.status);

    // 强制执行统计
    const [enforcedResult] = await this.db
      .select({ count: count() })
      .from(securityPolicies)
      .where(
        whereClause 
          ? and(whereClause, eq(securityPolicies.isEnforced, true))
          : eq(securityPolicies.isEnforced, true)
      );

    const enforcedCount = enforcedResult.count;
    const enforcementRate = totalResult.count > 0 ? (enforcedCount / totalResult.count) * 100 : 0;

    return {
      total: totalResult.count,
      byType: {
        'access-control': typeStats.find(s => s.policyType === 'access-control')?.count || 0,
        'network': typeStats.find(s => s.policyType === 'network')?.count || 0,
        'data-protection': typeStats.find(s => s.policyType === 'data-protection')?.count || 0,
        'compliance': typeStats.find(s => s.policyType === 'compliance')?.count || 0,
      },
      byStatus: {
        'active': statusStats.find(s => s.status === 'active')?.count || 0,
        'inactive': statusStats.find(s => s.status === 'inactive')?.count || 0,
        'draft': statusStats.find(s => s.status === 'draft')?.count || 0,
      },
      enforcedCount,
      enforcementRate,
    };
  }

  // 获取策略数量
  async getPolicyCount(
    projectId?: string,
    environmentId?: string,
    policyType?: SecurityPolicyType,
    status?: SecurityPolicyStatus
  ): Promise<number> {
    let whereConditions = [];

    if (projectId) {
      whereConditions.push(eq(securityPolicies.projectId, projectId));
    }
    if (environmentId) {
      whereConditions.push(eq(securityPolicies.environmentId, environmentId));
    }
    if (policyType) {
      whereConditions.push(eq(securityPolicies.policyType, policyType));
    }
    if (status) {
      whereConditions.push(eq(securityPolicies.status, status));
    }

    const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

    const [result] = await this.db
      .select({ count: count() })
      .from(securityPolicies)
      .where(whereClause);

    return result.count;
  }

  // 复制安全策略
  async duplicatePolicy(
    id: string,
    newName: string,
    createdBy: string
  ): Promise<SecurityPolicy | null> {
    const originalPolicy = await this.getSecurityPolicyById(id);
    if (!originalPolicy) {
      return null;
    }

    const duplicatedData: NewSecurityPolicy = {
      ...originalPolicy,
      id: undefined, // 让数据库生成新ID
      name: newName,
      status: 'draft', // 复制的策略默认为草稿状态
      createdBy,
      createdAt: undefined, // 让数据库生成新时间
      updatedAt: undefined,
    };

    return await this.createSecurityPolicy(duplicatedData);
  }

  // 获取策略详情（包含项目和环境信息）
  async getPolicyWithDetails(id: string): Promise<any> {
    const [result] = await this.db
      .select({
        policy: securityPolicies,
        project: projects,
        environment: environments,
      })
      .from(securityPolicies)
      .leftJoin(projects, eq(securityPolicies.projectId, projects.id))
      .leftJoin(environments, eq(securityPolicies.environmentId, environments.id))
      .where(eq(securityPolicies.id, id))
      .limit(1);

    return result || null;
  }

  // 验证策略数据
  async validatePolicy(data: Partial<SecurityPolicy>): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // 验证必填字段
    if (data.name !== undefined && (!data.name || data.name.trim().length === 0)) {
      errors.push('Policy name is required');
    }

    if (data.policyType !== undefined && !['access-control', 'network', 'data-protection', 'compliance'].includes(data.policyType)) {
      errors.push('Invalid policy type');
    }

    if (data.status !== undefined && !['active', 'inactive', 'draft'].includes(data.status)) {
      errors.push('Invalid policy status');
    }

    // 验证优先级
    if (data.priority !== undefined && data.priority !== null && (data.priority < 0 || data.priority > 100)) {
      errors.push('Priority must be between 0 and 100');
    }

    // 验证项目ID是否存在
    if (data.projectId) {
      const [project] = await this.db
        .select({ id: projects.id })
        .from(projects)
        .where(eq(projects.id, data.projectId))
        .limit(1);
      
      if (!project) {
        errors.push('Project ID does not exist');
      }
    }

    // 验证环境ID是否存在
    if (data.environmentId) {
      const [environment] = await this.db
        .select({ id: environments.id })
        .from(environments)
        .where(eq(environments.id, data.environmentId))
        .limit(1);
      
      if (!environment) {
        errors.push('Environment ID does not exist');
      }
    }

    // 验证规则JSON格式
    if (data.rules) {
      try {
        JSON.parse(data.rules);
      } catch (e) {
        errors.push('Rules must be valid JSON format');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }
}