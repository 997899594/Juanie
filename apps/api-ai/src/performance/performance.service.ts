/**
 * 🚀 Juanie AI - 性能优化服务
 * 实现智能性能监控、分析和自动优化机制
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import * as os from 'os';
import * as process from 'process';
import { performance } from 'perf_hooks';

// ============================================================================
// 性能指标 Schema 定义
// ============================================================================

export const PerformanceMetricSchema = z.object({
  timestamp: z.number(),
  type: z.enum(['cpu', 'memory', 'network', 'disk', 'response_time', 'throughput', 'error_rate']),
  value: z.number(),
  unit: z.string(),
  tags: z.record(z.string()).optional(),
  metadata: z.record(z.any()).optional(),
});

export const PerformanceThresholdSchema = z.object({
  metric: z.string(),
  warning: z.number(),
  critical: z.number(),
  unit: z.string(),
  enabled: z.boolean().default(true),
});

export const OptimizationActionSchema = z.object({
  id: z.string(),
  type: z.enum(['scale_up', 'scale_down', 'cache_clear', 'gc_trigger', 'connection_pool_adjust']),
  trigger: z.string(),
  parameters: z.record(z.any()),
  executed_at: z.number(),
  result: z.string().optional(),
});

export const PerformanceReportSchema = z.object({
  period: z.object({
    start: z.number(),
    end: z.number(),
  }),
  metrics: z.array(PerformanceMetricSchema),
  thresholds_breached: z.array(z.string()),
  optimizations_applied: z.array(OptimizationActionSchema),
  recommendations: z.array(z.string()),
  score: z.number().min(0).max(100),
});

// ============================================================================
// 类型定义
// ============================================================================

export type PerformanceMetric = z.infer<typeof PerformanceMetricSchema>;
export type PerformanceThreshold = z.infer<typeof PerformanceThresholdSchema>;
export type OptimizationAction = z.infer<typeof OptimizationActionSchema>;
export type PerformanceReport = z.infer<typeof PerformanceReportSchema>;

export interface PerformanceConfig {
  collection_interval: number;
  retention_period: number;
  auto_optimization: boolean;
  thresholds: PerformanceThreshold[];
}

// ============================================================================
// 性能数据收集器
// ============================================================================

@Injectable()
export class PerformanceCollector {
  private readonly logger = new Logger(PerformanceCollector.name);
  private metrics: PerformanceMetric[] = [];
  private collectionInterval?: NodeJS.Timeout;

  constructor(private eventEmitter: EventEmitter2) {}

  /**
   * 开始性能数据收集
   */
  startCollection(interval: number = 5000): void {
    this.logger.log(`开始性能数据收集，间隔: ${interval}ms`);
    
    this.collectionInterval = setInterval(() => {
      this.collectSystemMetrics();
      this.collectProcessMetrics();
      this.collectNodeJSMetrics();
    }, interval);
  }

  /**
   * 停止性能数据收集
   */
  stopCollection(): void {
    if (this.collectionInterval) {
      clearInterval(this.collectionInterval);
      this.collectionInterval = undefined;
      this.logger.log('性能数据收集已停止');
    }
  }

  /**
   * 收集系统指标
   */
  private collectSystemMetrics(): void {
    const timestamp = Date.now();
    
    // CPU 使用率
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;
    
    cpus.forEach(cpu => {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    });
    
    const cpuUsage = 100 - (totalIdle / totalTick) * 100;
    
    this.addMetric({
      timestamp,
      type: 'cpu',
      value: cpuUsage,
      unit: 'percent',
      tags: { source: 'system' },
    });

    // 内存使用率
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const memoryUsage = ((totalMemory - freeMemory) / totalMemory) * 100;
    
    this.addMetric({
      timestamp,
      type: 'memory',
      value: memoryUsage,
      unit: 'percent',
      tags: { source: 'system' },
      metadata: {
        total: totalMemory,
        free: freeMemory,
        used: totalMemory - freeMemory,
      },
    });

    // 负载平均值
    const loadAvg = os.loadavg();
    this.addMetric({
      timestamp,
      type: 'cpu',
      value: loadAvg[0],
      unit: 'load',
      tags: { source: 'system', period: '1min' },
    });
  }

  /**
   * 收集进程指标
   */
  private collectProcessMetrics(): void {
    const timestamp = Date.now();
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    // 进程内存使用
    this.addMetric({
      timestamp,
      type: 'memory',
      value: memUsage.heapUsed,
      unit: 'bytes',
      tags: { source: 'process', type: 'heap_used' },
    });

    this.addMetric({
      timestamp,
      type: 'memory',
      value: memUsage.heapTotal,
      unit: 'bytes',
      tags: { source: 'process', type: 'heap_total' },
    });

    this.addMetric({
      timestamp,
      type: 'memory',
      value: memUsage.rss,
      unit: 'bytes',
      tags: { source: 'process', type: 'rss' },
    });

    // 进程 CPU 使用
    this.addMetric({
      timestamp,
      type: 'cpu',
      value: cpuUsage.user,
      unit: 'microseconds',
      tags: { source: 'process', type: 'user' },
    });

    this.addMetric({
      timestamp,
      type: 'cpu',
      value: cpuUsage.system,
      unit: 'microseconds',
      tags: { source: 'process', type: 'system' },
    });
  }

  /**
   * 收集 Node.js 特定指标
   */
  private collectNodeJSMetrics(): void {
    const timestamp = Date.now();

    // 事件循环延迟
    const start = performance.now();
    setImmediate(() => {
      const delay = performance.now() - start;
      this.addMetric({
        timestamp,
        type: 'response_time',
        value: delay,
        unit: 'milliseconds',
        tags: { source: 'nodejs', type: 'event_loop_delay' },
      });
    });

    // 垃圾回收统计（如果可用）
    if (global.gc) {
      const gcStats = process.memoryUsage();
      this.addMetric({
        timestamp,
        type: 'memory',
        value: gcStats.external,
        unit: 'bytes',
        tags: { source: 'nodejs', type: 'external' },
      });
    }
  }

  /**
   * 添加性能指标
   */
  addMetric(metric: Omit<PerformanceMetric, 'timestamp'> & { timestamp?: number }): void {
    const fullMetric: PerformanceMetric = {
      timestamp: Date.now(),
      ...metric,
    };

    this.metrics.push(fullMetric);
    this.eventEmitter.emit('performance.metric', fullMetric);

    // 限制内存中的指标数量
    if (this.metrics.length > 10000) {
      this.metrics = this.metrics.slice(-5000);
    }
  }

  /**
   * 获取指标数据
   */
  getMetrics(filter?: {
    type?: string;
    startTime?: number;
    endTime?: number;
    tags?: Record<string, string>;
  }): PerformanceMetric[] {
    let filtered = this.metrics;

    if (filter) {
      if (filter.type) {
        filtered = filtered.filter(m => m.type === filter.type);
      }
      if (filter.startTime) {
        filtered = filtered.filter(m => m.timestamp >= filter.startTime!);
      }
      if (filter.endTime) {
        filtered = filtered.filter(m => m.timestamp <= filter.endTime!);
      }
      if (filter.tags) {
        filtered = filtered.filter(m => {
          if (!m.tags) return false;
          return Object.entries(filter.tags!).every(([key, value]) => m.tags![key] === value);
        });
      }
    }

    return filtered;
  }

  /**
   * 清理旧指标
   */
  cleanup(retentionPeriod: number): void {
    const cutoff = Date.now() - retentionPeriod;
    const before = this.metrics.length;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    const after = this.metrics.length;
    
    if (before !== after) {
      this.logger.log(`清理了 ${before - after} 个过期指标`);
    }
  }
}

// ============================================================================
// 性能分析器
// ============================================================================

@Injectable()
export class PerformanceAnalyzer {
  private readonly logger = new Logger(PerformanceAnalyzer.name);

  constructor(
    private collector: PerformanceCollector,
    private eventEmitter: EventEmitter2,
  ) {}

  /**
   * 分析性能趋势
   */
  analyzeTrends(
    type: string,
    period: number = 3600000, // 1小时
  ): {
    trend: 'increasing' | 'decreasing' | 'stable';
    slope: number;
    correlation: number;
    prediction: number;
  } {
    const endTime = Date.now();
    const startTime = endTime - period;
    
    const metrics = this.collector.getMetrics({
      type,
      startTime,
      endTime,
    });

    if (metrics.length < 2) {
      return {
        trend: 'stable',
        slope: 0,
        correlation: 0,
        prediction: 0,
      };
    }

    // 线性回归分析
    const n = metrics.length;
    const sumX = metrics.reduce((sum, _, i) => sum + i, 0);
    const sumY = metrics.reduce((sum, m) => sum + m.value, 0);
    const sumXY = metrics.reduce((sum, m, i) => sum + i * m.value, 0);
    const sumXX = metrics.reduce((sum, _, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算相关系数
    const meanX = sumX / n;
    const meanY = sumY / n;
    const numerator = metrics.reduce((sum, m, i) => sum + (i - meanX) * (m.value - meanY), 0);
    const denomX = Math.sqrt(metrics.reduce((sum, _, i) => sum + Math.pow(i - meanX, 2), 0));
    const denomY = Math.sqrt(metrics.reduce((sum, m) => sum + Math.pow(m.value - meanY, 2), 0));
    const correlation = numerator / (denomX * denomY);

    // 预测下一个值
    const prediction = slope * n + intercept;

    // 确定趋势
    let trend: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(slope) < 0.01) {
      trend = 'stable';
    } else if (slope > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    return {
      trend,
      slope,
      correlation,
      prediction,
    };
  }

  /**
   * 检测异常值
   */
  detectAnomalies(
    type: string,
    period: number = 3600000,
    threshold: number = 2, // Z-score 阈值
  ): PerformanceMetric[] {
    const metrics = this.collector.getMetrics({
      type,
      startTime: Date.now() - period,
    });

    if (metrics.length < 10) {
      return [];
    }

    // 计算均值和标准差
    const values = metrics.map(m => m.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // 检测异常值
    const anomalies = metrics.filter(m => {
      const zScore = Math.abs((m.value - mean) / stdDev);
      return zScore > threshold;
    });

    if (anomalies.length > 0) {
      this.logger.warn(`检测到 ${anomalies.length} 个异常值 (${type})`);
      this.eventEmitter.emit('performance.anomaly', {
        type,
        anomalies,
        mean,
        stdDev,
      });
    }

    return anomalies;
  }

  /**
   * 计算性能评分
   */
  calculatePerformanceScore(period: number = 3600000): number {
    const endTime = Date.now();
    const startTime = endTime - period;

    // 获取各类指标
    const cpuMetrics = this.collector.getMetrics({ type: 'cpu', startTime, endTime });
    const memoryMetrics = this.collector.getMetrics({ type: 'memory', startTime, endTime });
    const responseTimeMetrics = this.collector.getMetrics({ type: 'response_time', startTime, endTime });

    let score = 100;

    // CPU 评分 (权重: 30%)
    if (cpuMetrics.length > 0) {
      const avgCpu = cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length;
      if (avgCpu > 80) score -= 30;
      else if (avgCpu > 60) score -= 20;
      else if (avgCpu > 40) score -= 10;
    }

    // 内存评分 (权重: 30%)
    if (memoryMetrics.length > 0) {
      const avgMemory = memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length;
      if (avgMemory > 90) score -= 30;
      else if (avgMemory > 75) score -= 20;
      else if (avgMemory > 60) score -= 10;
    }

    // 响应时间评分 (权重: 40%)
    if (responseTimeMetrics.length > 0) {
      const avgResponseTime = responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length;
      if (avgResponseTime > 1000) score -= 40;
      else if (avgResponseTime > 500) score -= 25;
      else if (avgResponseTime > 200) score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }
}

// ============================================================================
// 自动优化器
// ============================================================================

@Injectable()
export class AutoOptimizer {
  private readonly logger = new Logger(AutoOptimizer.name);
  private actions: OptimizationAction[] = [];
  private enabled = false;

  constructor(
    private collector: PerformanceCollector,
    private analyzer: PerformanceAnalyzer,
    private eventEmitter: EventEmitter2,
  ) {
    this.setupEventListeners();
  }

  /**
   * 启用自动优化
   */
  enable(): void {
    this.enabled = true;
    this.logger.log('自动优化已启用');
  }

  /**
   * 禁用自动优化
   */
  disable(): void {
    this.enabled = false;
    this.logger.log('自动优化已禁用');
  }

  /**
   * 设置事件监听器
   */
  private setupEventListeners(): void {
    this.eventEmitter.on('performance.metric', (metric: PerformanceMetric) => {
      if (this.enabled) {
        this.evaluateOptimization(metric);
      }
    });

    this.eventEmitter.on('performance.anomaly', (data: any) => {
      if (this.enabled) {
        this.handleAnomaly(data);
      }
    });
  }

  /**
   * 评估是否需要优化
   */
  private evaluateOptimization(metric: PerformanceMetric): void {
    // CPU 优化
    if (metric.type === 'cpu' && metric.value > 85) {
      this.executeAction({
        id: `cpu_optimization_${Date.now()}`,
        type: 'gc_trigger',
        trigger: `CPU usage: ${metric.value}%`,
        parameters: { force: true },
        executed_at: Date.now(),
      });
    }

    // 内存优化
    if (metric.type === 'memory' && metric.value > 90) {
      this.executeAction({
        id: `memory_optimization_${Date.now()}`,
        type: 'cache_clear',
        trigger: `Memory usage: ${metric.value}%`,
        parameters: { aggressive: true },
        executed_at: Date.now(),
      });
    }

    // 响应时间优化
    if (metric.type === 'response_time' && metric.value > 1000) {
      this.executeAction({
        id: `response_time_optimization_${Date.now()}`,
        type: 'connection_pool_adjust',
        trigger: `Response time: ${metric.value}ms`,
        parameters: { increase_pool_size: true },
        executed_at: Date.now(),
      });
    }
  }

  /**
   * 处理异常情况
   */
  private handleAnomaly(data: any): void {
    this.logger.warn(`处理性能异常: ${data.type}`);
    
    // 根据异常类型执行相应的优化动作
    this.executeAction({
      id: `anomaly_response_${Date.now()}`,
      type: 'scale_up',
      trigger: `Anomaly detected in ${data.type}`,
      parameters: { anomaly_count: data.anomalies.length },
      executed_at: Date.now(),
    });
  }

  /**
   * 执行优化动作
   */
  private executeAction(action: OptimizationAction): void {
    this.logger.log(`执行优化动作: ${action.type} - ${action.trigger}`);

    try {
      switch (action.type) {
        case 'gc_trigger':
          this.triggerGarbageCollection();
          action.result = 'success';
          break;
        
        case 'cache_clear':
          this.clearCache(action.parameters);
          action.result = 'success';
          break;
        
        case 'connection_pool_adjust':
          this.adjustConnectionPool(action.parameters);
          action.result = 'success';
          break;
        
        case 'scale_up':
        case 'scale_down':
          this.scaleApplication(action.type, action.parameters);
          action.result = 'success';
          break;
        
        default:
          action.result = 'unsupported';
      }
    } catch (error) {
      this.logger.error(`优化动作执行失败: ${error.message}`);
      action.result = `error: ${error.message}`;
    }

    this.actions.push(action);
    this.eventEmitter.emit('performance.optimization', action);

    // 限制动作历史记录
    if (this.actions.length > 1000) {
      this.actions = this.actions.slice(-500);
    }
  }

  /**
   * 触发垃圾回收
   */
  private triggerGarbageCollection(): void {
    if (global.gc) {
      global.gc();
      this.logger.log('手动触发垃圾回收');
    } else {
      this.logger.warn('垃圾回收不可用');
    }
  }

  /**
   * 清理缓存
   */
  private clearCache(parameters: any): void {
    // 这里可以集成实际的缓存清理逻辑
    this.logger.log('清理缓存', parameters);
  }

  /**
   * 调整连接池
   */
  private adjustConnectionPool(parameters: any): void {
    // 这里可以集成实际的连接池调整逻辑
    this.logger.log('调整连接池', parameters);
  }

  /**
   * 扩缩容应用
   */
  private scaleApplication(type: 'scale_up' | 'scale_down', parameters: any): void {
    // 这里可以集成实际的扩缩容逻辑
    this.logger.log(`应用${type === 'scale_up' ? '扩容' : '缩容'}`, parameters);
  }

  /**
   * 获取优化历史
   */
  getOptimizationHistory(limit: number = 100): OptimizationAction[] {
    return this.actions.slice(-limit);
  }
}

// ============================================================================
// 主性能服务
// ============================================================================

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private config: PerformanceConfig;
  private thresholds: Map<string, PerformanceThreshold> = new Map();

  constructor(
    private collector: PerformanceCollector,
    private analyzer: PerformanceAnalyzer,
    private optimizer: AutoOptimizer,
    private eventEmitter: EventEmitter2,
  ) {
    this.config = {
      collection_interval: 5000,
      retention_period: 86400000, // 24小时
      auto_optimization: true,
      thresholds: [
        { metric: 'cpu', warning: 70, critical: 85, unit: 'percent', enabled: true },
        { metric: 'memory', warning: 75, critical: 90, unit: 'percent', enabled: true },
        { metric: 'response_time', warning: 500, critical: 1000, unit: 'milliseconds', enabled: true },
      ],
    };

    this.initializeThresholds();
    this.setupMonitoring();
  }

  /**
   * 初始化阈值
   */
  private initializeThresholds(): void {
    this.config.thresholds.forEach(threshold => {
      this.thresholds.set(threshold.metric, threshold);
    });
  }

  /**
   * 设置监控
   */
  private setupMonitoring(): void {
    // 启动数据收集
    this.collector.startCollection(this.config.collection_interval);

    // 启用自动优化
    if (this.config.auto_optimization) {
      this.optimizer.enable();
    }

    // 设置定期清理
    setInterval(() => {
      this.collector.cleanup(this.config.retention_period);
    }, 3600000); // 每小时清理一次

    // 设置阈值监控
    this.eventEmitter.on('performance.metric', (metric: PerformanceMetric) => {
      this.checkThresholds(metric);
    });
  }

  /**
   * 检查阈值
   */
  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.get(metric.type);
    if (!threshold || !threshold.enabled) {
      return;
    }

    if (metric.value >= threshold.critical) {
      this.eventEmitter.emit('performance.threshold.critical', {
        metric,
        threshold,
        level: 'critical',
      });
    } else if (metric.value >= threshold.warning) {
      this.eventEmitter.emit('performance.threshold.warning', {
        metric,
        threshold,
        level: 'warning',
      });
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(period: number = 3600000): PerformanceReport {
    const endTime = Date.now();
    const startTime = endTime - period;

    const metrics = this.collector.getMetrics({ startTime, endTime });
    const score = this.analyzer.calculatePerformanceScore(period);
    const optimizations = this.optimizer.getOptimizationHistory(50);

    // 检查阈值违规
    const thresholdsBreached: string[] = [];
    this.thresholds.forEach((threshold, metric) => {
      const anomalies = this.analyzer.detectAnomalies(metric, period);
      if (anomalies.length > 0) {
        thresholdsBreached.push(metric);
      }
    });

    // 生成建议
    const recommendations: string[] = [];
    if (score < 70) {
      recommendations.push('系统性能较差，建议进行全面优化');
    }
    if (thresholdsBreached.includes('cpu')) {
      recommendations.push('CPU 使用率过高，考虑优化算法或增加计算资源');
    }
    if (thresholdsBreached.includes('memory')) {
      recommendations.push('内存使用率过高，检查内存泄漏或增加内存');
    }
    if (thresholdsBreached.includes('response_time')) {
      recommendations.push('响应时间过长，优化数据库查询或增加缓存');
    }

    return {
      period: { start: startTime, end: endTime },
      metrics,
      thresholds_breached: thresholdsBreached,
      optimizations_applied: optimizations,
      recommendations,
      score,
    };
  }

  /**
   * 获取实时性能状态
   */
  getRealTimeStatus(): {
    cpu: number;
    memory: number;
    responseTime: number;
    score: number;
    status: 'healthy' | 'warning' | 'critical';
  } {
    const now = Date.now();
    const recent = now - 60000; // 最近1分钟

    const cpuMetrics = this.collector.getMetrics({ type: 'cpu', startTime: recent });
    const memoryMetrics = this.collector.getMetrics({ type: 'memory', startTime: recent });
    const responseTimeMetrics = this.collector.getMetrics({ type: 'response_time', startTime: recent });

    const cpu = cpuMetrics.length > 0 
      ? cpuMetrics.reduce((sum, m) => sum + m.value, 0) / cpuMetrics.length 
      : 0;
    
    const memory = memoryMetrics.length > 0 
      ? memoryMetrics.reduce((sum, m) => sum + m.value, 0) / memoryMetrics.length 
      : 0;
    
    const responseTime = responseTimeMetrics.length > 0 
      ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length 
      : 0;

    const score = this.analyzer.calculatePerformanceScore(300000); // 5分钟

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (cpu > 85 || memory > 90 || responseTime > 1000) {
      status = 'critical';
    } else if (cpu > 70 || memory > 75 || responseTime > 500) {
      status = 'warning';
    }

    return { cpu, memory, responseTime, score, status };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.thresholds) {
      this.thresholds.clear();
      newConfig.thresholds.forEach(threshold => {
        this.thresholds.set(threshold.metric, threshold);
      });
    }

    this.logger.log('性能配置已更新');
  }

  /**
   * 获取配置
   */
  getConfig(): PerformanceConfig {
    return { ...this.config };
  }
}