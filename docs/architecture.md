# System Architecture

## 概览

AI DevOps Platform 采用微服务架构，基于 NestJS + tRPC 构建。

```
┌─────────────┐
│   Web App   │ (Vue 3)
└──────┬──────┘
       │ tRPC
┌──────▼──────────┐
│  API Gateway    │ (NestJS + tRPC)
└──────┬──────────┘
       │
   ┌───┴────┬────────┬────────┐
   │        │        │        │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│Proj │ │Env  │ │Repo │ │Flux │ (Services)
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │       │       │
   └───────┴───────┴───────┘
           │
      ┌────▼────┐
      │Database │ (PostgreSQL)
      └─────────┘
```

## 技术栈

### 后端
- **框架**: NestJS 11
- **API**: tRPC (类型安全的 RPC)
- **数据库**: PostgreSQL 15 + Drizzle ORM
- **缓存**: Redis 7
- **队列**: BullMQ
- **容器**: Docker + K3s

### 前端
- **框架**: Vue 3 + Vite
- **状态**: Pinia
- **UI**: shadcn-vue
- **路由**: Vue Router
- **类型**: TypeScript + tRPC Client

## 服务划分

### Core Services
- **projects** - 项目管理和编排
- **environments** - 环境管理
- **repositories** - 仓库管理
- **deployments** - 部署管理

### Integration Services
- **flux** - Flux CD 集成
- **git-providers** - GitHub/GitLab API
- **k3s** - Kubernetes 集成

### Support Services
- **auth** - 认证和授权
- **audit-logs** - 审计日志
- **notifications** - 通知服务
- **cost-tracking** - 成本追踪

## 数据流

### 项目创建流程

```
User → Web → API Gateway → ProjectsService
                              ↓
                         ProjectOrchestrator
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
  Environments          Repositories            Flux
        ↓                     ↓                     ↓
    Database              Database              K8s
```

### 部署流程

```
User → Trigger Deploy → DeploymentsService
                              ↓
                         FluxService
                              ↓
                    Create/Update GitOps Resources
                              ↓
                         Flux CD (K8s)
                              ↓
                         Apply Manifests
```

## 技术决策

### 为什么选择 tRPC？
- 端到端类型安全
- 无需手写 API 文档
- 自动生成客户端
- 优秀的开发体验

### 为什么选择 Drizzle ORM？
- TypeScript 原生
- 类型安全的查询
- 零运行时开销
- 简单的迁移管理

### 为什么选择 BullMQ？
- Redis 支持
- 可靠的任务队列
- 支持延迟和重试
- 良好的监控

## 扩展性

### 水平扩展
- API Gateway 可以多实例部署
- 服务间通过 Redis 共享状态
- 数据库使用连接池

### 垂直扩展
- 增加服务器资源
- 优化数据库查询
- 使用缓存减少负载

## 安全性

- JWT 认证
- RBAC 权限控制
- OAuth 集成
- 审计日志
- 数据加密

详见 [DEPLOYMENT.md](../DEPLOYMENT.md#安全配置)
