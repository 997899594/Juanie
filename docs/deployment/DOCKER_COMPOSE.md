# Docker Compose 部署指南

本文档介绍如何使用 Docker Compose 部署 AI DevOps 平台（包含 GitOps 功能）。

## 目录

- [系统要求](#系统要求)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [GitOps 配置](#gitops-配置)
- [故障排查](#故障排查)

---

## 系统要求

### 硬件要求

**最小配置:**

- CPU: 4 核
- 内存: 8 GB
- 磁盘: 50 GB

**推荐配置（含 GitOps）:**

- CPU: 8 核
- 内存: 16 GB
- 磁盘: 100 GB

### 软件要求

- Docker: 20.10+
- Docker Compose: 2.0+
- 操作系统: Linux (Ubuntu 20.04+, CentOS 8+) 或 macOS

---

## 快速开始

### 1. 克隆仓库

```bash
git clone https://github.com/your-org/ai-devops-platform.git
cd ai-devops-platform
```

### 2. 配置环境变量

```bash
# 复制示例配置
cp .env.example .env

# 编辑配置
vim .env
```

必填环境变量：

```bash
# 数据库配置
DATABASE_URL=postgresql://postgres:password@postgres:5432/devops

# JWT 密钥
JWT_SECRET=your-secret-key-change-this

# 管理员账号
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=change-this-password

# GitOps 配置（可选）
ENABLE_GITOPS=true
FLUX_VERSION=v2.2.0
```

### 3. 启动服务

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 检查服务状态
docker-compose ps
```

### 4. 访问平台

打开浏览器访问: http://localhost:3000

默认管理员账号：
- 邮箱: admin@example.com
- 密码: 在 .env 中配置的密码

---

## 配置说明

### docker-compose.yml

完整的 Docker Compose 配置：

```yaml
version: '3.8'

services:
  # PostgreSQL 数据库
  postgres:
    image: postgres:15-alpine
    container_name: devops-postgres
    environment:
      POSTGRES_DB: devops
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-password}
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - devops-network

  # Redis 缓存
  redis:
    image: redis:7-alpine
    container_name: devops-redis
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - devops-network

  # K3s 集群（用于 GitOps）
  k3s:
    image: rancher/k3s:v1.28.5-k3s1
    container_name: devops-k3s
    privileged: true
    environment:
      K3S_TOKEN: ${K3S_TOKEN:-devops-k3s-token}
      K3S_KUBECONFIG_OUTPUT: /output/kubeconfig.yaml
      K3S_KUBECONFIG_MODE: "644"
    volumes:
      - k3s-server:/var/lib/rancher/k3s
      - k3s-kubeconfig:/output
    ports:
      - "6443:6443"
      - "80:80"
      - "443:443"
    tmpfs:
      - /run
      - /var/run
    networks:
      - devops-network
    healthcheck:
      test: ["CMD-SHELL", "k3s kubectl get nodes"]
      interval: 30s
      timeout: 10s
      retries: 5

  # API 服务
  api:
    build:
      context: .
      dockerfile: Dockerfile
      target: api
    container_name: devops-api
    environment:
      NODE_ENV: production
      DATABASE_URL: ${DATABASE_URL}
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
      
      # GitOps 配置
      ENABLE_GITOPS: ${ENABLE_GITOPS:-true}
      KUBECONFIG_PATH: /kubeconfig/config
      FLUX_VERSION: ${FLUX_VERSION:-v2.2.0}
      
      # Git 配置
      GIT_SSH_KEY_PATH: /secrets/git-ssh-key
    volumes:
      - k3s-kubeconfig:/kubeconfig:ro
      - git-ssh-keys:/secrets:ro
      - flux-cli:/usr/local/bin/flux:ro
    ports:
      - "4000:4000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      k3s:
        condition: service_healthy
    networks:
      - devops-network
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  # Web 前端
  web:
    build:
      context: .
      dockerfile: Dockerfile
      target: web
    container_name: devops-web
    environment:
      VITE_API_URL: http://localhost:4000
    ports:
      - "3000:3000"
    depends_on:
      - api
    networks:
      - devops-network

  # Flux CLI 初始化容器
  flux-init:
    image: fluxcd/flux-cli:${FLUX_VERSION:-v2.2.0}
    container_name: devops-flux-init
    entrypoint: ["/bin/sh", "-c"]
    command:
      - |
        cp /usr/local/bin/flux /output/flux
        chmod +x /output/flux
        echo "Flux CLI copied successfully"
    volumes:
      - flux-cli:/output
    networks:
      - devops-network

volumes:
  postgres-data:
    driver: local
  redis-data:
    driver: local
  k3s-server:
    driver: local
  k3s-kubeconfig:
    driver: local
  git-ssh-keys:
    driver: local
  flux-cli:
    driver: local

networks:
  devops-network:
    driver: bridge
```

---

## GitOps 配置

### 启用 GitOps

在 `.env` 文件中配置：

```bash
# 启用 GitOps 功能
ENABLE_GITOPS=true

# Flux 版本
FLUX_VERSION=v2.2.0

# K3s 配置
K3S_TOKEN=your-secure-token-change-this
```

### 配置 Git SSH 密钥

#### 1. 生成 SSH 密钥

```bash
# 创建密钥目录
mkdir -p ./secrets

# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "flux@devops-platform" -f ./secrets/git-ssh-key -N ""

# 设置权限
chmod 600 ./secrets/git-ssh-key
chmod 644 ./secrets/git-ssh-key.pub
```

#### 2. 添加公钥到 Git 仓库

```bash
# 查看公钥
cat ./secrets/git-ssh-key.pub

# 复制公钥内容，添加到：
# - GitHub: Settings → SSH and GPG keys → New SSH key
# - GitLab: Settings → SSH Keys → Add new key
# - Gitea: Settings → SSH / GPG Keys → Add Key
```

#### 3. 挂载密钥到容器

在 `docker-compose.yml` 中已配置：

```yaml
api:
  volumes:
    - ./secrets:/secrets:ro
  environment:
    GIT_SSH_KEY_PATH: /secrets/git-ssh-key
```

### 配置 Kubeconfig

K3s 会自动生成 kubeconfig，API 服务会自动使用。

验证配置：

```bash
# 进入 API 容器
docker-compose exec api sh

# 验证 kubectl 访问
kubectl get nodes

# 验证 Flux CLI
flux version
```

### 安装 Flux

启动服务后，Flux 会自动安装。也可以手动安装：

```bash
# 进入 API 容器
docker-compose exec api sh

# 安装 Flux
flux install --namespace=flux-system

# 验证安装
flux check
```

---

## 环境变量参考

### 必填变量

| 变量名 | 描述 | 示例 |
|--------|------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | JWT 签名密钥 | `your-secret-key` |
| `ADMIN_EMAIL` | 管理员邮箱 | `admin@example.com` |
| `ADMIN_PASSWORD` | 管理员密码 | `secure-password` |

### GitOps 相关变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `ENABLE_GITOPS` | 启用 GitOps 功能 | `true` |
| `FLUX_VERSION` | Flux 版本 | `v2.2.0` |
| `K3S_TOKEN` | K3s 集群 token | `devops-k3s-token` |
| `KUBECONFIG_PATH` | Kubeconfig 文件路径 | `/kubeconfig/config` |
| `GIT_SSH_KEY_PATH` | Git SSH 密钥路径 | `/secrets/git-ssh-key` |

### 可选变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `NODE_ENV` | 运行环境 | `production` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `REDIS_URL` | Redis 连接字符串 | `redis://redis:6379` |
| `PORT` | API 服务端口 | `4000` |

---

## 常用命令

### 服务管理

```bash
# 启动所有服务
docker-compose up -d

# 启动特定服务
docker-compose up -d api web

# 停止所有服务
docker-compose down

# 停止并删除数据卷
docker-compose down -v

# 重启服务
docker-compose restart api

# 查看服务状态
docker-compose ps

# 查看日志
docker-compose logs -f
docker-compose logs -f api
docker-compose logs --tail=100 api
```

### 数据库管理

```bash
# 进入数据库
docker-compose exec postgres psql -U postgres -d devops

# 备份数据库
docker-compose exec postgres pg_dump -U postgres devops > backup.sql

# 恢复数据库
docker-compose exec -T postgres psql -U postgres devops < backup.sql

# 查看数据库大小
docker-compose exec postgres psql -U postgres -c "SELECT pg_size_pretty(pg_database_size('devops'));"
```

### K3s 管理

```bash
# 进入 K3s 容器
docker-compose exec k3s sh

# 查看节点
docker-compose exec k3s k3s kubectl get nodes

# 查看所有 Pod
docker-compose exec k3s k3s kubectl get pods -A

# 查看 Flux 状态
docker-compose exec api flux check
```

### 更新服务

```bash
# 拉取最新镜像
docker-compose pull

# 重新构建并启动
docker-compose up -d --build

# 仅重新构建特定服务
docker-compose build api
docker-compose up -d api
```

---

## 故障排查

### 问题 1: K3s 无法启动

**症状:**

```
k3s container keeps restarting
```

**解决方案:**

```bash
# 1. 检查日志
docker-compose logs k3s

# 2. 确保有足够权限
# K3s 需要 privileged 模式

# 3. 检查端口占用
netstat -tuln | grep -E '6443|80|443'

# 4. 清理并重启
docker-compose down
docker volume rm devops_k3s-server
docker-compose up -d k3s
```

### 问题 2: API 无法连接 K3s

**症状:**

```
Error: unable to connect to kubernetes cluster
```

**解决方案:**

```bash
# 1. 检查 kubeconfig
docker-compose exec api cat /kubeconfig/config

# 2. 验证 K3s 健康状态
docker-compose exec k3s k3s kubectl get nodes

# 3. 检查网络连接
docker-compose exec api ping k3s

# 4. 重启服务
docker-compose restart k3s api
```

### 问题 3: Flux 安装失败

**症状:**

```
Flux installation failed
```

**解决方案:**

```bash
# 1. 手动安装 Flux
docker-compose exec api sh
flux install --namespace=flux-system

# 2. 检查 Flux 组件
flux check

# 3. 查看 Flux 日志
kubectl logs -n flux-system -l app=source-controller
```

### 问题 4: Git 认证失败

**症状:**

```
Git authentication failed
```

**解决方案:**

```bash
# 1. 检查 SSH 密钥
docker-compose exec api ls -la /secrets/

# 2. 验证密钥权限
docker-compose exec api stat /secrets/git-ssh-key

# 3. 测试 Git 连接
docker-compose exec api ssh -T git@github.com -i /secrets/git-ssh-key

# 4. 重新生成密钥
rm -rf ./secrets/git-ssh-key*
ssh-keygen -t ed25519 -C "flux@devops-platform" -f ./secrets/git-ssh-key -N ""
# 重新添加公钥到 Git 仓库
docker-compose restart api
```

---

## 生产环境建议

### 1. 使用外部数据库

不要在生产环境使用容器化数据库：

```yaml
# docker-compose.prod.yml
services:
  api:
    environment:
      DATABASE_URL: postgresql://user:pass@external-db.example.com:5432/devops
```

### 2. 配置持久化存储

使用命名卷或绑定挂载：

```yaml
volumes:
  postgres-data:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /data/postgres
```

### 3. 启用 HTTPS

使用 Nginx 或 Traefik 作为反向代理：

```yaml
services:
  nginx:
    image: nginx:alpine
    ports:
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
```

### 4. 配置资源限制

```yaml
services:
  api:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

### 5. 启用日志收集

```yaml
services:
  api:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 6. 定期备份

```bash
# 创建备份脚本
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker-compose exec -T postgres pg_dump -U postgres devops > backup_${DATE}.sql
tar czf backup_${DATE}.tar.gz backup_${DATE}.sql
rm backup_${DATE}.sql
EOF

chmod +x backup.sh

# 添加到 crontab
crontab -e
# 每天凌晨 2 点备份
0 2 * * * /path/to/backup.sh
```

---

## 升级指南

### 升级平台版本

```bash
# 1. 备份数据
./backup.sh

# 2. 拉取最新代码
git pull origin main

# 3. 更新镜像
docker-compose pull

# 4. 停止服务
docker-compose down

# 5. 启动新版本
docker-compose up -d

# 6. 验证升级
docker-compose ps
docker-compose logs -f
```

### 升级 Flux 版本

```bash
# 1. 更新 .env
vim .env
# FLUX_VERSION=v2.3.0

# 2. 重新构建
docker-compose down
docker-compose up -d flux-init

# 3. 升级 Flux
docker-compose exec api flux install --namespace=flux-system

# 4. 验证
docker-compose exec api flux version
```

---

## 相关文档

- [环境变量配置](./ENVIRONMENT_VARIABLES.md)
- [Flux 安装指南](./FLUX_INSTALLATION.md)
- [GitOps 快速入门](../gitops/QUICK_START.md)
- [故障排查指南](../gitops/TROUBLESHOOTING.md)
