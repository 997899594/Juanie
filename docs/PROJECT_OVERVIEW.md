# Juanie - AI DevOps 平台项目概览

## 📋 项目简介

Juanie 是一个现代化的 AI 驱动 DevOps 平台，提供项目管理、GitOps 自动化部署、环境管理、成本追踪等功能。

**项目名称**: Juanie  
**版本**: 0.1.0  
**技术栈**: NestJS + Vue 3 + PostgreSQL + Redis + K3s + Flux CD

---

## 🏗️ 项目架构

### 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                      前端层 (Vue 3)                      │
│  - Web UI (Vite + Vue 3 + Pinia + shadcn-vue)          │
└─────────────────────────────────────────────────────────┘
                            ↓ tRPC
┌─────────────────────────────────────────────────────────┐
│                   API 网关 (NestJS)                      │
│  - tRPC 路由                                             │
│  - 认证授权                                              │
│  - SSE 实时通信                                          │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                      业务服务层                          │
│  - 项目管理    - 部署管理    - 流水线                   │
│  - 团队管理    - 环境管理    - 成本追踪                 │
│  - AI 助手     - GitOps      - 安全策略                 │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                      核心层                              │
│  - Database (Drizzle ORM + PostgreSQL)                  │
│  - Queue (BullMQ + Redis)                               │
│  - SSE (Server-Sent Events)                             │
│  - Storage (MinIO)                                       │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                    基础设施层                            │
│  - K3s (Kubernetes)                                      │
│  - Flux CD (GitOps)                                      │
│  - Prometheus (监控)                                     │
│  - Ollama (AI 模型)                                      │
└─────────────────────────────────────────────────────────┘
```

---

## 📁 项目结构

```
juanie/
├── apps/                          # 应用程序
│   ├── api-gateway/              # API 网关 (NestJS + tRPC)
│   └── web/                      # Web 前端 (Vue 3)
│
├── packages/                      # 共享包
│   ├── core/                     # 核心包
│   │   ├── database/            # 数据库 (Drizzle ORM)
│   │   ├── queue/               # 队列 (BullMQ)
│   │   ├── sse/                 # 服务器推送事件
│   │   ├── types/               # TypeScript 类型定义
│   │   ├── tokens/              # Token 管理
│   │   ├── utils/               # 工具函数
│   │   └── observability/       # 可观测性 (OpenTelemetry)
│   │
│   ├── services/                 # 业务服务
│   │   ├── auth/                # 认证授权
│   │   ├── projects/            # 项目管理
│   │   ├── deployments/         # 部署管理
│   │   ├── pipelines/           # 流水线
│   │   ├── repositories/        # 代码仓库
│   │   ├── teams/               # 团队管理
│   │   ├── organizations/       # 组织管理
│   │   ├── environments/        # 环境管理
│   │   ├── cost-tracking/       # 成本追踪
│   │   ├── ai-assistants/       # AI 助手
│   │   ├── git-ops/             # GitOps
│   │   ├── flux/                # Flux CD 集成
│   │   ├── k3s/                 # K3s 集成
│   │   ├── notifications/       # 通知服务
│   │   ├── security-policies/   # 安全策略
│   │   ├── storage/             # 对象存储
│   │   ├── templates/           # 项目模板
│   │   ├── users/               # 用户管理
│   │   ├── audit-logs/          # 审计日志
│   │   ├── ollama/              # Ollama AI 集成
│   │   └── git-providers/       # Git 提供商集成
│   │
│   ├── ui/                       # UI 组件库 (shadcn-vue)
│   ├── shared/                   # 共享代码
│   └── config/                   # 配置文件
│
├── docs/                          # 文档
│   ├── PROJECT_OVERVIEW.md       # 项目概览 (本文件)
│   ├── ARCHITECTURE.md           # 架构设计
│   ├── DEVELOPMENT.md            # 开发指南
│   ├── API_REFERENCE.md          # API 参考
│   └── DEPLOYMENT.md             # 部署指南
│
├── scripts/                       # 脚本工具
├── templates/                     # 项目模板
├── infra/                         # 基础设施配置
├── monitoring/                    # 监控配置
└── grafana/                       # Grafana 仪表盘
```

---

## 🎯 核心功能模块

### 1. 项目管理
- 多项目管理
- 项目模板系统
- 项目成员和权限管理
- 项目归档和恢复

### 2. GitOps 自动化
- Git 仓库集成 (GitHub/GitLab)
- Flux CD 自动部署
- 声明式配置管理
- 自动同步和回滚

### 3. 环境管理
- 多环境支持 (Dev/Staging/Prod)
- 环境隔离
- 环境变量管理
- 环境配置版本控制

### 4. 部署管理
- 自动化部署流水线
- 部署历史和回滚
- 部署审批流程
- 实时部署状态监控

### 5. 成本追踪
- 资源使用监控
- 成本分析和预测
- 成本优化建议
- 多维度成本报表

### 6. AI 助手
- 代码审查建议
- DevOps 最佳实践推荐
- 安全漏洞分析
- 智能故障诊断

### 7. 团队协作
- 组织和团队管理
- 基于角色的访问控制 (RBAC)
- 审计日志
- 通知和告警

### 8. 监控与可观测性
- 实时性能监控
- 日志聚合
- 分布式追踪
- 自定义仪表盘

---

## 🔧 技术栈详情

### 后端
- **框架**: NestJS 10
- **API**: tRPC (类型安全的 RPC)
- **数据库**: PostgreSQL 16 + Drizzle ORM
- **缓存**: Redis (Dragonfly)
- **队列**: BullMQ
- **认证**: JWT + OAuth 2.0 (GitHub/GitLab)
- **实时通信**: Server-Sent Events (SSE)
- **可观测性**: OpenTelemetry + Jaeger

### 前端
- **框架**: Vue 3 (Composition API)
- **构建工具**: Vite 7
- **状态管理**: Pinia
- **路由**: Vue Router 4
- **UI 组件**: shadcn-vue (基于 Radix Vue)
- **样式**: Tailwind CSS 4
- **图表**: ECharts
- **类型检查**: TypeScript 5

### 基础设施
- **容器编排**: K3s (轻量级 Kubernetes)
- **GitOps**: Flux CD
- **对象存储**: MinIO
- **监控**: Prometheus + Grafana
- **AI 模型**: Ollama (本地 LLM)
- **CI/CD**: GitLab CI

### 开发工具
- **包管理器**: Bun 1.2
- **Monorepo**: Turborepo
- **代码质量**: Biome (Linter + Formatter)
- **Git Hooks**: Husky + lint-staged
- **类型检查**: TypeScript + vue-tsc

---

## 🚀 快速开始

### 前置要求
- Node.js >= 22.0.0
- Bun >= 1.0.0
- Docker & Docker Compose
- PostgreSQL 16
- Redis

### 安装步骤

1. **克隆仓库**
```bash
git clone <repository-url>
cd juanie
```

2. **安装依赖**
```bash
bun install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，填入实际配置
```

4. **启动基础服务**
```bash
bun run docker:up
```

5. **运行数据库迁移**
```bash
bun run db:push
```

6. **启动开发服务器**
```bash
bun run dev
```

7. **访问应用**
- Web UI: http://localhost:5173
- API: http://localhost:3000
- Drizzle Studio: `bun run db:studio`

---

## 📚 文档导航

- **[架构设计](./ARCHITECTURE.md)** - 详细的系统架构和设计决策
- **[开发指南](./DEVELOPMENT.md)** - 开发环境设置和工作流程
- **[API 参考](./API_REFERENCE.md)** - tRPC API 端点文档
- **[部署指南](../DEPLOYMENT.md)** - 生产环境部署说明
- **[贡献指南](../CONTRIBUTING.md)** - 如何贡献代码

---

## 🔐 安全性

- JWT 令牌认证
- OAuth 2.0 社交登录
- 基于角色的访问控制 (RBAC)
- API 请求限流
- SQL 注入防护 (参数化查询)
- XSS 防护
- CSRF 防护
- 审计日志记录

---

## 📊 性能指标

- API 响应时间: < 100ms (P95)
- 前端首屏加载: < 2s
- 数据库查询优化: 索引 + 连接池
- 缓存策略: Redis 缓存热点数据
- 异步任务: BullMQ 队列处理

---

## 🤝 贡献

欢迎贡献！请查看 [CONTRIBUTING.md](../CONTRIBUTING.md) 了解详情。

---

## 📄 许可证

MIT License

---

**最后更新**: 2024-01-20  
**维护者**: Juanie Team
