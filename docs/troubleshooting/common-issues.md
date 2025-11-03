# 故障排查指南

本文档提供常见问题的诊断和解决方案。

## 📋 目录

- [应用启动问题](#应用启动问题)
- [数据库问题](#数据库问题)
- [认证问题](#认证问题)
- [性能问题](#性能问题)
- [Docker 问题](#docker-问题)
- [监控问题](#监控问题)

## 应用启动问题

### 问题: 应用无法启动

**症状**:
```
Error: Cannot find module '@juanie/core-database'
```

**原因**: 依赖未正确安装或构建

**解决方案**:
```bash
# 1. 清理并重新安装依赖
rm -rf node_modules
bun install

# 2. 构建所有包
bun run build:packages

# 3. 重新启动应用
bun run dev
```

### 问题: 端口已被占用

**症状**:
```
Error: listen EADDRINUSE: address already in use :::3001
```

**原因**: 端口 3001 已被其他进程占用

**解决方案**:
```bash
# 1. 查找占用端口的进程
lsof -i :3001
# 或
netstat -tulpn | grep 3001

# 2. 杀死进程
kill -9 <PID>

# 3. 或者使用不同的端口
export PORT=3002
bun run dev
```

### 问题: 环境变量未加载

**症状**:
```
Error: DATABASE_URL is not defined
```

**原因**: .env 文件不存在或未正确加载

**解决方案**:
```bash
# 1. 检查 .env 文件是否存在
ls -la apps/api-gateway/.env

# 2. 如果不存在，复制模板
cp apps/api-gateway/.env.example apps/api-gateway/.env

# 3. 编辑并填写必要的环境变量
vim apps/api-gateway/.env

# 4. 验证环境变量
cat apps/api-gateway/.env | grep DATABASE_URL
```

## 数据库问题

### 问题: 无法连接到 PostgreSQL

**症状**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**原因**: PostgreSQL 未运行或连接配置错误

**解决方案**:
```bash
# 1. 检查 PostgreSQL 是否运行
docker-compose ps postgres
# 或
sudo systemctl status postgresql

# 2. 如果未运行，启动它
docker-compose up -d postgres
# 或
sudo systemctl start postgresql

# 3. 测试连接
psql $DATABASE_URL

# 4. 检查连接字符串格式
echo $DATABASE_URL
# 应该是: postgresql://user:password@host:port/database
```

### 问题: 数据库迁移失败

**症状**:
```
Error: relation "users" does not exist
```

**原因**: 数据库 schema 未创建或迁移未运行

**解决方案**:
```bash
# 1. 检查数据库是否存在
psql $DATABASE_URL -c "\l"

# 2. 运行迁移
cd apps/api-gateway
bun run db:push

# 3. 如果失败，尝试重置数据库（仅开发环境）
bun run db:reset
bun run db:push

# 4. 验证表是否创建
psql $DATABASE_URL -c "\dt"
```

### 问题: 数据库连接池耗尽

**症状**:
```
Error: remaining connection slots are reserved
```

**原因**: 连接池配置不当或连接泄漏

**解决方案**:
```bash
# 1. 检查当前连接数
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 2. 查看活动连接
psql $DATABASE_URL -c "SELECT * FROM pg_stat_activity WHERE datname = 'devops';"

# 3. 杀死空闲连接
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'devops' AND state = 'idle';"

# 4. 调整连接池配置
# 在 DATABASE_URL 中添加参数
DATABASE_URL="postgresql://user:pass@host:5432/db?pool_timeout=30&connection_limit=10"
```

## 认证问题

### 问题: GitHub OAuth 认证失败

**症状**:
```
Error: OAuth callback error: invalid_client
```

**原因**: GitHub OAuth 配置错误

**解决方案**:
```bash
# 1. 检查环境变量
echo $GITHUB_CLIENT_ID
echo $GITHUB_CLIENT_SECRET

# 2. 验证回调 URL
echo $GITHUB_CALLBACK_URL
# 应该与 GitHub OAuth App 配置中的回调 URL 一致

# 3. 检查 GitHub OAuth App 设置
# 访问: https://github.com/settings/developers
# 确认:
# - Client ID 正确
# - Client Secret 正确
# - Authorization callback URL 正确

# 4. 重新生成 Client Secret（如果需要）
```

### 问题: JWT 令牌验证失败

**症状**:
```
Error: invalid signature
```

**原因**: JWT 密钥不一致或令牌已过期

**解决方案**:
```bash
# 1. 检查 JWT_SECRET 是否一致
echo $JWT_SECRET

# 2. 确保所有实例使用相同的密钥

# 3. 清除 Redis 中的旧会话
redis-cli FLUSHDB

# 4. 重新登录获取新令牌
```

### 问题: 会话丢失

**症状**: 用户频繁需要重新登录

**原因**: Redis 未运行或会话配置错误

**解决方案**:
```bash
# 1. 检查 Redis 是否运行
docker-compose ps redis
redis-cli ping

# 2. 检查 Redis 连接
redis-cli -u $REDIS_URL ping

# 3. 查看会话数据
redis-cli KEYS "session:*"

# 4. 检查会话过期时间
# 在代码中确认 JWT_EXPIRES_IN 设置
echo $JWT_EXPIRES_IN
```

## 性能问题

### 问题: API 响应缓慢

**症状**: 请求响应时间超过 1 秒

**诊断步骤**:
```bash
# 1. 检查 API 响应时间
curl -w "@curl-format.txt" -o /dev/null -s http://localhost:3001/health

# curl-format.txt 内容:
# time_namelookup:  %{time_namelookup}\n
# time_connect:  %{time_connect}\n
# time_appconnect:  %{time_appconnect}\n
# time_pretransfer:  %{time_pretransfer}\n
# time_redirect:  %{time_redirect}\n
# time_starttransfer:  %{time_starttransfer}\n
# ----------\n
# time_total:  %{time_total}\n

# 2. 检查数据库查询性能
psql $DATABASE_URL -c "SELECT query, mean_exec_time, calls FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 3. 检查 Redis 性能
redis-cli --latency

# 4. 查看应用日志
docker-compose logs -f api-gateway | grep "slow"
```

**解决方案**:
```bash
# 1. 添加数据库索引
psql $DATABASE_URL -c "CREATE INDEX idx_users_email ON users(email);"

# 2. 启用查询缓存
# 在代码中使用 Redis 缓存频繁查询的数据

# 3. 优化数据库连接池
# 调整 DATABASE_URL 参数

# 4. 启用 HTTP 压缩
# 在 Nginx 或应用中启用 gzip
```

### 问题: 内存使用过高

**症状**: 应用内存使用超过 1GB

**诊断步骤**:
```bash
# 1. 检查内存使用
docker stats api-gateway

# 2. 生成堆快照（Node.js）
kill -USR2 <PID>

# 3. 使用 Bun 的内存分析
bun --inspect dist/main.js
```

**解决方案**:
```bash
# 1. 限制 Docker 容器内存
# 在 docker-compose.yml 中添加:
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 1G

# 2. 优化代码
# - 避免内存泄漏
# - 及时释放大对象
# - 使用流处理大文件

# 3. 调整 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=512" bun run start
```

### 问题: CPU 使用率过高

**症状**: CPU 使用率持续超过 80%

**诊断步骤**:
```bash
# 1. 检查 CPU 使用
docker stats api-gateway

# 2. 查看进程 CPU 使用
top -p <PID>

# 3. 生成 CPU 分析
bun --cpu-prof dist/main.js
```

**解决方案**:
```bash
# 1. 优化计算密集型操作
# - 使用异步处理
# - 添加缓存
# - 使用 Worker Threads

# 2. 水平扩展
docker-compose up -d --scale api-gateway=3

# 3. 启用负载均衡
# 配置 Nginx 负载均衡
```

## Docker 问题

### 问题: Docker 构建失败

**症状**:
```
ERROR [builder 3/5] RUN bun install --frozen-lockfile
```

**原因**: 依赖安装失败或网络问题

**解决方案**:
```bash
# 1. 清理 Docker 缓存
docker builder prune -a

# 2. 使用国内镜像（如果在中国）
# 在 Dockerfile 中添加:
# RUN bun config set registry https://registry.npmmirror.com

# 3. 重新构建
docker-compose build --no-cache

# 4. 检查 Dockerfile 语法
docker build -t test -f apps/api-gateway/Dockerfile .
```

### 问题: 容器无法启动

**症状**:
```
Error: Container exited with code 1
```

**诊断步骤**:
```bash
# 1. 查看容器日志
docker-compose logs api-gateway

# 2. 查看容器状态
docker-compose ps

# 3. 进入容器调试
docker-compose run --rm api-gateway sh

# 4. 检查健康检查
docker inspect api-gateway | grep -A 10 Health
```

### 问题: 容器间网络不通

**症状**: API 无法连接到数据库

**解决方案**:
```bash
# 1. 检查网络配置
docker network ls
docker network inspect ai-devops_app-network

# 2. 测试容器间连接
docker-compose exec api-gateway ping postgres

# 3. 检查服务名称
# 在 docker-compose.yml 中确认服务名称正确

# 4. 重新创建网络
docker-compose down
docker-compose up -d
```

## 监控问题

### 问题: Prometheus 无法抓取指标

**症状**: Prometheus UI 显示目标为 DOWN

**解决方案**:
```bash
# 1. 检查指标端点
curl http://localhost:9465/metrics

# 2. 检查 Prometheus 配置
cat monitoring/prometheus.yml

# 3. 检查网络连接
docker-compose exec prometheus ping api-gateway

# 4. 重启 Prometheus
docker-compose restart prometheus
```

### 问题: Grafana 无法连接 Prometheus

**症状**: Grafana 仪表板无数据

**解决方案**:
```bash
# 1. 检查 Prometheus 数据源配置
# 访问 Grafana -> Configuration -> Data Sources

# 2. 测试连接
curl http://prometheus:9090/api/v1/query?query=up

# 3. 检查 Grafana 日志
docker-compose logs grafana

# 4. 重新配置数据源
# 在 grafana/provisioning/datasources.yml 中确认配置
```

### 问题: Jaeger 无追踪数据

**症状**: Jaeger UI 无法看到追踪

**解决方案**:
```bash
# 1. 检查 OTLP 端点配置
echo $OTEL_EXPORTER_OTLP_ENDPOINT

# 2. 测试 OTLP 端点
curl http://localhost:4318/v1/traces

# 3. 检查应用日志
docker-compose logs api-gateway | grep "OpenTelemetry"

# 4. 验证追踪是否启用
# 在代码中确认 setupObservability() 被调用
```

## 获取帮助

如果以上方法都无法解决问题：

1. **查看日志**: 详细的日志通常包含问题的根本原因
   ```bash
   docker-compose logs -f --tail=100
   ```

2. **启用调试模式**:
   ```bash
   export LOG_LEVEL=debug
   export LOG_PRETTY=true
   ```

3. **搜索 GitHub Issues**: https://github.com/your-org/ai-devops-platform/issues

4. **加入社区**: Discord / Slack

5. **联系支持**: support@yourdomain.com

---

**最后更新**: 2024-10-31
