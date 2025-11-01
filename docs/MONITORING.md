# 生产监控指南

本文档介绍 AI DevOps 平台的监控系统配置和使用。

## 📋 目录

- [监控架构](#监控架构)
- [Prometheus 配置](#prometheus-配置)
- [Grafana 仪表板](#grafana-仪表板)
- [告警配置](#告警配置)
- [分布式追踪](#分布式追踪)
- [日志聚合](#日志聚合)
- [最佳实践](#最佳实践)

## 监控架构

### 组件概览

```
┌─────────────┐
│ Application │
│  (API GW)   │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│ Prometheus  │   │   Jaeger    │
│  (Metrics)  │   │  (Traces)   │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                │
                ▼
         ┌─────────────┐
         │   Grafana   │
         │ (Dashboard) │
         └─────────────┘
```

### 监控层次

1. **基础设施监控**
   - CPU、内存、磁盘、网络
   - 使用 Node Exporter

2. **应用监控**
   - HTTP 请求指标
   - 业务指标
   - 自定义指标

3. **数据库监控**
   - PostgreSQL 性能指标
   - Redis 性能指标

4. **分布式追踪**
   - 请求链路追踪
   - 性能瓶颈分析

## Prometheus 配置

### 指标端点

API Gateway 在端口 `9465` 暴露 Prometheus 指标：

```bash
curl http://localhost:9465/metrics
```

### 主要指标

#### HTTP 请求指标

```promql
# 请求总数
http_requests_total

# 请求延迟（直方图）
http_request_duration_seconds

# 按状态码统计
http_requests_total{status="200"}
http_requests_total{status=~"5.."}
```

#### 业务指标

```promql
# 部署总数
deployments_total

# Pipeline 运行总数
pipeline_runs_total

# 用户活跃度
active_users_total
```

#### 数据库指标

```promql
# 数据库查询数
db_queries_total

# 查询延迟
db_query_duration_seconds

# 连接池状态
db_connection_pool_size
db_connection_pool_active
```

### 常用查询

#### 请求速率

```promql
# 每秒请求数
rate(http_requests_total[5m])

# 按路径分组
sum(rate(http_requests_total[5m])) by (path)
```

#### 错误率

```promql
# 错误率百分比
(
  rate(http_requests_total{status=~"5.."}[5m])
  /
  rate(http_requests_total[5m])
) * 100
```

#### 响应时间

```promql
# P50 延迟
histogram_quantile(0.50, rate(http_request_duration_seconds_bucket[5m]))

# P95 延迟
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# P99 延迟
histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))
```

## Grafana 仪表板

### 访问 Grafana

- **URL**: http://localhost:3000
- **默认用户名**: admin
- **默认密码**: 见 `.env.prod` 中的 `GRAFANA_ADMIN_PASSWORD`

### 预配置仪表板

#### 1. API Overview Dashboard

位置: `grafana/dashboards/api-overview.json`

包含:
- 请求速率
- 错误率
- 响应时间（P50, P95, P99）
- 活跃连接数
- 按路径分组的请求统计

#### 2. Deployments Dashboard

位置: `grafana/dashboards/deployments.json`

包含:
- 部署成功率
- 部署频率
- 部署时长
- 按环境分组的部署统计

### 创建自定义仪表板

1. 登录 Grafana
2. 点击 "+" -> "Dashboard"
3. 添加面板
4. 选择 Prometheus 数据源
5. 输入 PromQL 查询
6. 配置可视化选项
7. 保存仪表板

### 导出仪表板

```bash
# 导出仪表板 JSON
curl -H "Authorization: Bearer <api-key>" \
  http://localhost:3000/api/dashboards/uid/<dashboard-uid> \
  > dashboard.json
```

## 告警配置

### 告警规则

告警规则定义在 `monitoring/alerts.yml`。

#### 关键告警

1. **APIServiceDown** (Critical)
   - 条件: API 服务宕机超过 1 分钟
   - 触发: `up{job="api-gateway"} == 0`

2. **HighErrorRate** (Critical)
   - 条件: 错误率超过 5%
   - 触发: 错误率持续 5 分钟

3. **HighLatency** (Warning)
   - 条件: P95 延迟超过 1 秒
   - 触发: 延迟持续 5 分钟

4. **HighMemoryUsage** (Warning)
   - 条件: 内存使用率超过 85%
   - 触发: 持续 10 分钟

### 告警级别

- **Critical**: 需要立即处理的严重问题
- **Warning**: 需要关注但不紧急的问题
- **Info**: 信息性告警，用于通知

### 告警通知

#### 配置 Alertmanager（可选）

1. 创建 `monitoring/alertmanager.yml`:

```yaml
global:
  resolve_timeout: 5m

route:
  group_by: ['alertname', 'cluster']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 12h
  receiver: 'default'
  routes:
    - match:
        severity: critical
      receiver: 'critical'
    - match:
        severity: warning
      receiver: 'warning'

receivers:
  - name: 'default'
    webhook_configs:
      - url: 'http://localhost:5001/webhook'
  
  - name: 'critical'
    email_configs:
      - to: 'ops@yourdomain.com'
        from: 'alertmanager@yourdomain.com'
        smarthost: 'smtp.gmail.com:587'
        auth_username: 'alertmanager@yourdomain.com'
        auth_password: 'your-password'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts-critical'
  
  - name: 'warning'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#alerts-warning'
```

2. 在 `docker-compose.prod.yml` 中添加 Alertmanager:

```yaml
alertmanager:
  image: prom/alertmanager:latest
  ports:
    - "9093:9093"
  volumes:
    - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
  command:
    - '--config.file=/etc/alertmanager/alertmanager.yml'
```

3. 更新 `monitoring/prometheus.yml`:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## 分布式追踪

### Jaeger 配置

Jaeger 用于分布式追踪，帮助分析请求链路和性能瓶颈。

#### 访问 Jaeger UI

- **URL**: http://localhost:16686

#### 查看追踪

1. 选择服务: `api-gateway`
2. 选择操作（可选）
3. 点击 "Find Traces"
4. 点击追踪查看详情

#### 追踪分析

- **Span 时长**: 查看每个操作的耗时
- **依赖关系**: 查看服务间的调用关系
- **错误追踪**: 查看失败的请求

### OpenTelemetry 配置

应用使用 OpenTelemetry 收集追踪数据。

配置文件: `apps/api-gateway/src/observability/tracing.ts`

```typescript
export function setupObservability() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [ATTR_SERVICE_NAME]: 'api-gateway',
      [ATTR_SERVICE_VERSION]: '1.0.0',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    // ...
  });
  
  sdk.start();
}
```

## 日志聚合

### Loki 配置（可选）

Loki 用于日志聚合和查询。

#### 安装 Loki

在 `docker-compose.prod.yml` 中添加:

```yaml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  volumes:
    - ./monitoring/loki.yml:/etc/loki/local-config.yaml
  command: -config.file=/etc/loki/local-config.yaml
```

#### 配置日志驱动

```yaml
services:
  api-gateway:
    logging:
      driver: loki
      options:
        loki-url: "http://localhost:3100/loki/api/v1/push"
        loki-batch-size: "400"
```

#### 在 Grafana 中查询日志

```logql
# 查看所有日志
{job="api-gateway"}

# 按级别过滤
{job="api-gateway"} |= "error"

# 按时间范围
{job="api-gateway"} |= "error" [5m]
```

## 最佳实践

### 1. 指标命名

遵循 Prometheus 命名约定:

```
<namespace>_<subsystem>_<name>_<unit>

例如:
http_requests_total
http_request_duration_seconds
db_query_duration_seconds
```

### 2. 标签使用

- 使用有意义的标签
- 避免高基数标签（如用户 ID）
- 常用标签: `method`, `path`, `status`, `environment`

### 3. 告警设置

- 设置合理的阈值
- 避免告警疲劳
- 使用告警分组
- 定期审查告警规则

### 4. 仪表板设计

- 使用一致的时间范围
- 添加变量以支持过滤
- 使用模板化查询
- 添加文档和说明

### 5. 性能优化

- 使用记录规则预计算复杂查询
- 设置合理的数据保留期
- 使用远程存储（如 Thanos）

### 6. 安全性

- 启用认证
- 使用 HTTPS
- 限制访问权限
- 定期更新组件

## 监控检查清单

### 日常检查

- [ ] 检查所有服务是否正常运行
- [ ] 查看错误率是否正常
- [ ] 检查响应时间是否在预期范围
- [ ] 查看资源使用情况

### 每周检查

- [ ] 审查告警历史
- [ ] 检查磁盘使用情况
- [ ] 更新仪表板
- [ ] 优化慢查询

### 每月检查

- [ ] 审查监控策略
- [ ] 更新告警规则
- [ ] 清理旧数据
- [ ] 性能基准测试

## 故障排查

### Prometheus 无法抓取指标

```bash
# 1. 检查目标状态
# 访问 http://localhost:9090/targets

# 2. 测试指标端点
curl http://api-gateway:9465/metrics

# 3. 检查网络连接
docker-compose exec prometheus ping api-gateway

# 4. 查看 Prometheus 日志
docker-compose logs prometheus
```

### Grafana 无数据

```bash
# 1. 检查数据源配置
# 访问 Grafana -> Configuration -> Data Sources

# 2. 测试数据源连接
# 点击 "Test" 按钮

# 3. 检查查询语法
# 在 Explore 页面测试 PromQL 查询

# 4. 查看 Grafana 日志
docker-compose logs grafana
```

### Jaeger 无追踪数据

```bash
# 1. 检查 OTLP 端点
echo $OTEL_EXPORTER_OTLP_ENDPOINT

# 2. 测试端点连接
curl http://jaeger:4318/v1/traces

# 3. 检查应用日志
docker-compose logs api-gateway | grep "OpenTelemetry"

# 4. 验证追踪是否启用
# 在代码中确认 setupObservability() 被调用
```

## 参考资源

- [Prometheus 文档](https://prometheus.io/docs/)
- [Grafana 文档](https://grafana.com/docs/)
- [Jaeger 文档](https://www.jaegertracing.io/docs/)
- [OpenTelemetry 文档](https://opentelemetry.io/docs/)
- [PromQL 教程](https://prometheus.io/docs/prometheus/latest/querying/basics/)

---

**最后更新**: 2024-10-31
