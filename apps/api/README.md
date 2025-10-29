# AI DevOps Platform

> 现代化的 AI 驱动 DevOps 平台，基于 Bun + NestJS + tRPC 构建

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)](https://www.typescriptlang.org/)
[![Bun](https://img.shields.io/badge/Bun-1.1-orange)](https://bun.sh/)
[![NestJS](https://img.shields.io/badge/NestJS-11-red)](https://nestjs.com/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## ✨ 特性

- 🚀 **高性能**: 基于 Bun 运行时，性能提升 3-4 倍
- 🤖 **AI 驱动**: 集成 Ollama 本地 LLM，智能化 DevOps 流程
- 📊 **完整可观测性**: Prometheus + Grafana + Loki + Tempo
- 🔄 **CI/CD 自动化**: 支持 GitHub Actions 和 GitLab CI/CD
- 🐳 **容器化部署**: K3s 轻量级 Kubernetes 集成
- 📦 **对象存储**: MinIO 兼容 S3 的文件存储
- ⚡ **高性能缓存**: Dragonfly (Redis 兼容，25x 性能)
- 🔐 **企业级安全**: RBAC 权限控制 + 安全策略引擎

## 🚀 快速开始

```bash
# 1. 安装依赖
bun install

# 2. 启动服务
docker-compose up -d

# 3. 初始化数据库
bun run db:push

# 4. 启动开发服务器
bun run dev
```

访问 http://localhost:3001

📖 **详细文档**: [docs/README.md](./docs/README.md)

## 📚 文档导航

- [快速开始](./docs/getting-started/QUICK_START.md) - 5 分钟上手
- [完整安装](./docs/getting-started/INSTALLATION.md) - 详细安装步骤
- [架构设计](./docs/architecture/OVERVIEW.md) - 系统架构
- [开发指南](./docs/development/SETUP.md) - 开发环境配置
- [功能指南](./docs/features/) - 各功能使用说明
- [运维指南](./docs/operations/) - 部署和运维
- [API 文档](./docs/reference/API.md) - API 参考

## 🛠️ 技术栈

### 核心技术
- **运行时**: Bun 1.1
- **框架**: NestJS 11
- **API**: tRPC 11 (类型安全)
- **数据库**: PostgreSQL 17 + Drizzle ORM
- **缓存**: Dragonfly (Redis 兼容)

### DevOps 工具
- **容器编排**: K3s (轻量级 Kubernetes)
- **任务队列**: BullMQ
- **对象存储**: MinIO
- **监控**: Prometheus + Grafana + Loki + Tempo

### AI 集成
- **本地 LLM**: Ollama
- **云端 AI**: OpenAI / Anthropic / Google AI (可选)

## 📊 项目结构

```
apps/api/
├── src/
│   ├── modules/          # 业务模块
│   │   ├── auth/        # 认证授权
│   │   ├── organizations/ # 组织管理
│   │   ├── projects/    # 项目管理
│   │   ├── pipelines/   # CI/CD Pipeline
│   │   ├── deployments/ # 部署管理
│   │   ├── ai-assistants/ # AI 助手
│   │   └── ...
│   ├── database/        # 数据库 Schema
│   ├── trpc/           # tRPC 路由
│   ├── observability/  # 可观测性
│   └── templates/      # CI/CD 模板
├── test/               # 测试文件
├── docs/               # 文档
├── grafana/            # Grafana 配置
└── docker-compose.yml  # Docker 配置
```

## 🎯 核心功能

### 1. 项目管理
- 多租户组织架构
- 团队协作
- 项目权限控制

### 2. CI/CD Pipeline
- 自动化构建和部署
- 多环境管理
- 部署审批流程

### 3. AI 助手
- 智能代码审查
- 自动化故障诊断
- 成本优化建议

### 4. 监控告警
- 实时性能监控
- 日志聚合分析
- 分布式追踪

### 5. 安全合规
- 安全策略引擎
- 漏洞扫描
- 审计日志

## 🔧 开发

### 环境要求
- Bun >= 1.1.38
- Docker & Docker Compose
- PostgreSQL 17
- Node.js >= 20 (可选)

### 开发命令

```bash
# 开发模式（热重载）
bun run dev

# 构建
bun run build

# 生产模式
bun run start

# 类型检查
bun run type-check

# 测试
bun run test
bun run test:watch
bun run test:coverage

# 数据库
bun run db:generate  # 生成迁移
bun run db:push      # 应用迁移
bun run db:studio    # 打开 Drizzle Studio
```

## 📈 性能

- **启动时间**: < 100ms (Bun)
- **API 响应**: < 50ms (p95)
- **并发处理**: 10,000+ req/s
- **内存占用**: < 100MB (基础)

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](./docs/development/CONTRIBUTING.md)

## 📄 许可证

MIT License - 详见 [LICENSE](./LICENSE)

## 🆘 获取帮助

- 📖 [文档](./docs/README.md)
- 🐛 [提交 Issue](https://github.com/your-repo/issues)
- 💬 [讨论区](https://github.com/your-repo/discussions)

## 🌟 Star History

如果这个项目对你有帮助，请给个 Star ⭐️

---

**Made with ❤️ using Bun + NestJS + tRPC**
