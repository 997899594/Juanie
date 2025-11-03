# Juanie 项目目录结构

> 最后更新: 2024-10-31

## 📁 完整目录结构

```
Juanie/
├── .github/                    # GitHub 配置
│   └── workflows/
│       └── ci.yml             # GitHub Actions CI/CD
├── .gitlab-ci.yml             # GitLab CI/CD 配置
├── .kiro/                     # Kiro IDE 配置
│   └── specs/                 # 功能规划文档（Spec）
│       ├── backend-modularization/  # 后端模块化重构
│       │   ├── requirements.md      # 需求文档
│       │   ├── design.md           # 设计文档
│       │   └── tasks.md            # 任务列表
│       └── ai-devops-platform-clean/ # AI DevOps 平台
│           ├── requirements.md
│           ├── design.md
│           └── tasks.md
├── apps/                      # 应用层
│   ├── api-gateway/          # API 网关（主后端）
│   │   ├── src/
│   │   │   ├── main.ts       # 入口文件
│   │   │   ├── app.module.ts # 根模块
│   │   │   ├── app.controller.ts
│   │   │   ├── routers/      # tRPC 路由（18个）
│   │   │   │   ├── auth.router.ts
│   │   │   │   ├── organizations.router.ts
│   │   │   │   ├── teams.router.ts
│   │   │   │   ├── projects.router.ts
│   │   │   │   ├── pipelines.router.ts
│   │   │   │   ├── deployments.router.ts
│   │   │   │   ├── repositories.router.ts
│   │   │   │   ├── environments.router.ts
│   │   │   │   ├── ai-assistants.router.ts
│   │   │   │   ├── storage.router.ts
│   │   │   │   ├── k3s.router.ts
│   │   │   │   ├── ollama.router.ts
│   │   │   │   ├── cost-tracking.router.ts
│   │   │   │   ├── security-policies.router.ts
│   │   │   │   ├── audit-logs.router.ts
│   │   │   │   ├── notifications.router.ts
│   │   │   │   ├── templates.router.ts
│   │   │   │   └── users.router.ts
│   │   │   ├── trpc/         # tRPC 配置
│   │   │   │   ├── trpc.service.ts
│   │   │   │   ├── trpc.module.ts
│   │   │   │   └── trpc.router.ts  # 路由聚合
│   │   │   ├── config/       # 配置
│   │   │   └── observability/ # 可观测性
│   │   ├── test/
│   │   ├── drizzle/          # 数据库迁移
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── drizzle.config.ts
│   │   └── Dockerfile
│   └── web/                  # 前端应用
│       ├── src/
│       │   ├── main.ts
│       │   ├── App.vue
│       │   ├── components/
│       │   ├── views/
│       │   ├── stores/       # Pinia stores
│       │   ├── router/
│       │   └── api/          # tRPC 客户端
│       ├── public/
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── index.html
├── packages/                  # 包层
│   ├── core/                 # 核心包（基础设施）
│   │   ├── database/         # 数据库
│   │   │   ├── src/
│   │   │   │   ├── schemas/  # Drizzle schemas（所有表）
│   │   │   │   ├── database.module.ts  # NestJS 全局模块
│   │   │   │   ├── client.ts
│   │   │   │   └── index.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── types/            # 共享类型
│   │   │   ├── src/
│   │   │   │   ├── models.ts    # 数据模型类型
│   │   │   │   ├── api.ts       # API 类型
│   │   │   │   ├── dtos.ts      # DTO 类型
│   │   │   │   └── index.ts
│   │   │   └── package.json
│   │   ├── utils/            # 工具函数
│   │   │   ├── src/
│   │   │   │   ├── id.ts        # ID 生成
│   │   │   │   ├── date.ts      # 日期处理
│   │   │   │   ├── string.ts    # 字符串工具
│   │   │   │   ├── validation.ts # 验证函数
│   │   │   │   └── index.ts
│   │   │   ├── test/            # 32个单元测试
│   │   │   └── package.json
│   │   ├── tokens/           # 依赖注入令牌
│   │   │   ├── src/
│   │   │   │   └── index.ts     # DATABASE, REDIS 等
│   │   │   └── package.json
│   │   ├── observability/    # 可观测性
│   │   │   ├── src/
│   │   │   │   ├── trace.decorator.ts  # @Trace 装饰器
│   │   │   │   └── index.ts
│   │   │   └── package.json
│   │   └── queue/            # 任务队列
│   │       ├── src/
│   │       │   ├── queue.module.ts     # QueueModule
│   │       │   ├── tokens.ts           # PIPELINE_QUEUE 等
│   │       │   ├── workers/
│   │       │   │   └── pipeline.worker.ts
│   │       │   └── index.ts
│   │       └── package.json
│   ├── services/             # 业务服务包（18个）
│   │   ├── auth/             # 认证服务
│   │   │   ├── src/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── test/
│   │   │   └── package.json
│   │   ├── organizations/    # 组织管理
│   │   ├── teams/            # 团队管理
│   │   ├── projects/         # 项目管理
│   │   ├── pipelines/        # CI/CD Pipeline
│   │   ├── deployments/      # 部署管理
│   │   ├── repositories/     # 代码仓库
│   │   ├── environments/     # 环境管理
│   │   ├── ai-assistants/    # AI 助手
│   │   ├── storage/          # 文件存储
│   │   ├── k3s/              # K3s 集群管理
│   │   ├── ollama/           # Ollama AI 模型
│   │   ├── cost-tracking/    # 成本追踪
│   │   ├── security-policies/# 安全策略
│   │   ├── audit-logs/       # 审计日志
│   │   ├── notifications/    # 通知服务
│   │   ├── templates/        # 模板管理
│   │   └── users/            # 用户管理
│   ├── config/               # 共享配置包
│   │   ├── typescript/       # TypeScript 配置
│   │   │   ├── base.json
│   │   │   ├── node.json
│   │   │   └── package.json
│   │   ├── vitest/           # Vitest 测试配置
│   │   │   ├── vitest.config.ts
│   │   │   └── package.json
│   │   └── vite/             # Vite 构建配置
│   │       └── package.json
│   ├── shared/               # 共享代码
│   └── ui/                   # UI 组件库
├── docs/                     # 文档
│   ├── README.md            # 文档导航
│   ├── DEVELOPMENT.md       # 开发指南
│   ├── PACKAGE_DEVELOPMENT.md  # 包开发指南
│   ├── ENVIRONMENT_VARIABLES.md # 环境变量说明
│   └── api/                 # API 参考文档（旧）
│       ├── architecture/
│       ├── development/
│       ├── features/
│       ├── getting-started/
│       ├── operations/
│       └── reference/
├── templates/               # 模板文件
│   ├── ci-cd/              # CI/CD 模板
│   │   ├── github-actions.yml
│   │   └── gitlab-ci.yml
│   └── dockerfiles/        # Dockerfile 模板
│       ├── bun.Dockerfile
│       ├── nodejs.Dockerfile
│       └── python.Dockerfile
├── config/                  # 配置文件
│   ├── prometheus.yml      # Prometheus 配置
│   └── tempo.yaml          # Tempo 追踪配置
├── grafana/                # Grafana 配置
│   ├── dashboards/         # 仪表板
│   └── provisioning/       # 配置
├── gitlab/                 # GitLab 私有部署配置
├── scripts/                # 构建脚本
├── .env.example            # 环境变量示例
├── .gitignore
├── biome.json             # Biome 配置
├── bun.lockb              # Bun 锁文件
├── docker-compose.yml     # Docker Compose
├── package.json           # 根 package.json
├── turbo.json             # Turborepo 配置
├── tsconfig.json          # 根 TypeScript 配置
├── README.md              # 项目概述
├── ARCHITECTURE_ANALYSIS.md  # 架构分析
└── PROJECT_STRUCTURE.md   # 本文档
```

## 📦 包统计

### 应用（2个）
- `@juanie/api-gateway` - API 网关
- `@juanie/web` - 前端应用

### 核心包（6个）
- `@juanie/core-database` - 数据库 schemas 和 DatabaseModule
- `@juanie/core-types` - 共享类型定义
- `@juanie/core-utils` - 工具函数（32个测试）
- `@juanie/core-tokens` - 依赖注入令牌
- `@juanie/core-observability` - @Trace 装饰器
- `@juanie/core-queue` - BullMQ 任务队列

### 服务包（18个）
1. `@juanie/service-auth` - 认证服务
2. `@juanie/service-organizations` - 组织管理
3. `@juanie/service-teams` - 团队管理
4. `@juanie/service-projects` - 项目管理
5. `@juanie/service-pipelines` - CI/CD Pipeline
6. `@juanie/service-deployments` - 部署管理
7. `@juanie/service-repositories` - 代码仓库
8. `@juanie/service-environments` - 环境管理
9. `@juanie/service-ai-assistants` - AI 助手
10. `@juanie/service-storage` - 文件存储
11. `@juanie/service-k3s` - K3s 集群管理
12. `@juanie/service-ollama` - Ollama AI 模型
13. `@juanie/service-cost-tracking` - 成本追踪
14. `@juanie/service-security-policies` - 安全策略
15. `@juanie/service-audit-logs` - 审计日志
16. `@juanie/service-notifications` - 通知服务
17. `@juanie/service-templates` - 模板管理
18. `@juanie/service-users` - 用户管理

### 配置包（3个）
- `@juanie/config-typescript` - TypeScript 配置
- `@juanie/config-vitest` - Vitest 配置
- `@juanie/config-vite` - Vite 配置

**总计**: 29 个包

## 🏗️ 架构层次

```
┌─────────────────────────────────────┐
│         应用层 (apps/)              │
│  api-gateway, web                   │
└─────────────────────────────────────┘
              ↓ 依赖
┌─────────────────────────────────────┐
│      服务层 (packages/services/)    │
│  18 个业务服务包                    │
└─────────────────────────────────────┘
              ↓ 依赖
┌─────────────────────────────────────┐
│       核心层 (packages/core/)       │
│  database, types, utils, queue...   │
└─────────────────────────────────────┘
```

## 📝 文档分类

### 项目文档（根目录）
- `README.md` - 项目概述、快速开始
- `ARCHITECTURE_ANALYSIS.md` - 架构分析和设计决策
- `PROJECT_STRUCTURE.md` - 本文档

### 开发文档（docs/）
- `README.md` - 文档导航中心
- `DEVELOPMENT.md` - 开发指南（环境设置、常用命令）
- `PACKAGE_DEVELOPMENT.md` - 如何创建新服务包
- `ENVIRONMENT_VARIABLES.md` - 环境变量配置说明

### 规划文档（.kiro/specs/）
- `backend-modularization/` - 后端模块化重构 Spec
  - `requirements.md` - 需求文档
  - `design.md` - 设计文档
  - `tasks.md` - 任务列表
- `ai-devops-platform-clean/` - AI DevOps 平台 Spec

### 参考文档（docs/api/）
- 从旧 API 迁移的文档，供参考

## 🔧 配置文件

### 根配置
- `package.json` - Monorepo 根配置
- `turbo.json` - Turborepo 任务配置
- `tsconfig.json` - TypeScript 根配置
- `biome.json` - 代码格式化和 Lint
- `docker-compose.yml` - 本地开发环境

### CI/CD
- `.github/workflows/ci.yml` - GitHub Actions
- `.gitlab-ci.yml` - GitLab CI

### 应用配置
- `apps/api-gateway/drizzle.config.ts` - 数据库迁移配置
- `apps/web/vite.config.ts` - Vite 构建配置

### 监控配置
- `config/prometheus.yml` - Prometheus 指标
- `config/tempo.yaml` - Tempo 追踪
- `grafana/` - Grafana 仪表板

## 🎯 关键特性

### Monorepo 管理
- **工具**: Turborepo + Bun Workspaces
- **包管理**: workspace protocol (`workspace:*`)
- **构建**: 增量构建和缓存
- **性能**: 单包修改构建时间减少 75%

### 类型安全
- **端到端**: tRPC 类型推导
- **数据库**: Drizzle ORM 类型安全
- **严格模式**: TypeScript strict mode

### 可观测性
- **追踪**: OpenTelemetry + @Trace 装饰器
- **指标**: Prometheus
- **可视化**: Grafana
- **日志**: 结构化日志

### 任务队列
- **引擎**: BullMQ
- **存储**: Redis/Dragonfly
- **Worker**: Pipeline 异步执行

## 📊 代码统计

- **总包数**: 29 个
- **服务包**: 18 个
- **核心包**: 6 个
- **配置包**: 3 个
- **应用**: 2 个
- **路由数**: 18 个 tRPC 路由
- **测试**: 32+ 单元测试（core/utils）

## 🚀 快速导航

### 开发相关
- [快速开始](README.md#快速开始)
- [开发指南](docs/DEVELOPMENT.md)
- [创建新服务包](docs/PACKAGE_DEVELOPMENT.md)

### 架构相关
- [架构分析](ARCHITECTURE_ANALYSIS.md)
- [设计文档](.kiro/specs/backend-modularization/design.md)
- [需求文档](.kiro/specs/backend-modularization/requirements.md)

### 配置相关
- [环境变量](docs/ENVIRONMENT_VARIABLES.md)
- [Turborepo 配置](turbo.json)
- [CI/CD 配置](.github/workflows/ci.yml)

---

**维护**: 请在项目结构发生重大变化时更新本文档  
**最后更新**: 2024-10-31
