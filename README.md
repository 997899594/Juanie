# AI DevOps Platform

一个现代化的 AI 驱动的 DevOps 平台，提供项目管理、CI/CD、环境管理、成本追踪等功能。

## ✨ 特性

- 🚀 **项目管理** - 多项目、多团队管理
- 🔄 **CI/CD** - 自动化构建、测试、部署
- 🌍 **环境管理** - 多环境配置和权限控制
- 💰 **成本追踪** - 实时成本监控和优化建议
- 🤖 **AI 助手** - 代码审查、DevOps 建议、安全分析
- 📊 **审计日志** - 完整的操作记录和合规性检查
- 🔐 **安全管理** - 基于角色的访问控制和安全策略
- 📦 **模板系统** - Dockerfile 和 CI/CD 配置生成

## 🏗️ 技术栈

### 后端
- **框架**: NestJS + tRPC
- **语言**: TypeScript
- **数据库**: PostgreSQL + Drizzle ORM
- **缓存**: Redis
- **消息队列**: BullMQ
- **容器编排**: K3s (Kubernetes)

### 前端
- **框架**: Vue 3 + Vite
- **状态管理**: Pinia
- **UI 库**: Element Plus
- **类型安全**: TypeScript + tRPC Client

### 基础设施
- **容器**: Docker
- **编排**: Docker Compose / K3s
- **监控**: Prometheus + Grafana
- **日志**: OpenTelemetry

## 📦 项目结构

```
.
├── apps/
│   ├── api-gateway/          # API 网关 (NestJS + tRPC)
│   └── web/                  # Web 前端 (Vue 3)
├── packages/
│   ├── core/                 # 核心包
│   │   ├── database/         # 数据库 Schema
│   │   ├── types/            # 公共类型定义
│   │   ├── tokens/           # 依赖注入 Token
│   │   ├── queue/            # 消息队列
│   │   ├── observability/    # 可观测性
│   │   └── utils/            # 工具函数
│   ├── services/             # 业务服务
│   │   ├── ai-assistants/    # AI 助手
│   │   ├── audit-logs/       # 审计日志
│   │   ├── auth/             # 认证
│   │   ├── cost-tracking/    # 成本追踪
│   │   ├── deployments/      # 部署管理
│   │   ├── environments/     # 环境管理
│   │   ├── notifications/    # 通知
│   │   ├── organizations/    # 组织管理
│   │   ├── pipelines/        # Pipeline
│   │   ├── projects/         # 项目管理
│   │   ├── repositories/     # 仓库管理
│   │   ├── teams/            # 团队管理
│   │   ├── templates/        # 模板
│   │   └── users/            # 用户管理
│   └── config/               # 配置包
├── docs/                     # 文档
├── infra/                    # 基础设施配置
└── scripts/                  # 脚本工具
```

## 🚀 快速开始

### 前置要求

- Node.js >= 20
- Bun >= 1.0
- Docker >= 24.0
- PostgreSQL >= 15
- Redis >= 7.0

### 安装

```bash
# 克隆仓库
git clone https://github.com/your-org/ai-devops-platform.git
cd ai-devops-platform

# 安装依赖
bun install

# 复制环境变量
cp .env.example .env

# 启动数据库和 Redis
docker-compose up -d postgres redis

# 运行数据库迁移
bun run db:push

# 构建所有包
bun run build
```

### 开发

```bash
# 启动开发服务器
bun run dev

# 或分别启动
bun run dev:api      # API Gateway (http://localhost:3000)
bun run dev:web      # Web Frontend (http://localhost:5173)
```

### 测试

```bash
# 运行所有测试
bun test

# 运行类型检查
bun run type-check

# 运行代码检查
bun run lint
```

### 构建

```bash
# 构建所有包
bun run build

# 构建特定包
cd packages/services/projects && bun run build
```

## 📚 文档

- [架构文档](./docs/ARCHITECTURE.md) - 系统架构和设计
- [后端开发指南](./docs/BACKEND_GUIDE.md) - 后端开发最佳实践
- [项目结构](./PROJECT_STRUCTURE.md) - 详细的项目结构说明
- [部署指南](./docs/DEPLOYMENT.md) - 部署和运维指南
- [监控指南](./docs/MONITORING.md) - 监控和告警配置
- [故障排查](./docs/TROUBLESHOOTING.md) - 常见问题和解决方案
- [环境变量](./docs/ENVIRONMENT_VARIABLES.md) - 环境变量配置说明

## 🔧 开发工具

### 类型检查

```bash
# 检查所有包
bun run type-check

# 检查特定包
cd packages/services/projects && bun run type-check
```

### 数据库

```bash
# 生成迁移
bun run db:generate

# 应用迁移
bun run db:push

# 打开 Drizzle Studio
bun run db:studio
```

### 代码质量

```bash
# 运行 Biome 检查
bun run lint

# 自动修复
bun run lint:fix

# 格式化代码
bun run format
```

## 🐳 Docker 部署

### 开发环境

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 生产环境

```bash
# 构建镜像
docker-compose -f docker-compose.prod.yml build

# 启动服务
docker-compose -f docker-compose.prod.yml up -d

# 查看状态
docker-compose -f docker-compose.prod.yml ps
```

## 🔐 环境变量

主要环境变量配置：

```bash
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/devops

# Redis
REDIS_URL=redis://localhost:6379

# OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret

# Ollama (AI)
OLLAMA_BASE_URL=http://localhost:11434

# S3 (存储)
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=devops-platform

# K3s (Kubernetes)
K3S_URL=https://k3s.example.com:6443
K3S_TOKEN=your_k3s_token
```

详细配置请参考 [环境变量文档](./docs/ENVIRONMENT_VARIABLES.md)

## 📊 监控

系统提供完整的监控和可观测性：

- **Prometheus** - 指标采集 (http://localhost:9090)
- **Grafana** - 可视化仪表板 (http://localhost:3001)
- **OpenTelemetry** - 分布式追踪

详细配置请参考 [监控指南](./docs/MONITORING.md)

## 🤝 贡献

欢迎贡献！请查看 [贡献指南](./CONTRIBUTING.md)

### 开发流程

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

### 代码规范

- 使用 TypeScript
- 遵循 ESLint 规则
- 编写单元测试
- 更新文档

## 📄 许可证

[MIT License](./LICENSE)

## 🙏 致谢

感谢所有贡献者和开源项目：

- [NestJS](https://nestjs.com/)
- [tRPC](https://trpc.io/)
- [Vue 3](https://vuejs.org/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [BullMQ](https://docs.bullmq.io/)

## 📞 联系方式

- 问题反馈: [GitHub Issues](https://github.com/your-org/ai-devops-platform/issues)
- 讨论: [GitHub Discussions](https://github.com/your-org/ai-devops-platform/discussions)
- 邮件: support@example.com

---

Made with ❤️ by the AI DevOps Platform Team
