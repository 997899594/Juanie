import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, count, gte, lte, ilike, inArray, sql } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { 
  auditLogs, 
  type AuditLog, 
  type NewAuditLog, 
  type UpdateAuditLog,
  type AuditOutcome,
  type AuditSeverity,
  type AuditActorType
} from '../../database/schemas/audit-logs.schema';

@Injectable()
export class AuditLogsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  // 创建审计日志
  async create(data: NewAuditLog): Promise<AuditLog> {
    const [auditLog] = await this.db
      .insert(auditLogs)
      .values({
        ...data,
        requestId: data.requestId || this.generateRequestId(),
        correlationId: data.correlationId || this.generateCorrelationId(),
      })
      .returning();
    return auditLog;
  }

  // 批量创建审计日志
  async createMany(data: NewAuditLog[]): Promise<AuditLog[]> {
    const logsWithIds = data.map(log => ({
      ...log,
      requestId: log.requestId || this.generateRequestId(),
      correlationId: log.correlationId || this.generateCorrelationId(),
    }));

    return await this.db
      .insert(auditLogs)
      .values(logsWithIds)
      .returning();
  }

  // 根据ID获取审计日志
  async getById(id: string): Promise<AuditLog | null> {
    const [auditLog] = await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.id, id))
      .limit(1);
    return auditLog || null;
  }

  // 根据组织ID获取审计日志
  async getByOrganization(
    organizationId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'action' | 'outcome' | 'severity';
      sortOrder?: 'asc' | 'desc';
      action?: string;
      outcome?: AuditOutcome;
      severity?: AuditSeverity;
      actorType?: AuditActorType;
      userId?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      action,
      outcome,
      severity,
      actorType,
      userId,
      resourceType,
      startDate,
      endDate,
    } = options;

    const conditions = [eq(auditLogs.organizationId, organizationId)];

    if (action) {
      conditions.push(ilike(auditLogs.action, `%${action}%`));
    }
    if (outcome) {
      conditions.push(eq(auditLogs.outcome, outcome));
    }
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }
    if (actorType) {
      conditions.push(eq(auditLogs.actorType, actorType));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = and(...conditions);
    const orderBy = sortOrder === 'desc' ? desc(auditLogs[sortBy]) : asc(auditLogs[sortBy]);

    const [logs, totalResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)
        .execute()
    ]);

    return {
      logs,
      total: totalResult[0]?.count || 0,
    };
  }

  // 根据项目ID获取审计日志
  async getByProject(
    projectId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'action' | 'outcome' | 'severity';
      sortOrder?: 'asc' | 'desc';
      action?: string;
      outcome?: AuditOutcome;
      severity?: AuditSeverity;
      actorType?: AuditActorType;
      userId?: string;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      action,
      outcome,
      severity,
      actorType,
      userId,
      resourceType,
      startDate,
      endDate,
    } = options;

    const conditions = [eq(auditLogs.projectId, projectId)];

    if (action) {
      conditions.push(ilike(auditLogs.action, `%${action}%`));
    }
    if (outcome) {
      conditions.push(eq(auditLogs.outcome, outcome));
    }
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }
    if (actorType) {
      conditions.push(eq(auditLogs.actorType, actorType));
    }
    if (userId) {
      conditions.push(eq(auditLogs.userId, userId));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = and(...conditions);
    const orderBy = sortOrder === 'desc' ? desc(auditLogs[sortBy]) : asc(auditLogs[sortBy]);

    const [logs, totalResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)
        .execute()
    ]);

    return {
      logs,
      total: totalResult[0]?.count || 0,
    };
  }

  // 根据用户ID获取审计日志
  async getByUser(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'action' | 'outcome' | 'severity';
      sortOrder?: 'asc' | 'desc';
      organizationId?: string;
      projectId?: string;
      action?: string;
      outcome?: AuditOutcome;
      severity?: AuditSeverity;
      resourceType?: string;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      organizationId,
      projectId,
      action,
      outcome,
      severity,
      resourceType,
      startDate,
      endDate,
    } = options;

    const conditions = [eq(auditLogs.userId, userId)];

    if (organizationId) {
      conditions.push(eq(auditLogs.organizationId, organizationId));
    }
    if (projectId) {
      conditions.push(eq(auditLogs.projectId, projectId));
    }
    if (action) {
      conditions.push(ilike(auditLogs.action, `%${action}%`));
    }
    if (outcome) {
      conditions.push(eq(auditLogs.outcome, outcome));
    }
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }
    if (resourceType) {
      conditions.push(eq(auditLogs.resourceType, resourceType));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = and(...conditions);
    const orderBy = sortOrder === 'desc' ? desc(auditLogs[sortBy]) : asc(auditLogs[sortBy]);

    const [logs, totalResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)
        .execute()
    ]);

    return {
      logs,
      total: totalResult[0]?.count || 0,
    };
  }

  // 根据关联ID获取审计日志
  async getByCorrelationId(correlationId: string): Promise<AuditLog[]> {
    return await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.correlationId, correlationId))
      .orderBy(desc(auditLogs.createdAt));
  }

  // 根据请求ID获取审计日志
  async getByRequestId(requestId: string): Promise<AuditLog[]> {
    return await this.db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.requestId, requestId))
      .orderBy(desc(auditLogs.createdAt));
  }

  // 根据资源获取审计日志
  async getByResource(
    resourceType: string,
    resourceId: string,
    options: {
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'action' | 'outcome' | 'severity';
      sortOrder?: 'asc' | 'desc';
      organizationId?: string;
      projectId?: string;
      action?: string;
      outcome?: AuditOutcome;
      severity?: AuditSeverity;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      organizationId,
      projectId,
      action,
      outcome,
      severity,
      startDate,
      endDate,
    } = options;

    const conditions = [
      eq(auditLogs.resourceType, resourceType),
      eq(auditLogs.resourceId, resourceId)
    ];

    if (organizationId) {
      conditions.push(eq(auditLogs.organizationId, organizationId));
    }
    if (projectId) {
      conditions.push(eq(auditLogs.projectId, projectId));
    }
    if (action) {
      conditions.push(ilike(auditLogs.action, `%${action}%`));
    }
    if (outcome) {
      conditions.push(eq(auditLogs.outcome, outcome));
    }
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = and(...conditions);
    const orderBy = sortOrder === 'desc' ? desc(auditLogs[sortBy]) : asc(auditLogs[sortBy]);

    const [logs, totalResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)
        .execute()
    ]);

    return {
      logs,
      total: totalResult[0]?.count || 0,
    };
  }

  // 更新审计日志
  async update(id: string, data: UpdateAuditLog): Promise<AuditLog | null> {
    const [auditLog] = await this.db
      .update(auditLogs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(auditLogs.id, id))
      .returning();
    return auditLog || null;
  }

  // 删除审计日志
  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(auditLogs)
      .where(eq(auditLogs.id, id));
    return result.count > 0;
  }

  // 批量删除审计日志
  async deleteMany(ids: string[]): Promise<number> {
    const result = await this.db
      .delete(auditLogs)
      .where(inArray(auditLogs.id, ids));
    return result.count;
  }

  // 清理旧的审计日志
  async cleanupOldLogs(
    organizationId: string,
    retentionDays: number = 90
  ): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db
      .delete(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, organizationId),
          lte(auditLogs.createdAt, cutoffDate)
        )
      );
    return result.count;
  }

  // 获取审计日志统计信息
  async getStatistics(
    organizationId?: string,
    projectId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    byOutcome: Record<AuditOutcome, number>;
    bySeverity: Record<AuditSeverity, number>;
    byActorType: Record<AuditActorType, number>;
    topActions: Array<{ action: string; count: number }>;
    topResources: Array<{ resourceType: string; count: number }>;
  }> {
    const conditions = [];
    
    if (organizationId) {
      conditions.push(eq(auditLogs.organizationId, organizationId));
    }
    if (projectId) {
      conditions.push(eq(auditLogs.projectId, projectId));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [
      totalResult,
      outcomeStats,
      severityStats,
      actorTypeStats,
      actionStats,
      resourceStats
    ] = await Promise.all([
      // 总数
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause),
      
      // 按结果统计
      this.db
        .select({
          outcome: auditLogs.outcome,
          count: count()
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.outcome),
      
      // 按严重级别统计
      this.db
        .select({
          severity: auditLogs.severity,
          count: count()
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.severity),
      
      // 按主体类型统计
      this.db
        .select({
          actorType: auditLogs.actorType,
          count: count()
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.actorType),
      
      // 热门操作
      this.db
        .select({
          action: auditLogs.action,
          count: count()
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.action)
        .orderBy(desc(count()))
        .limit(10),
      
      // 热门资源类型
      this.db
        .select({
          resourceType: auditLogs.resourceType,
          count: count()
        })
        .from(auditLogs)
        .where(whereClause)
        .groupBy(auditLogs.resourceType)
        .orderBy(desc(count()))
        .limit(10)
    ]);

    // 初始化统计对象
    const byOutcome: Record<AuditOutcome, number> = {
      success: 0,
      failure: 0,
      denied: 0
    };
    const bySeverity: Record<AuditSeverity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };
    const byActorType: Record<AuditActorType, number> = {
      user: 0,
      system: 0,
      service: 0
    };

    // 填充统计数据
    outcomeStats.forEach(stat => {
      byOutcome[stat.outcome] = stat.count;
    });
    severityStats.forEach(stat => {
      bySeverity[stat.severity] = stat.count;
    });
    actorTypeStats.forEach(stat => {
      byActorType[stat.actorType] = stat.count;
    });

    return {
      total: totalResult[0]?.count || 0,
      byOutcome,
      bySeverity,
      byActorType,
      topActions: actionStats.map(stat => ({
        action: stat.action,
        count: stat.count
      })),
      topResources: resourceStats
        .filter(stat => stat.resourceType)
        .map(stat => ({
          resourceType: stat.resourceType!,
          count: stat.count
        }))
    };
  }

  // 搜索审计日志
  async search(
    query: string,
    options: {
      organizationId?: string;
      projectId?: string;
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'action' | 'outcome' | 'severity';
      sortOrder?: 'asc' | 'desc';
      outcome?: AuditOutcome;
      severity?: AuditSeverity;
      actorType?: AuditActorType;
      startDate?: Date;
      endDate?: Date;
    } = {}
  ): Promise<{ logs: AuditLog[]; total: number }> {
    const {
      organizationId,
      projectId,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      outcome,
      severity,
      actorType,
      startDate,
      endDate,
    } = options;

    const conditions = [
      sql`(
        ${auditLogs.action} ILIKE ${`%${query}%`} OR
        ${auditLogs.resourceType} ILIKE ${`%${query}%`} OR
        ${auditLogs.resourceId} ILIKE ${`%${query}%`} OR
        ${auditLogs.reason} ILIKE ${`%${query}%`} OR
        ${auditLogs.ipAddress} ILIKE ${`%${query}%`}
      )`
    ];

    if (organizationId) {
      conditions.push(eq(auditLogs.organizationId, organizationId));
    }
    if (projectId) {
      conditions.push(eq(auditLogs.projectId, projectId));
    }
    if (outcome) {
      conditions.push(eq(auditLogs.outcome, outcome));
    }
    if (severity) {
      conditions.push(eq(auditLogs.severity, severity));
    }
    if (actorType) {
      conditions.push(eq(auditLogs.actorType, actorType));
    }
    if (startDate) {
      conditions.push(gte(auditLogs.createdAt, startDate));
    }
    if (endDate) {
      conditions.push(lte(auditLogs.createdAt, endDate));
    }

    const whereClause = and(...conditions);
    const orderBy = sortOrder === 'desc' ? desc(auditLogs[sortBy]) : asc(auditLogs[sortBy]);

    const [logs, totalResult] = await Promise.all([
      this.db
        .select()
        .from(auditLogs)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset)
        .execute(),
      this.db
        .select({ count: count() })
        .from(auditLogs)
        .where(whereClause)
        .execute()
    ]);

    return {
      logs,
      total: totalResult[0]?.count || 0,
    };
  }

  // 生成请求ID
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // 生成关联ID
  private generateCorrelationId(): string {
    return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}