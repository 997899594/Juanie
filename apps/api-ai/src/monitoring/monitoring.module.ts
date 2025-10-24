/**
 * 🚀 Juanie AI - 监控模块
 * 整合指标收集、智能告警和实时仪表板
 */

import { Global, Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { AlertManager, AnomalyDetector } from "./alerts.service";
import { DashboardManager, DataAggregator } from "./dashboard.service";
import { MetricsCollector, SystemMetricsCollector } from "./metrics.service";
import { MonitoringController } from "./monitoring.controller";
import { MonitoringService } from "./monitoring.service";

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [MonitoringController],
  providers: [
    // 指标收集服务
    {
      provide: MetricsCollector,
      useFactory: (configService: ConfigService) => {
        // MetricsCollector构造函数只接受可选的MetricStore参数
        return new MetricsCollector();
      },
      inject: [ConfigService],
    },

    // 系统指标收集器
    {
      provide: SystemMetricsCollector,
      useFactory: (
        metricsCollector: MetricsCollector,
        configService: ConfigService
      ) => {
        const interval = configService.get("SYSTEM_METRICS_INTERVAL", 30000); // 30秒
        return new SystemMetricsCollector(metricsCollector, interval);
      },
      inject: [MetricsCollector, ConfigService],
    },

    // 异常检测器
    {
      provide: AnomalyDetector,
      useFactory: (configService: ConfigService) => {
        const sensitivity = configService.get("ANOMALY_SENSITIVITY", 2.0);
        return new AnomalyDetector(sensitivity);
      },
      inject: [ConfigService],
    },

    // 告警管理器
    {
      provide: AlertManager,
      useFactory: (metricsCollector: MetricsCollector) => {
        return new AlertManager(metricsCollector);
      },
      inject: [MetricsCollector],
    },

    // 数据聚合器
    {
      provide: DataAggregator,
      useFactory: (metricsCollector: MetricsCollector) => {
        return new DataAggregator(metricsCollector);
      },
      inject: [MetricsCollector],
    },

    // 仪表板管理器
    {
      provide: DashboardManager,
      useFactory: (
        metricsCollector: MetricsCollector,
        alertManager: AlertManager
      ) => {
        return new DashboardManager(metricsCollector, alertManager);
      },
      inject: [MetricsCollector, AlertManager],
    },

    // 监控服务
    MonitoringService,
  ],
  exports: [
    MetricsCollector,
    SystemMetricsCollector,
    AlertManager,
    AnomalyDetector,
    DashboardManager,
    DataAggregator,
    MonitoringService,
  ],
})
export class MonitoringModule {
  constructor(
    private readonly systemMetricsCollector: SystemMetricsCollector,
    private readonly alertManager: AlertManager
  ) {
    // 启动系统指标收集
    this.systemMetricsCollector.start();

    // 启动告警评估
    this.alertManager.startEvaluation();

    // 添加默认告警规则
    this.setupDefaultAlertRules();
  }

  onModuleDestroy() {
    // 停止系统指标收集
    this.systemMetricsCollector.stop();

    // 停止告警评估
    this.alertManager.stopEvaluation();
  }

  private setupDefaultAlertRules() {
    // CPU使用率告警
    this.alertManager.addRule({
      id: "high_cpu_usage",
      name: "High CPU Usage",
      description: "CPU usage is above 80%",
      metric: "system_cpu_usage",
      condition: "threshold",
      threshold: 80,
      operator: ">",
      window: 300, // 5分钟
      severity: "high",
      labels: {},
      enabled: true,
      cooldown: 600, // 10分钟冷却期
      notifications: ["console"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 内存使用率告警
    this.alertManager.addRule({
      id: "high_memory_usage",
      name: "High Memory Usage",
      description: "Memory usage is above 85%",
      metric: "system_memory_usage_percent",
      condition: "threshold",
      threshold: 85,
      operator: ">",
      window: 300,
      severity: "high",
      labels: {},
      enabled: true,
      cooldown: 600,
      notifications: ["console"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 事件循环延迟告警
    this.alertManager.addRule({
      id: "high_event_loop_lag",
      name: "High Event Loop Lag",
      description: "Event loop lag is above 100ms",
      metric: "nodejs_eventloop_lag_seconds",
      condition: "threshold",
      threshold: 0.1, // 100ms
      operator: ">",
      window: 180, // 3分钟
      severity: "medium",
      labels: {},
      enabled: true,
      cooldown: 300,
      notifications: ["console"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // API响应时间异常检测
    this.alertManager.addRule({
      id: "api_response_time_anomaly",
      name: "API Response Time Anomaly",
      description: "Unusual API response time detected",
      metric: "http_request_duration_seconds",
      condition: "anomaly",
      window: 600, // 10分钟
      severity: "medium",
      labels: {},
      enabled: true,
      cooldown: 300,
      notifications: ["console"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 错误率告警
    this.alertManager.addRule({
      id: "high_error_rate",
      name: "High Error Rate",
      description: "Error rate is above 5%",
      metric: "http_requests_error_rate",
      condition: "threshold",
      threshold: 5,
      operator: ">",
      window: 300,
      severity: "critical",
      labels: {},
      enabled: true,
      cooldown: 300,
      notifications: ["console"],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }
}
