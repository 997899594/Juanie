/**
 * 🚀 Juanie AI - 指标收集服务
 * 实现实时性能监控和智能分析
 */

import { z } from 'zod';
import { EventEmitter } from 'events';

// ============================================================================
// 指标类型定义
// ============================================================================

export const MetricTypeSchema = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary',
  'timer',
]);

export const MetricSchema = z.object({
  name: z.string(),
  type: MetricTypeSchema,
  value: z.number(),
  labels: z.record(z.string()).default({}),
  timestamp: z.date().default(() => new Date()),
  unit: z.string().optional(),
  description: z.string().optional(),
});

export const MetricAggregationSchema = z.object({
  name: z.string(),
  count: z.number(),
  sum: z.number(),
  min: z.number(),
  max: z.number(),
  avg: z.number(),
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
  timestamp: z.date(),
});

export type Metric = z.infer<typeof MetricSchema>;
export type MetricType = z.infer<typeof MetricTypeSchema>;
export type MetricAggregation = z.infer<typeof MetricAggregationSchema>;

// ============================================================================
// 指标存储接口
// ============================================================================

export interface MetricStore {
  write(metric: Metric): Promise<void>;
  query(name: string, start: Date, end: Date, labels?: Record<string, string>): Promise<Metric[]>;
  aggregate(name: string, start: Date, end: Date, interval: number): Promise<MetricAggregation[]>;
  getLatest(name: string, labels?: Record<string, string>): Promise<Metric | null>;
  cleanup(before: Date): Promise<void>;
}

// ============================================================================
// 内存指标存储
// ============================================================================

export class MemoryMetricStore implements MetricStore {
  private metrics: Map<string, Metric[]>;
  private maxRetention: number;
  private cleanupInterval: NodeJS.Timeout;

  constructor(maxRetentionHours = 24) {
    this.metrics = new Map();
    this.maxRetention = maxRetentionHours * 60 * 60 * 1000; // 转换为毫秒
    
    // 定期清理过期指标
    this.cleanupInterval = setInterval(() => {
      this.cleanup(new Date(Date.now() - this.maxRetention));
    }, 60 * 60 * 1000); // 每小时清理一次
  }

  async write(metric: Metric): Promise<void> {
    const key = this.getMetricKey(metric.name, metric.labels);
    
    if (!this.metrics.has(key)) {
      this.metrics.set(key, []);
    }
    
    const metrics = this.metrics.get(key)!;
    metrics.push(metric);
    
    // 保持时间序列排序
    metrics.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // 限制单个时间序列的大小
    if (metrics.length > 10000) {
      metrics.splice(0, metrics.length - 10000);
    }
  }

  async query(
    name: string,
    start: Date,
    end: Date,
    labels?: Record<string, string>
  ): Promise<Metric[]> {
    const results: Metric[] = [];
    
    for (const [key, metrics] of this.metrics.entries()) {
      if (!key.startsWith(name)) continue;
      
      // 检查标签匹配
      if (labels && !this.labelsMatch(key, labels)) continue;
      
      // 过滤时间范围
      const filtered = metrics.filter(m => 
        m.timestamp >= start && m.timestamp <= end
      );
      
      results.push(...filtered);
    }
    
    return results.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async aggregate(
    name: string,
    start: Date,
    end: Date,
    interval: number
  ): Promise<MetricAggregation[]> {
    const metrics = await this.query(name, start, end);
    const aggregations: MetricAggregation[] = [];
    
    // 按时间间隔分组
    const buckets = new Map<number, Metric[]>();
    
    for (const metric of metrics) {
      const bucketTime = Math.floor(metric.timestamp.getTime() / interval) * interval;
      
      if (!buckets.has(bucketTime)) {
        buckets.set(bucketTime, []);
      }
      
      buckets.get(bucketTime)!.push(metric);
    }
    
    // 计算每个桶的聚合统计
    for (const [bucketTime, bucketMetrics] of buckets.entries()) {
      const values = bucketMetrics.map(m => m.value).sort((a, b) => a - b);
      
      if (values.length === 0) continue;
      
      const sum = values.reduce((a, b) => a + b, 0);
      const count = values.length;
      const min = values[0];
      const max = values[values.length - 1];
      const avg = sum / count;
      
      const p50Index = Math.floor(count * 0.5);
      const p95Index = Math.floor(count * 0.95);
      const p99Index = Math.floor(count * 0.99);
      
      aggregations.push({
        name,
        count,
        sum,
        min,
        max,
        avg,
        p50: values[p50Index] || 0,
        p95: values[p95Index] || 0,
        p99: values[p99Index] || 0,
        timestamp: new Date(bucketTime),
      });
    }
    
    return aggregations.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getLatest(name: string, labels?: Record<string, string>): Promise<Metric | null> {
    let latest: Metric | null = null;
    
    for (const [key, metrics] of this.metrics.entries()) {
      if (!key.startsWith(name)) continue;
      
      // 检查标签匹配
      if (labels && !this.labelsMatch(key, labels)) continue;
      
      if (metrics.length > 0) {
        const candidate = metrics[metrics.length - 1];
        if (!latest || candidate.timestamp > latest.timestamp) {
          latest = candidate;
        }
      }
    }
    
    return latest;
  }

  async cleanup(before: Date): Promise<void> {
    for (const [key, metrics] of this.metrics.entries()) {
      const filtered = metrics.filter(m => m.timestamp >= before);
      
      if (filtered.length === 0) {
        this.metrics.delete(key);
      } else {
        this.metrics.set(key, filtered);
      }
    }
  }

  private getMetricKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  private labelsMatch(key: string, labels: Record<string, string>): boolean {
    for (const [labelKey, labelValue] of Object.entries(labels)) {
      if (!key.includes(`${labelKey}=${labelValue}`)) {
        return false;
      }
    }
    return true;
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }
}

// ============================================================================
// 指标收集器
// ============================================================================

export class MetricsCollector extends EventEmitter {
  private store: MetricStore;
  private counters: Map<string, number>;
  private gauges: Map<string, number>;
  private histograms: Map<string, number[]>;
  private timers: Map<string, number>;

  constructor(store?: MetricStore) {
    super();
    this.store = store || new MemoryMetricStore();
    this.counters = new Map();
    this.gauges = new Map();
    this.histograms = new Map();
    this.timers = new Map();
  }

  /**
   * 递增计数器
   */
  async incrementCounter(
    name: string,
    value = 1,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const key = this.getKey(name, labels);
    const currentValue = this.counters.get(key) || 0;
    const newValue = currentValue + value;
    
    this.counters.set(key, newValue);
    
    const metric: Metric = {
      name,
      type: 'counter',
      value: newValue,
      labels,
      timestamp: new Date(),
    };
    
    await this.store.write(metric);
    this.emit('metric', metric);
  }

  /**
   * 设置仪表值
   */
  async setGauge(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const key = this.getKey(name, labels);
    this.gauges.set(key, value);
    
    const metric: Metric = {
      name,
      type: 'gauge',
      value,
      labels,
      timestamp: new Date(),
    };
    
    await this.store.write(metric);
    this.emit('metric', metric);
  }

  /**
   * 记录直方图值
   */
  async recordHistogram(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    const key = this.getKey(name, labels);
    
    if (!this.histograms.has(key)) {
      this.histograms.set(key, []);
    }
    
    const values = this.histograms.get(key)!;
    values.push(value);
    
    // 保持最近1000个值
    if (values.length > 1000) {
      values.shift();
    }
    
    const metric: Metric = {
      name,
      type: 'histogram',
      value,
      labels,
      timestamp: new Date(),
    };
    
    await this.store.write(metric);
    this.emit('metric', metric);
  }

  /**
   * 开始计时
   */
  startTimer(name: string, labels: Record<string, string> = {}): string {
    const timerId = `${name}_${Date.now()}_${Math.random()}`;
    const key = this.getKey(name, labels);
    
    this.timers.set(timerId, Date.now());
    
    return timerId;
  }

  /**
   * 结束计时
   */
  async endTimer(
    timerId: string,
    name: string,
    labels: Record<string, string> = {}
  ): Promise<number> {
    const startTime = this.timers.get(timerId);
    if (!startTime) {
      throw new Error(`Timer ${timerId} not found`);
    }
    
    const duration = Date.now() - startTime;
    this.timers.delete(timerId);
    
    const metric: Metric = {
      name,
      type: 'timer',
      value: duration,
      labels,
      timestamp: new Date(),
      unit: 'ms',
    };
    
    await this.store.write(metric);
    this.emit('metric', metric);
    
    return duration;
  }

  /**
   * 记录执行时间
   */
  async time<T>(
    name: string,
    fn: () => Promise<T>,
    labels: Record<string, string> = {}
  ): Promise<T> {
    const timerId = this.startTimer(name, labels);
    
    try {
      const result = await fn();
      await this.endTimer(timerId, name, labels);
      return result;
    } catch (error) {
      await this.endTimer(timerId, name, { ...labels, error: 'true' });
      throw error;
    }
  }

  /**
   * 获取指标统计
   */
  async getStats(name?: string): Promise<{
    counters: Record<string, number>;
    gauges: Record<string, number>;
    histograms: Record<string, { count: number; avg: number; p95: number }>;
  }> {
    const stats = {
      counters: {} as Record<string, number>,
      gauges: {} as Record<string, number>,
      histograms: {} as Record<string, { count: number; avg: number; p95: number }>,
    };
    
    // 计数器统计
    for (const [key, value] of this.counters.entries()) {
      if (!name || key.includes(name)) {
        stats.counters[key] = value;
      }
    }
    
    // 仪表统计
    for (const [key, value] of this.gauges.entries()) {
      if (!name || key.includes(name)) {
        stats.gauges[key] = value;
      }
    }
    
    // 直方图统计
    for (const [key, values] of this.histograms.entries()) {
      if (!name || key.includes(name)) {
        const sorted = [...values].sort((a, b) => a - b);
        const sum = sorted.reduce((a, b) => a + b, 0);
        const count = sorted.length;
        const avg = count > 0 ? sum / count : 0;
        const p95Index = Math.floor(count * 0.95);
        const p95 = sorted[p95Index] || 0;
        
        stats.histograms[key] = { count, avg, p95 };
      }
    }
    
    return stats;
  }

  /**
   * 查询历史指标
   */
  async query(
    name: string,
    start: Date,
    end: Date,
    labels?: Record<string, string>
  ): Promise<Metric[]> {
    return this.store.query(name, start, end, labels);
  }

  /**
   * 获取聚合数据
   */
  async aggregate(
    name: string,
    start: Date,
    end: Date,
    interval: number
  ): Promise<MetricAggregation[]> {
    return this.store.aggregate(name, start, end, interval);
  }

  /**
   * 获取最新指标
   */
  async getLatest(name: string, labels?: Record<string, string>): Promise<Metric | null> {
    return this.store.getLatest(name, labels);
  }

  /**
   * 获取所有指标名称
   */
  async getMetricNames(): Promise<string[]> {
    const names = new Set<string>();
    
    // 从计数器获取名称
    for (const name of this.counters.keys()) {
      names.add(name);
    }
    
    // 从仪表获取名称
    for (const name of this.gauges.keys()) {
      names.add(name);
    }
    
    // 从直方图获取名称
    for (const name of this.histograms.keys()) {
      names.add(name);
    }
    
    return Array.from(names);
  }

  private getKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    
    return labelStr ? `${name}{${labelStr}}` : name;
  }
}

// ============================================================================
// 系统指标收集器
// ============================================================================

export class SystemMetricsCollector {
  private collector: MetricsCollector;
  private interval: NodeJS.Timeout | null = null;
  private collectInterval: number;

  constructor(collector: MetricsCollector, collectIntervalMs = 10000) {
    this.collector = collector;
    this.collectInterval = collectIntervalMs;
  }

  /**
   * 开始收集系统指标
   */
  start(): void {
    if (this.interval) return;
    
    this.interval = setInterval(() => {
      this.collectSystemMetrics();
    }, this.collectInterval);
    
    // 立即收集一次
    this.collectSystemMetrics();
  }

  /**
   * 停止收集系统指标
   */
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  /**
   * 收集系统指标
   */
  private async collectSystemMetrics(): Promise<void> {
    try {
      // 内存使用情况
      const memUsage = process.memoryUsage();
      await this.collector.setGauge('nodejs_memory_rss_bytes', memUsage.rss);
      await this.collector.setGauge('nodejs_memory_heap_total_bytes', memUsage.heapTotal);
      await this.collector.setGauge('nodejs_memory_heap_used_bytes', memUsage.heapUsed);
      await this.collector.setGauge('nodejs_memory_external_bytes', memUsage.external);
      
      // CPU使用情况
      const cpuUsage = process.cpuUsage();
      await this.collector.setGauge('nodejs_cpu_user_seconds', cpuUsage.user / 1000000);
      await this.collector.setGauge('nodejs_cpu_system_seconds', cpuUsage.system / 1000000);
      
      // 进程信息
      await this.collector.setGauge('nodejs_process_uptime_seconds', process.uptime());
      await this.collector.setGauge('nodejs_process_pid', process.pid);
      
      // 事件循环延迟
      const start = process.hrtime.bigint();
      setImmediate(() => {
        const delay = Number(process.hrtime.bigint() - start) / 1000000; // 转换为毫秒
        this.collector.setGauge('nodejs_eventloop_lag_milliseconds', delay);
      });
      
    } catch (error) {
      console.error('Failed to collect system metrics:', error);
    }
  }
}

// 导出所有类和接口
// 注意：这些类已经在上面定义时使用了export关键字，这里不需要重复导出