/**
 * 🚀 Juanie AI - 实时监控仪表板服务
 * 提供数据聚合、可视化和实时更新功能
 */

import { EventEmitter } from "events";
import { z } from "zod";
import { Alert, AlertManager, AlertRule } from "./alerts.service";
import { Metric, MetricAggregation, MetricsCollector } from "./metrics.service";

// ============================================================================
// 仪表板类型定义
// ============================================================================

export const WidgetTypeSchema = z.enum([
  "metric",
  "chart",
  "gauge",
  "counter",
  "table",
  "heatmap",
  "alert_list",
  "log_stream",
  "status_indicator",
  "progress_bar",
]);

export const ChartTypeSchema = z.enum([
  "line",
  "bar",
  "area",
  "pie",
  "donut",
  "scatter",
  "histogram",
  "candlestick",
]);

export const TimeRangeSchema = z.object({
  from: z.date(),
  to: z.date(),
  interval: z.string().default("1m"), // 1m, 5m, 15m, 1h, 1d
});

export const WidgetConfigSchema = z.object({
  id: z.string(),
  type: WidgetTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  position: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }),
  query: z.object({
    metric: z.string().optional(),
    filters: z.record(z.string()).default({}),
    aggregation: z.string().optional(),
    groupBy: z.array(z.string()).default([]),
  }),
  visualization: z.object({
    chartType: ChartTypeSchema.optional(),
    colors: z.array(z.string()).default([]),
    thresholds: z
      .array(
        z.object({
          value: z.number(),
          color: z.string(),
          label: z.string().optional(),
        })
      )
      .default([]),
    unit: z.string().optional(),
    decimals: z.number().default(2),
    showLegend: z.boolean().default(true),
    showTooltip: z.boolean().default(true),
  }),
  refresh: z.object({
    interval: z.number().default(30000), // 30秒
    enabled: z.boolean().default(true),
  }),
  alerts: z.object({
    enabled: z.boolean().default(false),
    rules: z.array(z.string()).default([]),
  }),
});

export const DashboardSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  widgets: z.array(WidgetConfigSchema),
  layout: z.object({
    columns: z.number().default(12),
    rowHeight: z.number().default(30),
    margin: z.array(z.number()).default([10, 10]),
    containerPadding: z.array(z.number()).default([10, 10]),
  }),
  timeRange: TimeRangeSchema,
  autoRefresh: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(30000),
  }),
  permissions: z.object({
    viewers: z.array(z.string()).default([]),
    editors: z.array(z.string()).default([]),
    admins: z.array(z.string()).default([]),
  }),
  createdAt: z.date().default(() => new Date()),
  updatedAt: z.date().default(() => new Date()),
  createdBy: z.string(),
});

export type WidgetType = z.infer<typeof WidgetTypeSchema>;
export type ChartType = z.infer<typeof ChartTypeSchema>;
export type TimeRange = z.infer<typeof TimeRangeSchema>;
export type WidgetConfig = z.infer<typeof WidgetConfigSchema>;
export type Dashboard = z.infer<typeof DashboardSchema>;

// ============================================================================
// 数据聚合器
// ============================================================================

export class DataAggregator {
  private metricsCollector: MetricsCollector;

  constructor(metricsCollector: MetricsCollector) {
    this.metricsCollector = metricsCollector;
  }

  /**
   * 聚合指标数据
   */
  async aggregateMetrics(
    metric: string,
    timeRange: TimeRange,
    aggregation: string = "avg",
    groupBy: string[] = [],
    filters: Record<string, string> = {}
  ): Promise<{
    data: Array<{
      timestamp: Date;
      value: number;
      labels?: Record<string, string>;
    }>;
    summary: {
      min: number;
      max: number;
      avg: number;
      sum: number;
      count: number;
    };
  }> {
    const metrics = await this.metricsCollector.query(
      metric,
      timeRange.from,
      timeRange.to,
      filters
    );

    if (metrics.length === 0) {
      return {
        data: [],
        summary: { min: 0, max: 0, avg: 0, sum: 0, count: 0 },
      };
    }

    // 按时间间隔分组
    const intervalMs = this.parseInterval(timeRange.interval);
    const groupedData = this.groupByTimeInterval(metrics, intervalMs);

    // 应用聚合函数
    const aggregatedData = Object.entries(groupedData)
      .map(([timestamp, values]) => {
        const aggregatedValue = this.applyAggregation(values, aggregation);
        return {
          timestamp: new Date(parseInt(timestamp)),
          value: aggregatedValue,
          labels: values[0]?.labels || {},
        };
      })
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // 计算摘要统计
    const allValues = aggregatedData.map((d) => d.value);
    const summary = {
      min: Math.min(...allValues),
      max: Math.max(...allValues),
      avg: allValues.reduce((a, b) => a + b, 0) / allValues.length,
      sum: allValues.reduce((a, b) => a + b, 0),
      count: allValues.length,
    };

    return { data: aggregatedData, summary };
  }

  /**
   * 获取实时数据
   */
  async getRealTimeData(
    metric: string,
    filters: Record<string, string> = {}
  ): Promise<{
    current: number;
    previous: number;
    change: number;
    changePercent: number;
    trend: "up" | "down" | "stable";
  }> {
    const now = new Date();
    const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);

    const [currentMetrics, previousMetrics] = await Promise.all([
      this.metricsCollector.query(metric, fiveMinutesAgo, now, filters),
      this.metricsCollector.query(
        metric,
        tenMinutesAgo,
        fiveMinutesAgo,
        filters
      ),
    ]);

    const current =
      currentMetrics.length > 0
        ? currentMetrics[currentMetrics.length - 1].value
        : 0;

    const previous =
      previousMetrics.length > 0
        ? previousMetrics[previousMetrics.length - 1].value
        : 0;

    const change = current - previous;
    const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

    let trend: "up" | "down" | "stable" = "stable";
    if (Math.abs(changePercent) > 5) {
      trend = changePercent > 0 ? "up" : "down";
    }

    return { current, previous, change, changePercent, trend };
  }

  /**
   * 获取热力图数据
   */
  async getHeatmapData(
    metric: string,
    timeRange: TimeRange,
    xAxis: string,
    yAxis: string,
    filters: Record<string, string> = {}
  ): Promise<
    Array<{
      x: string;
      y: string;
      value: number;
      count: number;
    }>
  > {
    const metrics = await this.metricsCollector.query(
      metric,
      timeRange.from,
      timeRange.to,
      filters
    );

    const heatmapData = new Map<string, { value: number; count: number }>();

    for (const metric of metrics) {
      const xValue = metric.labels[xAxis] || "unknown";
      const yValue = metric.labels[yAxis] || "unknown";
      const key = `${xValue}:${yValue}`;

      if (!heatmapData.has(key)) {
        heatmapData.set(key, { value: 0, count: 0 });
      }

      const data = heatmapData.get(key)!;
      data.value += metric.value;
      data.count += 1;
    }

    return Array.from(heatmapData.entries()).map(([key, data]) => {
      const [x, y] = key.split(":");
      return {
        x,
        y,
        value: data.value / data.count, // 平均值
        count: data.count,
      };
    });
  }

  private parseInterval(interval: string): number {
    const match = interval.match(/^(\d+)([smhd])$/);
    if (!match) return 60000; // 默认1分钟

    const value = parseInt(match[1]);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 60000;
    }
  }

  private groupByTimeInterval(
    metrics: Metric[],
    intervalMs: number
  ): Record<string, Metric[]> {
    const groups: Record<string, Metric[]> = {};

    for (const metric of metrics) {
      const timestamp =
        Math.floor(metric.timestamp.getTime() / intervalMs) * intervalMs;
      const key = timestamp.toString();

      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(metric);
    }

    return groups;
  }

  private applyAggregation(metrics: Metric[], aggregation: string): number {
    if (metrics.length === 0) return 0;

    const values = metrics.map((m) => m.value);

    switch (aggregation) {
      case "sum":
        return values.reduce((a, b) => a + b, 0);
      case "avg":
        return values.reduce((a, b) => a + b, 0) / values.length;
      case "min":
        return Math.min(...values);
      case "max":
        return Math.max(...values);
      case "count":
        return values.length;
      case "median": {
        const sorted = values.sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
          ? (sorted[mid - 1] + sorted[mid]) / 2
          : sorted[mid];
      }
      case "p95": {
        const sorted95 = values.sort((a, b) => a - b);
        const index95 = Math.floor(sorted95.length * 0.95);
        return sorted95[index95];
      }
      case "p99": {
        const sorted99 = values.sort((a, b) => a - b);
        const index99 = Math.floor(sorted99.length * 0.99);
        return sorted99[index99];
      }
      default:
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
  }
}

// ============================================================================
// 仪表板管理器
// ============================================================================

export class DashboardManager extends EventEmitter {
  private dashboards: Map<string, Dashboard>;
  private dataAggregator: DataAggregator;
  private alertManager: AlertManager;
  private refreshIntervals: Map<string, NodeJS.Timeout>;
  private websocketClients: Set<any>;

  constructor(metricsCollector: MetricsCollector, alertManager: AlertManager) {
    super();
    this.dashboards = new Map();
    this.dataAggregator = new DataAggregator(metricsCollector);
    this.alertManager = alertManager;
    this.refreshIntervals = new Map();
    this.websocketClients = new Set();
  }

  /**
   * 创建仪表板
   */
  createDashboard(dashboard: Dashboard): void {
    const validatedDashboard = DashboardSchema.parse(dashboard);
    this.dashboards.set(validatedDashboard.id, validatedDashboard);

    // 启动自动刷新
    if (validatedDashboard.autoRefresh.enabled) {
      this.startAutoRefresh(validatedDashboard.id);
    }

    this.emit("dashboardCreated", validatedDashboard);
  }

  /**
   * 更新仪表板
   */
  updateDashboard(dashboardId: string, updates: Partial<Dashboard>): void {
    const existingDashboard = this.dashboards.get(dashboardId);
    if (!existingDashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const updatedDashboard = DashboardSchema.parse({
      ...existingDashboard,
      ...updates,
      updatedAt: new Date(),
    });

    this.dashboards.set(dashboardId, updatedDashboard);

    // 重启自动刷新
    this.stopAutoRefresh(dashboardId);
    if (updatedDashboard.autoRefresh.enabled) {
      this.startAutoRefresh(dashboardId);
    }

    this.emit("dashboardUpdated", updatedDashboard);
  }

  /**
   * 删除仪表板
   */
  deleteDashboard(dashboardId: string): void {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    this.stopAutoRefresh(dashboardId);
    this.dashboards.delete(dashboardId);

    this.emit("dashboardDeleted", dashboard);
  }

  /**
   * 获取仪表板数据
   */
  async getDashboardData(dashboardId: string): Promise<{
    dashboard: Dashboard;
    widgets: Array<{
      id: string;
      data: any;
      lastUpdated: Date;
    }>;
    alerts: Alert[];
  }> {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) {
      throw new Error(`Dashboard ${dashboardId} not found`);
    }

    const widgetDataPromises = dashboard.widgets.map(async (widget) => {
      const data = await this.getWidgetData(widget, dashboard.timeRange);
      return {
        id: widget.id,
        data,
        lastUpdated: new Date(),
      };
    });

    const widgets = await Promise.all(widgetDataPromises);
    const alerts = this.alertManager.getActiveAlerts();

    return { dashboard, widgets, alerts };
  }

  /**
   * 获取小部件数据
   */
  async getWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    switch (widget.type) {
      case "metric":
        return await this.getMetricWidgetData(widget, timeRange);
      case "chart":
        return await this.getChartWidgetData(widget, timeRange);
      case "gauge":
        return await this.getGaugeWidgetData(widget, timeRange);
      case "counter":
        return await this.getCounterWidgetData(widget, timeRange);
      case "table":
        return await this.getTableWidgetData(widget, timeRange);
      case "heatmap":
        return await this.getHeatmapWidgetData(widget, timeRange);
      case "alert_list":
        return await this.getAlertListWidgetData(widget);
      case "status_indicator":
        return await this.getStatusIndicatorWidgetData(widget, timeRange);
      default:
        return { error: `Unsupported widget type: ${widget.type}` };
    }
  }

  private async getMetricWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric) {
      return { error: "No metric specified" };
    }

    const realTimeData = await this.dataAggregator.getRealTimeData(
      widget.query.metric,
      widget.query.filters
    );

    return {
      current: realTimeData.current,
      previous: realTimeData.previous,
      change: realTimeData.change,
      changePercent: realTimeData.changePercent,
      trend: realTimeData.trend,
      unit: widget.visualization.unit,
      thresholds: widget.visualization.thresholds,
    };
  }

  private async getChartWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric) {
      return { error: "No metric specified" };
    }

    const aggregatedData = await this.dataAggregator.aggregateMetrics(
      widget.query.metric,
      timeRange,
      widget.query.aggregation,
      widget.query.groupBy,
      widget.query.filters
    );

    return {
      series: [
        {
          name: widget.query.metric,
          data: aggregatedData.data.map((d) => ({
            x: d.timestamp,
            y: d.value,
          })),
        },
      ],
      summary: aggregatedData.summary,
      chartType: widget.visualization.chartType,
      colors: widget.visualization.colors,
      unit: widget.visualization.unit,
    };
  }

  private async getGaugeWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric) {
      return { error: "No metric specified" };
    }

    const realTimeData = await this.dataAggregator.getRealTimeData(
      widget.query.metric,
      widget.query.filters
    );

    const thresholds = widget.visualization.thresholds;
    const maxThreshold =
      thresholds.length > 0 ? Math.max(...thresholds.map((t) => t.value)) : 100;

    return {
      value: realTimeData.current,
      min: 0,
      max: maxThreshold,
      thresholds: thresholds,
      unit: widget.visualization.unit,
    };
  }

  private async getCounterWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric) {
      return { error: "No metric specified" };
    }

    const aggregatedData = await this.dataAggregator.aggregateMetrics(
      widget.query.metric,
      timeRange,
      "sum",
      widget.query.groupBy,
      widget.query.filters
    );

    return {
      value: aggregatedData.summary.sum,
      change:
        aggregatedData.data.length > 1
          ? aggregatedData.data[aggregatedData.data.length - 1].value -
            aggregatedData.data[0].value
          : 0,
      unit: widget.visualization.unit,
    };
  }

  private async getTableWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric) {
      return { error: "No metric specified" };
    }

    const aggregatedData = await this.dataAggregator.aggregateMetrics(
      widget.query.metric,
      timeRange,
      widget.query.aggregation,
      widget.query.groupBy,
      widget.query.filters
    );

    const columns = ["timestamp", "value", ...widget.query.groupBy];
    const rows = aggregatedData.data.map((d) => ({
      timestamp: d.timestamp,
      value: d.value,
      ...d.labels,
    }));

    return { columns, rows };
  }

  private async getHeatmapWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric || widget.query.groupBy.length < 2) {
      return { error: "Heatmap requires metric and at least 2 groupBy fields" };
    }

    const heatmapData = await this.dataAggregator.getHeatmapData(
      widget.query.metric,
      timeRange,
      widget.query.groupBy[0],
      widget.query.groupBy[1],
      widget.query.filters
    );

    return {
      data: heatmapData,
      xAxis: widget.query.groupBy[0],
      yAxis: widget.query.groupBy[1],
      colors: widget.visualization.colors,
    };
  }

  private async getAlertListWidgetData(widget: WidgetConfig): Promise<any> {
    const alerts = this.alertManager.getActiveAlerts();

    // 过滤告警
    const filteredAlerts = alerts.filter((alert) => {
      if (widget.alerts.rules.length > 0) {
        return widget.alerts.rules.includes(alert.ruleId);
      }
      return true;
    });

    return {
      alerts: filteredAlerts.slice(0, 10), // 最多显示10个告警
      total: filteredAlerts.length,
    };
  }

  private async getStatusIndicatorWidgetData(
    widget: WidgetConfig,
    timeRange: TimeRange
  ): Promise<any> {
    if (!widget.query.metric) {
      return { error: "No metric specified" };
    }

    const realTimeData = await this.dataAggregator.getRealTimeData(
      widget.query.metric,
      widget.query.filters
    );

    const thresholds = widget.visualization.thresholds;
    let status = "ok";
    let color = "#00ff00";

    for (const threshold of thresholds) {
      if (realTimeData.current >= threshold.value) {
        status = threshold.label || "warning";
        color = threshold.color;
      }
    }

    return {
      status,
      color,
      value: realTimeData.current,
      unit: widget.visualization.unit,
    };
  }

  /**
   * 启动自动刷新
   */
  private startAutoRefresh(dashboardId: string): void {
    const dashboard = this.dashboards.get(dashboardId);
    if (!dashboard) return;

    const interval = setInterval(async () => {
      try {
        const data = await this.getDashboardData(dashboardId);
        this.broadcastUpdate(dashboardId, data);
      } catch (error) {
        console.error(`Failed to refresh dashboard ${dashboardId}:`, error);
      }
    }, dashboard.autoRefresh.interval);

    this.refreshIntervals.set(dashboardId, interval);
  }

  /**
   * 停止自动刷新
   */
  private stopAutoRefresh(dashboardId: string): void {
    const interval = this.refreshIntervals.get(dashboardId);
    if (interval) {
      clearInterval(interval);
      this.refreshIntervals.delete(dashboardId);
    }
  }

  /**
   * 广播更新
   */
  private broadcastUpdate(dashboardId: string, data: any): void {
    for (const client of this.websocketClients) {
      try {
        client.send(
          JSON.stringify({
            type: "dashboard_update",
            dashboardId,
            data,
            timestamp: new Date(),
          })
        );
      } catch (error) {
        // 移除断开的客户端
        this.websocketClients.delete(client);
      }
    }
  }

  /**
   * 添加WebSocket客户端
   */
  addWebSocketClient(client: any): void {
    this.websocketClients.add(client);
  }

  /**
   * 移除WebSocket客户端
   */
  removeWebSocketClient(client: any): void {
    this.websocketClients.delete(client);
  }

  /**
   * 获取所有仪表板
   */
  getDashboards(): Dashboard[] {
    return Array.from(this.dashboards.values());
  }

  /**
   * 获取仪表板统计
   */
  getStats(): {
    totalDashboards: number;
    activeRefreshes: number;
    connectedClients: number;
  } {
    return {
      totalDashboards: this.dashboards.size,
      activeRefreshes: this.refreshIntervals.size,
      connectedClients: this.websocketClients.size,
    };
  }
}

// ============================================================================
// 导出
// ============================================================================

// 导出所有类和接口
// 注意：这些类已经在上面定义时使用了export关键字，这里不需要重复导出
