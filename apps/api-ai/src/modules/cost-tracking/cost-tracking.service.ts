import { Injectable } from '@nestjs/common';
import { eq, and, desc, asc, count, sql, gte, lte, inArray } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import { costTracking, type CostTracking, type NewCostTracking, type UpdateCostTracking } from '../../database/schemas/cost-tracking.schema';

@Injectable()
export class CostTrackingService {
  constructor(@InjectDatabase() private readonly db: Database) {}

  // 创建成本记录
  async create(data: NewCostTracking): Promise<CostTracking> {
    const [result] = await this.db
      .insert(costTracking)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();
    return result;
  }

  // 根据ID获取成本记录
  async findById(id: string): Promise<CostTracking | null> {
    const [result] = await this.db
      .select()
      .from(costTracking)
      .where(eq(costTracking.id, id))
      .limit(1);
    return result || null;
  }

  // 根据项目获取成本记录
  async findByProject(projectId: string, limit = 50, offset = 0): Promise<CostTracking[]> {
    return await this.db
      .select()
      .from(costTracking)
      .where(eq(costTracking.projectId, projectId))
      .orderBy(desc(costTracking.period))
      .limit(limit)
      .offset(offset);
  }

  // 根据组织获取成本记录
  async findByOrganization(organizationId: string, limit = 50, offset = 0): Promise<CostTracking[]> {
    return await this.db
      .select()
      .from(costTracking)
      .where(eq(costTracking.organizationId, organizationId))
      .orderBy(desc(costTracking.period))
      .limit(limit)
      .offset(offset);
  }

  // 根据时间周期获取成本记录
  async findByPeriod(organizationId: string, period: string): Promise<CostTracking[]> {
    return await this.db
      .select()
      .from(costTracking)
      .where(and(
        eq(costTracking.organizationId, organizationId),
        eq(costTracking.period, period)
      ))
      .orderBy(desc(costTracking.totalCost));
  }

  // 获取时间范围内的成本记录
  async findByPeriodRange(
    organizationId: string,
    startPeriod: string,
    endPeriod: string,
    projectId?: string
  ): Promise<CostTracking[]> {
    const conditions = [
      eq(costTracking.organizationId, organizationId),
      gte(costTracking.period, startPeriod),
      lte(costTracking.period, endPeriod)
    ];

    if (projectId) {
      conditions.push(eq(costTracking.projectId, projectId));
    }

    return await this.db
      .select()
      .from(costTracking)
      .where(and(...conditions))
      .orderBy(asc(costTracking.period));
  }

  // 更新成本记录
  async update(id: string, data: UpdateCostTracking): Promise<CostTracking | null> {
    const [result] = await this.db
      .update(costTracking)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(costTracking.id, id))
      .returning();
    return result || null;
  }

  // 删除成本记录
  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(costTracking)
      .where(eq(costTracking.id, id));
    return true;
  }

  // 批量删除成本记录
  async batchDelete(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    
    await this.db
      .delete(costTracking)
      .where(inArray(costTracking.id, ids));
    return ids.length;
  }

  // 获取成本统计信息
  async getCostStats(organizationId: string, projectId?: string): Promise<{
    totalCost: number;
    avgCost: number;
    maxCost: number;
    minCost: number;
    recordCount: number;
    costBreakdown: {
      compute: number;
      storage: number;
      network: number;
      database: number;
      monitoring: number;
    };
  }> {
    const conditions = [eq(costTracking.organizationId, organizationId)];
    if (projectId) {
      conditions.push(eq(costTracking.projectId, projectId));
    }

    const [stats] = await this.db
      .select({
        totalCost: sql<number>`COALESCE(SUM(${costTracking.totalCost}), 0)`,
        avgCost: sql<number>`COALESCE(AVG(${costTracking.totalCost}), 0)`,
        maxCost: sql<number>`COALESCE(MAX(${costTracking.totalCost}), 0)`,
        minCost: sql<number>`COALESCE(MIN(${costTracking.totalCost}), 0)`,
        recordCount: sql<number>`COUNT(*)`,
        computeTotal: sql<number>`COALESCE(SUM(${costTracking.computeCost}), 0)`,
        storageTotal: sql<number>`COALESCE(SUM(${costTracking.storageCost}), 0)`,
        networkTotal: sql<number>`COALESCE(SUM(${costTracking.networkCost}), 0)`,
        databaseTotal: sql<number>`COALESCE(SUM(${costTracking.databaseCost}), 0)`,
        monitoringTotal: sql<number>`COALESCE(SUM(${costTracking.monitoringCost}), 0)`,
      })
      .from(costTracking)
      .where(and(...conditions));

    return {
      totalCost: Number(stats.totalCost),
      avgCost: Number(stats.avgCost),
      maxCost: Number(stats.maxCost),
      minCost: Number(stats.minCost),
      recordCount: Number(stats.recordCount),
      costBreakdown: {
        compute: Number(stats.computeTotal),
        storage: Number(stats.storageTotal),
        network: Number(stats.networkTotal),
        database: Number(stats.databaseTotal),
        monitoring: Number(stats.monitoringTotal),
      },
    };
  }

  // 获取成本趋势分析
  async getCostTrend(
    organizationId: string,
    months: number = 12,
    projectId?: string
  ): Promise<Array<{
    period: string;
    totalCost: number;
    computeCost: number;
    storageCost: number;
    networkCost: number;
    databaseCost: number;
    monitoringCost: number;
    changePercent: number;
  }>> {
    const conditions = [eq(costTracking.organizationId, organizationId)];
    if (projectId) {
      conditions.push(eq(costTracking.projectId, projectId));
    }

    const results = await this.db
      .select({
        period: costTracking.period,
        totalCost: sql<number>`COALESCE(SUM(${costTracking.totalCost}), 0)`,
        computeCost: sql<number>`COALESCE(SUM(${costTracking.computeCost}), 0)`,
        storageCost: sql<number>`COALESCE(SUM(${costTracking.storageCost}), 0)`,
        networkCost: sql<number>`COALESCE(SUM(${costTracking.networkCost}), 0)`,
        databaseCost: sql<number>`COALESCE(SUM(${costTracking.databaseCost}), 0)`,
        monitoringCost: sql<number>`COALESCE(SUM(${costTracking.monitoringCost}), 0)`,
      })
      .from(costTracking)
      .where(and(...conditions))
      .groupBy(costTracking.period)
      .orderBy(desc(costTracking.period))
      .limit(months);

    // 计算环比变化
    return results.map((item, index) => {
      const prevItem = results[index + 1];
      const changePercent = prevItem 
        ? ((Number(item.totalCost) - Number(prevItem.totalCost)) / Number(prevItem.totalCost)) * 100
        : 0;

      return {
        period: item.period,
        totalCost: Number(item.totalCost),
        computeCost: Number(item.computeCost),
        storageCost: Number(item.storageCost),
        networkCost: Number(item.networkCost),
        databaseCost: Number(item.databaseCost),
        monitoringCost: Number(item.monitoringCost),
        changePercent: Number(changePercent.toFixed(2)),
      };
    });
  }

  // 获取成本预算对比
  async getCostBudgetComparison(
    organizationId: string,
    period: string,
    budgetAmount: number
  ): Promise<{
    actualCost: number;
    budgetAmount: number;
    variance: number;
    variancePercent: number;
    isOverBudget: boolean;
    projectBreakdown: Array<{
      projectId: string;
      actualCost: number;
      budgetPercent: number;
    }>;
  }> {
    const [totalStats] = await this.db
      .select({
        actualCost: sql<number>`COALESCE(SUM(${costTracking.totalCost}), 0)`,
      })
      .from(costTracking)
      .where(and(
        eq(costTracking.organizationId, organizationId),
        eq(costTracking.period, period)
      ));

    const projectStats = await this.db
      .select({
        projectId: costTracking.projectId,
        actualCost: sql<number>`COALESCE(SUM(${costTracking.totalCost}), 0)`,
      })
      .from(costTracking)
      .where(and(
        eq(costTracking.organizationId, organizationId),
        eq(costTracking.period, period)
      ))
      .groupBy(costTracking.projectId);

    const actualCost = Number(totalStats.actualCost);
    const variance = actualCost - budgetAmount;
    const variancePercent = budgetAmount > 0 ? (variance / budgetAmount) * 100 : 0;

    return {
      actualCost,
      budgetAmount,
      variance,
      variancePercent: Number(variancePercent.toFixed(2)),
      isOverBudget: actualCost > budgetAmount,
      projectBreakdown: projectStats.map(item => ({
        projectId: item.projectId || '',
        actualCost: Number(item.actualCost),
        budgetPercent: budgetAmount > 0 ? (Number(item.actualCost) / budgetAmount) * 100 : 0,
      })),
    };
  }

  // 生成成本优化建议
  async generateOptimizationTips(
    organizationId: string,
    projectId?: string
  ): Promise<string[]> {
    const stats = await this.getCostStats(organizationId, projectId);
    const tips: string[] = [];

    // 基于成本分布生成建议
    const { costBreakdown } = stats;
    const total = stats.totalCost;

    if (total === 0) {
      return ['暂无成本数据，无法生成优化建议'];
    }

    // 计算各项成本占比
    const computePercent = (costBreakdown.compute / total) * 100;
    const storagePercent = (costBreakdown.storage / total) * 100;
    const networkPercent = (costBreakdown.network / total) * 100;
    const databasePercent = (costBreakdown.database / total) * 100;
    const monitoringPercent = (costBreakdown.monitoring / total) * 100;

    // 生成针对性建议
    if (computePercent > 50) {
      tips.push('计算成本占比过高，建议优化实例规格或启用自动扩缩容');
    }
    if (storagePercent > 30) {
      tips.push('存储成本较高，建议清理无用数据或使用更经济的存储类型');
    }
    if (networkPercent > 20) {
      tips.push('网络成本较高，建议优化数据传输或使用CDN');
    }
    if (databasePercent > 25) {
      tips.push('数据库成本较高，建议优化查询性能或调整实例配置');
    }
    if (monitoringPercent > 15) {
      tips.push('监控成本较高，建议优化监控指标或调整采集频率');
    }

    if (tips.length === 0) {
      tips.push('成本分布合理，建议持续监控和定期评估');
    }

    return tips;
  }
}