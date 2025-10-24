/**
 * 🚀 Juanie AI - 监控控制器
 * 提供监控数据的REST API和WebSocket实时推送
 */

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { z } from "zod";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Alert, AlertRule } from "./alerts.service";
import { Dashboard, TimeRange, WidgetConfig } from "./dashboard.service";
import { MonitoringService } from "./monitoring.service";

// ============================================================================
// 请求/响应模式
// ============================================================================

const TimeRangeQuerySchema = z.object({
  from: z.string().transform((str) => new Date(str)),
  to: z.string().transform((str) => new Date(str)),
  interval: z.string().default("1m"),
});

const MetricQuerySchema = z.object({
  metric: z.string().optional(),
  aggregation: z.string().default("avg"),
  groupBy: z.array(z.string()).default([]),
  filters: z.record(z.string()).default({}),
});

const AlertRuleCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  metric: z.string(),
  condition: z.enum(["threshold", "anomaly", "trend", "pattern"]),
  threshold: z.number().optional(),
  operator: z.enum([">", "<", ">=", "<=", "==", "!="]).optional(),
  window: z.number().default(300),
  severity: z.enum(["low", "medium", "high", "critical"]),
  labels: z.record(z.string()).default({}),
  enabled: z.boolean().default(true),
  cooldown: z.number().default(300),
  notifications: z.array(z.string()).default([]),
});

const DashboardCreateSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
  widgets: z.array(z.any()), // WidgetConfig schema
  layout: z.object({
    columns: z.number().default(12),
    rowHeight: z.number().default(30),
    margin: z.array(z.number()).default([10, 10]),
    containerPadding: z.array(z.number()).default([10, 10]),
  }),
  timeRange: z.object({
    from: z.string().transform((str) => new Date(str)),
    to: z.string().transform((str) => new Date(str)),
    interval: z.string().default("1m"),
  }),
  autoRefresh: z.object({
    enabled: z.boolean().default(true),
    interval: z.number().default(30000),
  }),
});

// ============================================================================
// REST API 控制器
// ============================================================================

@Controller("monitoring")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  // ========================================================================
  // 指标相关接口
  // ========================================================================

  @Get("metrics")
  @Roles("admin", "operator", "viewer")
  async getMetrics(@Query() query: any) {
    const { metric, from, to, interval, aggregation, groupBy, filters } = query;

    const timeRange = TimeRangeQuerySchema.parse({ from, to, interval });
    const metricQuery = MetricQuerySchema.parse({
      metric,
      aggregation,
      groupBy: groupBy ? groupBy.split(",") : [],
      filters: filters ? JSON.parse(filters) : {},
    });

    // 确保必填字段存在
    const validatedQuery = {
      metric: metricQuery.metric || "default",
      aggregation: metricQuery.aggregation,
      groupBy: metricQuery.groupBy,
      filters: metricQuery.filters,
    };

    return await this.monitoringService.getMetrics(validatedQuery, timeRange);
  }

  @Get("metrics/realtime/:metric")
  @Roles("admin", "operator", "viewer")
  async getRealTimeMetric(
    @Param("metric") metric: string,
    @Query("filters") filters?: string
  ) {
    const parsedFilters = filters ? JSON.parse(filters) : {};
    return await this.monitoringService.getRealTimeMetric(
      metric,
      parsedFilters
    );
  }

  @Get("metrics/list")
  @Roles("admin", "operator", "viewer")
  async getMetricsList() {
    return await this.monitoringService.getAvailableMetrics();
  }

  @Post("metrics/:metric")
  @Roles("admin", "operator")
  async recordMetric(
    @Param("metric") metric: string,
    @Body() body: { value: number; labels?: Record<string, string> }
  ) {
    return await this.monitoringService.recordMetric(
      metric,
      body.value,
      body.labels
    );
  }

  // ========================================================================
  // 告警相关接口
  // ========================================================================

  @Get("alerts")
  @Roles("admin", "operator", "viewer")
  async getAlerts(
    @Query("status") status?: string,
    @Query("severity") severity?: string
  ) {
    return await this.monitoringService.getAlerts({ status, severity });
  }

  @Get("alerts/rules")
  @Roles("admin", "operator", "viewer")
  async getAlertRules() {
    return await this.monitoringService.getAlertRules();
  }

  @Post("alerts/rules")
  @Roles("admin", "operator")
  async createAlertRule(@Body() body: any) {
    const ruleData = AlertRuleCreateSchema.parse(body);
    return await this.monitoringService.createAlertRule(ruleData);
  }

  @Put("alerts/rules/:ruleId")
  @Roles("admin", "operator")
  async updateAlertRule(
    @Param("ruleId") ruleId: string,
    @Body() body: Partial<AlertRule>
  ) {
    return await this.monitoringService.updateAlertRule(ruleId, body);
  }

  @Delete("alerts/rules/:ruleId")
  @Roles("admin", "operator")
  async deleteAlertRule(@Param("ruleId") ruleId: string) {
    return await this.monitoringService.deleteAlertRule(ruleId);
  }

  @Post("alerts/:alertId/acknowledge")
  @Roles("admin", "operator")
  async acknowledgeAlert(
    @Param("alertId") alertId: string,
    @Body() body: { acknowledgedBy: string }
  ) {
    return await this.monitoringService.acknowledgeAlert(
      alertId,
      body.acknowledgedBy
    );
  }

  @Post("alerts/:alertId/resolve")
  @Roles("admin", "operator")
  async resolveAlert(
    @Param("alertId") alertId: string,
    @Body() body: { resolvedBy: string; reason?: string }
  ) {
    return await this.monitoringService.resolveAlert(
      alertId,
      body.resolvedBy,
      body.reason
    );
  }

  // ========================================================================
  // 仪表板相关接口
  // ========================================================================

  @Get("dashboards")
  @Roles("admin", "operator", "viewer")
  async getDashboards() {
    return await this.monitoringService.getDashboards();
  }

  @Get("dashboards/:dashboardId")
  @Roles("admin", "operator", "viewer")
  async getDashboard(@Param("dashboardId") dashboardId: string) {
    return await this.monitoringService.getDashboard(dashboardId);
  }

  @Get("dashboards/:dashboardId/data")
  @Roles("admin", "operator", "viewer")
  async getDashboardData(@Param("dashboardId") dashboardId: string) {
    return await this.monitoringService.getDashboardData(dashboardId);
  }

  @Post("dashboards")
  @Roles("admin", "operator")
  async createDashboard(@Body() body: any) {
    const dashboardData = DashboardCreateSchema.parse(body);
    return await this.monitoringService.createDashboard(dashboardData);
  }

  @Put("dashboards/:dashboardId")
  @Roles("admin", "operator")
  async updateDashboard(
    @Param("dashboardId") dashboardId: string,
    @Body() body: Partial<Dashboard>
  ) {
    return await this.monitoringService.updateDashboard(dashboardId, body);
  }

  @Delete("dashboards/:dashboardId")
  @Roles("admin", "operator")
  async deleteDashboard(@Param("dashboardId") dashboardId: string) {
    return await this.monitoringService.deleteDashboard(dashboardId);
  }

  // ========================================================================
  // 系统状态接口
  // ========================================================================

  @Get("health")
  async getHealth() {
    return await this.monitoringService.getSystemHealth();
  }

  @Get("stats")
  @Roles("admin", "operator", "viewer")
  async getStats() {
    return await this.monitoringService.getSystemStats();
  }

  @Get("status")
  @Roles("admin", "operator", "viewer")
  async getStatus() {
    return await this.monitoringService.getSystemStatus();
  }
}

// ============================================================================
// WebSocket 网关
// ============================================================================

@WebSocketGateway({
  namespace: "/monitoring",
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
})
export class MonitoringGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, Socket>();
  private subscriptions = new Map<string, Set<string>>();

  constructor(private readonly monitoringService: MonitoringService) {
    // 监听告警事件
    this.monitoringService.onAlertFired((alert: Alert) => {
      this.broadcastAlert("alert_fired", alert);
    });

    this.monitoringService.onAlertResolved((alert: Alert) => {
      this.broadcastAlert("alert_resolved", alert);
    });

    // 监听仪表板更新
    this.monitoringService.onDashboardUpdated(
      (dashboardId: string, data: any) => {
        this.broadcastDashboardUpdate(dashboardId, data);
      }
    );
  }

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
    this.connectedClients.set(client.id, client);
    this.subscriptions.set(client.id, new Set());

    // 注册客户端到监控服务
    this.monitoringService.addWebSocketClient(client);

    // 发送初始状态
    client.emit("connection_established", {
      clientId: client.id,
      timestamp: new Date(),
    });
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    this.connectedClients.delete(client.id);
    this.subscriptions.delete(client.id);

    // 从监控服务移除客户端
    this.monitoringService.removeWebSocketClient(client);
  }

  @SubscribeMessage("subscribe_dashboard")
  handleSubscribeDashboard(client: Socket, payload: { dashboardId: string }) {
    const subscriptions = this.subscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.add(`dashboard:${payload.dashboardId}`);
    }

    client.emit("subscription_confirmed", {
      type: "dashboard",
      id: payload.dashboardId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage("unsubscribe_dashboard")
  handleUnsubscribeDashboard(client: Socket, payload: { dashboardId: string }) {
    const subscriptions = this.subscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.delete(`dashboard:${payload.dashboardId}`);
    }

    client.emit("unsubscription_confirmed", {
      type: "dashboard",
      id: payload.dashboardId,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage("subscribe_alerts")
  handleSubscribeAlerts(client: Socket, payload: { severity?: string }) {
    const subscriptions = this.subscriptions.get(client.id);
    if (subscriptions) {
      const key = payload.severity
        ? `alerts:${payload.severity}`
        : "alerts:all";
      subscriptions.add(key);
    }

    client.emit("subscription_confirmed", {
      type: "alerts",
      filter: payload.severity,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage("subscribe_metrics")
  handleSubscribeMetrics(
    client: Socket,
    payload: { metric: string; interval?: number }
  ) {
    const subscriptions = this.subscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.add(`metrics:${payload.metric}`);
    }

    // 启动指标推送
    const interval = payload.interval || 5000; // 默认5秒
    const intervalId = setInterval(async () => {
      try {
        const data = await this.monitoringService.getRealTimeMetric(
          payload.metric
        );
        client.emit("metric_update", {
          metric: payload.metric,
          data,
          timestamp: new Date(),
        });
      } catch (error) {
        console.error(
          `Failed to send metric update for ${payload.metric}:`,
          error
        );
      }
    }, interval);

    // 存储interval ID以便清理
    client.data.metricIntervals = client.data.metricIntervals || new Map();
    client.data.metricIntervals.set(payload.metric, intervalId);

    client.emit("subscription_confirmed", {
      type: "metrics",
      metric: payload.metric,
      interval,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage("unsubscribe_metrics")
  handleUnsubscribeMetrics(client: Socket, payload: { metric: string }) {
    const subscriptions = this.subscriptions.get(client.id);
    if (subscriptions) {
      subscriptions.delete(`metrics:${payload.metric}`);
    }

    // 清理interval
    if (client.data.metricIntervals) {
      const intervalId = client.data.metricIntervals.get(payload.metric);
      if (intervalId) {
        clearInterval(intervalId);
        client.data.metricIntervals.delete(payload.metric);
      }
    }

    client.emit("unsubscription_confirmed", {
      type: "metrics",
      metric: payload.metric,
      timestamp: new Date(),
    });
  }

  @SubscribeMessage("get_system_status")
  async handleGetSystemStatus(client: Socket) {
    try {
      const status = await this.monitoringService.getSystemStatus();
      client.emit("system_status", {
        status,
        timestamp: new Date(),
      });
    } catch (error) {
      client.emit("error", {
        message: "Failed to get system status",
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  private broadcastAlert(event: string, alert: Alert) {
    for (const [clientId, client] of this.connectedClients.entries()) {
      const subscriptions = this.subscriptions.get(clientId);
      if (
        subscriptions &&
        (subscriptions.has("alerts:all") ||
          subscriptions.has(`alerts:${alert.severity}`))
      ) {
        client.emit(event, {
          alert,
          timestamp: new Date(),
        });
      }
    }
  }

  private broadcastDashboardUpdate(dashboardId: string, data: any) {
    for (const [clientId, client] of this.connectedClients.entries()) {
      const subscriptions = this.subscriptions.get(clientId);
      if (subscriptions && subscriptions.has(`dashboard:${dashboardId}`)) {
        client.emit("dashboard_update", {
          dashboardId,
          data,
          timestamp: new Date(),
        });
      }
    }
  }

  // 广播系统事件
  broadcastSystemEvent(event: string, data: any) {
    this.server.emit("system_event", {
      event,
      data,
      timestamp: new Date(),
    });
  }

  // 获取连接统计
  getConnectionStats() {
    return {
      connectedClients: this.connectedClients.size,
      totalSubscriptions: Array.from(this.subscriptions.values()).reduce(
        (total, subs) => total + subs.size,
        0
      ),
    };
  }
}
