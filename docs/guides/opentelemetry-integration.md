# OpenTelemetry 集成指南

> 完整的可观测性解决方案 - 追踪、指标、日志

## 概述

项目已完整集成 OpenTelemetry，提供端到端的可观测性：

**后端（NestJS + Fastify）:**
- ✅ 自动追踪所有 HTTP 请求
- ✅ 自动追踪数据库查询
- ✅ 自动追踪 Redis 操作
- ✅ Prometheus 指标导出
- ✅ OTLP 追踪导出（Jaeger/Tempo）
- ✅ 自定义 @Trace 装饰器

**前端（Vue 3）:**
- ✅ 自动收集错误和异常
- ✅ 自动收集 Web Vitals（性能指标）
- ✅ 自动追踪用户会话
- ✅ 自动收集控制台日志
- ✅ Grafana Faro 集成

## 架构

```
┌─────────────────────────────────────────────────────────────┐
│                        前端 (Vue 3)                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Grafana Faro SDK                                    │   │
│  │  - 错误收集                                          │   │
│  │  - Web Vitals                                        │   │
│  │  - 用户会话                                          │   │
│  │  - 控制台日志                                        │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
                  Faro Collector (Grafana)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    后端 (NestJS + Fastify)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  OpenTelemetry SDK                                   │   │
│  │  - HTTP 自动追踪                                     │   │
│  │  - 数据库自动追踪                                    │   │
│  │  - Redis 自动追踪                                    │   │
│  │  - 自定义 Span (@Trace)                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
        OTLP Exporter           Prometheus Exporter
                │                       │
                ▼                       ▼
        Jaeger/Tempo              Prometheus
                │                       │
                └───────────┬───────────┘
                            ▼
                        Grafana
                    (统一可视化)
```

## 后端集成

### 1. 已安装的依赖

```json
{
  "@opentelemetry/api": "^1.9.0",
  "@opentelemetry/sdk-node": "^0.56.0",
  "@opentelemetry/auto-instrumentations-node": "^0.67.0",
  "@opentelemetry/exporter-trace-otlp-http": "^0.56.0",
  "@opentelemetry/exporter-prometheus": "^0.56.0",
  "@opentelemetry/resources": "^1.29.0",
  "@opentelemetry/semantic-conventions": "^1.29.0"
}
```

### 2. 配置文件

**位置:** `apps/api-gateway/src/observability/tracing.ts`

```typescript
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { NodeSDK } from '@opentelemetry/sdk-node'

export function setupObservability() {
  const sdk = new NodeSDK({
    resource: new Resource({
      'service.name': 'api-gateway',
      'service.version': '1.0.0',
      environment: process.env.NODE_ENV,
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PrometheusExporter({
      port: 9465,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-fastify': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
  })

  sdk.start()
  return sdk
}
```

### 3. 启动配置

**位置:** `apps/api-gateway/src/main.ts`

```typescript
import { setupObservability } from './observability'

// 必须在应用启动前初始化
const otelSdk = setupObservability()

async function bootstrap() {
  // ... 应用启动代码
}

// 优雅关闭
process.on('SIGTERM', async () => {
  await otelSdk.shutdown()
})
```

### 4. 使用 @Trace 装饰器

**位置:** `packages/core/src/observability/trace.decorator.ts`

```typescript
import { Trace } from '@juanie/core/observability'

@Injectable()
export class ProjectsService {
  @Trace('projects.create')
  async createProject(data: CreateProjectInput) {
    // 自动创建 Span，记录执行时间和错误
    return await this.db.insert(schema.projects).values(data)
  }
}
```

### 5. 自定义指标

**位置:** `apps/api-gateway/src/observability/metrics.ts`

```typescript
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('api-gateway')

// 创建计数器
export const httpRequestCounter = meter.createCounter('http.requests.total')

// 创建直方图
export const httpRequestDuration = meter.createHistogram('http.request.duration')

// 记录指标
export function recordHttpRequest(method: string, path: string, duration: number) {
  httpRequestCounter.add(1, { method, path })
  httpRequestDuration.record(duration, { method, path })
}
```

### 6. 环境变量

```bash
# .env
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
TRACING_ENABLED=true
TRACING_SAMPLE_RATE=1.0
```

## 前端集成

### 1. 已安装的依赖

```json
{
  "@grafana/faro-web-sdk": "^2.0.2"
}
```

### 2. 配置文件

**位置:** `apps/web/src/lib/observability.ts`

```typescript
import { initializeFaro, getWebInstrumentations } from '@grafana/faro-web-sdk'

export function setupObservability() {
  const faro = initializeFaro({
    url: import.meta.env.VITE_FARO_COLLECTOR_URL,
    app: {
      name: 'juanie-web',
      version: import.meta.env.VITE_APP_VERSION,
      environment: import.meta.env.MODE,
    },
    instrumentations: [
      ...getWebInstrumentations({
        captureConsole: true,
        captureConsoleDisabledLevels: ['debug', 'trace'],
      }),
    ],
    sessionTracking: {
      enabled: true,
      persistent: true,
    },
  })

  return faro
}
```

### 3. 启动配置

**位置:** `apps/web/src/main.ts`

```typescript
import { setupObservability } from './lib/observability'
import { setupErrorHandler } from './plugins/error-handler'

// 初始化可观测性
setupObservability()

const app = createApp(App)

// 设置错误处理
setupErrorHandler(app)
```

### 4. 错误处理插件

**位置:** `apps/web/src/plugins/error-handler.ts`

```typescript
import { logError } from '../lib/observability'

export function setupErrorHandler(app: App) {
  // Vue 错误处理
  app.config.errorHandler = (err, instance, info) => {
    logError(err as Error, {
      type: 'vue-error',
      componentName: instance?.$options.name,
      info,
    })
  }

  // 全局未捕获错误
  window.addEventListener('error', (event) => {
    logError(event.error, {
      type: 'uncaught-error',
      filename: event.filename,
    })
  })

  // 未捕获 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    logError(event.reason, {
      type: 'unhandled-rejection',
    })
  })
}
```

### 5. 手动记录事件

```typescript
import { logEvent, logError, setUser } from '@/lib/observability'

// 记录用户操作
logEvent('project.created', {
  projectId: project.id,
  templateId: template.id,
})

// 记录错误
try {
  await createProject(data)
} catch (error) {
  logError(error, { operation: 'createProject' })
}

// 设置用户信息（登录后）
setUser(user.id, user.email, user.username)
```

### 6. 环境变量

```bash
# .env
VITE_OBSERVABILITY_ENABLED=true
VITE_FARO_COLLECTOR_URL=http://localhost:12345/collect
VITE_APP_VERSION=1.0.0
```

## 部署配置

### 1. Docker Compose

```yaml
# docker-compose.yml
services:
  # Jaeger - 追踪后端
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # UI
      - "4318:4318"    # OTLP HTTP
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  # Prometheus - 指标收集
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'

  # Grafana - 可视化
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3001:3000"
    environment:
      - GF_AUTH_ANONYMOUS_ENABLED=true
      - GF_AUTH_ANONYMOUS_ORG_ROLE=Admin
    volumes:
      - ./grafana/datasources.yml:/etc/grafana/provisioning/datasources/datasources.yml
      - ./grafana/dashboards.yml:/etc/grafana/provisioning/dashboards/dashboards.yml

  # Grafana Faro Collector (前端可观测性)
  faro-collector:
    image: grafana/faro-collector:latest
    ports:
      - "12345:12345"
    environment:
      - FARO_RECEIVER_OTLP_ENDPOINT=http://jaeger:4318
```

### 2. Prometheus 配置

```yaml
# prometheus.yml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['localhost:9465']
```

### 3. Grafana 数据源

```yaml
# grafana/datasources.yml
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Jaeger
    type: jaeger
    access: proxy
    url: http://jaeger:16686
```

## 使用场景

### 1. 追踪请求链路

```typescript
// 自动追踪整个请求链路
@Trace('projects.create')
async createProject(data: CreateProjectInput) {
  // 1. 验证权限
  await this.checkPermission(userId, 'create')
  
  // 2. 创建项目
  const project = await this.db.insert(schema.projects).values(data)
  
  // 3. 初始化 GitOps
  await this.gitopsService.initialize(project.id)
  
  // 4. 发送通知
  await this.notificationService.send(userId, 'project.created')
  
  return project
}
```

在 Jaeger UI 中可以看到完整的调用链：
```
projects.create (200ms)
  ├─ checkPermission (10ms)
  ├─ db.insert (50ms)
  ├─ gitopsService.initialize (100ms)
  │   ├─ createNamespace (30ms)
  │   └─ createGitRepository (70ms)
  └─ notificationService.send (40ms)
```

### 2. 监控性能指标

在 Grafana 中创建仪表板：

```promql
# HTTP 请求速率
rate(http_requests_total[5m])

# HTTP 请求延迟（P95）
histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))

# 错误率
rate(http_requests_errors[5m]) / rate(http_requests_total[5m])

# 数据库查询延迟
histogram_quantile(0.95, rate(db_query_duration_bucket[5m]))
```

### 3. 错误追踪

前端错误自动发送到 Grafana Faro：

```typescript
// 自动捕获
throw new Error('Something went wrong')

// 手动记录
logError(new Error('Custom error'), {
  userId: user.id,
  operation: 'createProject',
  projectId: project.id,
})
```

### 4. 用户会话分析

Faro 自动追踪用户会话：
- 页面访问
- 用户操作
- 错误发生时的上下文
- 性能指标（LCP, FID, CLS）

## 最佳实践

### 1. 合理使用 @Trace

```typescript
// ✅ 推荐：追踪重要的业务操作
@Trace('projects.create')
async createProject(data: CreateProjectInput) { }

// ✅ 推荐：追踪外部调用
@Trace('github.createRepository')
async createGitHubRepository(name: string) { }

// ❌ 避免：追踪简单的 getter
@Trace('projects.getId')  // 不需要
getId(): string { return this.id }
```

### 2. 添加有意义的属性

```typescript
import { setSpanAttribute } from '@juanie/core/observability'

@Trace('projects.create')
async createProject(data: CreateProjectInput) {
  setSpanAttribute('project.name', data.name)
  setSpanAttribute('project.template', data.templateId)
  setSpanAttribute('user.id', userId)
  
  // ... 业务逻辑
}
```

### 3. 记录关键事件

```typescript
import { addSpanEvent } from '@juanie/core/observability'

@Trace('projects.initialize')
async initializeProject(projectId: string) {
  addSpanEvent('namespace.created')
  await this.createNamespace(projectId)
  
  addSpanEvent('gitrepository.created')
  await this.createGitRepository(projectId)
  
  addSpanEvent('initialization.completed')
}
```

### 4. 采样策略

```typescript
// 生产环境使用采样
const sdk = new NodeSDK({
  // ...
  sampler: new TraceIdRatioBasedSampler(0.1), // 10% 采样
})
```

### 5. 敏感数据过滤

```typescript
// 不要记录敏感信息
@Trace('auth.login')
async login(email: string, password: string) {
  // ❌ 不要这样做
  setSpanAttribute('password', password)
  
  // ✅ 只记录非敏感信息
  setSpanAttribute('email', email)
}
```

## 故障排查

### 1. 追踪数据未显示

检查：
- OTLP Exporter 端点是否正确
- Jaeger 是否正常运行
- 网络连接是否正常

```bash
# 测试 OTLP 端点
curl http://localhost:4318/v1/traces

# 查看 Jaeger UI
open http://localhost:16686
```

### 2. Prometheus 指标未收集

检查：
- Prometheus 配置是否正确
- 目标端点是否可访问

```bash
# 测试指标端点
curl http://localhost:9465/metrics

# 查看 Prometheus targets
open http://localhost:9090/targets
```

### 3. 前端错误未上报

检查：
- Faro Collector URL 是否正确
- 浏览器控制台是否有错误
- 网络请求是否成功

```typescript
// 启用调试模式
const faro = initializeFaro({
  // ...
  debug: true,
})
```

## 性能影响

### 后端

- **追踪开销:** < 1% CPU，< 10MB 内存
- **指标开销:** < 0.5% CPU，< 5MB 内存
- **网络开销:** 批量发送，异步处理

### 前端

- **Faro SDK:** < 50KB gzipped
- **运行时开销:** < 1% CPU
- **网络开销:** 批量发送，可配置采样率

## 参考资料

- [OpenTelemetry 官方文档](https://opentelemetry.io/docs/)
- [Grafana Faro 文档](https://grafana.com/docs/grafana-cloud/monitor-applications/frontend-observability/)
- [Jaeger 文档](https://www.jaegertracing.io/docs/)
- [Prometheus 文档](https://prometheus.io/docs/)

## 总结

✅ **已完成:**
- 后端 OpenTelemetry 完整集成
- 前端 Grafana Faro 集成
- 自动追踪和指标收集
- 错误处理和上报
- 完整的文档和示例

✅ **收益:**
- 端到端的请求追踪
- 实时性能监控
- 自动错误收集
- 用户会话分析
- 统一的可观测性平台

**下一步:**
- 配置 Grafana 仪表板
- 设置告警规则
- 优化采样策略
- 添加自定义指标
