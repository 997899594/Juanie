# Deployment Guide

生产环境部署指南

## 环境要求

### 最小配置

- **CPU**: 4 cores
- **内存**: 8GB RAM
- **存储**: 50GB SSD
- **网络**: 100Mbps

### 推荐配置

- **CPU**: 8 cores
- **内存**: 16GB RAM
- **存储**: 100GB SSD
- **网络**: 1Gbps

### 软件要求

- **Docker**: >= 24.0
- **Docker Compose**: >= 2.20
- **PostgreSQL**: >= 15
- **Redis**: >= 7.0
- **Node.js**: >= 20 (用于构建)

## 环境变量

### 核心配置

```bash
# 应用
NODE_ENV=production
PORT=3000
WEB_PORT=5173

# 数据库
DATABASE_URL=postgresql://user:password@postgres:5432/devops
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Redis
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=your_redis_password

# 会话
SESSION_SECRET=your_session_secret_min_32_chars
JWT_SECRET=your_jwt_secret_min_32_chars
```

### OAuth 配置（可选）

```bash
# GitHub
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_CALLBACK_URL=https://your-domain.com/api/auth/github/callback

# GitLab
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret
GITLAB_CALLBACK_URL=https://your-domain.com/api/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com
```

### AI 配置（可选）

```bash
# Ollama
OLLAMA_BASE_URL=http://ollama:11434
OLLAMA_MODEL=llama2

# OpenAI (备选)
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
```

### 存储配置

```bash
# S3 兼容存储
S3_ENDPOINT=http://minio:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=devops-platform
S3_REGION=us-east-1
```

### K3s 配置（可选）

```bash
# Kubernetes
K3S_URL=https://k3s.example.com:6443
K3S_TOKEN=your_k3s_token
K3S_NAMESPACE=default

# Flux CD
FLUX_NAMESPACE=flux-system
FLUX_VERSION=v2.1.0
```

### 监控配置

```bash
# Prometheus
PROMETHEUS_URL=http://prometheus:9090

# Grafana
GRAFANA_URL=http://grafana:3001
GRAFANA_ADMIN_PASSWORD=your_grafana_password
```

## Docker Compose 部署

### 1. 准备环境

```bash
# 创建部署目录
mkdir -p /opt/devops-platform
cd /opt/devops-platform

# 克隆仓库
git clone https://github.com/your-org/ai-devops-platform.git .

# 复制环境变量
cp .env.example .env
vim .env  # 编辑配置
```

### 2. 构建镜像

```bash
# 构建所有服务
docker-compose -f docker-compose.prod.yml build

# 或使用预构建镜像
docker-compose -f docker-compose.prod.yml pull
```

### 3. 启动服务

```bash
# 启动所有服务
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f

# 查看状态
docker-compose -f docker-compose.prod.yml ps
```

### 4. 初始化数据库

```bash
# 运行迁移
docker-compose -f docker-compose.prod.yml exec api bun run db:push

# 创建管理员用户（可选）
docker-compose -f docker-compose.prod.yml exec api bun run seed:admin
```

### 5. 验证部署

```bash
# 检查健康状态
curl http://localhost:3000/health

# 检查 API
curl http://localhost:3000/api/trpc/health.check

# 访问 Web
open http://localhost:5173
```

## K3s 部署

### 1. 安装 K3s

```bash
# 在主节点安装
curl -sfL https://get.k3s.io | sh -

# 获取 token
sudo cat /var/lib/rancher/k3s/server/node-token

# 在工作节点加入集群
curl -sfL https://get.k3s.io | K3S_URL=https://master:6443 K3S_TOKEN=<token> sh -
```

### 2. 安装 Flux CD

```bash
# 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 引导 Flux
flux bootstrap github \
  --owner=your-org \
  --repository=ai-devops-platform \
  --branch=main \
  --path=./infra/k3s \
  --personal
```

### 3. 部署应用

```bash
# 应用 Kubernetes 配置
kubectl apply -f infra/k3s/

# 查看部署状态
kubectl get pods -n devops-platform

# 查看服务
kubectl get svc -n devops-platform
```

### 4. 配置 Ingress

```bash
# 安装 Traefik (K3s 默认)
kubectl apply -f infra/k3s/ingress.yaml

# 或使用 Nginx Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml
```

## 数据库管理

### 备份

```bash
# 手动备份
docker-compose exec postgres pg_dump -U user devops > backup.sql

# 自动备份（cron）
0 2 * * * docker-compose exec postgres pg_dump -U user devops > /backups/devops-$(date +\%Y\%m\%d).sql
```

### 恢复

```bash
# 从备份恢复
docker-compose exec -T postgres psql -U user devops < backup.sql
```

### 迁移

```bash
# 运行迁移
docker-compose exec api bun run db:push

# 回滚（如果需要）
docker-compose exec api bun run db:drop
```

## 监控和日志

### Prometheus

```bash
# 访问 Prometheus
open http://localhost:9090

# 查看指标
curl http://localhost:9090/api/v1/query?query=up
```

### Grafana

```bash
# 访问 Grafana
open http://localhost:3001

# 默认登录
# 用户名: admin
# 密码: 见 GRAFANA_ADMIN_PASSWORD
```

### 日志

```bash
# 查看所有日志
docker-compose logs -f

# 查看特定服务
docker-compose logs -f api

# 查看最近 100 行
docker-compose logs --tail=100 api
```

## 性能优化

### 数据库优化

```sql
-- 创建索引
CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_deployments_project_id ON deployments(project_id);

-- 分析表
ANALYZE projects;
ANALYZE deployments;
```

### Redis 优化

```bash
# 设置最大内存
redis-cli CONFIG SET maxmemory 2gb
redis-cli CONFIG SET maxmemory-policy allkeys-lru
```

### 应用优化

```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096"

# 启用集群模式
PM2_INSTANCES=4
```

## 安全配置

### SSL/TLS

```bash
# 使用 Let's Encrypt
certbot certonly --standalone -d your-domain.com

# 配置 Nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
}
```

### 防火墙

```bash
# 只开放必要端口
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw enable
```

### 密钥管理

```bash
# 使用 Docker Secrets
echo "my_secret" | docker secret create db_password -

# 在 docker-compose.yml 中使用
services:
  api:
    secrets:
      - db_password
```

## 故障排查

### 常见问题

**1. 数据库连接失败**
```bash
# 检查数据库状态
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 测试连接
docker-compose exec postgres psql -U user -d devops
```

**2. Redis 连接失败**
```bash
# 检查 Redis 状态
docker-compose ps redis

# 测试连接
docker-compose exec redis redis-cli ping
```

**3. 内存不足**
```bash
# 查看内存使用
docker stats

# 增加 swap
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

**4. 磁盘空间不足**
```bash
# 清理 Docker
docker system prune -a

# 清理日志
docker-compose exec api rm -rf /app/logs/*
```

### 健康检查

```bash
# API 健康检查
curl http://localhost:3000/health

# 数据库健康检查
docker-compose exec postgres pg_isready

# Redis 健康检查
docker-compose exec redis redis-cli ping
```

## 更新和维护

### 更新应用

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 重新构建
docker-compose -f docker-compose.prod.yml build

# 3. 停止服务
docker-compose -f docker-compose.prod.yml down

# 4. 启动新版本
docker-compose -f docker-compose.prod.yml up -d

# 5. 运行迁移
docker-compose -f docker-compose.prod.yml exec api bun run db:push
```

### 回滚

```bash
# 1. 切换到旧版本
git checkout v1.0.0

# 2. 重新构建和启动
docker-compose -f docker-compose.prod.yml up -d --build

# 3. 恢复数据库（如果需要）
docker-compose exec -T postgres psql -U user devops < backup.sql
```

## 扩展

### 水平扩展

```bash
# 增加 API 实例
docker-compose -f docker-compose.prod.yml up -d --scale api=3

# 使用负载均衡器
# 配置 Nginx 或 Traefik
```

### 垂直扩展

```yaml
# docker-compose.prod.yml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```

## 支持

- 📖 文档: [docs/](./docs/)
- 💬 讨论: [GitHub Discussions](https://github.com/your-org/ai-devops-platform/discussions)
- 🐛 问题: [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues)

---

**生产环境检查清单**:
- [ ] 所有环境变量已配置
- [ ] 数据库已备份
- [ ] SSL 证书已配置
- [ ] 防火墙已设置
- [ ] 监控已启用
- [ ] 日志已配置
- [ ] 健康检查通过
