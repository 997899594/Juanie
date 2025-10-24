/**
 * 🚀 Juanie AI - 智能告警服务
 * 实现AI驱动的异常检测和智能告警
 */

import { EventEmitter } from "events";
import { z } from "zod";
import { Metric, MetricAggregation, MetricsCollector } from "./metrics.service";

// ============================================================================
// 告警类型定义
// ============================================================================

export const AlertSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);
export const AlertStatusSchema = z.enum([
  "active",
  "resolved",
  "suppressed",
  "acknowledged",
]);
export const AlertConditionTypeSchema = z.enum([
  "threshold",
  "anomaly",
  "trend",
  "pattern",
]);

export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  metric: z.string(),
  condition: AlertConditionTypeSchema,
  threshold: z.number().optional(),
  operator: z.enum([">", "<", ">=", "<=", "==", "!="]).optional(),
  window: z.number().default(300), // 5分钟窗口
  severity: AlertSeveritySchema,
  labels: z.record(z.string()).default({}),
  enabled: z.boolean().default(true),
  cooldown: z.number().default(300), // 5分钟冷却期
  notifications: z.array(z.string()).default([]),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
});

export const AlertSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  ruleName: z.string(),
  metric: z.string(),
  value: z.number(),
  threshold: z.number().optional(),
  severity: AlertSeveritySchema,
  status: AlertStatusSchema,
  message: z.string(),
  labels: z.record(z.string()).default({}),
  annotations: z.record(z.string()).default({}),
  startsAt: z.date(),
  endsAt: z.date().optional(),
  acknowledgedAt: z.date().optional(),
  acknowledgedBy: z.string().optional(),
  resolvedAt: z.date().optional(),
  resolvedBy: z.string().optional(),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type AlertSeverity = z.infer<typeof AlertSeveritySchema>;
export type AlertStatus = z.infer<typeof AlertStatusSchema>;
export type AlertConditionType = z.infer<typeof AlertConditionTypeSchema>;

// ============================================================================
// 异常检测算法
// ============================================================================

export class AnomalyDetector {
  private historicalData: Map<string, number[]>;
  private sensitivity: number;

  constructor(sensitivity = 2.0) {
    this.historicalData = new Map();
    this.sensitivity = sensitivity;
  }

  /**
   * 检测异常值
   */
  detectAnomaly(
    metricName: string,
    value: number,
    historical?: number[]
  ): boolean {
    const data = historical || this.historicalData.get(metricName) || [];

    if (data.length < 10) {
      // 数据不足，不进行异常检测
      this.addDataPoint(metricName, value);
      return false;
    }

    const stats = this.calculateStats(data);
    const zScore = Math.abs((value - stats.mean) / stats.stdDev);

    this.addDataPoint(metricName, value);

    return zScore > this.sensitivity;
  }

  /**
   * 检测趋势异常
   */
  detectTrendAnomaly(
    metricName: string,
    values: number[]
  ): {
    isAnomalous: boolean;
    trend: "increasing" | "decreasing" | "stable";
    confidence: number;
  } {
    if (values.length < 5) {
      return { isAnomalous: false, trend: "stable", confidence: 0 };
    }

    // 计算线性回归斜率
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // 计算R²
    const yMean = sumY / n;
    const ssRes = y.reduce((sum, yi, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + (yi - predicted) ** 2;
    }, 0);
    const ssTot = y.reduce((sum, yi) => sum + (yi - yMean) ** 2, 0);
    const rSquared = 1 - ssRes / ssTot;

    const trend =
      slope > 0.1 ? "increasing" : slope < -0.1 ? "decreasing" : "stable";
    const confidence = Math.abs(rSquared);

    // 异常趋势检测
    const isAnomalous = Math.abs(slope) > 1.0 && confidence > 0.7;

    return { isAnomalous, trend, confidence };
  }

  /**
   * 检测模式异常
   */
  detectPatternAnomaly(
    metricName: string,
    values: number[]
  ): {
    isAnomalous: boolean;
    pattern: string;
    confidence: number;
  } {
    if (values.length < 20) {
      return { isAnomalous: false, pattern: "unknown", confidence: 0 };
    }

    // 检测周期性模式
    const periodicityScore = this.detectPeriodicity(values);

    // 检测突发模式
    const spikeScore = this.detectSpikes(values);

    // 检测平稳性
    const stabilityScore = this.detectStability(values);

    let pattern = "normal";
    let confidence = 0;
    let isAnomalous = false;

    if (periodicityScore > 0.8) {
      pattern = "periodic";
      confidence = periodicityScore;
    } else if (spikeScore > 0.7) {
      pattern = "spiky";
      confidence = spikeScore;
      isAnomalous = true;
    } else if (stabilityScore < 0.3) {
      pattern = "unstable";
      confidence = 1 - stabilityScore;
      isAnomalous = true;
    }

    return { isAnomalous, pattern, confidence };
  }

  private addDataPoint(metricName: string, value: number): void {
    if (!this.historicalData.has(metricName)) {
      this.historicalData.set(metricName, []);
    }

    const data = this.historicalData.get(metricName)!;
    data.push(value);

    // 保持最近1000个数据点
    if (data.length > 1000) {
      data.shift();
    }
  }

  private calculateStats(data: number[]): { mean: number; stdDev: number } {
    const mean = data.reduce((a, b) => a + b, 0) / data.length;
    const variance =
      data.reduce((sum, x) => sum + (x - mean) ** 2, 0) / data.length;
    const stdDev = Math.sqrt(variance);

    return { mean, stdDev };
  }

  private detectPeriodicity(values: number[]): number {
    // 简化的周期性检测
    const autocorrelations: number[] = [];

    for (let lag = 1; lag < Math.min(values.length / 2, 50); lag++) {
      let correlation = 0;
      let count = 0;

      for (let i = 0; i < values.length - lag; i++) {
        correlation += values[i] * values[i + lag];
        count++;
      }

      autocorrelations.push(correlation / count);
    }

    // 找到最大自相关值
    const maxCorrelation = Math.max(...autocorrelations);
    return Math.max(0, maxCorrelation / (values.length * values.length));
  }

  private detectSpikes(values: number[]): number {
    const stats = this.calculateStats(values);
    const spikes = values.filter(
      (v) => Math.abs(v - stats.mean) > 3 * stats.stdDev
    );

    return spikes.length / values.length;
  }

  private detectStability(values: number[]): number {
    const stats = this.calculateStats(values);
    const coefficientOfVariation = stats.stdDev / Math.abs(stats.mean);

    return Math.max(0, 1 - coefficientOfVariation);
  }
}

// ============================================================================
// 告警管理器
// ============================================================================

export class AlertManager extends EventEmitter {
  private rules: Map<string, AlertRule>;
  private activeAlerts: Map<string, Alert>;
  private metricsCollector: MetricsCollector;
  private anomalyDetector: AnomalyDetector;
  private evaluationInterval: NodeJS.Timeout | null = null;
  private cooldownTracker: Map<string, number>;

  constructor(metricsCollector: MetricsCollector) {
    super();
    this.rules = new Map();
    this.activeAlerts = new Map();
    this.metricsCollector = metricsCollector;
    this.anomalyDetector = new AnomalyDetector();
    this.cooldownTracker = new Map();
  }

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    const validatedRule = AlertRuleSchema.parse(rule);
    this.rules.set(validatedRule.id, validatedRule);
    this.emit("ruleAdded", validatedRule);
  }

  /**
   * 更新告警规则
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): void {
    const existingRule = this.rules.get(ruleId);
    if (!existingRule) {
      throw new Error(`Alert rule ${ruleId} not found`);
    }

    const updatedRule = AlertRuleSchema.parse({
      ...existingRule,
      ...updates,
      updatedAt: new Date(),
    });

    this.rules.set(ruleId, updatedRule);
    this.emit("ruleUpdated", updatedRule);
  }

  /**
   * 删除告警规则
   */
  deleteRule(ruleId: string): void {
    const rule = this.rules.get(ruleId);
    if (!rule) {
      throw new Error(`Alert rule ${ruleId} not found`);
    }

    this.rules.delete(ruleId);

    // 解决相关的活跃告警
    for (const [alertId, alert] of this.activeAlerts.entries()) {
      if (alert.ruleId === ruleId) {
        this.resolveAlert(alertId, "system", "Rule deleted");
      }
    }

    this.emit("ruleDeleted", rule);
  }

  /**
   * 开始告警评估
   */
  startEvaluation(intervalMs = 30000): void {
    if (this.evaluationInterval) return;

    this.evaluationInterval = setInterval(() => {
      this.evaluateRules();
    }, intervalMs);

    // 立即评估一次
    this.evaluateRules();
  }

  /**
   * 停止告警评估
   */
  stopEvaluation(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
    }
  }

  /**
   * 评估所有规则
   */
  private async evaluateRules(): Promise<void> {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      try {
        await this.evaluateRule(rule);
      } catch (error) {
        console.error(`Failed to evaluate rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * 评估单个规则
   */
  private async evaluateRule(rule: AlertRule): Promise<void> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - rule.window * 1000);

    // 检查冷却期
    const lastAlert = this.cooldownTracker.get(rule.id);
    if (lastAlert && now.getTime() - lastAlert < rule.cooldown * 1000) {
      return;
    }

    try {
      // 获取指标数据
      const metrics = await this.metricsCollector.query(
        rule.metric,
        windowStart,
        now,
        rule.labels
      );

      if (metrics.length === 0) return;

      let shouldAlert = false;
      let alertValue = 0;
      let alertMessage = "";

      switch (rule.condition) {
        case "threshold": {
          const result = await this.evaluateThreshold(rule, metrics);
          shouldAlert = result.shouldAlert;
          alertValue = result.value;
          alertMessage = result.message;
          break;
        }

        case "anomaly": {
          const anomalyResult = await this.evaluateAnomaly(rule, metrics);
          shouldAlert = anomalyResult.shouldAlert;
          alertValue = anomalyResult.value;
          alertMessage = anomalyResult.message;
          break;
        }

        case "trend": {
          const trendResult = await this.evaluateTrend(rule, metrics);
          shouldAlert = trendResult.shouldAlert;
          alertValue = trendResult.value;
          alertMessage = trendResult.message;
          break;
        }

        case "pattern": {
          const patternResult = await this.evaluatePattern(rule, metrics);
          shouldAlert = patternResult.shouldAlert;
          alertValue = patternResult.value;
          alertMessage = patternResult.message;
          break;
        }
      }

      if (shouldAlert) {
        await this.fireAlert(rule, alertValue, alertMessage);
      } else {
        // 检查是否需要解决现有告警
        const existingAlert = Array.from(this.activeAlerts.values()).find(
          (alert) => alert.ruleId === rule.id && alert.status === "active"
        );

        if (existingAlert) {
          this.resolveAlert(
            existingAlert.id,
            "system",
            "Condition no longer met"
          );
        }
      }
    } catch (error) {
      console.error(`Error evaluating rule ${rule.id}:`, error);
    }
  }

  /**
   * 评估阈值条件
   */
  private async evaluateThreshold(
    rule: AlertRule,
    metrics: Metric[]
  ): Promise<{ shouldAlert: boolean; value: number; message: string }> {
    if (!rule.threshold || !rule.operator) {
      return { shouldAlert: false, value: 0, message: "" };
    }

    // 使用最新值或平均值
    const values = metrics.map((m) => m.value);
    const currentValue = values[values.length - 1] || 0;

    let shouldAlert = false;

    switch (rule.operator) {
      case ">":
        shouldAlert = currentValue > rule.threshold;
        break;
      case "<":
        shouldAlert = currentValue < rule.threshold;
        break;
      case ">=":
        shouldAlert = currentValue >= rule.threshold;
        break;
      case "<=":
        shouldAlert = currentValue <= rule.threshold;
        break;
      case "==":
        shouldAlert = currentValue === rule.threshold;
        break;
      case "!=":
        shouldAlert = currentValue !== rule.threshold;
        break;
    }

    const message = shouldAlert
      ? `${rule.metric} is ${currentValue} (${rule.operator} ${rule.threshold})`
      : "";

    return { shouldAlert, value: currentValue, message };
  }

  /**
   * 评估异常条件
   */
  private async evaluateAnomaly(
    rule: AlertRule,
    metrics: Metric[]
  ): Promise<{ shouldAlert: boolean; value: number; message: string }> {
    const values = metrics.map((m) => m.value);
    const currentValue = values[values.length - 1] || 0;

    const isAnomalous = this.anomalyDetector.detectAnomaly(
      rule.metric,
      currentValue,
      values
    );

    const message = isAnomalous
      ? `Anomalous value detected for ${rule.metric}: ${currentValue}`
      : "";

    return { shouldAlert: isAnomalous, value: currentValue, message };
  }

  /**
   * 评估趋势条件
   */
  private async evaluateTrend(
    rule: AlertRule,
    metrics: Metric[]
  ): Promise<{ shouldAlert: boolean; value: number; message: string }> {
    const values = metrics.map((m) => m.value);
    const currentValue = values[values.length - 1] || 0;

    const trendResult = this.anomalyDetector.detectTrendAnomaly(
      rule.metric,
      values
    );

    const message = trendResult.isAnomalous
      ? `Anomalous ${trendResult.trend} trend detected for ${
          rule.metric
        } (confidence: ${(trendResult.confidence * 100).toFixed(1)}%)`
      : "";

    return {
      shouldAlert: trendResult.isAnomalous,
      value: currentValue,
      message,
    };
  }

  /**
   * 评估模式条件
   */
  private async evaluatePattern(
    rule: AlertRule,
    metrics: Metric[]
  ): Promise<{ shouldAlert: boolean; value: number; message: string }> {
    const values = metrics.map((m) => m.value);
    const currentValue = values[values.length - 1] || 0;

    const patternResult = this.anomalyDetector.detectPatternAnomaly(
      rule.metric,
      values
    );

    const message = patternResult.isAnomalous
      ? `Anomalous ${patternResult.pattern} pattern detected for ${
          rule.metric
        } (confidence: ${(patternResult.confidence * 100).toFixed(1)}%)`
      : "";

    return {
      shouldAlert: patternResult.isAnomalous,
      value: currentValue,
      message,
    };
  }

  /**
   * 触发告警
   */
  private async fireAlert(
    rule: AlertRule,
    value: number,
    message: string
  ): Promise<void> {
    const alertId = `${rule.id}_${Date.now()}`;

    const alert: Alert = {
      id: alertId,
      ruleId: rule.id,
      ruleName: rule.name,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      status: "active",
      message,
      labels: rule.labels,
      annotations: {
        description: rule.description || "",
        runbook: `Check ${rule.metric} metric`,
      },
      startsAt: new Date(),
    };

    this.activeAlerts.set(alertId, alert);
    this.cooldownTracker.set(rule.id, Date.now());

    // 发送通知
    await this.sendNotifications(alert, rule.notifications);

    this.emit("alertFired", alert);
  }

  /**
   * 确认告警
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = "acknowledged";
    alert.acknowledgedAt = new Date();
    alert.acknowledgedBy = acknowledgedBy;

    this.emit("alertAcknowledged", alert);
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string, resolvedBy: string, reason?: string): void {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      throw new Error(`Alert ${alertId} not found`);
    }

    alert.status = "resolved";
    alert.resolvedAt = new Date();
    alert.resolvedBy = resolvedBy;
    alert.endsAt = new Date();

    if (reason) {
      alert.annotations.resolution = reason;
    }

    this.activeAlerts.delete(alertId);
    this.emit("alertResolved", alert);
  }

  /**
   * 发送通知
   */
  private async sendNotifications(
    alert: Alert,
    channels: string[]
  ): Promise<void> {
    for (const channel of channels) {
      try {
        await this.sendNotification(alert, channel);
      } catch (error) {
        console.error(`Failed to send notification to ${channel}:`, error);
      }
    }
  }

  /**
   * 发送单个通知
   */
  private async sendNotification(alert: Alert, channel: string): Promise<void> {
    // 这里可以集成各种通知渠道
    // 如 Slack, Discord, Email, SMS, PagerDuty 等
    console.log(`Sending alert notification to ${channel}:`, {
      severity: alert.severity,
      message: alert.message,
      metric: alert.metric,
      value: alert.value,
    });
  }

  /**
   * 获取活跃告警
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警规则
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 获取告警统计
   */
  getStats(): {
    totalRules: number;
    activeAlerts: number;
    alertsBySeverity: Record<AlertSeverity, number>;
    alertsByStatus: Record<AlertStatus, number>;
  } {
    const activeAlerts = this.getActiveAlerts();

    const alertsBySeverity = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0,
    };

    const alertsByStatus = {
      active: 0,
      resolved: 0,
      suppressed: 0,
      acknowledged: 0,
    };

    for (const alert of activeAlerts) {
      alertsBySeverity[alert.severity]++;
      alertsByStatus[alert.status]++;
    }

    return {
      totalRules: this.rules.size,
      activeAlerts: activeAlerts.length,
      alertsBySeverity,
      alertsByStatus,
    };
  }
}
