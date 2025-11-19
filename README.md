# AI DevOps Platform

> 现代化的 AI 驱动 DevOps 平台 - 项目管理、GitOps、环境管理、成本追踪

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

## 核心功能

- **项目管理** - 多项目、多团队、模板系统
- **GitOps** - 自动化部署、Flux CD 集成
- **环境管理** - Development/Staging/Production 环境隔离
- **成本追踪** - 实时成本监控和优化建议
- **AI 助手** - 代码审查、DevOps 建议、安全分析

## 技术栈

**后端**: NestJS + tRPC + PostgreSQL + Redis + BullMQ  
**前端**: Vue 3 + Vite + Pinia + shadcn-vue  
**基础设施**: Docker + K3s + Flux CD + Prometheus

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
