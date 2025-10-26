import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray, like, isNull } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { 
  incidents, 
  insertIncidentSchema,
  selectIncidentSchema,
  updateIncidentSchema,
  Incident,
  NewIncident,
  UpdateIncident,
  IncidentSeverityEnum,
  IncidentPriorityEnum,
  IncidentStatusEnum,
  IncidentCategoryEnum
} from '../../database/schemas/incidents.schema';

type IncidentSeverity = typeof IncidentSeverityEnum[number];
type IncidentPriority = typeof IncidentPriorityEnum[number];
type IncidentStatus = typeof IncidentStatusEnum[number];
type IncidentCategory = typeof IncidentCategoryEnum[number];

@Injectable()
export class IncidentsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  // 创建事件
  async createIncident(data: NewIncident): Promise<Incident> {
    const [incident] = await this.db
      .insert(incidents)
      .values({
        ...data,
        reportedAt: data.reportedAt || new Date()
      })
      .returning();
    return incident;
  }

  // 根据ID获取事件
  async getIncidentById(id: string): Promise<Incident | null> {
    const [incident] = await this.db
      .select()
      .from(incidents)
      .where(eq(incidents.id, id))
      .limit(1);
    return incident || null;
  }

  // 获取项目的事件列表
  async getIncidentsByProject(
    projectId: string,
    options: {
      status?: IncidentStatus;
      severity?: IncidentSeverity;
      priority?: IncidentPriority;
      category?: IncidentCategory;
      assignedTo?: string;
      reportedBy?: string;
      dateFrom?: Date;
      dateTo?: Date;
      limit?: number;
      offset?: number;
      sortBy?: 'reportedAt' | 'severity' | 'priority' | 'status';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ incidents: Incident[]; total: number }> {
    const {
      status,
      severity,
      priority,
      category,
      assignedTo,
      reportedBy,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
      sortBy = 'reportedAt',
      sortOrder = 'desc'
    } = options;

    let query = this.db.select().from(incidents);
    let countQuery = this.db.select({ count: count() }).from(incidents);

    const conditions = [eq(incidents.projectId, projectId)];
    
    if (status) {
      conditions.push(eq(incidents.status, status));
    }
    if (severity) {
      conditions.push(eq(incidents.severity, severity));
    }
    if (priority) {
      conditions.push(eq(incidents.priority, priority));
    }
    if (category) {
      conditions.push(eq(incidents.category, category));
    }
    if (assignedTo) {
      conditions.push(eq(incidents.assignedTo, assignedTo));
    }
    if (reportedBy) {
      conditions.push(eq(incidents.reportedBy, reportedBy));
    }
    if (dateFrom) {
      conditions.push(gte(incidents.reportedAt, dateFrom));
    }
    if (dateTo) {
      conditions.push(lte(incidents.reportedAt, dateTo));
    }

    if (conditions.length > 0) {
      const whereClause = and(...conditions);
      const filteredQuery = query.where(whereClause);
      const filteredCountQuery = countQuery.where(whereClause);
      
      // 排序
      const orderColumn = incidents[sortBy];
      const orderedQuery = filteredQuery.orderBy(sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn));

      // 分页
      const finalQuery = orderedQuery.limit(limit).offset(offset);

      const [incidentList, totalResult] = await Promise.all([
        finalQuery.execute(),
        filteredCountQuery.execute()
      ]);

      return {
        incidents: incidentList,
        total: totalResult[0].count
      };
    } else {
      // 排序
      const orderColumn = incidents[sortBy];
      const orderedQuery = query.orderBy(sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn));

      // 分页
      const finalQuery = orderedQuery.limit(limit).offset(offset);

      const [incidentList, totalResult] = await Promise.all([
        finalQuery.execute(),
        countQuery.execute()
      ]);

      return {
        incidents: incidentList,
        total: totalResult[0].count
      };
    }
  }

  // 更新事件
  async updateIncident(
    id: string,
    data: UpdateIncident
  ): Promise<Incident | null> {
    const [incident] = await this.db
      .update(incidents)
      .set({
        ...data,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 确认事件
  async acknowledgeIncident(
    id: string,
    assignedTo?: string
  ): Promise<Incident | null> {
    const updateData: any = {
      status: 'investigating',
      acknowledgedAt: new Date(),
      updatedAt: new Date()
    };

    if (assignedTo) {
      updateData.assignedTo = assignedTo;
    }

    const [incident] = await this.db
      .update(incidents)
      .set(updateData)
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 解决事件
  async resolveIncident(
    id: string,
    resolutionData?: {
      resolutionMitigation?: any;
      rootCauseAnalysis?: any;
    }
  ): Promise<Incident | null> {
    const updateData: any = {
      status: 'resolved' as IncidentStatus,
      resolvedAt: new Date(),
      updatedAt: new Date()
    };

    if (resolutionData?.resolutionMitigation) {
      updateData.resolutionMitigation = resolutionData.resolutionMitigation;
    }
    if (resolutionData?.rootCauseAnalysis) {
      updateData.rootCauseAnalysis = resolutionData.rootCauseAnalysis;
    }

    const [incident] = await this.db
      .update(incidents)
      .set(updateData)
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 关闭事件
  async closeIncident(
    id: string,
    postIncidentReview?: any
  ): Promise<Incident | null> {
    const updateData: any = {
      status: 'closed' as IncidentStatus,
      closedAt: new Date(),
      updatedAt: new Date()
    };

    if (postIncidentReview) {
      updateData.postIncidentReview = postIncidentReview;
    }

    const [incident] = await this.db
      .update(incidents)
      .set(updateData)
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 重新打开事件
  async reopenIncident(id: string): Promise<Incident | null> {
    const [incident] = await this.db
      .update(incidents)
      .set({
        status: 'open' as IncidentStatus,
        resolvedAt: null,
        closedAt: null,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 分配事件
  async assignIncident(
    id: string,
    assignedTo: string
  ): Promise<Incident | null> {
    const [incident] = await this.db
      .update(incidents)
      .set({
        assignedTo,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 更新事件严重级别
  async updateSeverity(
    id: string,
    severity: IncidentSeverity
  ): Promise<Incident | null> {
    const [incident] = await this.db
      .update(incidents)
      .set({
        severity,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 更新事件优先级
  async updatePriority(
    id: string,
    priority: IncidentPriority
  ): Promise<Incident | null> {
    const [incident] = await this.db
      .update(incidents)
      .set({
        priority,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();
    return incident || null;
  }

  // 添加沟通更新
  async addCommunicationUpdate(
    id: string,
    update: {
      type: 'status-page' | 'internal' | 'customer';
      message: string;
      author: string;
      audience?: string;
      channel?: string;
      recipients?: number;
    }
  ): Promise<Incident | null> {
    const incident = await this.getIncidentById(id);
    if (!incident) return null;

    const currentUpdates = incident.communicationUpdates || {};
    const timestamp = new Date().toISOString();

    let updatedCommunications = { ...currentUpdates };

    switch (update.type) {
      case 'status-page':
        updatedCommunications.statusPageUpdates = [
          ...(currentUpdates.statusPageUpdates || []),
          {
            timestamp,
            status: incident.status,
            message: update.message,
            author: update.author
          }
        ];
        break;
      case 'internal':
        updatedCommunications.internalUpdates = [
          ...(currentUpdates.internalUpdates || []),
          {
            timestamp,
            audience: update.audience || 'team',
            message: update.message,
            author: update.author
          }
        ];
        break;
      case 'customer':
        updatedCommunications.customerNotifications = [
          ...(currentUpdates.customerNotifications || []),
          {
            timestamp,
            channel: update.channel || 'email',
            message: update.message,
            recipients: update.recipients || 0
          }
        ];
        break;
    }

    const [updatedIncident] = await this.db
      .update(incidents)
      .set({
        communicationUpdates: updatedCommunications,
        updatedAt: new Date()
      })
      .where(eq(incidents.id, id))
      .returning();

    return updatedIncident || null;
  }

  // 获取事件统计信息
  async getIncidentStatistics(
    projectId?: string,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    total: number;
    byStatus: Record<IncidentStatus, number>;
    bySeverity: Record<IncidentSeverity, number>;
    byCategory: Record<IncidentCategory, number>;
    avgResolutionTime: number;
    slaCompliance: number;
    trendsOverTime: Array<{
      date: string;
      count: number;
      resolved: number;
    }>;
  }> {
    let baseConditions = [];
    
    if (projectId) {
      baseConditions.push(eq(incidents.projectId, projectId));
    }
    if (dateFrom) {
      baseConditions.push(gte(incidents.reportedAt, dateFrom));
    }
    if (dateTo) {
      baseConditions.push(lte(incidents.reportedAt, dateTo));
    }

    const whereClause = baseConditions.length > 0 ? and(...baseConditions) : undefined;

    const [
      totalResult,
      statusStats,
      severityStats,
      categoryStats,
      resolutionStats,
      slaStats
    ] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(incidents)
        .where(whereClause)
        .execute(),
      this.db
        .select({
          status: incidents.status,
          count: count()
        })
        .from(incidents)
        .where(whereClause)
        .groupBy(incidents.status)
        .execute(),
      this.db
        .select({
          severity: incidents.severity,
          count: count()
        })
        .from(incidents)
        .where(whereClause)
        .groupBy(incidents.severity)
        .execute(),
      this.db
        .select({
          category: incidents.category,
          count: count()
        })
        .from(incidents)
        .where(whereClause)
        .groupBy(incidents.category)
        .execute(),
      this.db
        .select({
          avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (resolved_at - reported_at)))`
        })
        .from(incidents)
        .where(
          whereClause 
            ? and(whereClause, eq(incidents.status, 'resolved'))
            : eq(incidents.status, 'resolved')
        )
        .execute(),
      this.db
        .select({
          total: count(),
          compliant: sql<number>`COUNT(CASE WHEN (metrics_sla->>'slaCompliance')::jsonb->>'breached' = 'false' THEN 1 END)`
        })
        .from(incidents)
        .where(whereClause)
        .execute()
    ]);

    const byStatus = {} as Record<IncidentStatus, number>;
    const bySeverity = {} as Record<IncidentSeverity, number>;
    const byCategory = {} as Record<IncidentCategory, number>;

    statusStats.forEach(stat => {
      byStatus[stat.status] = stat.count;
    });

    severityStats.forEach(stat => {
      bySeverity[stat.severity] = stat.count;
    });

    categoryStats.forEach(stat => {
      byCategory[stat.category] = stat.count;
    });

    const slaCompliance = slaStats[0]?.total > 0 
      ? (slaStats[0].compliant / slaStats[0].total) * 100 
      : 0;

    // 简化的趋势数据，实际应该按日期分组
    const trendsOverTime = [
      {
        date: new Date().toISOString().split('T')[0],
        count: totalResult[0].count,
        resolved: byStatus.resolved || 0
      }
    ];

    return {
      total: totalResult[0].count,
      byStatus,
      bySeverity,
      byCategory,
      avgResolutionTime: resolutionStats[0]?.avgTime || 0,
      slaCompliance,
      trendsOverTime
    };
  }

  // 批量更新事件状态
  async batchUpdateStatus(
    incidentIds: string[],
    status: IncidentStatus,
    assignedTo?: string
  ): Promise<number> {
    const updateData: Partial<UpdateIncident> = { status };
    if (assignedTo) {
      updateData.assignedTo = assignedTo;
    }

    const result = await this.db
      .update(incidents)
      .set(updateData)
      .where(inArray(incidents.id, incidentIds));

    // postgres.js 返回的结果有 count 属性，表示受影响的行数
    return result.count || 0;
  }

  // 删除事件
  async deleteIncident(id: string): Promise<boolean> {
    const result = await this.db
      .delete(incidents)
      .where(eq(incidents.id, id));
    
    // postgres.js 返回的结果有 count 属性，表示受影响的行数
    return (result.count || 0) > 0;
  }

  // 批量删除事件
  async batchDeleteIncidents(incidentIds: string[]): Promise<number> {
    const result = await this.db
      .delete(incidents)
      .where(inArray(incidents.id, incidentIds));
    
    // postgres.js 返回的结果有 count 属性，表示受影响的行数
    return result.count || 0;
  }

  // 获取相似事件
  async getSimilarIncidents(
    incidentId: string,
    limit: number = 10
  ): Promise<Incident[]> {
    const incident = await this.getIncidentById(incidentId);
    if (!incident) return [];

    // 基于分类、严重级别和关键词查找相似事件
    const similarIncidents = await this.db
      .select()
      .from(incidents)
      .where(
        and(
          eq(incidents.category, incident.category),
          eq(incidents.severity, incident.severity),
          sql`${incidents.id} != ${incidentId}`
        )
      )
      .orderBy(desc(incidents.reportedAt))
      .limit(limit);

    return similarIncidents;
  }

  // AI 辅助诊断
  async getAIRecommendations(incidentId: string): Promise<{
    recommendations: Array<{
      type: 'diagnosis' | 'mitigation' | 'prevention';
      confidence: number;
      suggestion: string;
      reasoning: string;
    }>;
    similarIncidents: Array<{
      id: string;
      similarity: number;
      resolution: string;
    }>;
    knowledgeBase: {
      articles: string[];
      runbooks: string[];
      procedures: string[];
    };
  }> {
    // 这里应该调用 AI 服务进行智能分析
    // 暂时返回模拟数据
    const incident = await this.getIncidentById(incidentId);
    if (!incident) {
      throw new Error('Incident not found');
    }

    const similarIncidents = await this.getSimilarIncidents(incidentId, 5);

    return {
      recommendations: [
        {
          type: 'diagnosis',
          confidence: 0.85,
          suggestion: 'Check database connection pool configuration',
          reasoning: 'Similar incidents were resolved by adjusting connection pool settings'
        },
        {
          type: 'mitigation',
          confidence: 0.78,
          suggestion: 'Implement circuit breaker pattern',
          reasoning: 'This can prevent cascade failures in similar scenarios'
        }
      ],
      similarIncidents: similarIncidents.map(sim => ({
        id: sim.id,
        similarity: 0.75,
        resolution: 'Database connection pool increased'
      })),
      knowledgeBase: {
        articles: ['Database Performance Troubleshooting', 'Connection Pool Best Practices'],
        runbooks: ['Database Incident Response', 'Performance Issue Resolution'],
        procedures: ['Incident Escalation Process', 'Post-Incident Review']
      }
    };
  }
}