# 本地开发指南

## 概述

本项目包含两大功能模块，它们的依赖要求不同：

### ✅ 核心功能（无需 Kubernetes）

这些功能可以在本地开发，只需要数据库和 Redis：

- **项目管理**
  - 项目创建、编辑、删除
  - 项目模板管理
  - 项目健康度监控
  - 审批流程管理
  
- **用户管理**
  - 用户认证和授权
  - 组织管理
  - 权限控制

- **API 和前端**
  - 所有 tRPC API
  - 所有前端界面
  - 数据库操作

### ⚠️ GitOps 功能（需要 Kubernetes + Flux）

这些功能需要 Kubernetes 集群和 Flux：

- Flux 资源监听和同步
- 自动部署触发
- GitOps 资源状态更新
- Kubernetes 资源管理

**好消息：** GitOps 功能已经做了优雅降级，没有集群时会自动跳过，不影响其他功能。

---

## 快速开始（无需 Kubernetes）

### 1. 安装依赖

```bash
# 安装 Bun（如果还没有）
curl -fsSL https://bun.sh/install | bash

# 安装项目依赖
bun install
```

### 2. 启动数据库和 Redis

**选项 A：使用 Docker Compose（推荐）**

```bash
# 启动 PostgreSQL 和 Redis
docker-compose up -d postgres redis

# 查看状态
docker-compose ps
```

**选项 B：本地安装**

```bash
# macOS
brew install postgresql redis
brew services start postgresql
brew services start redis
```

### 3. 配置环境变量

创建 `.env.local` 文件：

```bash
cp .env.local.example .env.local
```

编辑 `.env.local`：

```env
# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/juanie_dev

# Redis
REDIS_URL=redis://localhost:6379

# 禁用 GitOps 功能（本地开发）
ENABLE_FLUX_WATCHER=false

# 环境
NODE_ENV=development
```

### 4. 初始化数据库

```bash
# 运行数据库迁移
cd packages/core/database
bun run drizzle-kit push:pg

# 插入系统模板（可选）
bun run src/seeds/project-templates.seed.ts
```

### 5. 启动开发服务器

```bash
# 启动所有服务
bun run dev

# 或者分别启动
bun run dev:api      # API Gateway (http://localhost:3000)
bun run dev:web      # Web 前端 (http://localhost:5173)
```

### 6. 访问应用

- **前端**: http://localhost:5173
- **API**: http://localhost:3000
- **API 文档**: http://localhost:3000/api/docs

---

## 可以开发和测试的功能

### ✅ 完全可用

1. **项目管理**
   - 创建项目（选择模板）
   - 查看项目列表
   - 查看项目详情
   - 编辑项目配置
   - 删除/归档项目

2. **模板管理**
   - 查看系统模板
   - 创建自定义模板
   - 编辑模板配置
   - 渲染模板预览

3. **健康度监控**
   - 查看项目健康度评分
   - 查看健康度历史
   - 查看问题和建议
   - 配置健康度规则

4. **审批流程**
   - 创建审批请求
   - 查看待审批列表
   - 批准/拒绝审批
   - 查看审批历史

5. **用户和权限**
   - 用户登录/注册
   - 组织管理
   - 成员管理
   - 权限配置

### ⚠️ 部分可用（Mock 数据）

这些功能的 UI 和 API 可以开发，但实际执行需要 Kubernetes：

1. **部署管理**
   - UI 和 API 可以开发
   - 可以创建部署记录（存入数据库）
   - 实际部署到 K8s 需要集群

2. **GitOps 资源**
   - UI 和 API 可以开发
   - 可以创建 GitOps 资源记录
   - Flux 同步需要集群

3. **环境管理**
   - 创建环境配置（完全可用）
   - 查看环境状态（需要集群）

---

## 如果需要测试 GitOps 功能

### 选项 1：Docker Desktop Kubernetes（最简单）

1. **启用 Kubernetes**
   - 打开 Docker Desktop
   - Settings → Kubernetes → Enable Kubernetes
   - 等待启动完成

2. **安装 Flux**
   ```bash
   # 安装 Flux CLI
   brew install fluxcd/tap/flux
   
   # 检查集群
   flux check --pre
   
   # 安装 Flux
   flux install
   ```

3. **更新配置**
   ```env
   # .env.local
   ENABLE_FLUX_WATCHER=true
   KUBECONFIG_PATH=~/.kube/config
   ```

4. **重启服务**
   ```bash
   bun run dev
   ```

### 选项 2：Minikube（轻量级）

```bash
# 安装 Minikube
brew install minikube

# 启动集群
minikube start

# 安装 Flux
flux install

# 更新配置
echo "ENABLE_FLUX_WATCHER=true" >> .env.local
echo "KUBECONFIG_PATH=~/.kube/config" >> .env.local

# 重启服务
bun run dev
```

### 选项 3：Kind（Kubernetes in Docker）

```bash
# 安装 Kind
brew install kind

# 创建集群
kind create cluster --name juanie-dev

# 安装 Flux
flux install

# 更新配置
echo "ENABLE_FLUX_WATCHER=true" >> .env.local
echo "KUBECONFIG_PATH=~/.kube/config" >> .env.local

# 重启服务
bun run dev
```

---

## 开发工作流建议

### 阶段 1：核心功能开发（当前阶段）

**无需 Kubernetes**

```bash
# 1. 启动数据库和 Redis
docker-compose up -d postgres redis

# 2. 配置环境变量（禁用 GitOps）
echo "ENABLE_FLUX_WATCHER=false" > .env.local

# 3. 启动开发服务器
bun run dev

# 4. 开发和测试
# - 项目管理功能
# - 模板管理功能
# - 健康度监控功能
# - 审批流程功能
# - UI 组件
# - API 端点
```

### 阶段 2：GitOps 功能开发

**需要 Kubernetes**

```bash
# 1. 启动本地 Kubernetes（选择一种）
# Docker Desktop / Minikube / Kind

# 2. 安装 Flux
flux install

# 3. 启用 GitOps 功能
echo "ENABLE_FLUX_WATCHER=true" >> .env.local

# 4. 重启服务
bun run dev

# 5. 测试 GitOps 功能
# - Flux 资源监听
# - 自动部署
# - GitOps 同步
```

### 阶段 3：集成测试

**完整环境**

```bash
# 使用 Docker Compose 启动所有服务
docker-compose up -d

# 运行集成测试
bun run test:e2e
```

---

## 常见问题

### Q1: 启动时看到 "K3s 未连接" 是正常的吗？

**A:** 是的！这是正常的信息提示，表示 Kubernetes 集群不可用。如果你不需要 GitOps 功能，可以忽略。

### Q2: 可以只开发前端吗？

**A:** 可以！前端可以独立开发，只需要 API Gateway 运行即可：

```bash
# 终端 1：启动 API
cd apps/api-gateway
bun run dev

# 终端 2：启动前端
cd apps/web
bun run dev
```

### Q3: 如何 Mock GitOps 功能？

**A:** GitOps 相关的 API 已经实现，会返回数据库中的数据。你可以：

1. 手动在数据库中插入测试数据
2. 使用 API 创建 GitOps 资源记录
3. UI 会显示这些数据，只是不会真正同步到 K8s

### Q4: 生产环境需要什么？

**A:** 生产环境需要：

- PostgreSQL 数据库
- Redis
- Kubernetes 集群
- Flux 安装在集群中
- 配置正确的 KUBECONFIG_PATH

### Q5: 如何切换开发模式？

**A:** 通过环境变量控制：

```bash
# 无 Kubernetes 模式（默认）
ENABLE_FLUX_WATCHER=false

# 完整模式（需要 Kubernetes）
ENABLE_FLUX_WATCHER=true
KUBECONFIG_PATH=~/.kube/config
```

---

## 推荐的开发顺序

1. ✅ **先开发核心功能**（无需 K8s）
   - 项目管理 CRUD
   - 模板系统
   - 健康度监控
   - 审批流程
   - 前端界面

2. ⏸️ **再开发 GitOps 功能**（需要 K8s）
   - 搭建本地集群
   - 安装 Flux
   - 测试 GitOps 集成

3. 🚀 **最后集成测试**
   - 完整流程测试
   - 性能测试
   - 部署到测试环境

---

## 相关文档

- [项目创建指南](../guides/PROJECT_CREATION_GUIDE.md)
- [API 参考文档](../api/projects/PROJECT_API.md)
- [Flux 安装指南](../deployment/FLUX_INSTALLATION.md)
- [故障排查指南](../guides/TR