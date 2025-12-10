# AI DevOps Platform

现代化的 AI 驱动 DevOps 平台，用于项目管理、GitOps、环境管理和成本追踪。

## 📖 文档

所有文档在 [`docs/`](./docs/) 目录：
- [文档索引](./docs/README.md) - 完整的文档导航
- [快速开始](./docs/guides/quick-start.md) - 项目快速上手
- [系统架构](./docs/ARCHITECTURE.md) - 架构设计文档
- [API 参考](./docs/API_REFERENCE.md) - API 接口文档
- [现代化进度](./docs/guides/MODERNIZATION_PROGRESS.md) - 技术栈现代化进度（89% 完成）
- [故障排查](./docs/troubleshooting/README.md) - 问题诊断和解决方案

## 快速开始

### 前置要求
- Bun >= 1.0.0
- Node.js >= 22.0.0
- PostgreSQL 15
- Redis 7
- Docker (可选)

### 安装

```bash
# 克隆项目
git clone <repo-url>
cd juanie

# 安装依赖
bun install

# 配置环境变量
cp .env.example .env
# 编辑 .env 填入你的配置

# 启动数据库服务
bun run docker:up

# 运行数据库迁移
bun run db:push

# 启动开发服务器
bun run dev
```

访问：
- Web 应用: http://localhost:5173
- API 网关: http://localhost:1997

## 核心功能

- **项目管理**: 多项目、多团队支持，内置模板系统
- **GitOps**: 自动化部署，集成 Flux CD 和 K3s
- **环境管理**: Development/Staging/Production 环境隔离
- **成本追踪**: 实时成本监控和优化建议
- **AI 助手**: 代码审查、DevOps 建议、安全分析

## 技术栈

- **后端**: NestJS 11 + Fastify + tRPC
- **前端**: Vue 3 + Vite + Tailwind CSS
- **数据库**: PostgreSQL + Drizzle ORM
- **缓存/队列**: Redis + BullMQ
- **容器编排**: K3s + Flux CD
- **监控**: Prometheus + Grafana + OpenTelemetry

## 更多文档

### 操作指南
- [快速开始](./docs/guides/quick-start.md) - 项目快速上手
- [K3s 远程访问](./docs/guides/k3s-remote-access.md) - 配置 K3s 集群
- [Flux 安装](./docs/guides/flux-installation.md) - 安装 Flux CD
- [OpenTelemetry 集成](./docs/guides/opentelemetry-integration.md) - 可观测性方案

### 技术指南
- [现代化进度](./docs/guides/MODERNIZATION_PROGRESS.md) - 技术栈现代化（89% 完成）
- [2025 实用指南](./docs/guides/pragmatic-2025-guide.md) - 技术选型和最佳实践
- [Using Declarations](./docs/guides/using-declarations.md) - TypeScript 资源管理

### 架构文档
- [系统架构](./docs/ARCHITECTURE.md) - 总体架构设计
- [三层服务架构](./docs/architecture/three-tier-architecture.md) - 服务分层设计
- [GitOps 架构](./docs/architecture/gitops.md) - GitOps 实现方案

### 故障排查
- [问题排查索引](./docs/troubleshooting/README.md) - 常见问题和解决方案
- [Flux 问题](./docs/troubleshooting/flux/) - Flux GitOps 相关问题
- [Kubernetes 问题](./docs/troubleshooting/kubernetes/) - K8s 相关问题

## 常用命令

```bash
# 开发
bun run dev              # 启动所有服务
bun run dev:web          # 只启动 Web
bun run dev:api          # 只启动 API

# 数据库
bun run db:generate      # 生成迁移
bun run db:push          # 应用迁移
bun run db:studio        # Drizzle Studio

# 测试
bun test                 # 运行测试
bun test --watch         # 监听模式

# 构建
bun run build            # 构建所有包

# Docker
bun run docker:up        # 启动服务
bun run docker:down      # 停止服务
```

## 项目结构

```
apps/
  api-gateway/           # API 网关 (NestJS + tRPC)
  web/                   # Web 前端 (Vue 3)

packages/
  core/                  # 核心包 (database, types, queue, utils)
  services/
    foundation/          # 基础层 (auth, users, organizations)
    business/            # 业务层 (projects, deployments, gitops)
    extensions/          # 扩展层 (ai, monitoring, notifications)
  config/                # 共享配置
  ui/                    # UI 组件库
```

## License

MIT
