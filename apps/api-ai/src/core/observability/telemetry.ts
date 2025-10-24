import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { z } from 'zod';

// OpenTelemetry配置Schema
export const TelemetryConfigSchema = z.object({
  serviceName: z.string().default('juanie-api-ai'),
  version: z.string().default('1.0.0'),
  environment: z.string().default('development'),
  tracing: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().optional(),
    sampleRate: z.number().min(0).max(1).default(1.0),
    exportInterval: z.number().default(5000),
  }),
  metrics: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().optional(),
    exportInterval: z.number().default(10000),
    histogramBuckets: z.array(z.number()).default([0.1, 0.5, 1, 2, 5, 10]),
  }),
  logs: z.object({
    enabled: z.boolean().default(true),
    endpoint: z.string().optional(),
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  }),
});

export type TelemetryConfig = z.infer<typeof TelemetryConfigSchema>;

// 指标类型Schema
export const MetricTypeSchema = z.enum([
  'counter',
  'gauge',
  'histogram',
  'summary',
]);

export type MetricType = z.infer<typeof MetricTypeSchema>;

// 指标定义Schema
export const MetricDefinitionSchema = z.object({
  name: z.string(),
  type: MetricTypeSchema,
  description: z.string(),
  unit: z.string().optional(),
  labels: z.array(z.string()).default([]),
});

export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;

// 追踪Span Schema
export const SpanSchema = z.object({
  traceId: z.string(),
  spanId: z.string(),
  parentSpanId: z.string().optional(),
  operationName: z.string(),
  startTime: z.number(),
  endTime: z.number().optional(),
  duration: z.number().optional(),
  status: z.enum(['ok', 'error', 'timeout']).default('ok'),
  tags: z.record(z.any()).default({}),
  logs: z.array(z.object({
    timestamp: z.number(),
    level: z.string(),
    message: z.string(),
    fields: z.record(z.any()).default({}),
  })).default([]),
});

export type Span = z.infer<typeof SpanSchema>;

// 告警规则Schema
export const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  metric: z.string(),
  condition: z.object({
    operator: z.enum(['>', '<', '>=', '<=', '==', '!=']),
    threshold: z.number(),
    duration: z.number(), // 持续时间(秒)
  }),
  severity: z.enum(['critical', 'warning', 'info']),
  channels: z.array(z.string()), // 通知渠道
  enabled: z.boolean().default(true),
  labels: z.record(z.string()).default({}),
});

export type AlertRule = z.infer<typeof AlertRuleSchema>;

// OpenTelemetry集成服务
@Injectable()
export class OpenTelemetryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OpenTelemetryService.name);
  private tracer: any;
  private meter: any;
  private provider: any;
  private initialized = false;

  constructor(
    private configService: ConfigService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initialize();
  }

  async onModuleDestroy(): Promise<void> {
    await this.shutdown();
  }

  private async initialize(): Promise<void> {
    try {
      const config = this.getConfig();
      
      // 动态导入OpenTelemetry模块
      const { NodeSDK } = await import('@opentelemetry/sdk-node');
      const { Resource } = await import('@opentelemetry/resources');
      const { SemanticResourceAttributes } = await import('@opentelemetry/semantic-conventions');
      const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node');
      const { JaegerExporter } = await import('@opentelemetry/exporter-jaeger');
      const { PrometheusExporter } = await import('@opentelemetry/exporter-prometheus');

      // 创建资源
      const resource = new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: config.serviceName,
        [SemanticResourceAttributes.SERVICE_VERSION]: config.version,
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.environment,
      });

      // 配置导出器
      const exporters: any[] = [];
      
      if (config.tracing.enabled && config.tracing.endpoint) {
        exporters.push(new JaegerExporter({
          endpoint: config.tracing.endpoint,
        }));
      }

      // 初始化SDK
      const sdk = new NodeSDK({
        resource,
        instrumentations: [getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-fs': {
            enabled: false, // 禁用文件系统监控以减少噪音
          },
        })],
        traceExporter: exporters[0],
        metricReader: config.metrics.enabled ? new PrometheusExporter({
          port: 9464,
        }) : undefined,
      });

      // 启动SDK
      sdk.start();
      this.provider = sdk;

      // 获取tracer和meter
      const { trace, metrics } = await import('@opentelemetry/api');
      this.tracer = trace.getTracer(config.serviceName, config.version);
      this.meter = metrics.getMeter(config.serviceName, config.version);

      this.initialized = true;
      this.logger.log('OpenTelemetry initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize OpenTelemetry:', error);
      // 使用本地实现作为备用
      await this.initializeFallback();
    }
  }

  private async initializeFallback(): Promise<void> {
    // 本地追踪实现
    this.tracer = new LocalTracer();
    this.meter = new LocalMeter();
    this.initialized = true;
    this.logger.warn('Using local telemetry implementation');
  }

  private getConfig(): TelemetryConfig {
    return TelemetryConfigSchema.parse({
      serviceName: this.configService.get('TELEMETRY_SERVICE_NAME'),
      version: this.configService.get('npm_package_version'),
      environment: this.configService.get('NODE_ENV'),
      tracing: {
        enabled: this.configService.get('TELEMETRY_TRACING_ENABLED', true),
        endpoint: this.configService.get('JAEGER_ENDPOINT'),
        sampleRate: this.configService.get('TELEMETRY_SAMPLE_RATE', 1.0),
      },
      metrics: {
        enabled: this.configService.get('TELEMETRY_METRICS_ENABLED', true),
        endpoint: this.configService.get('PROMETHEUS_ENDPOINT'),
      },
      logs: {
        enabled: this.configService.get('TELEMETRY_LOGS_ENABLED', true),
        level: this.configService.get('LOG_LEVEL', 'info'),
      },
    });
  }

  // 创建Span
  createSpan(name: string, options: any = {}): any {
    if (!this.initialized) {
      return new NoOpSpan();
    }

    return this.tracer.startSpan(name, {
      attributes: options.attributes || {},
      kind: options.kind,
    });
  }

  // 创建子Span
  createChildSpan(parentSpan: any, name: string, options: any = {}): any {
    if (!this.initialized) {
      return new NoOpSpan();
    }

    return this.tracer.startSpan(name, {
      parent: parentSpan,
      attributes: options.attributes || {},
      kind: options.kind,
    });
  }

  // 记录异常
  recordException(span: any, error: Error): void {
    if (span && span.recordException) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // ERROR
    }
  }

  // 添加事件
  addEvent(span: any, name: string, attributes: any = {}): void {
    if (span && span.addEvent) {
      span.addEvent(name, attributes);
    }
  }

  // 获取当前Span
  getCurrentSpan(): any {
    if (!this.initialized) {
      return new NoOpSpan();
    }

    const { trace } = require('@opentelemetry/api');
    return trace.getActiveSpan();
  }

  private async shutdown(): Promise<void> {
    if (this.provider && this.provider.shutdown) {
      await this.provider.shutdown();
      this.logger.log('OpenTelemetry shutdown completed');
    }
  }
}

// 指标收集服务
@Injectable()
export class MetricsCollector implements OnModuleInit {
  private readonly logger = new Logger(MetricsCollector.name);
  private metrics = new Map<string, any>();
  private customMetrics = new Map<string, MetricDefinition>();

  constructor(
    private telemetryService: OpenTelemetryService,
    private eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.initializeMetrics();
    this.setupEventListeners();
  }

  private async initializeMetrics(): Promise<void> {
    // 定义核心业务指标
    const coreMetrics: MetricDefinition[] = [
      {
        name: 'http_requests_total',
        type: 'counter',
        description: 'Total number of HTTP requests',
        labels: ['method', 'route', 'status_code'],
      },
      {
        name: 'http_request_duration_seconds',
        type: 'histogram',
        description: 'HTTP request duration in seconds',
        unit: 'seconds',
        labels: ['method', 'route'],
      },
      {
        name: 'ai_requests_total',
        type: 'counter',
        description: 'Total number of AI requests',
        labels: ['model', 'type', 'status'],
      },
      {
        name: 'ai_request_duration_seconds',
        type: 'histogram',
        description: 'AI request duration in seconds',
        unit: 'seconds',
        labels: ['model', 'type'],
      },
      {
        name: 'database_connections_active',
        type: 'gauge',
        description: 'Number of active database connections',
      },
      {
        name: 'cache_hits_total',
        type: 'counter',
        description: 'Total number of cache hits',
        labels: ['cache_type'],
      },
      {
        name: 'cache_misses_total',
        type: 'counter',
        description: 'Total number of cache misses',
        labels: ['cache_type'],
      },
      {
        name: 'websocket_connections_active',
        type: 'gauge',
        description: 'Number of active WebSocket connections',
      },
      {
        name: 'wasm_executions_total',
        type: 'counter',
        description: 'Total number of WASM executions',
        labels: ['module', 'function', 'status'],
      },
      {
        name: 'security_events_total',
        type: 'counter',
        description: 'Total number of security events',
        labels: ['type', 'severity'],
      },
    ];

    // 注册指标
    for (const metricDef of coreMetrics) {
      await this.registerMetric(metricDef);
    }

    this.logger.log(`Registered ${coreMetrics.length} core metrics`);
  }

  private setupEventListeners(): void {
    // 监听HTTP请求事件
    this.eventEmitter.on('http.request.completed', (data: any) => {
      this.incrementCounter('http_requests_total', 1, {
        method: data.method,
        route: data.route,
        status_code: data.statusCode.toString(),
      });

      this.recordHistogram('http_request_duration_seconds', data.duration / 1000, {
        method: data.method,
        route: data.route,
      });
    });

    // 监听AI请求事件
    this.eventEmitter.on('ai.request.completed', (data: any) => {
      this.incrementCounter('ai_requests_total', 1, {
        model: data.model,
        type: data.type,
        status: data.success ? 'success' : 'error',
      });

      this.recordHistogram('ai_request_duration_seconds', data.duration / 1000, {
        model: data.model,
        type: data.type,
      });
    });

    // 监听缓存事件
    this.eventEmitter.on('cache.hit', (data: any) => {
      this.incrementCounter('cache_hits_total', 1, {
        cache_type: data.type,
      });
    });

    this.eventEmitter.on('cache.miss', (data: any) => {
      this.incrementCounter('cache_misses_total', 1, {
        cache_type: data.type,
      });
    });

    // 监听WASM执行事件
    this.eventEmitter.on('wasm.execution.completed', (data: any) => {
      this.incrementCounter('wasm_executions_total', 1, {
        module: data.module,
        function: data.function,
        status: data.success ? 'success' : 'error',
      });
    });

    // 监听安全事件
    this.eventEmitter.on('security.event', (data: any) => {
      this.incrementCounter('security_events_total', 1, {
        type: data.type,
        severity: data.severity,
      });
    });
  }

  async registerMetric(definition: MetricDefinition): Promise<void> {
    try {
      const meter = this.telemetryService['meter'];
      if (!meter) {
        this.logger.warn(`Cannot register metric ${definition.name}: meter not available`);
        return;
      }

      let metric: any;

      switch (definition.type) {
        case 'counter':
          metric = meter.createCounter(definition.name, {
            description: definition.description,
            unit: definition.unit,
          });
          break;
        case 'gauge':
          metric = meter.createUpDownCounter(definition.name, {
            description: definition.description,
            unit: definition.unit,
          });
          break;
        case 'histogram':
          metric = meter.createHistogram(definition.name, {
            description: definition.description,
            unit: definition.unit,
          });
          break;
        default:
          throw new Error(`Unsupported metric type: ${definition.type}`);
      }

      this.metrics.set(definition.name, metric);
      this.customMetrics.set(definition.name, definition);
      
      this.logger.debug(`Registered metric: ${definition.name} (${definition.type})`);
    } catch (error) {
      this.logger.error(`Failed to register metric ${definition.name}:`, error);
    }
  }

  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const metric = this.metrics.get(name);
    if (metric && metric.add) {
      metric.add(value, labels);
    }
  }

  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.metrics.get(name);
    if (metric && metric.add) {
      // 对于gauge，我们需要先减去当前值，再加上新值
      // 这是一个简化实现，实际项目中可能需要更复杂的状态管理
      metric.add(value, labels);
    }
  }

  recordHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const metric = this.metrics.get(name);
    if (metric && metric.record) {
      metric.record(value, labels);
    }
  }

  getMetricDefinitions(): MetricDefinition[] {
    return Array.from(this.customMetrics.values());
  }
}

// 智能告警服务
@Injectable()
export class IntelligentAlertingService implements OnModuleInit {
  private readonly logger = new Logger(IntelligentAlertingService.name);
  private alertRules = new Map<string, AlertRule>();
  private alertStates = new Map<string, any>();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor(
    private metricsCollector: MetricsCollector,
    private eventEmitter: EventEmitter2,
    private configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.loadAlertRules();
    this.startAlertChecking();
  }

  private async loadAlertRules(): Promise<void> {
    // 加载默认告警规则
    const defaultRules: AlertRule[] = [
      {
        id: 'high_error_rate',
        name: 'High Error Rate',
        description: 'HTTP error rate is above 5%',
        metric: 'http_requests_total',
        condition: {
          operator: '>',
          threshold: 0.05,
          duration: 300, // 5分钟
        },
        severity: 'critical',
        channels: ['slack', 'email'],
        enabled: true,
        labels: { team: 'platform' },
      },
      {
        id: 'high_response_time',
        name: 'High Response Time',
        description: 'Average response time is above 2 seconds',
        metric: 'http_request_duration_seconds',
        condition: {
          operator: '>',
          threshold: 2.0,
          duration: 180, // 3分钟
        },
        severity: 'warning',
        channels: ['slack'],
        enabled: true,
        labels: { team: 'platform' },
      },
      {
        id: 'ai_service_down',
        name: 'AI Service Down',
        description: 'AI service error rate is above 50%',
        metric: 'ai_requests_total',
        condition: {
          operator: '>',
          threshold: 0.5,
          duration: 60, // 1分钟
        },
        severity: 'critical',
        channels: ['slack', 'email', 'pagerduty'],
        enabled: true,
        labels: { team: 'ai' },
      },
      {
        id: 'security_incident',
        name: 'Security Incident',
        description: 'Multiple security events detected',
        metric: 'security_events_total',
        condition: {
          operator: '>',
          threshold: 10,
          duration: 60, // 1分钟
        },
        severity: 'critical',
        channels: ['slack', 'email', 'security'],
        enabled: true,
        labels: { team: 'security' },
      },
    ];

    for (const rule of defaultRules) {
      this.addAlertRule(rule);
    }

    this.logger.log(`Loaded ${defaultRules.length} alert rules`);
  }

  addAlertRule(rule: AlertRule): void {
    const validatedRule = AlertRuleSchema.parse(rule);
    this.alertRules.set(validatedRule.id, validatedRule);
    this.alertStates.set(validatedRule.id, {
      triggered: false,
      firstTriggered: null,
      lastChecked: null,
      consecutiveFailures: 0,
    });

    this.logger.debug(`Added alert rule: ${validatedRule.name}`);
  }

  removeAlertRule(ruleId: string): void {
    this.alertRules.delete(ruleId);
    this.alertStates.delete(ruleId);
    this.logger.debug(`Removed alert rule: ${ruleId}`);
  }

  private startAlertChecking(): void {
    const checkInterval = this.configService.get('ALERT_CHECK_INTERVAL', 30000); // 30秒
    
    this.checkInterval = setInterval(async () => {
      await this.checkAlerts();
    }, checkInterval);

    this.logger.log(`Alert checking started (interval: ${checkInterval}ms)`);
  }

  private async checkAlerts(): Promise<void> {
    for (const [ruleId, rule] of this.alertRules) {
      if (!rule.enabled) continue;

      try {
        await this.checkAlert(ruleId, rule);
      } catch (error) {
        this.logger.error(`Error checking alert rule ${ruleId}:`, error);
      }
    }
  }

  private async checkAlert(ruleId: string, rule: AlertRule): Promise<void> {
    const state = this.alertStates.get(ruleId)!;
    const now = Date.now();

    // 获取指标值（这里需要实际的指标查询实现）
    const metricValue = await this.getMetricValue(rule.metric);
    
    // 检查条件
    const conditionMet = this.evaluateCondition(metricValue, rule.condition);
    
    state.lastChecked = now;

    if (conditionMet) {
      state.consecutiveFailures++;
      
      if (!state.triggered) {
        state.firstTriggered = now;
      }

      // 检查是否达到持续时间阈值
      const durationMet = state.firstTriggered && 
        (now - state.firstTriggered) >= (rule.condition.duration * 1000);

      if (durationMet && !state.triggered) {
        // 触发告警
        state.triggered = true;
        await this.triggerAlert(rule, metricValue);
      }
    } else {
      // 条件不满足，重置状态
      if (state.triggered) {
        // 告警恢复
        await this.resolveAlert(rule);
      }
      
      state.triggered = false;
      state.firstTriggered = null;
      state.consecutiveFailures = 0;
    }
  }

  private async getMetricValue(metricName: string): Promise<number> {
    // 这里需要实际的指标查询实现
    // 可以从Prometheus、内存指标或其他数据源获取
    return Math.random(); // 模拟指标值
  }

  private evaluateCondition(value: number, condition: AlertRule['condition']): boolean {
    switch (condition.operator) {
      case '>': return value > condition.threshold;
      case '<': return value < condition.threshold;
      case '>=': return value >= condition.threshold;
      case '<=': return value <= condition.threshold;
      case '==': return value === condition.threshold;
      case '!=': return value !== condition.threshold;
      default: return false;
    }
  }

  private async triggerAlert(rule: AlertRule, value: number): Promise<void> {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      description: rule.description,
      severity: rule.severity,
      metric: rule.metric,
      value,
      threshold: rule.condition.threshold,
      timestamp: new Date(),
      labels: rule.labels,
    };

    // 发送到各个通知渠道
    for (const channel of rule.channels) {
      await this.sendNotification(channel, alert);
    }

    // 发布告警事件
    await this.eventEmitter.emitAsync('alert.triggered', alert);

    this.logger.warn(`Alert triggered: ${rule.name} (value: ${value}, threshold: ${rule.condition.threshold})`);
  }

  private async resolveAlert(rule: AlertRule): Promise<void> {
    const alert = {
      ruleId: rule.id,
      ruleName: rule.name,
      description: `${rule.description} - RESOLVED`,
      severity: 'info',
      timestamp: new Date(),
      labels: rule.labels,
    };

    // 发送恢复通知
    for (const channel of rule.channels) {
      await this.sendNotification(channel, alert);
    }

    // 发布恢复事件
    await this.eventEmitter.emitAsync('alert.resolved', alert);

    this.logger.log(`Alert resolved: ${rule.name}`);
  }

  private async sendNotification(channel: string, alert: any): Promise<void> {
    try {
      switch (channel) {
        case 'slack':
          await this.sendSlackNotification(alert);
          break;
        case 'email':
          await this.sendEmailNotification(alert);
          break;
        case 'pagerduty':
          await this.sendPagerDutyNotification(alert);
          break;
        case 'security':
          await this.sendSecurityNotification(alert);
          break;
        default:
          this.logger.warn(`Unknown notification channel: ${channel}`);
      }
    } catch (error) {
      this.logger.error(`Failed to send notification to ${channel}:`, error);
    }
  }

  private async sendSlackNotification(alert: any): Promise<void> {
    // Slack通知实现
    this.logger.debug(`Slack notification: ${alert.ruleName}`);
  }

  private async sendEmailNotification(alert: any): Promise<void> {
    // 邮件通知实现
    this.logger.debug(`Email notification: ${alert.ruleName}`);
  }

  private async sendPagerDutyNotification(alert: any): Promise<void> {
    // PagerDuty通知实现
    this.logger.debug(`PagerDuty notification: ${alert.ruleName}`);
  }

  private async sendSecurityNotification(alert: any): Promise<void> {
    // 安全团队通知实现
    this.logger.debug(`Security notification: ${alert.ruleName}`);
  }

  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  getAlertStates(): Array<{ ruleId: string; state: any }> {
    return Array.from(this.alertStates.entries()).map(([ruleId, state]) => ({
      ruleId,
      state,
    }));
  }
}

// 本地追踪器实现（备用）
class LocalTracer {
  startSpan(name: string, options: any = {}): LocalSpan {
    return new LocalSpan(name, options);
  }
}

class LocalSpan {
  private startTime = Date.now();
  private attributes: Record<string, any> = {};
  private events: Array<{ name: string; timestamp: number; attributes: any }> = [];

  constructor(private name: string, private options: any = {}) {
    this.attributes = options.attributes || {};
  }

  setAttributes(attributes: Record<string, any>): void {
    Object.assign(this.attributes, attributes);
  }

  addEvent(name: string, attributes: any = {}): void {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes,
    });
  }

  recordException(error: Error): void {
    this.addEvent('exception', {
      'exception.type': error.constructor.name,
      'exception.message': error.message,
      'exception.stacktrace': error.stack,
    });
  }

  setStatus(status: { code: number; message?: string }): void {
    this.attributes['span.status.code'] = status.code;
    if (status.message) {
      this.attributes['span.status.message'] = status.message;
    }
  }

  end(): void {
    const duration = Date.now() - this.startTime;
    console.log(`Span: ${this.name} (${duration}ms)`, {
      attributes: this.attributes,
      events: this.events,
    });
  }
}

class NoOpSpan {
  setAttributes(): void {}
  addEvent(): void {}
  recordException(): void {}
  setStatus(): void {}
  end(): void {}
}

class LocalMeter {
  createCounter(name: string, options: any = {}): LocalCounter {
    return new LocalCounter(name, options);
  }

  createUpDownCounter(name: string, options: any = {}): LocalUpDownCounter {
    return new LocalUpDownCounter(name, options);
  }

  createHistogram(name: string, options: any = {}): LocalHistogram {
    return new LocalHistogram(name, options);
  }
}

class LocalCounter {
  constructor(private name: string, private options: any = {}) {}

  add(value: number, labels: Record<string, string> = {}): void {
    console.log(`Counter ${this.name}: +${value}`, labels);
  }
}

class LocalUpDownCounter {
  constructor(private name: string, private options: any = {}) {}

  add(value: number, labels: Record<string, string> = {}): void {
    console.log(`Gauge ${this.name}: ${value}`, labels);
  }
}

class LocalHistogram {
  constructor(private name: string, private options: any = {}) {}

  record(value: number, labels: Record<string, string> = {}): void {
    console.log(`Histogram ${this.name}: ${value}`, labels);
  }
}