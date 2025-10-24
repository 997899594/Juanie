/**
 * 🚀 Juanie AI - 自动扩缩容服务
 * 实现基于性能指标和预测算法的智能自动扩缩容
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';
import * as k8s from '@kubernetes/client-node';

// ============================================================================
// 扩缩容 Schema 定义
// ============================================================================

export const ScalingMetricSchema = z.object({
  name: z.string(),
  type: z.enum(['cpu', 'memory', 'custom', 'external']),
  target_value: z.number(),
  current_value: z.number(),
  utilization: z.number(),
  timestamp: z.number(),
});

export const ScalingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  metrics: z.array(ScalingMetricSchema),
  scale_up_threshold: z.number(),
  scale_down_threshold: z.number(),
  min_replicas: z.number().min(1),
  max_replicas: z.number(),
  cooldown_period: z.number().default(300), // 5分钟
  scale_up_step: z.number().default(1),
  scale_down_step: z.number().default(1),
  behavior: z.object({
    scale_up: z.object({
      stabilization_window: z.number().default(60),
      policies: z.array(z.object({
        type: z.enum(['Percent', 'Pods']),
        value: z.number(),
        period: z.number(),
      })),
    }),
    scale_down: z.object({
      stabilization_window: z.number().default(300),
      policies: z.array(z.object({
        type: z.enum(['Percent', 'Pods']),
        value: z.number(),
        period: z.number(),
      })),
    }),
  }),
});

export const ScalingEventSchema = z.object({
  id: z.string(),
  timestamp: z.number(),
  type: z.enum(['scale_up', 'scale_down', 'no_action']),
  trigger: z.string(),
  from_replicas: z.number(),
  to_replicas: z.number(),
  metrics: z.array(ScalingMetricSchema),
  reason: z.string(),
  status: z.enum(['pending', 'in_progress', 'completed', 'failed']),
  duration: z.number().optional(),
  error: z.string().optional(),
});

export const PredictionSchema = z.object({
  timestamp: z.number(),
  metric: z.string(),
  current_value: z.number(),
  predicted_values: z.array(z.object({
    time_offset: z.number(), // 未来时间偏移（秒）
    value: z.number(),
    confidence: z.number(),
  })),
  trend: z.enum(['increasing', 'decreasing', 'stable']),
  recommendation: z.enum(['scale_up', 'scale_down', 'maintain']),
});

// ============================================================================
// 类型定义
// ============================================================================

export type ScalingMetric = z.infer<typeof ScalingMetricSchema>;
export type ScalingRule = z.infer<typeof ScalingRuleSchema>;
export type ScalingEvent = z.infer<typeof ScalingEventSchema>;
export type Prediction = z.infer<typeof PredictionSchema>;

export interface AutoScalerConfig {
  enabled: boolean;
  check_interval: number;
  prediction_enabled: boolean;
  prediction_window: number;
  kubernetes?: {
    namespace: string;
    deployment_name: string;
    service_name: string;
  };
  rules: ScalingRule[];
}

export interface PartialAutoScalerConfig {
  enabled?: boolean;
  check_interval?: number;
  prediction_enabled?: boolean;
  prediction_window?: number;
  kubernetes?: {
    namespace?: string;
    deployment_name?: string;
    service_name?: string;
  };
  rules?: ScalingRule[];
}

// ============================================================================
// 指标收集器
// ============================================================================

@Injectable()
export class MetricsCollector {
  private readonly logger = new Logger(MetricsCollector.name);
  private k8sApi?: k8s.AppsV1Api;
  private metricsApi?: k8s.Metrics;

  constructor() {
    this.initializeKubernetes();
  }

  /**
   * 初始化 Kubernetes 客户端
   */
  private initializeKubernetes(): void {
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();
      
      this.k8sApi = kc.makeApiClient(k8s.AppsV1Api);
      this.metricsApi = new k8s.Metrics(kc);
      
      this.logger.log('Kubernetes 客户端初始化成功');
    } catch (error) {
      this.logger.warn(`Kubernetes 客户端初始化失败: ${error.message}`);
    }
  }

  /**
   * 收集 CPU 指标
   */
  async collectCpuMetrics(namespace: string, deploymentName: string): Promise<ScalingMetric> {
    try {
      if (!this.metricsApi) {
        throw new Error('Kubernetes Metrics API 不可用');
      }

      const pods = await this.metricsApi.getPodMetrics(namespace);
      const deploymentPods = pods.items.filter(pod => {
        const labels = (pod.metadata as any)?.labels;
        return labels && labels['app'] === deploymentName;
      });

      if (deploymentPods.length === 0) {
        throw new Error(`未找到部署 ${deploymentName} 的 Pod`);
      }

      // 计算平均 CPU 使用率
      let totalCpuUsage = 0;
      let totalCpuRequest = 0;

      deploymentPods.forEach(pod => {
        pod.containers.forEach(container => {
          const cpuUsage = this.parseCpuValue(container.usage.cpu);
          totalCpuUsage += cpuUsage;
          
          // 这里需要从 Pod 规格中获取 CPU 请求值
          // 简化处理，假设每个容器请求 100m CPU
          totalCpuRequest += 100;
        });
      });

      const utilization = totalCpuRequest > 0 ? (totalCpuUsage / totalCpuRequest) * 100 : 0;

      return {
        name: 'cpu',
        type: 'cpu',
        target_value: 70, // 目标 70% CPU 使用率
        current_value: totalCpuUsage,
        utilization,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`收集 CPU 指标失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 收集内存指标
   */
  async collectMemoryMetrics(namespace: string, deploymentName: string): Promise<ScalingMetric> {
    try {
      if (!this.metricsApi) {
        throw new Error('Kubernetes Metrics API 不可用');
      }

      const pods = await this.metricsApi.getPodMetrics(namespace);
      const deploymentPods = pods.items.filter(pod => {
        const labels = (pod.metadata as any)?.labels;
        return labels && labels['app'] === deploymentName;
      });

      if (deploymentPods.length === 0) {
        throw new Error(`未找到部署 ${deploymentName} 的 Pod`);
      }

      // 计算平均内存使用率
      let totalMemoryUsage = 0;
      let totalMemoryRequest = 0;

      deploymentPods.forEach(pod => {
        pod.containers.forEach(container => {
          const memoryUsage = this.parseMemoryValue(container.usage.memory);
          totalMemoryUsage += memoryUsage;
          
          // 简化处理，假设每个容器请求 256Mi 内存
          totalMemoryRequest += 256 * 1024 * 1024;
        });
      });

      const utilization = totalMemoryRequest > 0 ? (totalMemoryUsage / totalMemoryRequest) * 100 : 0;

      return {
        name: 'memory',
        type: 'memory',
        target_value: 80, // 目标 80% 内存使用率
        current_value: totalMemoryUsage,
        utilization,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`收集内存指标失败: ${error.message}`);
      throw error;
    }
  }

  /**
   * 收集自定义指标
   */
  async collectCustomMetrics(metricName: string): Promise<ScalingMetric> {
    // 这里可以集成 Prometheus 或其他监控系统
    // 简化实现，返回模拟数据
    return {
      name: metricName,
      type: 'custom',
      target_value: 100,
      current_value: Math.random() * 200,
      utilization: Math.random() * 100,
      timestamp: Date.now(),
    };
  }

  /**
   * 获取当前副本数
   */
  async getCurrentReplicas(namespace: string, deploymentName: string): Promise<number> {
    try {
      if (!this.k8sApi) {
        throw new Error('Kubernetes API 不可用');
      }

      const deployment = await this.k8sApi.readNamespacedDeployment({ 
        name: deploymentName, 
        namespace: namespace 
      });
      return deployment.status?.replicas || 0;
    } catch (error) {
      this.logger.error(`获取当前副本数失败: ${error.message}`);
      return 0;
    }
  }

  /**
   * 解析 CPU 值
   */
  private parseCpuValue(cpu: string): number {
    if (cpu.endsWith('m')) {
      return parseInt(cpu.slice(0, -1));
    } else if (cpu.endsWith('n')) {
      return parseInt(cpu.slice(0, -1)) / 1000000;
    } else {
      return parseFloat(cpu) * 1000;
    }
  }

  /**
   * 解析内存值
   */
  private parseMemoryValue(memory: string): number {
    const units = {
      'Ki': 1024,
      'Mi': 1024 * 1024,
      'Gi': 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024,
    };

    for (const [suffix, multiplier] of Object.entries(units)) {
      if (memory.endsWith(suffix)) {
        return parseInt(memory.slice(0, -suffix.length)) * multiplier;
      }
    }

    return parseInt(memory);
  }
}

// ============================================================================
// 预测引擎
// ============================================================================

@Injectable()
export class PredictionEngine {
  private readonly logger = new Logger(PredictionEngine.name);
  private historicalData: Map<string, ScalingMetric[]> = new Map();

  /**
   * 添加历史数据
   */
  addHistoricalData(metric: ScalingMetric): void {
    const key = metric.name;
    if (!this.historicalData.has(key)) {
      this.historicalData.set(key, []);
    }

    const data = this.historicalData.get(key)!;
    data.push(metric);

    // 保留最近 1000 个数据点
    if (data.length > 1000) {
      data.splice(0, data.length - 1000);
    }
  }

  /**
   * 预测未来指标值
   */
  predictMetric(metricName: string, timeHorizon: number = 300): Prediction | null {
    const data = this.historicalData.get(metricName);
    if (!data || data.length < 10) {
      return null;
    }

    const recentData = data.slice(-50); // 使用最近 50 个数据点
    const values = recentData.map(d => d.utilization);
    const timestamps = recentData.map(d => d.timestamp);

    // 简单线性回归预测
    const prediction = this.linearRegression(values, timestamps, timeHorizon);
    
    // 计算趋势
    const trend = this.calculateTrend(values);
    
    // 生成建议
    const recommendation = this.generateRecommendation(prediction, trend);

    return {
      timestamp: Date.now(),
      metric: metricName,
      current_value: values[values.length - 1],
      predicted_values: prediction,
      trend,
      recommendation,
    };
  }

  /**
   * 线性回归预测
   */
  private linearRegression(
    values: number[], 
    timestamps: number[], 
    timeHorizon: number
  ): Array<{ time_offset: number; value: number; confidence: number }> {
    const n = values.length;
    if (n < 2) return [];

    // 计算回归系数
    const sumX = timestamps.reduce((sum, t, i) => sum + i, 0);
    const sumY = values.reduce((sum, v) => sum + v, 0);
    const sumXY = values.reduce((sum, v, i) => sum + i * v, 0);
    const sumXX = timestamps.reduce((sum, t, i) => sum + i * i, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算 R²
    const meanY = sumY / n;
    const ssRes = values.reduce((sum, v, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(v - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, v) => sum + Math.pow(v - meanY, 2), 0);
    const rSquared = 1 - (ssRes / ssTot);

    // 生成预测值
    const predictions = [];
    const stepSize = timeHorizon / 10; // 生成 10 个预测点

    for (let i = 1; i <= 10; i++) {
      const timeOffset = i * stepSize;
      const futureIndex = n + (timeOffset / 60); // 假设数据点间隔 1 分钟
      const predictedValue = slope * futureIndex + intercept;
      
      predictions.push({
        time_offset: timeOffset,
        value: Math.max(0, predictedValue),
        confidence: Math.max(0, Math.min(1, rSquared)),
      });
    }

    return predictions;
  }

  /**
   * 计算趋势
   */
  private calculateTrend(values: number[]): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 3) return 'stable';

    const recent = values.slice(-5);
    const earlier = values.slice(-10, -5);

    const recentAvg = recent.reduce((sum, v) => sum + v, 0) / recent.length;
    const earlierAvg = earlier.reduce((sum, v) => sum + v, 0) / earlier.length;

    const threshold = 5; // 5% 变化阈值

    if (recentAvg > earlierAvg + threshold) {
      return 'increasing';
    } else if (recentAvg < earlierAvg - threshold) {
      return 'decreasing';
    } else {
      return 'stable';
    }
  }

  /**
   * 生成扩缩容建议
   */
  private generateRecommendation(
    predictions: Array<{ time_offset: number; value: number; confidence: number }>,
    trend: 'increasing' | 'decreasing' | 'stable'
  ): 'scale_up' | 'scale_down' | 'maintain' {
    if (predictions.length === 0) return 'maintain';

    const avgPrediction = predictions.reduce((sum, p) => sum + p.value, 0) / predictions.length;
    const avgConfidence = predictions.reduce((sum, p) => sum + p.confidence, 0) / predictions.length;

    // 只有在高置信度的情况下才给出扩缩容建议
    if (avgConfidence < 0.7) return 'maintain';

    if (trend === 'increasing' && avgPrediction > 80) {
      return 'scale_up';
    } else if (trend === 'decreasing' && avgPrediction < 30) {
      return 'scale_down';
    } else {
      return 'maintain';
    }
  }
}

// ============================================================================
// 扩缩容执行器
// ============================================================================

@Injectable()
export class ScalingExecutor {
  private readonly logger = new Logger(ScalingExecutor.name);
  private k8sApi?: k8s.AppsV1Api;
  private scalingHistory: ScalingEvent[] = [];

  constructor(private eventEmitter: EventEmitter2) {
    this.initializeKubernetes();
  }

  /**
   * 初始化 Kubernetes 客户端
   */
  private initializeKubernetes(): void {
    try {
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();
      this.k8sApi = kc.makeApiClient(k8s.AppsV1Api);
      this.logger.log('Kubernetes 扩缩容客户端初始化成功');
    } catch (error) {
      this.logger.warn(`Kubernetes 扩缩容客户端初始化失败: ${error.message}`);
    }
  }

  /**
   * 执行扩缩容
   */
  async executeScaling(
    namespace: string,
    deploymentName: string,
    targetReplicas: number,
    currentReplicas: number,
    trigger: string,
    metrics: ScalingMetric[]
  ): Promise<ScalingEvent> {
    const scalingEvent: ScalingEvent = {
      id: `scaling_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      type: targetReplicas > currentReplicas ? 'scale_up' : 
            targetReplicas < currentReplicas ? 'scale_down' : 'no_action',
      trigger,
      from_replicas: currentReplicas,
      to_replicas: targetReplicas,
      metrics,
      reason: `基于指标 ${trigger} 的自动扩缩容`,
      status: 'pending',
    };

    this.scalingHistory.push(scalingEvent);
    this.eventEmitter.emit('scaling.started', scalingEvent);

    try {
      if (targetReplicas === currentReplicas) {
        scalingEvent.status = 'completed';
        scalingEvent.duration = 0;
        return scalingEvent;
      }

      if (!this.k8sApi) {
        throw new Error('Kubernetes API 不可用');
      }

      scalingEvent.status = 'in_progress';
      this.eventEmitter.emit('scaling.progress', scalingEvent);

      const startTime = Date.now();

      // 更新 Deployment 的副本数
      const patchBody = {
        spec: {
          replicas: targetReplicas,
        },
      };

      await this.k8sApi.patchNamespacedDeployment({
        name: deploymentName,
        namespace: namespace,
        body: patchBody,
        pretty: 'true',
        dryRun: undefined,
        fieldManager: 'autoscaler',
        fieldValidation: 'Strict',
        force: false
      });

      // 等待扩缩容完成
      await this.waitForScalingCompletion(namespace, deploymentName, targetReplicas);

      scalingEvent.status = 'completed';
      scalingEvent.duration = Date.now() - startTime;

      this.logger.log(
        `扩缩容完成: ${deploymentName} 从 ${currentReplicas} 到 ${targetReplicas} 副本`
      );

      this.eventEmitter.emit('scaling.completed', scalingEvent);

    } catch (error) {
      scalingEvent.status = 'failed';
      scalingEvent.error = error.message;
      scalingEvent.duration = Date.now() - scalingEvent.timestamp;

      this.logger.error(`扩缩容失败: ${error.message}`);
      this.eventEmitter.emit('scaling.failed', scalingEvent);
    }

    return scalingEvent;
  }

  /**
   * 等待扩缩容完成
   */
  private async waitForScalingCompletion(
    namespace: string,
    deploymentName: string,
    targetReplicas: number,
    timeout: number = 300000 // 5分钟超时
  ): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      try {
        const deployment = await this.k8sApi!.readNamespacedDeployment({
          name: deploymentName,
          namespace: namespace
        });
        const currentReplicas = deployment.status?.readyReplicas || 0;

        if (currentReplicas === targetReplicas) {
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 5000)); // 等待 5 秒
      } catch (error) {
        this.logger.warn(`检查扩缩容状态失败: ${error.message}`);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    throw new Error(`扩缩容超时: 未能在 ${timeout}ms 内完成`);
  }

  /**
   * 获取扩缩容历史
   */
  getScalingHistory(limit: number = 50): ScalingEvent[] {
    return this.scalingHistory.slice(-limit);
  }

  /**
   * 清理扩缩容历史
   */
  cleanupHistory(retentionPeriod: number = 86400000): void {
    const cutoff = Date.now() - retentionPeriod;
    const before = this.scalingHistory.length;
    this.scalingHistory = this.scalingHistory.filter(event => event.timestamp > cutoff);
    const after = this.scalingHistory.length;

    if (before !== after) {
      this.logger.log(`清理了 ${before - after} 个扩缩容历史记录`);
    }
  }
}

// ============================================================================
// 主自动扩缩容服务
// ============================================================================

@Injectable()
export class AutoScalerService {
  private readonly logger = new Logger(AutoScalerService.name);
  private config: AutoScalerConfig;
  private checkInterval?: NodeJS.Timeout;
  private lastScalingTime: Map<string, number> = new Map();

  constructor(
    private metricsCollector: MetricsCollector,
    private predictionEngine: PredictionEngine,
    private scalingExecutor: ScalingExecutor,
    private eventEmitter: EventEmitter2,
  ) {
    this.config = {
      enabled: false,
      check_interval: 30000, // 30秒检查一次
      prediction_enabled: true,
      prediction_window: 300, // 5分钟预测窗口
      kubernetes: {
        namespace: 'juanie-ai',
        deployment_name: 'juanie-api',
        service_name: 'juanie-service',
      },
      rules: [
        {
          id: 'cpu-scaling',
          name: 'CPU 自动扩缩容',
          enabled: true,
          metrics: [],
          scale_up_threshold: 70,
          scale_down_threshold: 30,
          min_replicas: 2,
          max_replicas: 10,
          cooldown_period: 300,
          scale_up_step: 2,
          scale_down_step: 1,
          behavior: {
            scale_up: {
              stabilization_window: 60,
              policies: [
                { type: 'Percent', value: 100, period: 60 },
                { type: 'Pods', value: 2, period: 60 },
              ],
            },
            scale_down: {
              stabilization_window: 300,
              policies: [
                { type: 'Percent', value: 50, period: 300 },
                { type: 'Pods', value: 1, period: 300 },
              ],
            },
          },
        },
        {
          id: 'memory-scaling',
          name: '内存自动扩缩容',
          enabled: true,
          metrics: [],
          scale_up_threshold: 80,
          scale_down_threshold: 40,
          min_replicas: 2,
          max_replicas: 10,
          cooldown_period: 300,
          scale_up_step: 1,
          scale_down_step: 1,
          behavior: {
            scale_up: {
              stabilization_window: 60,
              policies: [
                { type: 'Percent', value: 50, period: 60 },
                { type: 'Pods', value: 1, period: 60 },
              ],
            },
            scale_down: {
              stabilization_window: 300,
              policies: [
                { type: 'Percent', value: 25, period: 300 },
                { type: 'Pods', value: 1, period: 300 },
              ],
            },
          },
        },
      ],
    };
  }

  /**
   * 启动自动扩缩容
   */
  start(): void {
    if (this.checkInterval) {
      this.logger.warn('自动扩缩容已经在运行');
      return;
    }

    this.config.enabled = true;
    this.checkInterval = setInterval(() => {
      this.performScalingCheck();
    }, this.config.check_interval);

    this.logger.log('自动扩缩容已启动');
    this.eventEmitter.emit('autoscaler.started');
  }

  /**
   * 停止自动扩缩容
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }

    this.config.enabled = false;
    this.logger.log('自动扩缩容已停止');
    this.eventEmitter.emit('autoscaler.stopped');
  }

  /**
   * 执行扩缩容检查
   */
  private async performScalingCheck(): Promise<void> {
    if (!this.config.enabled || !this.config.kubernetes) {
      return;
    }

    try {
      const { namespace, deployment_name } = this.config.kubernetes;
      
      // 获取当前副本数
      const currentReplicas = await this.metricsCollector.getCurrentReplicas(
        namespace,
        deployment_name
      );

      // 收集指标
      const cpuMetric = await this.metricsCollector.collectCpuMetrics(namespace, deployment_name);
      const memoryMetric = await this.metricsCollector.collectMemoryMetrics(namespace, deployment_name);

      // 添加到历史数据
      this.predictionEngine.addHistoricalData(cpuMetric);
      this.predictionEngine.addHistoricalData(memoryMetric);

      // 检查每个扩缩容规则
      for (const rule of this.config.rules) {
        if (!rule.enabled) continue;

        await this.evaluateScalingRule(rule, currentReplicas, [cpuMetric, memoryMetric]);
      }

    } catch (error) {
      this.logger.error(`扩缩容检查失败: ${error.message}`);
    }
  }

  /**
   * 评估扩缩容规则
   */
  private async evaluateScalingRule(
    rule: ScalingRule,
    currentReplicas: number,
    metrics: ScalingMetric[]
  ): Promise<void> {
    const { namespace, deployment_name } = this.config.kubernetes;
    
    // 检查冷却期
    const lastScaling = this.lastScalingTime.get(rule.id) || 0;
    const timeSinceLastScaling = Date.now() - lastScaling;
    
    if (timeSinceLastScaling < rule.cooldown_period * 1000) {
      return;
    }

    // 更新规则的指标
    rule.metrics = metrics;

    // 计算扩缩容决策
    const decision = this.calculateScalingDecision(rule, currentReplicas, metrics);
    
    if (decision.action === 'no_action') {
      return;
    }

    // 使用预测引擎（如果启用）
    if (this.config.prediction_enabled) {
      const prediction = this.predictionEngine.predictMetric(
        decision.primaryMetric,
        this.config.prediction_window
      );
      
      if (prediction && prediction.recommendation !== 'maintain') {
        // 根据预测调整决策
        if (prediction.recommendation !== decision.action) {
          this.logger.log(
            `预测引擎建议 ${prediction.recommendation}，但当前决策是 ${decision.action}`
          );
        }
      }
    }

    // 执行扩缩容
    try {
      await this.scalingExecutor.executeScaling(
        namespace,
        deployment_name,
        decision.targetReplicas,
        currentReplicas,
        decision.reason,
        metrics
      );

      this.lastScalingTime.set(rule.id, Date.now());
      
    } catch (error) {
      this.logger.error(`执行扩缩容失败: ${error.message}`);
    }
  }

  /**
   * 计算扩缩容决策
   */
  private calculateScalingDecision(
    rule: ScalingRule,
    currentReplicas: number,
    metrics: ScalingMetric[]
  ): {
    action: 'scale_up' | 'scale_down' | 'no_action';
    targetReplicas: number;
    reason: string;
    primaryMetric: string;
  } {
    let shouldScaleUp = false;
    let shouldScaleDown = false;
    let primaryMetric = '';
    let maxUtilization = 0;
    let minUtilization = 100;

    // 分析所有指标
    for (const metric of metrics) {
      if (metric.utilization > maxUtilization) {
        maxUtilization = metric.utilization;
        primaryMetric = metric.name;
      }
      if (metric.utilization < minUtilization) {
        minUtilization = metric.utilization;
      }

      // 检查扩容条件
      if (metric.utilization > rule.scale_up_threshold) {
        shouldScaleUp = true;
      }

      // 检查缩容条件
      if (metric.utilization < rule.scale_down_threshold) {
        shouldScaleDown = true;
      }
    }

    // 扩容优先级高于缩容
    if (shouldScaleUp && currentReplicas < rule.max_replicas) {
      const targetReplicas = Math.min(
        rule.max_replicas,
        currentReplicas + rule.scale_up_step
      );
      
      return {
        action: 'scale_up',
        targetReplicas,
        reason: `${primaryMetric} 使用率 ${maxUtilization.toFixed(1)}% 超过阈值 ${rule.scale_up_threshold}%`,
        primaryMetric,
      };
    }

    if (shouldScaleDown && currentReplicas > rule.min_replicas) {
      const targetReplicas = Math.max(
        rule.min_replicas,
        currentReplicas - rule.scale_down_step
      );
      
      return {
        action: 'scale_down',
        targetReplicas,
        reason: `所有指标使用率低于阈值 ${rule.scale_down_threshold}%`,
        primaryMetric,
      };
    }

    return {
      action: 'no_action',
      targetReplicas: currentReplicas,
      reason: '指标在正常范围内',
      primaryMetric,
    };
  }

  /**
   * 获取扩缩容状态
   */
  getStatus(): {
    enabled: boolean;
    current_replicas: number;
    rules: ScalingRule[];
    recent_events: ScalingEvent[];
    predictions: Prediction[];
  } {
    return {
      enabled: this.config.enabled,
      current_replicas: 0, // 需要异步获取
      rules: this.config.rules,
      recent_events: this.scalingExecutor.getScalingHistory(10),
      predictions: this.config.rules.map(rule => 
        this.predictionEngine.predictMetric(rule.id, this.config.prediction_window)
      ).filter(p => p !== null) as Prediction[],
    };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: PartialAutoScalerConfig): void {
    // 深度合并配置，特别处理 kubernetes 字段
    const updatedConfig = { ...this.config };
    
    if (newConfig.kubernetes) {
      if (updatedConfig.kubernetes) {
        updatedConfig.kubernetes = {
          ...updatedConfig.kubernetes,
          ...newConfig.kubernetes,
        };
      } else {
        // 如果原配置中没有 kubernetes 字段，但新配置中有，需要确保新配置的 kubernetes 字段是完整的
        if (newConfig.kubernetes.namespace && 
            newConfig.kubernetes.deployment_name && 
            newConfig.kubernetes.service_name) {
          updatedConfig.kubernetes = newConfig.kubernetes as {
            namespace: string;
            deployment_name: string;
            service_name: string;
          };
        }
      }
    }
    
    // 合并其他配置项
    Object.keys(newConfig).forEach(key => {
      if (key !== 'kubernetes' && newConfig[key as keyof PartialAutoScalerConfig] !== undefined) {
        (updatedConfig as any)[key] = newConfig[key as keyof PartialAutoScalerConfig];
      }
    });
    
    this.config = updatedConfig;
    
    if (this.config.enabled && !this.checkInterval) {
      this.start();
    } else if (!this.config.enabled && this.checkInterval) {
      this.stop();
    }

    this.logger.log('自动扩缩容配置已更新');
  }

  /**
   * 获取配置
   */
  getConfig(): AutoScalerConfig {
    return { ...this.config };
  }

  /**
   * 手动触发扩缩容
   */
  async manualScale(targetReplicas: number, reason: string): Promise<ScalingEvent> {
    if (!this.config.kubernetes) {
      throw new Error('Kubernetes configuration is required for manual scaling');
    }
    
    const { namespace, deployment_name } = this.config.kubernetes;
    
    const currentReplicas = await this.metricsCollector.getCurrentReplicas(
      namespace,
      deployment_name
    );

    return this.scalingExecutor.executeScaling(
      namespace,
      deployment_name,
      targetReplicas,
      currentReplicas,
      `手动扩缩容: ${reason}`,
      []
    );
  }
}