# Juanie 项目文档

AI DevOps Platform - 现代化的 AI 驱动 DevOps 平台

## 📚 文档导航

### 快速开始
- [快速开始指南](guides/quick-start.md) - 5 分钟快速上手
- [K3s 远程访问配置](guides/k3s-remote-access.md) - 配置远程 Kubernetes 集群
- [Flux CD 安装](guides/flux-installation.md) - GitOps 工具安装指南
- [部署测试](guides/deployment-test.md) - 测试部署流程

### 架构设计
- [系统架构](ARCHITECTURE.md) - 整体架构设计
- [数据库 Schema 关系](architecture/database-schema-relationships.md) - 数据模型设计
- [Bun K8s 客户端](architecture/bun-k8s-client.md) - Kubernetes 客户端实现
- [进度系统设计](architecture/progress-system-final.md) - 实时进度追踪系统

### API 文档
- [API 参考](API_REFERENCE.md) - tRPC API 完整文档
- [API 概览](api/README.md) - API 使用指南

### 教程
- [Monorepo 与 Turborepo](tutorials/monorepo-turborepo.md) - Monorepo 架构实践
- [Ollama AI 集成](tutorials/ollama-ai-integration.md) - AI 功能集成指南
- [tRPC 全栈类型安全](tutorials/trpc-fullstack-typesafety.md) - 端到端类型安全实践

### 故障排查
- [故障排查索引](troubleshooting/README.md) - 常见问题解决方案
- **Flux CD 相关**
  - [SSH 认证问题](troubleshooting/flux/ssh-authentication.md)
  - [网络策略问题](troubleshooting/flux/network-policy.md)
  - [Kustomization 协调问题](troubleshooting/flux/kustomization-reconciling.md)
- **Kubernetes 相关**
  - [Namespace 时序问题](troubleshooting/kubernetes/namespace-timing.md)
  - [快速参考](troubleshooting/kubernetes/QUICK_REFERENCE.md)
- **Git 相关**
  - [仓库名称验证](troubleshooting/git/repository-name-validation.md)

### 其他
- [变更日志](CHANGELOG.md) - 版本更新记录
- [文档组织规则](ORGANIZATION.md) - 文档管理规范

## 🚀 核心功能

### 项目管理
- 多项目、多团队支持
- 内置模板系统（Next.js 15 等）
- 统一的项目创建流程（支持简单创建、模板创建、仓库创建）
- 异步初始化流程（状态机 + 队列）
- 实时进度追踪（SSE）

### GitOps
- 自动化部署，集成 Flux CD
- 智能 Git 认证（GitHub Deploy Keys, GitLab Tokens）
- SSH known_hosts 动态管理
- Kubernetes 资源自动创建

### 环境管理
- Development/Staging/Production 环境隔离
- 环境变量管理
- 配置版本控制

### AI 助手
- 代码审查
- DevOps 建议
- 安全分析

## 🛠️ 技术栈

### 后端
- **框架**: NestJS 11 + Fastify
- **API**: tRPC（类型安全）
- **数据库**: PostgreSQL 15 + Drizzle ORM
- **缓存**: Dragonfly（Redis 兼容）
- **队列**: BullMQ
- **运行时**: Bun

### 前端
- **框架**: Vue 3 + Composition API
- **构建**: Vite 7
- **状态**: Pinia
- **UI**: shadcn-vue + Tailwind CSS 4
- **路由**: Vue Router

### 基础设施
- **容器**: Docker
- **编排**: K3s（轻量级 Kubernetes）
- **GitOps**: Flux CD
- **监控**: Prometheus + Grafana + Jaeger

## 📖 开发指南

### 环境要求
- Bun >= 1.0.0
- Node.js >= 22.0.0
- PostgreSQL 15+
- Redis/Dragonfly 7+
- K3s（可选，用于 GitOps）

### 快速开始
```bash
# 安装依赖
bun install

# 启动核心服务
docker compose up -d

# 数据库迁移
bun run db:push

# 启动开发服务器
bun run dev
```

### 常用命令
```bash
# 开发
bun run dev                    # 启动所有服务
bun run dev:web                # 只启动 Web
bun run dev:api                # 只启动 API

# 数据库
bun run db:generate            # 生成迁移
bun run db:push                # 应用迁移
bun run db:studio              # Drizzle Studio

# 测试和检查
bun test                       # 运行测试
bun run type-check             # 类型检查
biome check --write            # 代码检查

# 构建
bun run build                  # 构建所有包
```

## 🤝 贡献指南

请参考 [协作原则](.kiro/steering/collaboration.md) 和 [AI 协作指南](.kiro/steering/ai-collaboration.md)

## 📝 许可证

MIT License

## 🔗 相关链接

- [项目仓库](https://github.com/your-org/juanie)
- [问题追踪](https://github.com/your-org/juanie/issues)
- [讨论区](https://github.com/your-org/juanie/discussions)
