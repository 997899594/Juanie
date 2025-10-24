/**
 * 🚀 Juanie AI - 监控服务
 * 监控模块的核心业务逻辑层，整合各种监控功能
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import { MetricsCollector, SystemMetricsCollector } from './metrics.service';
import { AlertManager, AnomalyDetector, Alert, AlertRule } from './alerts.service';
import { DashboardManager, DataAggregator, Dashboard, TimeRange } from './dashboard.service';

@Injectable()
export class MonitoringService extends EventEmitter {
  private readonly logger = new Logger(MonitoringService.name);

  constructor(
    private readonly metricsCollector: MetricsCollector,
    private readonly systemMetricsCollector: SystemMetricsCollector,
    private readonly alertManager: AlertManager,
    private readonly anomalyDetector: AnomalyDetector,
    private readonly dashboardManager: DashboardManager,
    private readonly dataAggregator: DataAggregator
  ) {
    super();
    this.setupEventListeners();
  }

  // ========================================================================
  // 指标相关方法
  // ========================================================================

  /**
   * 获取指标数据
   */
  async getMetrics(
    query: {
      metric: string;
      aggregation: string;
      groupBy: string[];
      filters: Record<string, string>;
    },
    timeRange: TimeRange
  ) {
    try {
      const result = await this.dataAggregator.aggregateMetrics(
        query.metric,
        timeRange,
        query.aggregation,
        query.groupBy,
        query.filters
      );

      this.logger.debug(`Retrieved metrics for ${query.metric}`, {
        dataPoints: result.data.length,
        timeRange,
        aggregation: query.aggregation,
      });

      return {
        success: true,
        data: result.data,
        summary: result.summary,
        query,
        timeRange,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get metrics for ${query.metric}`, error);
      throw error;
    }
  }

  /**
   * 获取实时指标
   */
  async getRealTimeMetric(metric: string, filters: Record<string, string> = {}) {
    try {
      const result = await this.dataAggregator.getRealTimeData(metric, filters);
      
      this.logger.debug(`Retrieved real-time data for ${metric}`, {
        current: result.current,
        trend: result.trend,
      });

      return {
        success: true,
        metric,
        ...result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get real-time metric ${metric}`, error);
      throw error;
    }
  }

  /**
   * 记录指标
   */
  async recordMetric(metric: string, value: number, labels: Record<string, string> = {}) {
    try {
      await this.metricsCollector.setGauge(metric, value, labels);
      
      this.logger.debug(`Recorded metric ${metric}`, { value, labels });

      return {
        success: true,
        metric,
        value,
        labels,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to record metric ${metric}`, error);
      throw error;
    }
  }

  /**
   * 获取可用指标列表
   */
  async getAvailableMetrics() {
    try {
      const metrics = await this.metricsCollector.getMetricNames();
      
      return {
        success: true,
        metrics: metrics.map(name => ({
          name,
          type: this.inferMetricType(name),
          description: this.getMetricDescription(name),
        })),
        count: metrics.length,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get available metrics', error);
      throw error;
    }
  }

  // ========================================================================
  // 告警相关方法
  // ========================================================================

  /**
   * 获取告警列表
   */
  async getAlerts(filters: { status?: string; severity?: string } = {}) {
    try {
      let alerts = this.alertManager.getActiveAlerts();

      // 应用过滤器
      if (filters.status) {
        alerts = alerts.filter(alert => alert.status === filters.status);
      }
      if (filters.severity) {
        alerts = alerts.filter(alert => alert.severity === filters.severity);
      }

      const stats = this.alertManager.getStats();

      return {
        success: true,
        alerts,
        stats,
        filters,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get alerts', error);
      throw error;
    }
  }

  /**
   * 获取告警规则
   */
  async getAlertRules() {
    try {
      const rules = this.alertManager.getRules();
      
      return {
        success: true,
        rules,
        count: rules.length,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get alert rules', error);
      throw error;
    }
  }

  /**
   * 创建告警规则
   */
  async createAlertRule(ruleData: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const rule: AlertRule = {
        ...ruleData,
        id: `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.alertManager.addRule(rule);
      
      this.logger.log(`Created alert rule: ${rule.name}`, { ruleId: rule.id });

      return {
        success: true,
        rule,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to create alert rule', error);
      throw error;
    }
  }

  /**
   * 更新告警规则
   */
  async updateAlertRule(ruleId: string, updates: Partial<AlertRule>) {
    try {
      this.alertManager.updateRule(ruleId, updates);
      
      this.logger.log(`Updated alert rule: ${ruleId}`, updates);

      return {
        success: true,
        ruleId,
        updates,
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to update alert rule ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * 删除告警规则
   */
  async deleteAlertRule(ruleId: string) {
    try {
      this.alertManager.deleteRule(ruleId);
      
      this.logger.log(`Deleted alert rule: ${ruleId}`);

      return {
        success: true,
        ruleId,
        deletedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to delete alert rule ${ruleId}`, error);
      throw error;
    }
  }

  /**
   * 确认告警
   */
  async acknowledgeAlert(alertId: string, acknowledgedBy: string) {
    try {
      this.alertManager.acknowledgeAlert(alertId, acknowledgedBy);
      
      this.logger.log(`Alert acknowledged: ${alertId}`, { acknowledgedBy });

      return {
        success: true,
        alertId,
        acknowledgedBy,
        acknowledgedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to acknowledge alert ${alertId}`, error);
      throw error;
    }
  }

  /**
   * 解决告警
   */
  async resolveAlert(alertId: string, resolvedBy: string, reason?: string) {
    try {
      this.alertManager.resolveAlert(alertId, resolvedBy, reason);
      
      this.logger.log(`Alert resolved: ${alertId}`, { resolvedBy, reason });

      return {
        success: true,
        alertId,
        resolvedBy,
        reason,
        resolvedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to resolve alert ${alertId}`, error);
      throw error;
    }
  }

  // ========================================================================
  // 仪表板相关方法
  // ========================================================================

  /**
   * 获取仪表板列表
   */
  async getDashboards() {
    try {
      const dashboards = this.dashboardManager.getDashboards();
      const stats = this.dashboardManager.getStats();
      
      return {
        success: true,
        dashboards,
        stats,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get dashboards', error);
      throw error;
    }
  }

  /**
   * 获取单个仪表板
   */
  async getDashboard(dashboardId: string) {
    try {
      const dashboards = this.dashboardManager.getDashboards();
      const dashboard = dashboards.find(d => d.id === dashboardId);
      
      if (!dashboard) {
        throw new Error(`Dashboard ${dashboardId} not found`);
      }

      return {
        success: true,
        dashboard,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard ${dashboardId}`, error);
      throw error;
    }
  }

  /**
   * 获取仪表板数据
   */
  async getDashboardData(dashboardId: string) {
    try {
      const data = await this.dashboardManager.getDashboardData(dashboardId);
      
      this.logger.debug(`Retrieved dashboard data: ${dashboardId}`, {
        widgetCount: data.widgets.length,
        alertCount: data.alerts.length,
      });

      return {
        success: true,
        ...data,
        retrievedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to get dashboard data ${dashboardId}`, error);
      throw error;
    }
  }

  /**
   * 创建仪表板
   */
  async createDashboard(dashboardData: Omit<Dashboard, 'id' | 'createdAt' | 'updatedAt'>) {
    try {
      const dashboard: Dashboard = {
        ...dashboardData,
        id: `dashboard_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      this.dashboardManager.createDashboard(dashboard);
      
      this.logger.log(`Created dashboard: ${dashboard.name}`, { dashboardId: dashboard.id });

      return {
        success: true,
        dashboard,
        createdAt: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to create dashboard', error);
      throw error;
    }
  }

  /**
   * 更新仪表板
   */
  async updateDashboard(dashboardId: string, updates: Partial<Dashboard>) {
    try {
      this.dashboardManager.updateDashboard(dashboardId, updates);
      
      this.logger.log(`Updated dashboard: ${dashboardId}`, updates);

      return {
        success: true,
        dashboardId,
        updates,
        updatedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to update dashboard ${dashboardId}`, error);
      throw error;
    }
  }

  /**
   * 删除仪表板
   */
  async deleteDashboard(dashboardId: string) {
    try {
      this.dashboardManager.deleteDashboard(dashboardId);
      
      this.logger.log(`Deleted dashboard: ${dashboardId}`);

      return {
        success: true,
        dashboardId,
        deletedAt: new Date(),
      };
    } catch (error) {
      this.logger.error(`Failed to delete dashboard ${dashboardId}`, error);
      throw error;
    }
  }

  // ========================================================================
  // 系统状态相关方法
  // ========================================================================

  /**
   * 获取系统健康状态
   */
  async getSystemHealth() {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      // 获取关键指标
      const [cpuMetrics, memoryMetrics, eventLoopMetrics] = await Promise.all([
        this.metricsCollector.query('system_cpu_usage', fiveMinutesAgo, now),
        this.metricsCollector.query('system_memory_usage_percent', fiveMinutesAgo, now),
        this.metricsCollector.query('nodejs_eventloop_lag_seconds', fiveMinutesAgo, now),
      ]);

      const currentCpu = cpuMetrics.length > 0 ? cpuMetrics[cpuMetrics.length - 1].value : 0;
      const currentMemory = memoryMetrics.length > 0 ? memoryMetrics[memoryMetrics.length - 1].value : 0;
      const currentEventLoop = eventLoopMetrics.length > 0 ? eventLoopMetrics[eventLoopMetrics.length - 1].value : 0;

      // 计算健康分数
      let healthScore = 100;
      let status = 'healthy';
      const issues: string[] = [];

      if (currentCpu > 80) {
        healthScore -= 30;
        issues.push('High CPU usage');
      }
      if (currentMemory > 85) {
        healthScore -= 25;
        issues.push('High memory usage');
      }
      if (currentEventLoop > 0.1) {
        healthScore -= 20;
        issues.push('High event loop lag');
      }

      if (healthScore < 70) {
        status = 'unhealthy';
      } else if (healthScore < 85) {
        status = 'degraded';
      }

      const activeAlerts = this.alertManager.getActiveAlerts();
      const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical').length;
      
      if (criticalAlerts > 0) {
        healthScore -= criticalAlerts * 15;
        status = 'critical';
        issues.push(`${criticalAlerts} critical alerts`);
      }

      return {
        status,
        healthScore: Math.max(0, healthScore),
        issues,
        metrics: {
          cpu: currentCpu,
          memory: currentMemory,
          eventLoop: currentEventLoop,
        },
        alerts: {
          total: activeAlerts.length,
          critical: criticalAlerts,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get system health', error);
      return {
        status: 'unknown',
        healthScore: 0,
        issues: ['Failed to retrieve health data'],
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * 获取系统统计
   */
  async getSystemStats() {
    try {
      const alertStats = this.alertManager.getStats();
      const dashboardStats = this.dashboardManager.getStats();
      const metricsStats = await this.metricsCollector.getStats();

      return {
        success: true,
        alerts: alertStats,
        dashboards: dashboardStats,
        metrics: metricsStats,
        uptime: process.uptime(),
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get system stats', error);
      throw error;
    }
  }

  /**
   * 获取系统状态
   */
  async getSystemStatus() {
    try {
      const health = await this.getSystemHealth();
      const stats = await this.getSystemStats();

      return {
        success: true,
        health,
        stats,
        services: {
          metrics: 'running',
          alerts: 'running',
          dashboards: 'running',
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('Failed to get system status', error);
      throw error;
    }
  }

  // ========================================================================
  // WebSocket 相关方法
  // ========================================================================

  /**
   * 添加WebSocket客户端
   */
  addWebSocketClient(client: any) {
    this.dashboardManager.addWebSocketClient(client);
  }

  /**
   * 移除WebSocket客户端
   */
  removeWebSocketClient(client: any) {
    this.dashboardManager.removeWebSocketClient(client);
  }

  /**
   * 监听告警触发事件
   */
  onAlertFired(callback: (alert: Alert) => void) {
    this.alertManager.on('alertFired', callback);
  }

  /**
   * 监听告警解决事件
   */
  onAlertResolved(callback: (alert: Alert) => void) {
    this.alertManager.on('alertResolved', callback);
  }

  /**
   * 监听仪表板更新事件
   */
  onDashboardUpdated(callback: (dashboardId: string, data: any) => void) {
    this.dashboardManager.on('dashboardUpdated', (dashboard: Dashboard) => {
      callback(dashboard.id, dashboard);
    });
  }

  // ========================================================================
  // 私有方法
  // ========================================================================

  private setupEventListeners() {
    // 监听告警事件
    this.alertManager.on('alertFired', (alert: Alert) => {
      this.logger.warn(`Alert fired: ${alert.ruleName}`, {
        alertId: alert.id,
        severity: alert.severity,
        metric: alert.metric,
        value: alert.value,
      });
      this.emit('alertFired', alert);
    });

    this.alertManager.on('alertResolved', (alert: Alert) => {
      this.logger.log(`Alert resolved: ${alert.ruleName}`, {
        alertId: alert.id,
        resolvedBy: alert.resolvedBy,
      });
      this.emit('alertResolved', alert);
    });

    // 监听仪表板事件
    this.dashboardManager.on('dashboardCreated', (dashboard: Dashboard) => {
      this.logger.log(`Dashboard created: ${dashboard.name}`, {
        dashboardId: dashboard.id,
      });
    });

    this.dashboardManager.on('dashboardUpdated', (dashboard: Dashboard) => {
      this.logger.log(`Dashboard updated: ${dashboard.name}`, {
        dashboardId: dashboard.id,
      });
      this.emit('dashboardUpdated', dashboard.id, dashboard);
    });
  }

  private inferMetricType(metricName: string): string {
    if (metricName.includes('_total') || metricName.includes('_count')) {
      return 'counter';
    }
    if (metricName.includes('_duration') || metricName.includes('_time')) {
      return 'histogram';
    }
    if (metricName.includes('_usage') || metricName.includes('_percent')) {
      return 'gauge';
    }
    return 'gauge';
  }

  private getMetricDescription(metricName: string): string {
    const descriptions: Record<string, string> = {
      'system_cpu_usage': 'System CPU usage percentage',
      'system_memory_usage_percent': 'System memory usage percentage',
      'nodejs_eventloop_lag_seconds': 'Node.js event loop lag in seconds',
      'http_request_duration_seconds': 'HTTP request duration in seconds',
      'http_requests_total': 'Total number of HTTP requests',
      'http_requests_error_rate': 'HTTP request error rate percentage',
    };

    return descriptions[metricName] || `Metric: ${metricName}`;
  }
}