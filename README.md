# AI DevOps Platform

现代化的 AI 驱动 DevOps 平台，用于项目管理、GitOps、环境管理和成本追踪。

## 📖 文档

**[📚 完整文档导航](./docs/README.md)**

### 快速链接
- 🚀 [快速开始](./docs/guides/quick-start.md) - 5 分钟上手
- 📘 [项目指南](./.kiro/steering/project-guide.md) - 开发规范和最佳实践
- 🏗️ [架构文档](./docs/architecture/README.md) - 系统架构设计
- 🔧 [问题排查](./docs/troubleshooting/README.md) - 常见问题解决
- 📝 [变更日志](./docs/CHANGELOG.md) - 版本更新记录

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

查看 **[完整文档导航](./docs/README.md)** 了解所有文档。

### 核心文档
- [分层架构](./docs/architecture/layered-architecture-analysis.md) - 三层服务架构
- [Business 层架构](./docs/architecture/business-layer-architecture.md) - 业务层设计
- [数据库设计](./docs/architecture/database-schema-reference.md) - 数据库 Schema
- [K3s 远程访问](./docs/guides/k3s-remote-access.md) - K3s 集群配置
- [Monorepo 最佳实践](./docs/guides/monorepo-best-practices.md) - Turborepo + Bun

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
