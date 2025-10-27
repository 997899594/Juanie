import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { TrpcService } from '../../trpc/trpc.service';
import { PerformanceMetricsService } from './performance-metrics.service';
import {
  insertPerformanceMetricSchema,
  updatePerformanceMetricSchema,
  MetricTypeEnum,
  MetricCategoryEnum
} from '../../database/schemas/performance-metrics.schema';

@Injectable()
export class PerformanceMetricsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly performanceMetricsService: PerformanceMetricsService
  ) {}

  public get performanceMetricsRouter() {
    return this.trpc.router({
      // 创建性能指标
      create: this.trpc.protectedProcedure
        .input(insertPerformanceMetricSchema)
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.createPerformanceMetric(input);
        }),

      // 批量创建性能指标
      batchCreate: this.trpc.protectedProcedure
        .input(z.object({
          metrics: z.array(insertPerformanceMetricSchema).min(1).max(100),
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.batchCreatePerformanceMetrics(input.metrics);
        }),

      // 根据ID获取性能指标
      getById: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceMetricById(input.id);
        }),

      // 根据项目ID获取性能指标列表
      getByProject: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
          startTime: z.date().optional(),
          endTime: z.date().optional(),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceMetricsByProject(
            input.projectId
          );
        }),

      // 根据环境ID获取性能指标列表
      getByEnvironment: this.trpc.protectedProcedure
        .input(z.object({
          environmentId: z.string().uuid(),
          limit: z.number().min(1).max(1000).default(100),
          offset: z.number().min(0).default(0),
          startTime: z.date().optional(),
          endTime: z.date().optional(),
          metricType: MetricTypeEnum.optional(),
          category: MetricCategoryEnum.optional(),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceMetricsByEnvironment(
            input.environmentId
          );
        }),

      // 获取性能指标统计
      getStats: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          startTime: z.date().optional(),
          endTime: z.date().optional(),
          metricType: MetricTypeEnum.optional(),
          category: MetricCategoryEnum.optional(),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceMetricStats(input.projectId);
        }),

      // 获取性能指标聚合数据
      getAggregated: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          startTime: z.date().optional(),
          endTime: z.date().optional(),
          metricType: MetricTypeEnum.optional(),
          category: MetricCategoryEnum.optional(),
          aggregationType: z.enum(['avg', 'sum', 'min', 'max', 'count']).default('avg'),
          groupBy: z.enum(['hour', 'day', 'week', 'month']).default('day'),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getAggregatedPerformanceMetrics(
            input.projectId,
            input.aggregationType
          );
        }),

      // 获取性能趋势
      getTrends: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          metricType: MetricTypeEnum,
          category: MetricCategoryEnum.optional(),
          period: z.enum(['1h', '6h', '24h', '7d', '30d']).default('24h'),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceMetricsTrends(
            input.projectId,
            input.metricType,
            input.period
          );
        }),

      // 更新性能指标
      update: this.trpc.protectedProcedure
        .input(z.object({
          id: z.string().uuid(),
          data: updatePerformanceMetricSchema,
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.updatePerformanceMetric(input.id, input.data);
        }),

      // 删除性能指标
      delete: this.trpc.protectedProcedure
        .input(z.object({ id: z.string().uuid() }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.deletePerformanceMetric(input.id);
        }),

      // 批量删除性能指标
      batchDelete: this.trpc.protectedProcedure
        .input(z.object({
          ids: z.array(z.string().uuid()).min(1).max(100),
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.batchDeletePerformanceMetrics(input.ids);
        }),

      // 清理过期数据
      cleanup: this.trpc.protectedProcedure
        .input(z.object({
          olderThan: z.date(),
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.cleanupPerformanceMetrics(input.olderThan);
        }),

      // 导出性能指标数据
      export: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          startTime: z.date().optional(),
          endTime: z.date().optional(),
          metricType: MetricTypeEnum.optional(),
          category: MetricCategoryEnum.optional(),
          format: z.enum(['json', 'csv']).default('json'),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.exportPerformanceMetrics(input.format);
        }),

      // 获取性能指标配置
      getConfig: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid(),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceMetricsConfig(input.projectId);
        }),

      // 更新性能指标配置
      updateConfig: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid(),
          config: z.object({
            retentionDays: z.number().min(1).max(365).optional(),
            samplingRate: z.number().min(0).max(1).optional(),
            alertThresholds: z.record(z.string(), z.number()).optional(),
          }),
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.updatePerformanceMetricsConfig(
            input.projectId,
            input.config
          );
        }),

      // 获取性能警报
      getAlerts: this.trpc.protectedProcedure
        .input(z.object({
          projectId: z.string().uuid().optional(),
          environmentId: z.string().uuid().optional(),
          severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
          status: z.enum(['active', 'resolved', 'acknowledged']).optional(),
          limit: z.number().min(1).max(100).default(20),
          offset: z.number().min(0).default(0),
        }))
        .query(async ({ input }) => {
          return this.performanceMetricsService.getPerformanceAlerts(
            input.projectId,
            input.status
          );
        }),

      // 确认性能警报
      acknowledgeAlert: this.trpc.protectedProcedure
        .input(z.object({
          alertId: z.string().uuid(),
          acknowledgedBy: z.string().uuid(),
          note: z.string().optional(),
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.acknowledgePerformanceAlert(input.alertId);
        }),

      // 解决性能警报
      resolveAlert: this.trpc.protectedProcedure
        .input(z.object({
          alertId: z.string().uuid(),
          resolvedBy: z.string().uuid(),
          resolution: z.string(),
        }))
        .mutation(async ({ input }) => {
          return this.performanceMetricsService.resolvePerformanceAlert(input.alertId);
        }),
    });
  }
}