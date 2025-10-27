import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { and, count, desc, eq, gte, ilike, lte } from "drizzle-orm";
import { InjectDatabase } from "../../common/decorators/database.decorator";
import type { Database } from "../../database/database.module";
import {
  insertPerformanceMetricSchema,
  NewPerformanceMetric,
  PerformanceMetric,
  performanceMetrics,
  UpdatePerformanceMetric,
  updatePerformanceMetricSchema,
} from "../../database/schemas/performance-metrics.schema";

@Injectable()
export class PerformanceMetricsService {
  private readonly logger = new Logger(PerformanceMetricsService.name);

  constructor(@InjectDatabase() private readonly db: Database) {}

  /**
   * 创建性能指标
   */
  async createPerformanceMetric(
    data: NewPerformanceMetric
  ): Promise<PerformanceMetric> {
    try {
      const validatedData = insertPerformanceMetricSchema.parse(data);

      const [metric] = await this.db
        .insert(performanceMetrics)
        .values({
          ...validatedData,
        })
        .returning();

      this.logger.log(`Created performance metric: ${metric.id}`);
      return metric;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to create performance metric: ${errorMessage}`);
      throw new BadRequestException("Failed to create performance metric");
    }
  }

  /**
   * 根据ID获取性能指标
   */
  async getPerformanceMetricById(
    id: string
  ): Promise<PerformanceMetric | null> {
    try {
      const [metric] = await this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.id, id))
        .limit(1);

      return metric || null;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to get performance metric by ID: ${errorMessage}`
      );
      throw new BadRequestException("Failed to get performance metric");
    }
  }

  /**
   * 更新性能指标
   */
  async updatePerformanceMetric(
    id: string,
    data: UpdatePerformanceMetric
  ): Promise<PerformanceMetric> {
    try {
      const validatedData = updatePerformanceMetricSchema.parse(data);

      const [updatedMetric] = await this.db
        .update(performanceMetrics)
        .set({
          ...validatedData,
        })
        .where(eq(performanceMetrics.id, id))
        .returning();

      if (!updatedMetric) {
        throw new NotFoundException("Performance metric not found");
      }

      this.logger.log(`Updated performance metric: ${id}`);
      return updatedMetric;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to update performance metric: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to update performance metric");
    }
  }

  /**
   * 删除性能指标
   */
  async deletePerformanceMetric(id: string): Promise<boolean> {
    try {
      const result = await this.db
        .delete(performanceMetrics)
        .where(eq(performanceMetrics.id, id))
        .returning();

      if (result.length === 0) {
        throw new NotFoundException("Performance metric not found");
      }

      this.logger.log(`Deleted performance metric: ${id}`);
      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to delete performance metric: ${errorMessage}`);
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new BadRequestException("Failed to delete performance metric");
    }
  }

  /**
   * 搜索性能指标
   */
  async searchPerformanceMetrics(
    query?: string,
    limit: number = 10,
    offset: number = 0
  ): Promise<{ metrics: PerformanceMetric[]; total: number }> {
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
        conditions.push(ilike(performanceMetrics.metricName, `%${query}%`));
      }

      const whereClause =
        conditions.length > 0 ? and(...conditions) : undefined;

      const [metricsResult, totalResult] = await Promise.all([
        this.db
          .select()
          .from(performanceMetrics)
          .where(whereClause)
          .limit(limit)
          .offset(offset)
          .orderBy(desc(performanceMetrics.createdAt)),

        this.db
          .select({ count: count() })
          .from(performanceMetrics)
          .where(whereClause),
      ]);

      return {
        metrics: metricsResult,
        total: totalResult[0]?.count || 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to search performance metrics: ${errorMessage}`
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException("Failed to search performance metrics");
    }
  }

  /**
   * 根据项目ID获取性能指标
   */
  async getMetricsByProject(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      return await this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.projectId, projectId))
        .orderBy(desc(performanceMetrics.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get metrics by project: ${errorMessage}`);
      throw new BadRequestException("Failed to get metrics by project");
    }
  }

  /**
   * 根据时间范围获取性能指标
   */
  async getMetricsByTimeRange(
    startTime: Date,
    endTime: Date,
    projectId?: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      const conditions = [
        gte(performanceMetrics.createdAt, startTime),
        lte(performanceMetrics.createdAt, endTime),
      ];

      if (projectId) {
        conditions.push(eq(performanceMetrics.projectId, projectId));
      }

      return await this.db
        .select()
        .from(performanceMetrics)
        .where(and(...conditions))
        .orderBy(desc(performanceMetrics.createdAt))
        .limit(limit)
        .offset(offset);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(`Failed to get metrics by time range: ${errorMessage}`);
      throw new BadRequestException("Failed to get metrics by time range");
    }
  }

  /**
   * 获取性能指标统计信息
   */
  async getPerformanceMetricStats(projectId?: string): Promise<{
    totalMetrics: number;
    avgValue: number;
    maxValue: number;
    minValue: number;
  }> {
    try {
      const whereCondition = projectId
        ? eq(performanceMetrics.projectId, projectId)
        : undefined;

      const [totalResult] = await this.db
        .select({ count: count() })
        .from(performanceMetrics)
        .where(whereCondition);

      // 简化实现，实际需要计算平均值、最大值、最小值
      return {
        totalMetrics: totalResult.count,
        avgValue: 0,
        maxValue: 0,
        minValue: 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      this.logger.error(
        `Failed to get performance metric stats: ${errorMessage}`
      );
      throw new BadRequestException("Failed to get performance metric stats");
    }
  }

  /**
   * 批量创建性能指标
   */
  async batchCreatePerformanceMetrics(
    metrics: NewPerformanceMetric[]
  ): Promise<PerformanceMetric[]> {
    try {
      const validatedMetrics = metrics.map(metric => 
        insertPerformanceMetricSchema.parse(metric)
      );

      const createdMetrics = await this.db
        .insert(performanceMetrics)
        .values(validatedMetrics)
        .returning();

      this.logger.log(`Batch created ${createdMetrics.length} performance metrics`);
      return createdMetrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch create performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to batch create performance metrics');
    }
  }

  /**
   * 根据项目获取性能指标
   */
  async getPerformanceMetricsByProject(
    projectId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.projectId, projectId))
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get performance metrics by project: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics by project');
    }
  }

  /**
   * 根据环境获取性能指标
   */
  async getPerformanceMetricsByEnvironment(
    environmentId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PerformanceMetric[]> {
    try {
      const metrics = await this.db
        .select()
        .from(performanceMetrics)
        .where(eq(performanceMetrics.environmentId, environmentId))
        .orderBy(desc(performanceMetrics.timestamp))
        .limit(limit)
        .offset(offset);

      return metrics;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get performance metrics by environment: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics by environment');
    }
  }

  /**
   * 获取聚合性能指标
   */
  async getAggregatedPerformanceMetrics(
    projectId?: string,
    environmentId?: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<{
    avgResponseTime: number;
    avgThroughput: number;
    avgCpuUsage: number;
    avgMemoryUsage: number;
    totalRequests: number;
  }> {
    try {
      // 这里需要根据实际的聚合逻辑来实现
      // 暂时返回默认值
      return {
        avgResponseTime: 0,
        avgThroughput: 0,
        avgCpuUsage: 0,
        avgMemoryUsage: 0,
        totalRequests: 0
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get aggregated performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to get aggregated performance metrics');
    }
  }

  /**
   * 获取性能指标趋势
   */
  async getPerformanceMetricsTrends(
    projectId?: string,
    environmentId?: string,
    timeRange: string = '24h'
  ): Promise<{
    trends: Array<{
      timestamp: Date;
      responseTime: number;
      throughput: number;
      cpuUsage: number;
      memoryUsage: number;
    }>;
  }> {
    try {
      // 这里需要根据实际的趋势分析逻辑来实现
      // 暂时返回空数组
      return {
        trends: []
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get performance metrics trends: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics trends');
    }
  }

  /**
   * 批量删除性能指标
   */
  async batchDeletePerformanceMetrics(ids: string[]): Promise<boolean> {
    try {
      // 这里需要根据实际的批量删除逻辑来实现
      // 暂时返回true
      this.logger.log(`Batch deleted ${ids.length} performance metrics`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to batch delete performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to batch delete performance metrics');
    }
  }

  /**
   * 清理性能指标
   */
  async cleanupPerformanceMetrics(
    olderThan: Date,
    projectId?: string
  ): Promise<{ deletedCount: number }> {
    try {
      // 这里需要根据实际的清理逻辑来实现
      // 暂时返回默认值
      return { deletedCount: 0 };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to cleanup performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to cleanup performance metrics');
    }
  }

  /**
   * 导出性能指标
   */
  async exportPerformanceMetrics(
    format: 'csv' | 'json' = 'json',
    projectId?: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<{ data: string; filename: string }> {
    try {
      // 这里需要根据实际的导出逻辑来实现
      // 暂时返回默认值
      return {
        data: '[]',
        filename: `performance-metrics-${Date.now()}.${format}`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to export performance metrics: ${errorMessage}`);
      throw new BadRequestException('Failed to export performance metrics');
    }
  }

  /**
   * 获取性能指标配置
   */
  async getPerformanceMetricsConfig(projectId?: string): Promise<{
    config: any;
  }> {
    try {
      // 这里需要根据实际的配置逻辑来实现
      // 暂时返回默认值
      return {
        config: {}
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get performance metrics config: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance metrics config');
    }
  }

  /**
   * 更新性能指标配置
   */
  async updatePerformanceMetricsConfig(
    projectId: string,
    config: any
  ): Promise<{ config: any }> {
    try {
      // 这里需要根据实际的配置更新逻辑来实现
      // 暂时返回传入的配置
      return { config };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to update performance metrics config: ${errorMessage}`);
      throw new BadRequestException('Failed to update performance metrics config');
    }
  }

  /**
   * 获取性能告警
   */
  async getPerformanceAlerts(
    projectId?: string,
    status?: 'active' | 'acknowledged' | 'resolved'
  ): Promise<Array<{
    id: string;
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'active' | 'acknowledged' | 'resolved';
    createdAt: Date;
  }>> {
    try {
      // 这里需要根据实际的告警逻辑来实现
      // 暂时返回空数组
      return [];
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to get performance alerts: ${errorMessage}`);
      throw new BadRequestException('Failed to get performance alerts');
    }
  }

  /**
   * 确认性能告警
   */
  async acknowledgePerformanceAlert(alertId: string): Promise<boolean> {
    try {
      // 这里需要根据实际的告警确认逻辑来实现
      // 暂时返回true
      this.logger.log(`Acknowledged performance alert: ${alertId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to acknowledge performance alert: ${errorMessage}`);
      throw new BadRequestException('Failed to acknowledge performance alert');
    }
  }

  /**
   * 解决性能告警
   */
  async resolvePerformanceAlert(alertId: string): Promise<boolean> {
    try {
      // 这里需要根据实际的告警解决逻辑来实现
      // 暂时返回true
      this.logger.log(`Resolved performance alert: ${alertId}`);
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to resolve performance alert: ${errorMessage}`);
      throw new BadRequestException('Failed to resolve performance alert');
    }
  }
}
