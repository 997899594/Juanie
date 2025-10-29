# 可观测性指南

本文档说明如何使用 OpenTelemetry、Prometheus 和 Jaeger 监控 AI DevOps 平台。

## 📊 Prometheus 指标

### 启动应用

```bash
bun run dev
```

应用启动后，Prometheus 指标将在以下端点暴露：

```
http://localhost:9464/metrics
```

### 可用指标

#### HTTP 指标
- `http_requests_total` - HTTP 请求总数
- `http_request_duration` - HTTP 请求延迟（直方图）
- `http_requests_errors` - HTTP 错误总数

#### 数据库指标
- `db_queries_total` - 数据库查询总数
- `db_query_duration` - 数据库查询延迟（直方图）
- `db_connection_pool_size` - 数据库连接池大小

#### 业务指标
- `deployments_total` - 部署总数
- `deployment_duration` - 部署耗时
- `pipeline_runs_total` - Pipeline 运行总数
- `pipeline_run_duration` - Pipeline 运行耗时
- `users_active` - 活跃用户数
- `organizations_total` - 组织总数
- `projects_total` - 项目总数

### 启动 Prometheus

使用 Docker 启动 Prometheus：

```bash
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  -v $(pwd)/alerts.yml:/etc/prometheus/alerts.yml \
  prom/prometheus:latest
```

访问 Prometheus UI：
```
http://localhost:9090
```

### 示例查询

#### 请求速率
```promql
rate(http_requests_total[5m])
```

#### P95 延迟
```promql
histogram_quantile(0.95, rate(http_request_duration_bucket[5m]))
```

#### 错误率
```promql
rate(http_requests_errors[5m]) / rate(http_requests_total[5m])
```

#### 部署成功率
```promql
rate(deployments_total{status="success"}[1h]) / rate(deployments_total[1h])
```

## 🔍 分布式追踪 (Jaeger)

### 启动 Jaeger

使用 Docker 启动 Jaeger：

```bash
docker run -d \
  --name jaeger \
  -e COLLECTOR_OTLP_ENABLED=true \
  -p 16686:16686 \
  -p 4318:4318 \
  jaegertracing/all-in-one:latest
```

访问 Jaeger UI：
```
http://localhost:16686
```

### 配置

应用会自动将追踪数据发送到 Jaeger。可以通过环境变量配置：

```bash
export OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

### 追踪功能

- ✅ 自动追踪 HTTP 请求
- ✅ 自动追踪数据库查询
- ✅ 自动追踪 Fastify 操作
- ✅ 使用 `@Trace()` 装饰器追踪服务方法
- ✅ 错误和异常自动记录

### 使用 @Trace 装饰器

```typescript
import { Trace } from '@/observability'

class MyService {
  @Trace('my-operation')
  async myMethod() {
    // 自动追踪
  }
}
```

### 手动创建 Span

```typescript
import { withSpan } from '@/observability'

await withSpan('custom-operation', async (span) => {
  span.setAttribute('custom.attribute', 'value')
  // 执行操作
})
```

## 📈 Grafana 仪表板

### 启动 Grafana

```bash
docker run -d \
  --name grafana \
  -p 3000:3000 \
  -e GF_SECURITY_ADMIN_PASSWORD=admin \
  grafana/grafana:latest
```

访问 Grafana：
```
http://localhost:3000
```

默认凭据：
- 用户名: `admin`
- 密码: `admin`

### 配置数据源

1. 添加 Prometheus 数据源
   - URL: `http://prometheus:9090`（如果使用 Docker 网络）
   - URL: `http://localhost:9090`（如果在本地）

2. 添加 Jaeger 数据源
   - URL: `http://jaeger:16686`（如果使用 Docker 网络）
   - URL: `http://localhost:16686`（如果在本地）

### 推荐仪表板

- **API 性能**: 请求速率、延迟、错误率
- **数据库性能**: 查询速率、延迟、连接池
- **业务指标**: 部署数、Pipeline 运行数、用户活跃度
- **资源使用**: CPU、内存、存储

## 🚀 完整监控栈 (Docker Compose)

创建 `docker-compose.monitoring.yml`：

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - ./alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  jaeger:
    image: jaegertracing/all-in-one:latest
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP receiver

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
    depends_on:
      - prometheus

volumes:
  prometheus_data:
  grafana_data:
```

启动监控栈：

```bash
docker-compose -f docker-compose.monitoring.yml up -d
```

## 🔔 告警配置

告警规则已在 `alerts.yml` 中定义：

- ✅ 高错误率（> 5%）
- ✅ 高延迟（P95 > 1000ms）
- ✅ 数据库查询慢（P95 > 500ms）
- ✅ 部署失败率高（> 20%）
- ✅ Pipeline 失败率高（> 30%）
- ✅ API 服务不可用
- ✅ 数据库连接池耗尽

### 配置告警通知

编辑 Prometheus 配置添加 Alertmanager：

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## 📝 最佳实践

1. **为关键操作添加追踪**
   ```typescript
   @Trace('critical-operation')
   async criticalMethod() { }
   ```

2. **记录业务指标**
   ```typescript
   import { recordDeployment } from '@/observability'
   
   recordDeployment('production', 'success', duration)
   ```

3. **添加自定义属性**
   ```typescript
   import { setSpanAttribute } from '@/observability'
   
   setSpanAttribute('user.id', userId)
   ```

4. **记录重要事件**
   ```typescript
   import { addSpanEvent } from '@/observability'
   
   addSpanEvent('deployment-started', { environment: 'prod' })
   ```

## 🐛 故障排查

### 指标未显示

1. 检查应用是否正常启动
2. 访问 `http://localhost:9464/metrics` 验证指标端点
3. 检查 Prometheus 配置中的 targets

### 追踪未显示

1. 检查 Jaeger 是否运行
2. 验证 OTLP 端点配置
3. 检查应用日志中的 OpenTelemetry 启动消息

### 告警未触发

1. 检查 Prometheus 是否加载了告警规则
2. 访问 Prometheus UI 的 Alerts 页面
3. 验证告警表达式是否正确

## 📚 更多资源

- [OpenTelemetry 文档](https://opentelemetry.io/docs/)
- [Prometheus 文档](https://prometheus.io/docs/)
- [Jaeger 文档](https://www.jaegertracing.io/docs/)
- [Grafana 文档](https://grafana.com/docs/)
