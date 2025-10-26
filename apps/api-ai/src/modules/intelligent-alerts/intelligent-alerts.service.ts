import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { DatabaseService } from '../../database/database.service';
import { 
  intelligentAlerts, 
  InsertIntelligentAlert, 
  SelectIntelligentAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  RootCauseCategory,
  RemediationActionType
} from '../../database/schemas/intelligent-alerts.schema';

@Injectable()
export class IntelligentAlertsService {
  constructor(private readonly db: DatabaseService) {}

  // 创建智能告警
  async createAlert(data: InsertIntelligentAlert): Promise<SelectIntelligentAlert> {
    const [alert] = await this.db.database
      .insert(intelligentAlerts)
      .values(data)
      .returning();
    return alert;
  }

  // 根据ID获取告警
  async getAlertById(id: string): Promise<SelectIntelligentAlert | null> {
    const [alert] = await this.db.database
      .select()
      .from(intelligentAlerts)
      .where(eq(intelligentAlerts.id, id))
      .limit(1);
    return alert || null;
  }

  // 获取项目的告警列表
  async getAlertsByProject(
    projectId: string,
    options: {
      status?: AlertStatus;
      severity?: AlertSeverity;
      alertType?: AlertType;
      limit?: number;
      offset?: number;
      sortBy?: 'createdAt' | 'severity' | 'aiConfidence';
      sortOrder?: 'asc' | 'desc';
    } = {}
  ): Promise<{ alerts: SelectIntelligentAlert[]; total: number }> {
    const {
      status,
      severity,
      alertType,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    let query = this.db.database.select().from(intelligentAlerts);
    let countQuery = this.db.database.select({ count: count() }).from(intelligentAlerts);

    const conditions = [];
    
    // 通过 monitorConfigId 关联到项目（需要 join monitoring_configs 表）
    // 这里简化处理，假设可以直接通过某种方式关联到项目
    // 实际实现中可能需要 join monitoring_configs 表
    
    if (status) {
      conditions.push(eq(intelligentAlerts.status, status));
    }
    if (severity) {
      conditions.push(eq(intelligentAlerts.severity, severity));
    }
    if (alertType) {
      conditions.push(eq(intelligentAlerts.alertType, alertType));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
      countQuery = countQuery.where(and(...conditions));
    }

    // 排序
    const orderColumn = intelligentAlerts[sortBy];
    query = query.orderBy(sortOrder === 'desc' ? desc(orderColumn) : asc(orderColumn));

    // 分页
    query = query.limit(limit).offset(offset);

    const [alerts, totalResult] = await Promise.all([
      query,
      countQuery
    ]);

    return {
      alerts,
      total: totalResult[0].count
    };
  }

  // 更新告警
  async updateAlert(
    id: string,
    data: Partial<InsertIntelligentAlert>
  ): Promise<SelectIntelligentAlert | null> {
    const [alert] = await this.db.database
      .update(intelligentAlerts)
      .set(data)
      .where(eq(intelligentAlerts.id, id))
      .returning();
    return alert || null;
  }

  // 确认告警
  async acknowledgeAlert(
    id: string,
    acknowledgedBy: string
  ): Promise<SelectIntelligentAlert | null> {
    const [alert] = await this.db.database
      .update(intelligentAlerts)
      .set({
        status: 'acknowledged',
        acknowledgedBy,
        acknowledgedAt: new Date()
      })
      .where(eq(intelligentAlerts.id, id))
      .returning();
    return alert || null;
  }

  // 解决告警
  async resolveAlert(
    id: string,
    resolutionNotes?: string
  ): Promise<SelectIntelligentAlert | null> {
    const [alert] = await this.db.database
      .update(intelligentAlerts)
      .set({
        status: 'resolved',
        resolvedAt: new Date(),
        resolutionNotes
      })
      .where(eq(intelligentAlerts.id, id))
      .returning();
    return alert || null;
  }

  // 升级告警
  async escalateAlert(id: string): Promise<SelectIntelligentAlert | null> {
    const [alert] = await this.db.database
      .update(intelligentAlerts)
      .set({
        escalated: true,
        escalatedAt: new Date()
      })
      .where(eq(intelligentAlerts.id, id))
      .returning();
    return alert || null;
  }

  // 应用自动修复
  async applyAutoRemediation(id: string): Promise<SelectIntelligentAlert | null> {
    const alert = await this.getAlertById(id);
    if (!alert || !alert.autoRemediationAvailable) {
      return null;
    }

    const [updatedAlert] = await this.db.database
      .update(intelligentAlerts)
      .set({
        autoRemediationApplied: true
      })
      .where(eq(intelligentAlerts.id, id))
      .returning();

    return updatedAlert || null;
  }

  // 获取告警统计信息
  async getAlertStatistics(projectId?: string): Promise<{
    total: number;
    byStatus: Record<AlertStatus, number>;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    avgResolutionTime: number;
    autoRemediationRate: number;
  }> {
    let baseQuery = this.db.database.select().from(intelligentAlerts);
    
    // 如果指定了项目ID，需要添加过滤条件
    // 这里简化处理，实际需要通过 monitoring_configs 关联

    const [
      totalResult,
      statusStats,
      severityStats,
      typeStats,
      resolutionStats,
      autoRemediationStats
    ] = await Promise.all([
      this.db.database.select({ count: count() }).from(intelligentAlerts),
      this.db.database
        .select({
          status: intelligentAlerts.status,
          count: count()
        })
        .from(intelligentAlerts)
        .groupBy(intelligentAlerts.status),
      this.db.database
        .select({
          severity: intelligentAlerts.severity,
          count: count()
        })
        .from(intelligentAlerts)
        .groupBy(intelligentAlerts.severity),
      this.db.database
        .select({
          alertType: intelligentAlerts.alertType,
          count: count()
        })
        .from(intelligentAlerts)
        .groupBy(intelligentAlerts.alertType),
      this.db.database
        .select({
          avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))`
        })
        .from(intelligentAlerts)
        .where(eq(intelligentAlerts.status, 'resolved')),
      this.db.database
        .select({
          total: count(),
          autoApplied: sql<number>`COUNT(CASE WHEN auto_remediation_applied = true THEN 1 END)`
        })
        .from(intelligentAlerts)
        .where(eq(intelligentAlerts.autoRemediationAvailable, true))
    ]);

    const byStatus = {} as Record<AlertStatus, number>;
    const bySeverity = {} as Record<AlertSeverity, number>;
    const byType = {} as Record<AlertType, number>;

    statusStats.forEach(stat => {
      byStatus[stat.status] = stat.count;
    });

    severityStats.forEach(stat => {
      bySeverity[stat.severity] = stat.count;
    });

    typeStats.forEach(stat => {
      byType[stat.alertType] = stat.count;
    });

    const autoRemediationRate = autoRemediationStats[0]?.total > 0 
      ? (autoRemediationStats[0].autoApplied / autoRemediationStats[0].total) * 100 
      : 0;

    return {
      total: totalResult[0].count,
      byStatus,
      bySeverity,
      byType,
      avgResolutionTime: resolutionStats[0]?.avgTime || 0,
      autoRemediationRate
    };
  }

  // 批量更新告警状态
  async batchUpdateStatus(
    alertIds: string[],
    status: AlertStatus,
    acknowledgedBy?: string
  ): Promise<number> {
    const updateData: any = { status };
    
    if (status === 'acknowledged' && acknowledgedBy) {
      updateData.acknowledgedBy = acknowledgedBy;
      updateData.acknowledgedAt = new Date();
    } else if (status === 'resolved') {
      updateData.resolvedAt = new Date();
    }

    const result = await this.db.database
      .update(intelligentAlerts)
      .set(updateData)
      .where(inArray(intelligentAlerts.id, alertIds));

    return result.rowCount || 0;
  }

  // 删除告警
  async deleteAlert(id: string): Promise<boolean> {
    const result = await this.db.database
      .delete(intelligentAlerts)
      .where(eq(intelligentAlerts.id, id));
    return (result.rowCount || 0) > 0;
  }

  // 批量删除告警
  async batchDeleteAlerts(alertIds: string[]): Promise<number> {
    const result = await this.db.database
      .delete(intelligentAlerts)
      .where(inArray(intelligentAlerts.id, alertIds));
    return result.rowCount || 0;
  }

  // 获取相关告警
  async getRelatedAlerts(
    alertId: string,
    limit: number = 10
  ): Promise<SelectIntelligentAlert[]> {
    const alert = await this.getAlertById(alertId);
    if (!alert) return [];

    // 基于根因类别和组件查找相关告警
    const relatedAlerts = await this.db.database
      .select()
      .from(intelligentAlerts)
      .where(
        and(
          eq(intelligentAlerts.rootCauseCategory, alert.rootCauseCategory),
          eq(intelligentAlerts.rootCauseComponent, alert.rootCauseComponent),
          sql`${intelligentAlerts.id} != ${alertId}`
        )
      )
      .orderBy(desc(intelligentAlerts.correlationStrength))
      .limit(limit);

    return relatedAlerts;
  }

  // AI 根因分析
  async performRootCauseAnalysis(alertId: string): Promise<{
    category: RootCauseCategory;
    component: string;
    description: string;
    confidence: number;
    suggestedActions: string[];
  }> {
    // 这里应该调用 AI 服务进行根因分析
    // 暂时返回模拟数据
    const alert = await this.getAlertById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    // 模拟 AI 分析结果
    return {
      category: 'infrastructure',
      component: 'database',
      description: 'High database connection pool usage detected',
      confidence: 0.85,
      suggestedActions: [
        'Increase database connection pool size',
        'Optimize slow queries',
        'Consider database scaling'
      ]
    };
  }

  // 预测性告警分析
  async generatePredictiveAlert(
    monitorConfigId: string,
    predictionHorizon: number
  ): Promise<SelectIntelligentAlert | null> {
    // 这里应该调用 AI 服务进行预测分析
    // 暂时返回模拟的预测性告警
    const predictiveAlert: InsertIntelligentAlert = {
      monitorConfigId,
      alertType: 'predictive',
      severity: 'warning',
      title: 'Predicted Performance Degradation',
      description: 'AI model predicts potential performance issues in the next 2 hours',
      aiConfidence: 0.78,
      predictionHorizon,
      probabilityScore: 0.65,
      status: 'active',
      impactLevel: 'medium',
      affectedServices: ['api-service', 'database'],
      estimatedDowntime: 15
    };

    return this.createAlert(predictiveAlert);
  }
}