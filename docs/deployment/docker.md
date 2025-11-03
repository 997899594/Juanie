# AI DevOps 平台 - 部署指南

> 本文档提供完整的部署指南，包括开发环境、测试环境和生产环境的部署步骤。

## 📋 目录

- [系统要求](#系统要求)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [环境变量配置](#环境变量配置)
- [数据库迁移](#数据库迁移)
- [监控配置](#监控配置)
- [故障排查](#故障排查)

## 系统要求

### 最低配置

- **CPU**: 2 核
- **内存**: 4GB RAM
- **存储**: 20GB 可用空间
- **操作系统**: Linux (Ubuntu 20.04+, CentOS 8+) / macOS / Windows (WSL2)

### 推荐配置（生产环境）

- **CPU**: 4 核+
- **内存**: 8GB+ RAM
- **存储**: 50GB+ SSD
- **操作系统**: Linux (Ubuntu 22.04 LTS)

### 软件依赖

- **Bun**: 1.0+
- **Node.js**: 20+ (可选，Bun 可替代)
- **Docker**: 24.0+
- **Docker Compose**: 2.20+
- **PostgreSQL**: 17+ (如果不使用 Docker)
- **Redis**: 7+ (如果不使用 Docker)

## 开发环境部署

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/ai-devops-platform.git
cd ai-devops-platform
```

### 2. 安装依赖

```bash
# 使用 Bun (推荐)
bun install

# 或使用 npm
npm install
```

### 3. 启动数据库服务

```bash
# 使用 Docker Compose 启动 PostgreSQL 和 Redis
docker-compose up -d postgres redis

# 等待服务启动
docker-compose ps
```

### 4. 配置环境变量

```bash
# 复制环境变量模板
cp apps/api-gateway/.env.example apps/api-gateway/.env

# 编辑环境变量
vim apps/api-gateway/.env
```

### 5. 运行数据库迁移

```bash
cd apps/api-gateway
bun run db:push
```

### 6. 启动开发服务器

```bash
# 返回项目根目录
cd ../..

# 启动所有服务
bun run dev

# 或只启动 API Gateway
bun run dev --filter=@juanie/api-gateway
```

### 7. 验证部署

访问以下地址验证服务是否正常运行：

- **API Gateway**: http://localhost:3001
- **API 文档**: http://localhost:3001/api
- **健康检查**: http://localhost:3001/health
- **Prometheus 指标**: http://localhost:9465/metrics

## 生产环境部署

### 方式 1: Docker Compose 部署（推荐）

#### 1. 准备服务器

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# 安装 Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose
```

#### 2. 克隆代码

```bash
git clone https://github.com/your-org/ai-devops-platform.git
cd ai-devops-platform
```

#### 3. 配置环境变量

```bash
# 复制生产环境配置模板
cp .env.prod.example .env.prod

# 编辑配置（重要：修改所有密码和密钥）
vim .env.prod
```

**重要配置项**:
- `POSTGRES_PASSWORD`: 数据库密码
- `REDIS_PASSWORD`: Redis 密码
- `JWT_SECRET`: JWT 密钥（至少 32 字符）
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`: GitHub OAuth
- `GITLAB_CLIENT_ID` / `GITLAB_CLIENT_SECRET`: GitLab OAuth

#### 4. 构建和启动服务

```bash
# 构建镜像
docker-compose -f docker-compose.prod.yml build

# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f api-gateway
```

#### 5. 运行数据库迁移

```bash
docker-compose -f docker-compose.prod.yml exec api-gateway bun run db:migrate
```

#### 6. 验证部署

```bash
# 检查服务状态
docker-compose -f docker-compose.prod.yml ps

# 测试 API
curl http://localhost:3001/health

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

### 方式 2: 手动部署

#### 1. 安装依赖

```bash
# 安装 Bun
curl -fsSL https://bun.sh/install | bash

# 安装 PostgreSQL 17
sudo apt install postgresql-17

# 安装 Redis 7
sudo apt install redis-server
```

#### 2. 配置数据库

```bash
# 创建数据库
sudo -u postgres psql
CREATE DATABASE devops;
CREATE USER devops_user WITH PASSWORD 'your-password';
GRANT ALL PRIVILEGES ON DATABASE devops TO devops_user;
\q
```

#### 3. 构建应用

```bash
# 安装依赖
bun install --production

# 构建应用
bun run build

# 运行迁移
cd apps/api-gateway
bun run db:migrate
```

#### 4. 配置 Systemd 服务

创建 `/etc/systemd/system/ai-devops-api.service`:

```ini
[Unit]
Description=AI DevOps Platform API Gateway
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=devops
WorkingDirectory=/opt/ai-devops-platform/apps/api-gateway
Environment="NODE_ENV=production"
EnvironmentFile=/opt/ai-devops-platform/.env.prod
ExecStart=/usr/local/bin/bun run dist/main.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

启动服务:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ai-devops-api
sudo systemctl start ai-devops-api
sudo systemctl status ai-devops-api
```

### 方式 3: Kubernetes 部署

参见 [K3s 部署指南](./k3s.md)

## 环境变量配置

### 必需的环境变量

| 变量名 | 说明 | 示例 |
|--------|------|------|
| `NODE_ENV` | 运行环境 | `production` |
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host:5432/db` |
| `REDIS_URL` | Redis 连接字符串 | `redis://host:6379` |
| `JWT_SECRET` | JWT 密钥 | 至少 32 字符的随机字符串 |

### OAuth 配置

#### GitHub OAuth

1. 访问 https://github.com/settings/developers
2. 创建新的 OAuth App
3. 设置回调 URL: `https://yourdomain.com/auth/github/callback`
4. 获取 Client ID 和 Client Secret

#### GitLab OAuth

1. 访问 https://gitlab.com/-/profile/applications
2. 创建新的 Application
3. 设置回调 URL: `https://yourdomain.com/auth/gitlab/callback`
4. 选择 scopes: `read_user`, `api`
5. 获取 Application ID 和 Secret

### 可选的环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `PORT` | API 端口 | `3001` |
| `CORS_ORIGIN` | CORS 允许的源 | `http://localhost:3000` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | OpenTelemetry 端点 | `http://localhost:4318/v1/traces` |

## 数据库迁移

### 开发环境

```bash
# 推送 schema 到数据库（开发用）
bun run db:push

# 生成迁移文件
bun run db:generate

# 查看 schema
bun run db:studio
```

### 生产环境

```bash
# 运行迁移
bun run db:migrate

# 回滚迁移
bun run db:migrate:rollback

# 查看迁移状态
bun run db:migrate:status
```

## 监控配置

### Prometheus

Prometheus 配置文件位于 `monitoring/prometheus.yml`。

访问 Prometheus UI: http://localhost:9090

### Grafana

Grafana 仪表板配置位于 `grafana/dashboards/`。

默认登录:
- 用户名: `admin`
- 密码: 见 `.env.prod` 中的 `GRAFANA_ADMIN_PASSWORD`

访问 Grafana: http://localhost:3000

### Jaeger

Jaeger 用于分布式追踪。

访问 Jaeger UI: http://localhost:16686

### 配置告警

编辑 `monitoring/prometheus.yml` 添加告警规则:

```yaml
rule_files:
  - 'alerts.yml'

alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

## 故障排查

### 常见问题

#### 1. 数据库连接失败

**症状**: `Error: connect ECONNREFUSED`

**解决方案**:
```bash
# 检查 PostgreSQL 是否运行
docker-compose ps postgres
# 或
sudo systemctl status postgresql

# 检查连接字符串
echo $DATABASE_URL

# 测试连接
psql $DATABASE_URL
```

#### 2. Redis 连接失败

**症状**: `Error: Redis connection to localhost:6379 failed`

**解决方案**:
```bash
# 检查 Redis 是否运行
docker-compose ps redis
# 或
sudo systemctl status redis

# 测试连接
redis-cli ping
```

#### 3. OAuth 认证失败

**症状**: `OAuth callback error`

**解决方案**:
- 检查 Client ID 和 Secret 是否正确
- 确认回调 URL 配置正确
- 检查防火墙是否阻止了回调请求

#### 4. 内存不足

**症状**: 应用频繁重启或 OOM

**解决方案**:
```bash
# 检查内存使用
docker stats

# 增加 Docker 内存限制
# 编辑 docker-compose.prod.yml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 2G
```

#### 5. 端口冲突

**症状**: `Error: listen EADDRINUSE: address already in use`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>

# 或修改端口
export PORT=3002
```

### 日志查看

#### Docker 部署

```bash
# 查看所有服务日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看特定服务日志
docker-compose -f docker-compose.prod.yml logs -f api-gateway

# 查看最近 100 行日志
docker-compose -f docker-compose.prod.yml logs --tail=100 api-gateway
```

#### Systemd 部署

```bash
# 查看服务日志
sudo journalctl -u ai-devops-api -f

# 查看最近 100 行
sudo journalctl -u ai-devops-api -n 100

# 查看特定时间范围
sudo journalctl -u ai-devops-api --since "1 hour ago"
```

### 性能调优

#### 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_organizations_slug ON organizations(slug);

-- 分析查询性能
EXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';

-- 更新统计信息
ANALYZE;
```

#### Redis 优化

```bash
# 检查内存使用
redis-cli INFO memory

# 设置最大内存
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

#### 应用优化

```bash
# 启用生产模式
export NODE_ENV=production

# 禁用调试日志
export LOG_LEVEL=warn

# 启用 Bun 优化
export BUN_JSC_useJIT=1
```

## 备份和恢复

### 数据库备份

```bash
# 备份数据库
docker-compose exec postgres pg_dump -U postgres devops > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U postgres devops < backup.sql
```

### Redis 备份

```bash
# 触发 RDB 快照
docker-compose exec redis redis-cli BGSAVE

# 复制 RDB 文件
docker cp ai-devops-redis:/data/dump.rdb ./redis-backup.rdb
```

## 安全建议

1. **使用强密码**: 所有密码至少 16 字符，包含大小写字母、数字和特殊字符
2. **启用 HTTPS**: 使用 Let's Encrypt 或其他 SSL 证书
3. **限制访问**: 使用防火墙限制数据库和 Redis 的访问
4. **定期更新**: 保持系统和依赖包的更新
5. **监控日志**: 定期检查审计日志和错误日志
6. **备份数据**: 每天自动备份数据库

## 扩展部署

### 水平扩展

```bash
# 扩展 API Gateway 实例
docker-compose -f docker-compose.prod.yml up -d --scale api-gateway=3

# 配置负载均衡器（Nginx）
# 编辑 infra/nginx/nginx.conf
upstream api_backend {
    server api-gateway-1:3001;
    server api-gateway-2:3001;
    server api-gateway-3:3001;
}
```

### 数据库主从复制

数据库主从复制配置请参考 [数据库设计文档](../architecture/database.md)

## 支持

如有问题，请：

1. 查看 [常见问题](../troubleshooting/common-issues.md)
2. 搜索 [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues)
3. 查看 [文档中心](../README.md)
4. 发送邮件至 support@yourdomain.com

---

**最后更新**: 2024-10-31
