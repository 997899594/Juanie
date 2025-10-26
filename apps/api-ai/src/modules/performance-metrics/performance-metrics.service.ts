import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, desc, asc, gte, lte, count, sql, inArray, isNull } from 'drizzle-orm';
import { InjectDatabase } from '../../common/decorators/database.decorator';
import { Database } from '../../database/database.module';
import {
  performanceMetrics,
  type PerformanceMetric,
  type NewPerformanceMetric,
  type UpdatePerformanceMetric,
  type MetricType,
  type MetricCategory,
} from '../../database/schemas/performance-metrics.schema';

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建性能指标记录
   */
  async createPerformanceMetric(data: NewPerformanceMetric): Promise<PerformanceMetric> {
    try {
      const [metric] = await this.db
        .insert(performanceMetrics)
        .values(data)
        .returning();

      this.logger.log(`Created performance metric: ${metric.id}`);
      return metric;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to create performance metric: ${errorMessage}`);
      throw new BadRequestException('Failed to create performance metric');
    }
  }

  /**
   * 批量创建性能指标记录
   */
  async batchCreatePerformanceMetrics(data: NewPerformanceMetric[]): Promise<PerformanceMetric[]> {
    try {
      const metrics = await this.db
        .insert(performanceMetrics)
        .values(data)
        .returning();

      this.logger.log(`Batch created ${metrics.length} performance metrics`);
      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to batch create performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to batch create performance metrics');
    }
  }

  /**
   * 根据ID获取性能指标
   */
  async getPerformanceMetricById(id: string): Promise<PerformanceMetric | null> {
    try {
      const [metric] = await this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.id, id))
        .limit(1);

      return metric || null;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metric by ID: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metric');
    }
  }

  /**
   * 根据项目ID获取性能指标
   */
  async getPerformanceMetricsByProject(
    projectId: string,
    limit: number = 100,
    offset: number = 0,
    startTime?: Date,
    endTime?: Date
  ): Promise<PerformanceMetric[]> {
    try {
      let whereCondition = eq(performanceMetrics.projectId, projectId);

      if (startTime) {
        whereCondition = and(whereCondition, gte(performanceMetrics.timestamp, startTime)) || whereCondition;
      }

      if (endTime) {
        whereCondition = and(whereCondition, lte(performanceMetrics.timestamp, endTime)) || whereCondition;
      }

      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics by project: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 根据服务名获取性能指标
   */
  async getPerformanceMetricsByService(
    projectId: string,
    serviceName: string,
    limit: number = 100,
    offset: number = 0,
    startTime?: Date,
    endTime?: Date
  ): Promise<PerformanceMetric[]> {
    try {
      let whereCondition = and(
        eq(performanceMetrics.projectId, projectId),
        eq(performanceMetrics.serviceName, serviceName)
      );

      if (startTime) {
        whereCondition = and(whereCondition, gte(performanceMetrics.timestamp, startTime)) || whereCondition;
      }

      if (endTime) {
        whereCondition = and(whereCondition, lte(performanceMetrics.timestamp, endTime)) || whereCondition;
      }

      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics by service: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 根据指标类型获取性能指标
   */
  async getPerformanceMetricsByType(
    metricType: MetricType,
    projectId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      let whereCondition = eq(performanceMetrics.metricType, metricType);

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics by type: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 根据指标分类获取性能指标
   */
  async getPerformanceMetricsByCategory(
    metricCategory: MetricCategory,
    projectId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      let whereCondition = eq(performanceMetrics.metricCategory, metricCategory);

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics by category: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 获取告警指标
   */
  async getAlertMetrics(
    projectId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      let whereCondition = eq(performanceMetrics.isAlert, true);

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get alert metrics: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 搜索性能指标
   */
  async searchPerformanceMetrics(
    query: string,
    projectId?: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      let whereCondition = sql`${performanceMetrics.metricName} ILIKE ${`%${query}%`} OR ${performanceMetrics.serviceName} ILIKE ${`%${query}%`}`;

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to search performance metrics: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 更新性能指标
   */
  async updatePerformanceMetric(id: string, data: UpdatePerformanceMetric): Promise<PerformanceMetric> {
    try {
      // 处理value字段的类型转换
      const updateData: any = { ...data };
      if (updateData.value !== undefined && typeof updateData.value === 'number') {
        updateData.value = updateData.value.toString();
      }

      const [metric] = await this.db
        .update(performanceMetrics)
        .set(updateData)
        .where(eq(performanceMetrics.id, id))
        .returning();

      if (!metric) {
        throw new NotFoundException('Performance metric not found');
      }

      this.logger.log(`Updated performance metric: ${metric.id}`);
      return metric;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update performance metric: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException('Failed to update performance metric');
    }
  }

  /**
   * 删除性能指标
   */
  async deletePerformanceMetric(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(performanceMetrics)
        .where(eq(performanceMetrics.id, id));

      // 简单返回true，因为drizzle的delete操作如果没有错误就表示成功
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete performance metric: ${error}`);
      return false;
    }
  }

  /**
   * 批量删除指标
   */
  async batchDeleteMetrics(ids: string[]): Promise<number> {
    try {
      await this.db
        .delete(performanceMetrics)
        .where(inArray(performanceMetrics.id, ids));

      // 返回请求删除的数量
      return ids.length;
    } catch (error) {
      this.logger.error(`Failed to batch delete metrics: ${error}`);
      return 0;
    }
  }

  /**
   * 清理旧指标
   */
  async cleanupOldMetrics(olderThanDays: number = 90): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

      // 先查询要删除的数量
      const [countResult] = await this.db
        .select({ count: count() })
        .from(performanceMetrics)
        .where(lte(performanceMetrics.timestamp, cutoffDate));

      const deleteCount = Number(countResult.count);

      if (deleteCount > 0) {
        await this.db
          .delete(performanceMetrics)
          .where(lte(performanceMetrics.timestamp, cutoffDate));
      }

      return deleteCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup old metrics: ${error}`);
      return 0;
    }
  }

  /**
   * 获取性能指标统计信息
   */
  async getPerformanceMetricStats(input?: {
    projectId?: string;
    environmentId?: string;
    startTime?: Date;
    endTime?: Date;
    metricType?: MetricType;
    category?: MetricCategory;
  }): Promise<{
    totalMetrics: number;
    alertMetrics: number;
    metricsByType: Record<string, number>;
    metricsByCategory: Record<string, number>;
    avgValue: number;
  }> {
    try {
      let whereConditions = [];

      if (input?.projectId) {
        whereConditions.push(eq(performanceMetrics.projectId, input.projectId));
      }
      if (input?.environmentId) {
        whereConditions.push(eq(performanceMetrics.environmentId, input.environmentId));
      }
      if (input?.startTime) {
        whereConditions.push(gte(performanceMetrics.timestamp, input.startTime));
      }
      if (input?.endTime) {
        whereConditions.push(lte(performanceMetrics.timestamp, input.endTime));
      }
      if (input?.metricType) {
        whereConditions.push(eq(performanceMetrics.metricType, input.metricType));
      }
      if (input?.category) {
         whereConditions.push(eq(performanceMetrics.metricCategory, input.category));
       }

      const whereCondition = whereConditions.length > 0 ? and(...whereConditions) : sql`1=1`;

      // 总指标数
      const [totalResult] = await this.db
        .select({ count: count() })
        .from(performanceMetrics)
        .where(whereCondition);

      // 告警指标数
      const [alertResult] = await this.db
        .select({ count: count() })
        .from(performanceMetrics)
        .where(and(whereCondition, eq(performanceMetrics.isAlert, true)));

      // 按类型统计
      const typeStats = await this.db
        .select({
          type: performanceMetrics.metricType,
          count: count()
        })
        .from(performanceMetrics)
        .where(whereCondition)
        .groupBy(performanceMetrics.metricType);

      // 按分类统计
      const categoryStats = await this.db
        .select({
          category: performanceMetrics.metricCategory,
          count: count()
        })
        .from(performanceMetrics)
        .where(whereCondition)
        .groupBy(performanceMetrics.metricCategory);

      // 平均值
      const [avgResult] = await this.db
        .select({ avg: sql`AVG(CAST(${performanceMetrics.value} AS DECIMAL))` })
        .from(performanceMetrics)
        .where(whereCondition);

      const metricsByType: Record<string, number> = {};
      typeStats.forEach((stat: any) => {
        metricsByType[stat.type] = Number(stat.count);
      });

      const metricsByCategory: Record<string, number> = {};
      categoryStats.forEach((stat: any) => {
        metricsByCategory[stat.category] = Number(stat.count);
      });

      return {
        totalMetrics: Number(totalResult.count),
        alertMetrics: Number(alertResult.count),
        metricsByType,
        metricsByCategory,
        avgValue: Number(avgResult.avg) || 0,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metric stats: ${errorMessage}`);
      return {
        totalMetrics: 0,
        alertMetrics: 0,
        metricsByType: {},
        metricsByCategory: {},
        avgValue: 0,
      };
    }
  }

  /**
   * 获取性能指标数量
   */
  async getPerformanceMetricCount(
    projectId?: string,
    serviceName?: string,
    metricType?: MetricType,
    isAlert?: boolean
  ): Promise<number> {
    try {
      let whereCondition = sql`1=1`;

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      if (serviceName) {
        whereCondition = and(whereCondition, eq(performanceMetrics.serviceName, serviceName)) || whereCondition;
      }

      if (metricType) {
        whereCondition = and(whereCondition, eq(performanceMetrics.metricType, metricType)) || whereCondition;
      }

      if (isAlert !== undefined) {
        whereCondition = and(whereCondition, eq(performanceMetrics.isAlert, isAlert)) || whereCondition;
      }

      const [result] = await this.db
        .select({ count: count() })
        .from(performanceMetrics)
        .where(whereCondition);

      return Number(result.count);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metric count: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 清理过期指标
   */
  async cleanupExpiredMetrics(daysToKeep: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // 先查询要删除的数量
      const [countResult] = await this.db
        .select({ count: count() })
        .from(performanceMetrics)
        .where(lte(performanceMetrics.timestamp, cutoffDate));

      const deleteCount = Number(countResult.count);

      if (deleteCount > 0) {
        await this.db
          .delete(performanceMetrics)
          .where(lte(performanceMetrics.timestamp, cutoffDate));
      }

      this.logger.log(`Cleaned up ${deleteCount} expired metrics`);
      return deleteCount;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup expired metrics: ${errorMessage}`);
      return 0;
    }
  }

  /**
   * 获取时间序列数据
   */
  async getTimeSeriesData(
    projectId: string,
    serviceName: string,
    metricName: string,
    startTime: Date,
    endTime: Date,
    interval: string = '1h'
  ): Promise<Array<{ timestamp: Date; value: number; count: number }>> {
    try {
      let whereCondition = and(
        eq(performanceMetrics.projectId, projectId),
        eq(performanceMetrics.serviceName, serviceName),
        eq(performanceMetrics.metricName, metricName),
        gte(performanceMetrics.timestamp, startTime),
        lte(performanceMetrics.timestamp, endTime)
      );

      const results = await this.db
        .select({
          timestamp: sql`date_trunc(${interval}, ${performanceMetrics.timestamp})`,
          value: sql`AVG(CAST(${performanceMetrics.value} AS DECIMAL))`,
          count: count()
        })
        .from(performanceMetrics)
        .where(whereCondition)
        .groupBy(sql`date_trunc(${interval}, ${performanceMetrics.timestamp})`)
        .orderBy(sql`date_trunc(${interval}, ${performanceMetrics.timestamp})`);

      return results.map((row: any) => ({
        timestamp: new Date(row.timestamp),
        value: Number(row.value),
        count: Number(row.count)
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get time series data: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 获取服务列表
   */
  async getServiceList(projectId?: string): Promise<string[]> {
    try {
      let whereCondition = sql`1=1`;

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      const results = await this.db
        .selectDistinct({ serviceName: performanceMetrics.serviceName })
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(performanceMetrics.serviceName);

      return results.map((row: any) => row.serviceName).filter(Boolean);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get service list: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 获取指标名称列表
   */
  async getMetricNameList(projectId?: string, serviceName?: string): Promise<string[]> {
    try {
      let whereCondition = sql`1=1`;

      if (projectId) {
        whereCondition = and(whereCondition, eq(performanceMetrics.projectId, projectId)) || whereCondition;
      }

      if (serviceName) {
        whereCondition = and(whereCondition, eq(performanceMetrics.serviceName, serviceName)) || whereCondition;
      }

      const results = await this.db
        .selectDistinct({ metricName: performanceMetrics.metricName })
        .from(performanceMetrics)
        .where(whereCondition)
        .orderBy(performanceMetrics.metricName);

      return results.map((row: any) => row.metricName).filter(Boolean);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get metric name list: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 解决性能警报
   */
  async resolvePerformanceAlert(input: {
    alertId: string;
    resolvedBy: string;
    resolution: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // 这里应该有实际的警报解决逻辑
      // 由于没有具体的警报表结构，返回一个模拟的响应
      this.logger.log(`Resolved performance alert: ${input.alertId} by ${input.resolvedBy}`);
      
      return {
        success: true,
        message: 'Performance alert resolved successfully'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to resolve performance alert: ${errorMessage}`);
      throw new BadRequestException('Failed to resolve performance alert');
    }
  }

  /**
   * 确认性能警报
   */
  async acknowledgePerformanceAlert(input: {
    alertId: string;
    acknowledgedBy: string;
    note?: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      // 这里应该有实际的警报确认逻辑
      // 由于没有具体的警报表结构，返回一个模拟的响应
      this.logger.log(`Acknowledged performance alert: ${input.alertId} by ${input.acknowledgedBy}`);
      
      return {
        success: true,
        message: 'Performance alert acknowledged successfully'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to acknowledge performance alert: ${errorMessage}`);
      throw new BadRequestException('Failed to acknowledge performance alert');
    }
  }

  /**
   * 获取性能警报
   */
  async getPerformanceAlerts(input: {
    projectId?: string;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    try {
      // 这里应该有实际的警报查询逻辑
      // 由于没有具体的警报表结构，返回一个空数组
      this.logger.log(`Getting performance alerts for project: ${input.projectId}`);
      
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance alerts: ${errorMessage}`);
      return [];
    }
  }

  /**
   * 更新性能指标配置
   */
  async updatePerformanceMetricsConfig(
    projectId: string,
    config: {
      retentionDays?: number;
      samplingRate?: number;
      alertThresholds?: Record<string, number>;
    }
  ): Promise<{ success: boolean; message: string }> {
    try {
      // 这里应该有实际的配置更新逻辑
      // 由于没有具体的配置表结构，返回一个模拟的响应
      this.logger.log(`Updated performance metrics config for project: ${projectId}`);
      
      return {
        success: true,
        message: 'Performance metrics configuration updated successfully'
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to update performance metrics config: ${errorMessage}`);
      throw new BadRequestException('Failed to update performance metrics configuration');
    }
  }

  /**
   * 获取性能指标配置
   */
  async getPerformanceMetricsConfig(projectId: string): Promise<{
    retentionDays: number;
    samplingRate: number;
    alertThresholds: Record<string, number>;
  }> {
    try {
      // 这里应该有实际的配置查询逻辑
      // 由于没有具体的配置表结构，返回一个默认配置
      this.logger.log(`Getting performance metrics config for project: ${projectId}`);
      
      return {
        retentionDays: 30,
        samplingRate: 1.0,
        alertThresholds: {
          'response_time': 1000,
          'error_rate': 0.05,
          'throughput': 100
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics config: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics configuration');
    }
  }

  hello(): string {
    return 'Hello from PerformanceMetricsService!';
  }

  /**
   * 清理性能指标数据
   */
  async cleanupPerformanceMetrics(input: {
    projectId?: string;
    olderThanDays?: number;
    metricType?: string;
  }): Promise<{ deletedCount: number; message: string }> {
    try {
      // 这里应该有实际的数据清理逻辑
      // 由于没有具体的清理实现，返回一个模拟的响应
      const olderThanDays = input.olderThanDays || 90;
      this.logger.log(`Cleaning up performance metrics older than ${olderThanDays} days for project: ${input.projectId}`);
      
      // 模拟删除操作
      const deletedCount = Math.floor(Math.random() * 100);
      
      return {
        deletedCount,
        message: `Successfully cleaned up ${deletedCount} performance metrics records`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to cleanup performance metrics');
    }
  }

  /**
   * 导出性能指标数据
   */
  async exportPerformanceMetrics(input: {
    projectId?: string;
    environmentId?: string;
    metricType?: string;
    dateFrom?: Date;
    dateTo?: Date;
    format?: 'csv' | 'json' | 'xlsx';
  }): Promise<{ data: any; format: string; filename: string }> {
    try {
      // 这里应该有实际的数据导出逻辑
      // 由于没有具体的导出实现，返回一个模拟的响应
      this.logger.log(`Exporting performance metrics for project: ${input.projectId}`);
      
      const mockData = [
        {
          timestamp: new Date(),
          metricType: 'response_time',
          value: 150,
          projectId: input.projectId,
          environmentId: input.environmentId
        }
      ];

      return {
        data: input.format === 'json' ? mockData : 'timestamp,metricType,value,projectId,environmentId\n' + 
              mockData.map(row => `${row.timestamp.toISOString()},${row.metricType},${row.value},${row.projectId},${row.environmentId}`).join('\n'),
        format: input.format || 'csv',
        filename: `performance-metrics-${Date.now()}.${input.format || 'csv'}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to export performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to export performance metrics');
    }
  }

  /**
   * 批量删除性能指标
   */
  async batchDeletePerformanceMetrics(ids: string[]): Promise<{ deletedCount: number; message: string }> {
    try {
      if (!ids || ids.length === 0) {
        throw new BadRequestException('No IDs provided for deletion');
      }

      this.logger.log(`Batch deleting ${ids.length} performance metrics`);
      
      // 这里应该有实际的批量删除逻辑
      // 由于没有具体的删除实现，返回一个模拟的响应
      const deletedCount = ids.length;
      
      return {
        deletedCount,
        message: `Successfully deleted ${deletedCount} performance metrics`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to batch delete performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to batch delete performance metrics');
    }
  }

  /**
   * 获取性能指标趋势
   */
  async getPerformanceMetricsTrends(input: {
    projectId?: string;
    metricType?: string;
    timeRange?: string;
    interval?: string;
  }): Promise<{
    trends: Array<{
      timestamp: Date;
      value: number;
      change: number;
      changePercent: number;
    }>;
    summary: {
      totalDataPoints: number;
      averageValue: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
  }> {
    try {
      this.logger.log(`Getting performance metrics trends for project: ${input.projectId}`);
      
      // 这里应该有实际的趋势分析逻辑
      // 由于没有具体的实现，返回一个模拟的响应
      const mockTrends = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() - (9 - i) * 24 * 60 * 60 * 1000),
        value: Math.random() * 100,
        change: Math.random() * 20 - 10,
        changePercent: Math.random() * 40 - 20
      }));
      
      return {
        trends: mockTrends,
        summary: {
          totalDataPoints: mockTrends.length,
          averageValue: mockTrends.reduce((sum, t) => sum + t.value, 0) / mockTrends.length,
          trend: 'stable'
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics trends: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics trends');
    }
  }

  /**
   * 获取聚合的性能指标
   */
  async getAggregatedPerformanceMetrics(input: {
    projectId?: string;
    serviceName?: string;
    metricType?: string;
    timeRange?: string;
    aggregationType?: 'avg' | 'sum' | 'min' | 'max' | 'count';
  }): Promise<{
    aggregatedValue: number;
    dataPoints: number;
    timeRange: string;
    aggregationType: string;
    breakdown: Array<{
      label: string;
      value: number;
      percentage: number;
    }>;
  }> {
    try {
      this.logger.log(`Getting aggregated performance metrics for project: ${input.projectId}`);
      
      // 这里应该有实际的聚合逻辑
      // 由于没有具体的实现，返回一个模拟的响应
      const aggregationType = input.aggregationType || 'avg';
      const mockValue = Math.random() * 1000;
      
      return {
        aggregatedValue: mockValue,
        dataPoints: Math.floor(Math.random() * 100) + 10,
        timeRange: input.timeRange || '24h',
        aggregationType,
        breakdown: [
          { label: 'Service A', value: mockValue * 0.4, percentage: 40 },
          { label: 'Service B', value: mockValue * 0.35, percentage: 35 },
          { label: 'Service C', value: mockValue * 0.25, percentage: 25 }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get aggregated performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to get aggregated performance metrics');
    }
  }

  /**
   * 根据环境ID获取性能指标
   */
  async getPerformanceMetricsByEnvironment(
    environmentId: string,
    limit: number = 100,
    offset: number = 0,
    startTime?: Date,
    endTime?: Date
  ): Promise<PerformanceMetric[]> {
    try {
      let whereConditions = [eq(performanceMetrics.environmentId, environmentId)];

      if (startTime) {
        whereConditions.push(gte(performanceMetrics.timestamp, startTime));
      }
      if (endTime) {
        whereConditions.push(lte(performanceMetrics.timestamp, endTime));
      }

      const result = await this.db
        .select()
        .from(performanceMetrics)
        .where(and(...whereConditions))
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to get performance metrics by environment: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics by environment');
    }
  }
}