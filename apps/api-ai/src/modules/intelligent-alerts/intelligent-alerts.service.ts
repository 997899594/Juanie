import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, inArray } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import type { Database } from '../../database/database.module';
import { 
  intelligentAlerts, 
  NewIntelligentAlert, 
  IntelligentAlert,
  AlertType,
  AlertSeverity,
  AlertStatus,
  RootCauseCategoryEnum
} from '../../database/schemas/intelligent-alerts.schema';

@Injectable()
export class IntelligentAlertsService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  // 创建智能告警
  async createAlert(data: NewIntelligentAlert): Promise<IntelligentAlert> {
    const [alert] = await this.db
      .insert(intelligentAlerts)
      .values(data)
      .returning();
    return alert;
  }

  // 根据ID获取告警
  async getAlertById(id: string): Promise<IntelligentAlert | null> {
    const [alert] = await this.db
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
  ): Promise<{ alerts: IntelligentAlert[]; total: number }> {
    const {
      status,
      severity,
      alertType,
      limit = 50,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = options;

    const conditions = [];
    
    if (status) {
      conditions.push(eq(intelligentAlerts.status, status));
    }
    if (severity) {
      conditions.push(eq(intelligentAlerts.severity, severity));
    }
    if (alertType) {
      conditions.push(eq(intelligentAlerts.alertType, alertType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn = sortBy === 'createdAt' ? intelligentAlerts.createdAt :
                      sortBy === 'severity' ? intelligentAlerts.severity :
                      intelligentAlerts.aiConfidence;
    
    const orderBy = sortOrder === 'asc' ? asc(sortColumn) : desc(sortColumn);

    const [alerts, totalResult] = await Promise.all([
      this.db
        .select()
        .from(intelligentAlerts)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      this.db
        .select({ count: count() })
        .from(intelligentAlerts)
        .where(whereClause)
    ]);

    return {
      alerts,
      total: totalResult[0]?.count || 0
    };
  }

  // 更新告警
  async updateAlert(
    id: string,
    data: Partial<NewIntelligentAlert>
  ): Promise<IntelligentAlert | null> {
    const [alert] = await this.db
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
  ): Promise<IntelligentAlert | null> {
    const [alert] = await this.db
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
  ): Promise<IntelligentAlert | null> {
    const [alert] = await this.db
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
  async escalateAlert(id: string): Promise<IntelligentAlert | null> {
    const [alert] = await this.db
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
  async applyAutoRemediation(id: string): Promise<IntelligentAlert | null> {
    const alert = await this.getAlertById(id);
    if (!alert || !alert.autoRemediationAvailable) {
      return null;
    }

    const [updatedAlert] = await this.db
      .update(intelligentAlerts)
      .set({
        autoRemediationApplied: true
      })
      .where(eq(intelligentAlerts.id, id))
      .returning();
    
    return updatedAlert || null;
  }

  // 获取告警统计
  async getAlertStatistics(projectId?: string): Promise<{
    total: number;
    byStatus: Record<AlertStatus, number>;
    bySeverity: Record<AlertSeverity, number>;
    byType: Record<AlertType, number>;
    avgResolutionTime: number;
    autoRemediationRate: number;
  }> {
    const conditions = projectId ? [eq(intelligentAlerts.monitorConfigId, projectId)] : [];
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [
      totalCount,
      statusStats,
      severityStats,
      typeStats,
      resolutionStats,
      autoRemediationStats
    ] = await Promise.all([
      this.db.select({ count: count() }).from(intelligentAlerts).where(whereClause),
      this.db
        .select({
          status: intelligentAlerts.status,
          count: count()
        })
        .from(intelligentAlerts)
        .where(whereClause)
        .groupBy(intelligentAlerts.status),
      this.db
        .select({
          severity: intelligentAlerts.severity,
          count: count()
        })
        .from(intelligentAlerts)
        .where(whereClause)
        .groupBy(intelligentAlerts.severity),
      this.db
        .select({
          alertType: intelligentAlerts.alertType,
          count: count()
        })
        .from(intelligentAlerts)
        .where(whereClause)
        .groupBy(intelligentAlerts.alertType),
      this.db
        .select({
          avgTime: sql<number>`AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))`
        })
        .from(intelligentAlerts)
        .where(and(
          whereClause,
          eq(intelligentAlerts.status, 'resolved')
        )),
      this.db
        .select({
          total: count(),
          autoRemediated: count(intelligentAlerts.autoRemediationApplied)
        })
        .from(intelligentAlerts)
        .where(whereClause)
    ]);

    const byStatus = {} as Record<AlertStatus, number>;
    const bySeverity = {} as Record<AlertSeverity, number>;
    const byType = {} as Record<AlertType, number>;

    statusStats.forEach(stat => {
      if (stat.status) {
        byStatus[stat.status] = stat.count;
      }
    });

    severityStats.forEach(stat => {
      if (stat.severity) {
        bySeverity[stat.severity] = stat.count;
      }
    });

    typeStats.forEach(stat => {
      if (stat.alertType) {
        byType[stat.alertType] = stat.count;
      }
    });

    const total = totalCount[0]?.count || 0;
    const avgResolutionTime = resolutionStats[0]?.avgTime || 0;
    const autoRemediationRate = total > 0 
      ? (autoRemediationStats[0]?.autoRemediated || 0) / total 
      : 0;

    return {
      total,
      byStatus,
      bySeverity,
      byType,
      avgResolutionTime,
      autoRemediationRate
    };
  }

  // 批量更新状态
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

    await this.db
      .update(intelligentAlerts)
      .set(updateData)
      .where(inArray(intelligentAlerts.id, alertIds));
    
    return alertIds.length;
  }

  // 删除告警
  async deleteAlert(id: string): Promise<boolean> {
    await this.db
      .delete(intelligentAlerts)
      .where(eq(intelligentAlerts.id, id));
    return true;
  }

  // 批量删除告警
  async batchDeleteAlerts(alertIds: string[]): Promise<number> {
    await this.db
      .delete(intelligentAlerts)
      .where(inArray(intelligentAlerts.id, alertIds));
    return alertIds.length;
  }

  // 获取相关告警
  async getRelatedAlerts(
    alertId: string,
    limit: number = 10
  ): Promise<IntelligentAlert[]> {
    const alert = await this.getAlertById(alertId);
    if (!alert) {
      return [];
    }

    const relatedAlerts = await this.db
      .select()
      .from(intelligentAlerts)
      .where(
        and(
          eq(intelligentAlerts.rootCauseComponent, alert.rootCauseComponent || ''),
          eq(intelligentAlerts.severity, alert.severity)
        )
      )
      .limit(limit);

    return relatedAlerts;
  }

  // 执行根因分析
  async performRootCauseAnalysis(alertId: string): Promise<{
    category: 'performance' | 'availability' | 'security' | 'capacity' | 'configuration';
    component: string;
    description: string;
    confidence: number;
    suggestedActions: string[];
  }> {
    const alert = await this.getAlertById(alertId);
    if (!alert) {
      throw new Error('Alert not found');
    }

    // 这里应该集成AI分析逻辑
    const category = (alert.rootCauseCategory as 'performance' | 'availability' | 'security' | 'capacity' | 'configuration') || 'performance';
    
    return {
      category,
      component: alert.rootCauseComponent || 'unknown',
      description: alert.rootCauseDescription || 'No description available',
      confidence: Number(alert.aiConfidence) || 0,
      suggestedActions: []
    };
  }

  // 生成预测性告警
  async generatePredictiveAlert(
    monitorConfigId: string,
    predictionHorizon: number
  ): Promise<IntelligentAlert | null> {
    // 这里应该集成预测分析逻辑
    const alertData: NewIntelligentAlert = {
      monitorConfigId,
      alertType: 'prediction',
      severity: 'warning',
      title: 'Predicted Issue',
      description: 'System analysis predicts potential issue',
      aiConfidence: '0.75',
      predictionHorizon,
      probabilityScore: '0.80'
    };

    return this.createAlert(alertData);
  }
}