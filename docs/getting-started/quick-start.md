# 快速启动指南

## 🎯 概述

本指南将帮助你快速启动整个 AI DevOps 平台，包括前端、后端和基础服务。

## 🚀 快速启动

### 1. 启动基础服务（数据库 + 缓存）

```bash
# 启动 PostgreSQL 和 Dragonfly
docker-compose up -d postgres dragonfly

# 检查服务状态
docker-compose ps

# 查看日志
docker-compose logs -f postgres dragonfly
```

### 2. 启动后端服务

```bash
# 进入 API Gateway 目录
cd apps/api-gateway

# 安装依赖（首次运行）
bun install

# 运行数据库迁移（首次运行）
bun run db:push

# 启动开发服务器
bun run dev
```

后端应该运行在: `http://localhost:3000`

### 3. 启动前端服务

```bash
# 新开一个终端
cd apps/web

# 安装依赖（首次运行）
bun install

# 启动开发服务器
bun run dev
```

前端应该运行在: `http://localhost:5173`

## 📋 服务端口

| 服务 | 端口 | 说明 |
|------|------|------|
| 前端 | 5173 | Vue 3 开发服务器 |
| 后端 | 3000 | NestJS API Gateway |
| PostgreSQL | 5432 | 数据库 |
| Dragonfly | 6379 | Redis 兼容缓存 (25x faster) |
| GitLab | 8080 | GitLab 私服 Web UI |
| GitLab SSH | 2222 | GitLab SSH 端口 |
| Jaeger | 16686 | 链路追踪 UI |
| Prometheus | 9090 | 指标收集 |
| Grafana | 3000 | 监控可视化 |

## ⚙️ 环境变量配置

### 后端 (.env)
```env
# 数据库
DATABASE_URL=postgresql://postgres:password@localhost:5432/devops_dev

# Redis (Dragonfly)
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRES_IN=7d

# GitHub OAuth (可选)
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# GitLab OAuth (可选)
GITLAB_CLIENT_ID=your-gitlab-client-id
GITLAB_CLIENT_SECRET=your-gitlab-client-secret

# OpenTelemetry (可选)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces

# CORS
CORS_ORIGIN=http://localhost:5173
```

### 前端 (.env)
```env
VITE_API_URL=http://localhost:3000
```

## ✅ 验证服务

### 检查 PostgreSQL
```bash
docker-compose exec postgres psql -U postgres -d devops_dev -c "SELECT version();"
```

### 检查 Dragonfly
```bash
docker-compose exec dragonfly redis-cli ping
# 应该返回: PONG
```

### 检查后端
```bash
curl http://localhost:3000/health
# 应该返回: {"status":"ok"}
```

### 检查前端
访问: http://localhost:5173

## 🎯 前端开发特别说明

### 核心改变

**不再构建 UI 包！** Vite 会直接处理 UI 包的源码。

### 前端启动步骤

```bash
# 1. 清理（如果之前卡死过）
bun run fix:vite

# 2. 启动 Web 应用
cd apps/web
bun run dev

# 或者从根目录
bun run dev:web
```

### 优点

- ⚡ **极快启动**：不需要构建 UI 包
- 🔥 **热更新**：修改 UI 组件立即生效
- 🎨 **易于定制**：直接修改 shadcn 组件源码
- 🐛 **易于调试**：直接调试源码，不是构建产物

### 架构说明

```
packages/ui/
  src/components/ui/  ← shadcn 组件源码
  (不需要构建！)

apps/web/
  ↓ 直接导入
  import { Button } from '@juanie/ui'
  ↓ Vite 自动处理
  (预构建 + HMR)
```

### 关键理解

1. **shadcn-vue 不是 npm 包**，是源码
2. **不需要构建**，Vite 会处理
3. **修改即生效**，有 HMR
4. **397 个文件**不是问题，Vite 只处理用到的

## 🔧 常见问题

### 1. 端口被占用
```bash
# 查看端口占用
lsof -i :5173  # 前端
lsof -i :3000  # 后端
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Dragonfly

# 杀死进程
kill -9 <PID>
```

### 2. Docker 服务启动失败
```bash
# 停止所有服务
docker-compose down

# 清理数据（谨慎使用）
docker-compose down -v

# 重新启动
docker-compose up -d postgres dragonfly
```

### 3. 数据库连接失败
```bash
# 检查 PostgreSQL 日志
docker-compose logs postgres

# 重启 PostgreSQL
docker-compose restart postgres

# 等待健康检查通过
docker-compose ps postgres
```

### 4. Dragonfly 连接失败
```bash
# 检查 Dragonfly 日志
docker-compose logs dragonfly

# 重启 Dragonfly
docker-compose restart dragonfly

# 测试连接
docker-compose exec dragonfly redis-cli ping
```

### 5. 后端启动失败
```bash
# 检查依赖
cd apps/api-gateway
bun install

# 检查数据库迁移
bun run db:push

# 查看详细错误
bun run dev
```

### 6. 前端 Vite 卡死

#### 方案 1：清理并重试

```bash
bun run clean:stuck
bun run dev:web
```

#### 方案 2：完全重置

```bash
# 1. 杀死所有进程
pkill -9 -f "vite|esbuild|node"

# 2. 清理所有缓存
rm -rf node_modules/.vite
rm -rf apps/web/node_modules/.vite
rm -rf packages/ui/dist

# 3. 重新启动
bun run dev:web
```

#### 方案 3：使用轮询模式

如果文件监听有问题，编辑 `apps/web/vite.config.ts`：

```typescript
server: {
  watch: {
    usePolling: true,  // 改为 true
    interval: 1000,
  },
}
```

### 7. GitLab 启动慢
```bash
# GitLab 首次启动需要 5-10 分钟
# 查看启动进度
docker-compose logs -f gitlab

# 检查健康状态
docker-compose ps gitlab

# 如果长时间未启动，重启
docker-compose restart gitlab
```

### 8. GitLab 内存不足
```bash
# 当前配置已经是轻量级 GitLab
# - 禁用了内置监控、容器注册表等不必要服务
# - 使用外部 PostgreSQL 和 Dragonfly
# - 限制了 Puma 和 Sidekiq 的并发数
# - 资源限制：最大 4GB 内存，2 CPU 核心

# 如果仍然内存不足，可以临时停止 GitLab
docker-compose stop gitlab

# 或者调整资源限制（编辑 docker-compose.yml）
# deploy.resources.limits.memory: 4G -> 2G
```

## 🚫 前端开发注意事项

### 不要做的事

- ❌ 不要运行 `bun run ui:build`
- ❌ 不要尝试构建 UI 包
- ❌ 不要担心 `packages/ui/dist` 不存在
- ❌ 不要在 turbo.json 中依赖 UI 构建

### 要做的事

- ✅ 直接启动 Web 应用
- ✅ 直接修改 UI 组件源码
- ✅ 享受快速的开发体验
- ✅ 需要新组件时用 `shadcn-vue add`

## 🔌 启动 GitLab 私服（可选）

### 轻量级配置说明
当前 GitLab 配置已优化为轻量级：
- ✅ 使用外部 PostgreSQL（共享数据库）
- ✅ 使用外部 Dragonfly（共享缓存）
- ✅ 禁用内置监控（Prometheus、Grafana、Alertmanager）
- ✅ 禁用容器注册表
- ✅ 禁用 GitLab Pages
- ✅ 禁用 Mattermost 聊天
- ✅ 减少 Puma 工作进程（2个）
- ✅ 减少 Sidekiq 并发数（10个）
- ✅ 资源限制：最大 4GB 内存，2 CPU 核心

**最低要求**：
- 内存：2GB（推荐 4GB）
- CPU：1 核心（推荐 2 核心）
- 磁盘：10GB

```bash
# 启动 GitLab（首次启动需要 5-10 分钟）
docker-compose up -d gitlab

# 查看启动日志
docker-compose logs -f gitlab

# 等待 GitLab 完全启动（看到 "gitlab Reconfigured!" 表示成功）
# 访问: http://localhost:8080
# 用户名: root
# 密码: admin123456
```

### GitLab 配置

1. **访问 GitLab**: http://localhost:8080
2. **首次登录**:
   - 用户名: `root`
   - 密码: `admin123456`
3. **创建项目**:
   - 点击 "New project"
   - 选择 "Create blank project"
   - 填写项目信息
4. **配置 SSH**:
   ```bash
   # 生成 SSH 密钥（如果没有）
   ssh-keygen -t ed25519 -C "your_email@example.com"
   
   # 复制公钥
   cat ~/.ssh/id_ed25519.pub
   
   # 在 GitLab 中添加 SSH 密钥
   # Settings -> SSH Keys -> 粘贴公钥
   ```
5. **克隆项目**:
   ```bash
   # 使用 SSH（端口 2222）
   git clone ssh://git@localhost:2222/root/your-project.git
   
   # 或使用 HTTP
   git clone http://localhost:8080/root/your-project.git
   ```

### GitLab 数据库初始化

GitLab 会自动在 PostgreSQL 中创建 `gitlab_dev` 数据库。如果需要手动创建：

```bash
# 进入 PostgreSQL 容器
docker-compose exec postgres psql -U findbiao -d juanie_ai_devops

# 创建 GitLab 数据库
CREATE DATABASE gitlab_dev;
GRANT ALL PRIVILEGES ON DATABASE gitlab_dev TO findbiao;
```

## 📊 启动监控服务（可选）

```bash
# 启动所有监控服务
docker-compose up -d jaeger prometheus grafana

# 访问监控界面
# Jaeger: http://localhost:16686
# Prometheus: http://localhost:9090
# Grafana: http://localhost:3000 (admin/admin)
```

## 🛑 停止服务

### 停止所有服务
```bash
# 停止但保留数据
docker-compose down

# 停止并删除数据（谨慎）
docker-compose down -v
```

### 停止特定服务
```bash
docker-compose stop postgres
docker-compose stop dragonfly
docker-compose stop gitlab
```

## 🚀 生产环境部署

```bash
# 使用生产配置
docker-compose -f docker-compose.prod.yml up -d

# 查看日志
docker-compose -f docker-compose.prod.yml logs -f
```

## 📖 相关文档

- [架构概述](../architecture/overview.md) - 系统架构说明
- [开发环境搭建](../development/setup.md) - 详细的开发环境配置
- [Docker 部署](../deployment/docker.md) - Docker 部署指南
- [常见问题](../troubleshooting/common-issues.md) - 故障排查指南

## 💡 提示

- 首次启动可能需要几分钟来下载 Docker 镜像和安装依赖
- GitLab 首次启动需要 5-10 分钟，请耐心等待
- 建议先启动基础服务，确认正常后再启动应用服务
- 开发时只需要启动 PostgreSQL、Dragonfly、后端和前端即可

## 🎉 开始开发

所有服务启动后，访问 http://localhost:5173 开始使用平台！
