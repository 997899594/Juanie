# Juanie - AI DevOps Platform

> 🚀 2025 年现代化的 AI 驱动 DevOps 平台 - 一键部署、智能配置、GitOps 自动化

[![Status](https://img.shields.io/badge/status-active-success.svg)]()
[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)]()
[![License](https://img.shields.io/badge/license-MIT-blue.svg)]()

## 📖 重要文档

> 💡 **提示**: 查看 [📚 文档索引](./DOCUMENTATION_INDEX.md) 快速找到你需要的文档

### 核心文档
- 📋 **[2025 技术路线图](./ROADMAP_2025.md)** - 完整的技术规划和实施计划
- 📊 **[项目状态](./PROJECT_STATUS.md)** - 当前进度和关键指标
- 🎯 **[模板系统状态](./TEMPLATE_SYSTEM_STATUS.md)** - 模板系统实施进度
- ✅ **[OAuth 多服务器支持](./OAUTH_MULTI_SERVER_COMPLETE.md)** - 已完成的功能

### 开发文档
- 💻 **[开发指南](./docs/DEVELOPMENT.md)** - 环境设置和开发流程
- 🏗️ **[架构设计](./docs/ARCHITECTURE.md)** - 系统架构和技术选型
- 🔌 **[API 参考](./docs/API_REFERENCE.md)** - API 接口文档

## 快速开始

```bash
# 安装依赖
bun install

# 启动数据库
docker-compose up -d postgres redis

# 运行迁移
bun run db:push

# 启动开发服务器
bun run dev
```

访问：
- 🌐 Web: http://localhost:5173
- 🔌 API: http://localhost:3000

## ✨ 核心功能

### 已实现 ✅
- **项目管理** - 多项目、多团队、完整的生命周期管理
- **GitOps** - Flux CD 自动化部署、多环境支持
- **OAuth 集成** - GitHub + GitLab（支持私有服务器）
- **环境管理** - Development/Staging/Production 环境隔离
- **实时监控** - 项目状态、部署进度、资源使用

### 开发中 🚧
- **模板系统** - 一键创建项目（Next.js、Vue、Python 等）
- **AI 配置生成** - 智能生成 K8s 配置和 Dockerfile
- **智能诊断** - AI 驱动的故障诊断和优化建议

### 计划中 📋
- **Backstage IDP** - 统一的开发者门户
- **策略引擎** - Kyverno 策略即代码
- **高级可观测性** - OpenTelemetry + eBPF
- **成本优化** - 实时成本追踪和优化建议

详见 [2025 技术路线图](./ROADMAP_2025.md)

## 🛠️ 技术栈

### 核心技术（已验证 ✅）
- **运行时**: Bun - 快速的 JavaScript 运行时
- **后端**: NestJS + tRPC - 类型安全的 API
- **前端**: Vue 3 + Vite + Pinia - 现代化前端
- **数据库**: PostgreSQL + Drizzle ORM - 类型安全的数据库
- **缓存**: Redis/Dragonfly - 高性能缓存
- **队列**: BullMQ - 可靠的任务队列
- **基础设施**: K3s + Flux CD - GitOps 自动化

### 2025 年新增（规划中 📋）
- **AI**: Ollama - 本地 AI 模型
- **IDP**: Backstage - 开发者门户
- **策略**: Kyverno - 策略即代码
- **可观测性**: OpenTelemetry + eBPF - 现代监控
- **多云**: Crossplane - 基础设施即代码

## 项目结构

```
apps/
  api-gateway/     # API 网关 (NestJS + tRPC)
  web/             # Web 前端 (Vue 3)
packages/
  core/            # 核心包 (database, types, queue)
  services/        # 业务服务 (projects, deployments, etc.)
docs/              # 文档
```

## 📚 文档

- **[项目概览](./docs/PROJECT_OVERVIEW.md)** - 项目简介和快速开始
- **[系统架构](./docs/ARCHITECTURE.md)** - 架构设计和技术决策
- **[开发指南](./docs/DEVELOPMENT.md)** - 开发环境设置和工作流程
- **[API 参考](./docs/API_REFERENCE.md)** - tRPC API 端点文档
- **[Kiro AI 指南](./docs/KIRO_GUIDE.md)** - 使用 Kiro AI 提高开发效率
- **[部署指南](./DEPLOYMENT.md)** - 生产环境部署说明
- **[贡献指南](./CONTRIBUTING.md)** - 如何贡献代码

## 开发

```bash
# 开发模式
bun run dev              # 启动所有服务
bun run dev:api          # 只启动 API
bun run dev:web          # 只启动 Web

# 测试
bun test                 # 运行测试
bun run type-check       # 类型检查

# 构建
bun run build            # 构建所有包
```

## 环境变量

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/devops

# Redis
REDIS_URL=redis://localhost:6379

# OAuth (可选)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

完整配置见 [DEPLOYMENT.md](./DEPLOYMENT.md)

## 贡献

欢迎贡献！请阅读 [CONTRIBUTING.md](./CONTRIBUTING.md) 了解：
- 开发环境设置
- 代码规范
- 提交流程
- 测试要求

## 许可证

MIT License - 详见 [LICENSE](./LICENSE)

---

**问题反馈**: [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues)  
**文档**: [docs/](./docs/)
