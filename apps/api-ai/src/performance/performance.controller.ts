/**
 * 🚀 Juanie AI - 性能优化控制器
 * 提供性能监控、自动扩缩容和优化的 REST API 接口
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpStatus,
  HttpException,
  Logger,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';

// 服务导入
import {
  PerformanceService,
  PerformanceConfig,
  PerformanceReport,
  PerformanceThreshold,
} from './performance.service';

import {
  AutoScalerService,
  AutoScalerConfig,
  PartialAutoScalerConfig,
  ScalingRule,
  ScalingEvent,
  ScalingRuleSchema,
} from './autoscaler.service';

// ============================================================================
// 请求/响应 Schema 定义
// ============================================================================

const PerformanceQuerySchema = z.object({
  type: z.string().optional(),
  startTime: z.coerce.number().optional(),
  endTime: z.coerce.number().optional(),
  limit: z.coerce.number().default(100),
});

const PerformanceConfigUpdateSchema = z.object({
  collection_interval: z.number().optional(),
  retention_period: z.number().optional(),
  auto_optimization: z.boolean().optional(),
  thresholds: z.array(z.object({
    metric: z.string(),
    warning: z.number(),
    critical: z.number(),
    unit: z.string(),
    enabled: z.boolean().default(true),
  })).optional(),
});

const AutoScalerConfigUpdateSchema = z.object({
  enabled: z.boolean().optional(),
  check_interval: z.number().optional(),
  prediction_enabled: z.boolean().optional(),
  prediction_window: z.number().optional(),
  kubernetes: z.object({
    namespace: z.string().optional(),
    deployment_name: z.string().optional(),
    service_name: z.string().optional(),
  }).optional(),
  rules: z.array(ScalingRuleSchema).optional(),
}) satisfies z.ZodType<PartialAutoScalerConfig>;

const ScalingRuleCreateSchema = z.object({
  name: z.string(),
  enabled: z.boolean().default(true),
  scale_up_threshold: z.number(),
  scale_down_threshold: z.number(),
  min_replicas: z.number().min(1),
  max_replicas: z.number(),
  cooldown_period: z.number().default(300),
  scale_up_step: z.number().default(1),
  scale_down_step: z.number().default(1),
});

const ManualScaleSchema = z.object({
  target_replicas: z.number().min(1),
  reason: z.string(),
});

// ============================================================================
// 性能优化控制器
// ============================================================================

@Controller('performance')
export class PerformanceController {
  private readonly logger = new Logger(PerformanceController.name);

  constructor(
    private performanceService: PerformanceService,
    private autoScalerService: AutoScalerService,
    private eventEmitter: EventEmitter2,
  ) {}

  // ========================================================================
  // 性能监控 API
  // ========================================================================

  /**
   * 获取性能指标
   */
  @Get('metrics')
  async getMetrics(@Query() query: any) {
    try {
      const params = PerformanceQuerySchema.parse(query);
      
      // 这里需要从 PerformanceCollector 获取指标
      // 由于架构限制，我们通过 PerformanceService 获取
      const metrics = await this.performanceService['collector'].getMetrics({
        type: params.type,
        startTime: params.startTime,
        endTime: params.endTime,
      });

      return {
        success: true,
        data: metrics.slice(-params.limit),
        total: metrics.length,
      };
    } catch (error) {
      this.logger.error(`获取性能指标失败: ${error.message}`);
      throw new HttpException(
        `获取性能指标失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取实时性能状态
   */
  @Get('status')
  async getPerformanceStatus() {
    try {
      const status = this.performanceService.getRealTimeStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`获取性能状态失败: ${error.message}`);
      throw new HttpException(
        `获取性能状态失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 生成性能报告
   */
  @Get('report')
  async generatePerformanceReport(@Query('period') period?: string) {
    try {
      const reportPeriod = period ? parseInt(period) : 3600000; // 默认1小时
      const report = this.performanceService.generateReport(reportPeriod);
      
      return {
        success: true,
        data: report,
      };
    } catch (error) {
      this.logger.error(`生成性能报告失败: ${error.message}`);
      throw new HttpException(
        `生成性能报告失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取性能配置
   */
  @Get('config')
  async getPerformanceConfig() {
    try {
      const config = this.performanceService.getConfig();
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error(`获取性能配置失败: ${error.message}`);
      throw new HttpException(
        `获取性能配置失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 更新性能配置
   */
  @Put('config')
  async updatePerformanceConfig(@Body() body: any) {
    try {
      const config = PerformanceConfigUpdateSchema.parse(body);
      this.performanceService.updateConfig(config);
      
      return {
        success: true,
        message: '性能配置更新成功',
      };
    } catch (error) {
      this.logger.error(`更新性能配置失败: ${error.message}`);
      throw new HttpException(
        `更新性能配置失败: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 获取性能趋势分析
   */
  @Get('trends/:type')
  async getPerformanceTrends(
    @Param('type') type: string,
    @Query('period') period?: string,
  ) {
    try {
      const analysisPeriod = period ? parseInt(period) : 3600000;
      const trends = await this.performanceService['analyzer'].analyzeTrends(type, analysisPeriod);
      
      return {
        success: true,
        data: trends,
      };
    } catch (error) {
      this.logger.error(`获取性能趋势失败: ${error.message}`);
      throw new HttpException(
        `获取性能趋势失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 检测性能异常
   */
  @Get('anomalies/:type')
  async detectPerformanceAnomalies(
    @Param('type') type: string,
    @Query('period') period?: string,
    @Query('threshold') threshold?: string,
  ) {
    try {
      const analysisPeriod = period ? parseInt(period) : 3600000;
      const thresholdValue = threshold ? parseFloat(threshold) : 2;
      
      const anomalies = await this.performanceService['analyzer'].detectAnomalies(
        type,
        analysisPeriod,
        thresholdValue,
      );
      
      return {
        success: true,
        data: anomalies,
      };
    } catch (error) {
      this.logger.error(`检测性能异常失败: ${error.message}`);
      throw new HttpException(
        `检测性能异常失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取优化历史
   */
  @Get('optimizations')
  async getOptimizationHistory(@Query('limit') limit?: string) {
    try {
      const limitValue = limit ? parseInt(limit) : 100;
      const history = await this.performanceService['optimizer'].getOptimizationHistory(limitValue);
      
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error(`获取优化历史失败: ${error.message}`);
      throw new HttpException(
        `获取优化历史失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========================================================================
  // 自动扩缩容 API
  // ========================================================================

  /**
   * 获取自动扩缩容状态
   */
  @Get('autoscaler/status')
  async getAutoScalerStatus() {
    try {
      const status = this.autoScalerService.getStatus();
      return {
        success: true,
        data: status,
      };
    } catch (error) {
      this.logger.error(`获取自动扩缩容状态失败: ${error.message}`);
      throw new HttpException(
        `获取自动扩缩容状态失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 启动自动扩缩容
   */
  @Post('autoscaler/start')
  async startAutoScaler() {
    try {
      this.autoScalerService.start();
      return {
        success: true,
        message: '自动扩缩容已启动',
      };
    } catch (error) {
      this.logger.error(`启动自动扩缩容失败: ${error.message}`);
      throw new HttpException(
        `启动自动扩缩容失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 停止自动扩缩容
   */
  @Post('autoscaler/stop')
  async stopAutoScaler() {
    try {
      this.autoScalerService.stop();
      return {
        success: true,
        message: '自动扩缩容已停止',
      };
    } catch (error) {
      this.logger.error(`停止自动扩缩容失败: ${error.message}`);
      throw new HttpException(
        `停止自动扩缩容失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取自动扩缩容配置
   */
  @Get('autoscaler/config')
  async getAutoScalerConfig() {
    try {
      const config = this.autoScalerService.getConfig();
      return {
        success: true,
        data: config,
      };
    } catch (error) {
      this.logger.error(`获取自动扩缩容配置失败: ${error.message}`);
      throw new HttpException(
        `获取自动扩缩容配置失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 更新自动扩缩容配置
   */
  @Put('autoscaler/config')
  async updateAutoScalerConfig(@Body() body: any) {
    try {
      const config = AutoScalerConfigUpdateSchema.parse(body);
      this.autoScalerService.updateConfig(config);
      
      return {
        success: true,
        message: '自动扩缩容配置更新成功',
      };
    } catch (error) {
      this.logger.error(`更新自动扩缩容配置失败: ${error.message}`);
      throw new HttpException(
        `更新自动扩缩容配置失败: ${error.message}`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 手动扩缩容
   */
  @Post('autoscaler/scale')
  async manualScale(@Body() body: any) {
    try {
      const { target_replicas, reason } = ManualScaleSchema.parse(body);
      const event = await this.autoScalerService.manualScale(target_replicas, reason);
      
      return {
        success: true,
        data: event,
        message: '手动扩缩容已触发',
      };
    } catch (error) {
      this.logger.error(`手动扩缩容失败: ${error.message}`);
      throw new HttpException(
        `手动扩缩容失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取扩缩容历史
   */
  @Get('autoscaler/history')
  async getScalingHistory(@Query('limit') limit?: string) {
    try {
      const limitValue = limit ? parseInt(limit) : 50;
      const history = await this.autoScalerService['scalingExecutor'].getScalingHistory(limitValue);
      
      return {
        success: true,
        data: history,
      };
    } catch (error) {
      this.logger.error(`获取扩缩容历史失败: ${error.message}`);
      throw new HttpException(
        `获取扩缩容历史失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取扩缩容预测
   */
  @Get('autoscaler/predictions')
  async getScalingPredictions(@Query('metric') metric?: string) {
    try {
      const predictions = [];
      
      if (metric) {
        const prediction = await this.autoScalerService['predictionEngine'].predictMetric(metric);
        if (prediction) {
          predictions.push(prediction);
        }
      } else {
        // 获取所有指标的预测
        const metrics = ['cpu', 'memory'];
        for (const m of metrics) {
          const prediction = await this.autoScalerService['predictionEngine'].predictMetric(m);
          if (prediction) {
            predictions.push(prediction);
          }
        }
      }
      
      return {
        success: true,
        data: predictions,
      };
    } catch (error) {
      this.logger.error(`获取扩缩容预测失败: ${error.message}`);
      throw new HttpException(
        `获取扩缩容预测失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========================================================================
  // 系统健康检查 API
  // ========================================================================

  /**
   * 系统健康检查
   */
  @Get('health')
  async healthCheck() {
    try {
      const performanceStatus = this.performanceService.getRealTimeStatus();
      const autoScalerStatus = this.autoScalerService.getStatus();
      
      const isHealthy = performanceStatus.status !== 'critical' && 
                       performanceStatus.score > 50;
      
      return {
        success: true,
        data: {
          status: isHealthy ? 'healthy' : 'unhealthy',
          performance: performanceStatus,
          autoscaler: {
            enabled: autoScalerStatus.enabled,
            current_replicas: autoScalerStatus.current_replicas,
          },
          timestamp: Date.now(),
        },
      };
    } catch (error) {
      this.logger.error(`健康检查失败: ${error.message}`);
      throw new HttpException(
        `健康检查失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 系统统计信息
   */
  @Get('stats')
  async getSystemStats() {
    try {
      const performanceReport = this.performanceService.generateReport(86400000); // 24小时
      const scalingHistory = await this.autoScalerService['scalingExecutor'].getScalingHistory(100);
      
      const stats = {
        performance: {
          score: performanceReport.score,
          metrics_collected: performanceReport.metrics.length,
          thresholds_breached: performanceReport.thresholds_breached.length,
          optimizations_applied: performanceReport.optimizations_applied.length,
        },
        scaling: {
          total_events: scalingHistory.length,
          successful_events: scalingHistory.filter(e => e.status === 'completed').length,
          failed_events: scalingHistory.filter(e => e.status === 'failed').length,
          scale_up_events: scalingHistory.filter(e => e.type === 'scale_up').length,
          scale_down_events: scalingHistory.filter(e => e.type === 'scale_down').length,
        },
        timestamp: Date.now(),
      };
      
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      this.logger.error(`获取系统统计失败: ${error.message}`);
      throw new HttpException(
        `获取系统统计失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // ========================================================================
  // 实时事件流 API
  // ========================================================================

  /**
   * 获取实时性能事件流
   * 注意：这是一个简化的实现，实际应用中可能需要使用 Server-Sent Events 或 WebSocket
   */
  @Get('events/performance')
  async getPerformanceEvents(@Query('since') since?: string) {
    try {
      const sinceTime = since ? parseInt(since) : Date.now() - 300000; // 默认最近5分钟
      
      // 这里应该从事件存储中获取事件
      // 简化实现，返回空数组
      const events: any[] = [];
      
      return {
        success: true,
        data: events,
        since: sinceTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`获取性能事件失败: ${error.message}`);
      throw new HttpException(
        `获取性能事件失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 获取实时扩缩容事件流
   */
  @Get('events/scaling')
  async getScalingEvents(@Query('since') since?: string) {
    try {
      const sinceTime = since ? parseInt(since) : Date.now() - 300000;
      const allEvents = await this.autoScalerService['scalingExecutor'].getScalingHistory(1000);
      
      const events = allEvents.filter(event => event.timestamp >= sinceTime);
      
      return {
        success: true,
        data: events,
        since: sinceTime,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`获取扩缩容事件失败: ${error.message}`);
      throw new HttpException(
        `获取扩缩容事件失败: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}