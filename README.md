# AI DevOps Platform

现代化的 AI 驱动 DevOps 平台，用于项目管理、GitOps、环境管理和成本追踪。

## 📖 文档

所有文档在 [`docs/`](./docs/) 目录：
- [快速开始](./docs/quick-start.md)
- [开发指南](./docs/development.md)
- [服务器部署](./docs/deployment.md)
- [GitOps 指南](./docs/gitops.md)
- [系统架构](./docs/architecture.md)

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

## 文档

- [贡献指南](./CONTRIBUTING.md)
- [部署指南](./DEPLOYMENT.md)
- [三层架构](./REFACTORING_THREE_TIER.md)
- [快速开始指南](./QUICK_START_GUIDE.md)
- [快速参考](./QUICK_REFERENCE.md)
- [2025 路线图](./ROADMAP_2025.md)
- [现代最佳实践](./MODERN_BEST_PRACTICES_2025.md)
- [详细文档](./docs/)

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
