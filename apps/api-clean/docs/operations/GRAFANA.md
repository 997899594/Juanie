# Grafana 监控仪表板设置指南

本指南介绍如何启动和配置 Grafana 监控仪表板。

## 快速开始

### 1. 启动所有服务

```bash
cd apps/api-clean
docker-compose up -d
```

这将启动：
- **Prometheus** - 指标收集 (端口 9090)
- **Loki** - 日志聚合 (端口 3100)
- **Tempo** - 分布式追踪 (端口 4318, 3200)
- **Grafana** - 可视化仪表板 (端口 3300)

### 2. 访问 Grafana

打开浏览器访问：http://localhost:3300

默认登录凭据：
- **用户名**: admin
- **密码**: admin

首次登录后会提示修改密码。

### 3. 查看预配置的仪表板

Grafana 已自动配置了以下仪表板：

1. **AI DevOps Platform - API Overview**
   - 请求速率
   - 响应时间 (p95)
   - 错误率
   - 活跃连接数
   - 数据库连接
   - 缓存命中率
   - 最热门端点
   - 最慢端点

2. **AI DevOps Platform - Deployments**
   - 部署成功率
   - 每小时部署次数
   - 平均部署时长
   - 失败部署统计
   - 部署趋势
   - 按环境的部署时长
   - Pipeline 队列长度
   - 最近部署日志

## 数据源配置

Grafana 已自动配置以下数据源：

### Prometheus
- **URL**: http://prometheus:9090
- **用途**: 应用指标、性能数据
- **默认数据源**: 是

### Loki
- **URL**: http://loki:3100
- **用途**: 日志聚合和查询
- **最大行数**: 1000

### PostgreSQL
- **URL**: postgres:5432
- **数据库**: devops
- **用途**: 业务数据查询

## 自定义仪表板

### 创建新仪表板

1. 点击左侧菜单 "+" → "Dashboard"
2. 点击 "Add new panel"
3. 选择数据源和编写查询
4. 配置可视化选项
5. 保存仪表板

### 常用 Prometheus 查询

#### HTTP 请求速率
```promql
rate(http_requests_total[5m])
```

#### 响应时间 p95
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

#### 错误率
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

#### 数据库连接数
```promql
db_connections_active
```

#### 缓存命中率
```promql
rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

#### 部署成功率
```promql
sum(rate(deployments_total{status="success"}[1h])) / sum(rate(deployments_total[1h]))
```

### 常用 Loki 查询

#### 查看 API 日志
```logql
{job="api"}
```

#### 查看错误日志
```logql
{job="api"} |= "error"
```

#### 查看部署日志
```logql
{job="api"} |= "deployment"
```

#### 查看特定用户的操作
```logql
{job="api"} | json | userId="user-123"
```

#### 统计错误数量
```logql
sum(rate({job="api"} |= "error" [5m]))
```

## 告警配置

### 创建告警规则

1. 打开仪表板面板
2. 点击面板标题 → "Edit"
3. 切换到 "Alert" 标签
4. 配置告警条件
5. 设置通知渠道

### 示例告警规则

#### 高错误率告警
```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
for: 5m
labels:
  severity: critical
annotations:
  summary: "High error rate detected"
  description: "Error rate is {{ $value }} requests/sec"
```

#### 部署失败告警
```yaml
alert: DeploymentFailed
expr: rate(deployments_total{status="failed"}[5m]) > 0
for: 1m
labels:
  severity: warning
annotations:
  summary: "Deployment failed"
  description: "{{ $value }} deployments failed in the last 5 minutes"
```

#### 数据库连接池耗尽
```yaml
alert: DatabaseConnectionPoolExhausted
expr: db_connections_active / db_connections_max > 0.9
for: 5m
labels:
  severity: warning
annotations:
  summary: "Database connection pool nearly exhausted"
  description: "{{ $value }}% of connections in use"
```

## 通知渠道

### 配置 Slack 通知

1. 进入 "Alerting" → "Contact points"
2. 点击 "New contact point"
3. 选择 "Slack"
4. 输入 Webhook URL
5. 测试并保存

### 配置邮件通知

1. 编辑 `docker-compose.yml`，添加 SMTP 配置：

```yaml
grafana:
  environment:
    - GF_SMTP_ENABLED=true
    - GF_SMTP_HOST=smtp.gmail.com:587
    - GF_SMTP_USER=your-email@gmail.com
    - GF_SMTP_PASSWORD=your-app-password
    - GF_SMTP_FROM_ADDRESS=your-email@gmail.com
```

2. 重启 Grafana
3. 配置邮件通知渠道

## 性能优化

### 查询优化

1. **使用合适的时间范围**
   - 避免查询过长的时间范围
   - 使用相对时间（如 "Last 1 hour"）

2. **限制返回数据量**
   - 使用 `topk()` 限制结果数量
   - 使用聚合函数减少数据点

3. **使用变量**
   - 创建仪表板变量，动态过滤数据
   - 减少重复查询

### 缓存配置

在 `docker-compose.yml` 中配置 Grafana 缓存：

```yaml
grafana:
  environment:
    - GF_DATAPROXY_TIMEOUT=300
    - GF_DATAPROXY_KEEP_ALIVE_SECONDS=300
```

## 数据保留策略

### Prometheus 数据保留

编辑 `config/prometheus.yml`：

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

# 保留 30 天数据
storage:
  tsdb:
    retention.time: 30d
    retention.size: 10GB
```

### Loki 数据保留

Loki 默认保留 30 天日志。修改配置：

```yaml
limits_config:
  retention_period: 720h  # 30 days
```

## 备份和恢复

### 备份 Grafana 配置

```bash
# 备份 Grafana 数据
docker exec devops-grafana tar czf /tmp/grafana-backup.tar.gz /var/lib/grafana
docker cp devops-grafana:/tmp/grafana-backup.tar.gz ./backups/

# 备份仪表板
curl -H "Authorization: Bearer YOUR_API_KEY" \
  http://localhost:3300/api/dashboards/db/dashboard-slug \
  > dashboard-backup.json
```

### 恢复 Grafana 配置

```bash
# 恢复数据
docker cp ./backups/grafana-backup.tar.gz devops-grafana:/tmp/
docker exec devops-grafana tar xzf /tmp/grafana-backup.tar.gz -C /

# 重启 Grafana
docker-compose restart grafana
```

## 故障排查

### Grafana 无法启动

1. 检查日志：
```bash
docker logs devops-grafana
```

2. 检查端口占用：
```bash
lsof -i :3300
```

3. 检查数据卷权限：
```bash
docker exec devops-grafana ls -la /var/lib/grafana
```

### 数据源连接失败

1. 检查服务是否运行：
```bash
docker ps | grep -E "prometheus|loki|postgres"
```

2. 测试网络连接：
```bash
docker exec devops-grafana ping prometheus
docker exec devops-grafana ping loki
```

3. 检查数据源配置：
   - 进入 "Configuration" → "Data sources"
   - 点击数据源
   - 点击 "Test" 按钮

### 仪表板无数据

1. 检查时间范围是否正确
2. 验证查询语法
3. 检查数据源是否有数据：
   - Prometheus: http://localhost:9090
   - Loki: http://localhost:3100/ready

4. 查看查询日志：
   - 打开浏览器开发者工具
   - 查看 Network 标签

## 最佳实践

### 1. 组织仪表板
- 按功能分组（API、部署、数据库等）
- 使用文件夹组织相关仪表板
- 添加描述和文档链接

### 2. 使用变量
- 创建环境变量（production, staging）
- 创建时间范围变量
- 创建服务/项目变量

### 3. 设置合理的刷新间隔
- 实时监控：5-10 秒
- 常规监控：30 秒 - 1 分钟
- 历史分析：不自动刷新

### 4. 配置告警
- 为关键指标设置告警
- 使用合适的阈值
- 避免告警疲劳

### 5. 定期备份
- 每周备份仪表板配置
- 导出重要仪表板为 JSON
- 版本控制仪表板配置

## 相关资源

- [Grafana 官方文档](https://grafana.com/docs/)
- [Prometheus 查询语法](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Loki 查询语法](https://grafana.com/docs/loki/latest/logql/)
- [仪表板最佳实践](https://grafana.com/docs/grafana/latest/best-practices/)

## 下一步

1. 探索预配置的仪表板
2. 根据需求自定义面板
3. 配置告警规则
4. 设置通知渠道
5. 定期检查和优化查询性能
