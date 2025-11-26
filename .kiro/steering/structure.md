# 项目结构

## Monorepo 组织

这是一个基于 Turborepo 的 monorepo 项目，使用 Bun workspaces 管理。

## 目录结构

```
apps/                          # 应用程序
  api-gateway/                 # API 网关 (NestJS + tRPC)
    src/
      routers/                 # tRPC 路由定义
      trpc/                    # tRPC 配置和适配器
      observability/           # 监控和追踪
  web/                         # Web 前端 (Vue 3)
    src/
      views/                   # 页面组件
      components/              # UI 组件
      composables/             # 组合式函数
      stores/                  # Pinia 状态管理
      router/                  # 路由配置

packages/
  core/                        # 核心基础包（单一包）
    src/
      database/                # 数据库 Schema 和迁移
      events/                  # 事件类型定义
      queue/                   # BullMQ 队列配置
      tokens/                  # Token 管理
      utils/                   # 工具函数
      observability/           # 可观测性工具
      sse/                     # Server-Sent Events
    migrations/                # 数据库迁移文件
  
  services/                    # 三层服务架构
    foundation/                # 基础层 - 认证、用户、存储
      src/
        auth/                  # 认证授权
        users/                 # 用户管理
        organizations/         # 组织管理
        teams/                 # 团队管理
        storage/               # 存储服务
    
    business/                  # 业务层 - 项目、部署、GitOps
      src/
        projects/              # 项目管理
          initialization/      # 项目初始化状态机
        environments/          # 环境管理
        templates/             # 模板服务
        deployments/           # 部署管理
        repositories/          # 仓库管理
        pipelines/             # CI/CD 管道
        queue/                 # 队列处理器
        gitops/                # GitOps 集成
          flux/                # Flux CD 服务
          k3s/                 # Kubernetes 服务
          git-auth/            # Git 认证（Deploy Keys, Tokens）
    
    extensions/                # 扩展层 - AI、监控、通知、安全
      src/
        ai/                    # AI 功能
          ai/                  # AI 服务
          ollama/              # Ollama 集成
          assistants/          # AI 助手
        monitoring/            # 监控功能
          audit-logs/          # 审计日志
          cost-tracking/       # 成本追踪
        notifications/         # 通知服务
        security/              # 安全策略
  
  config/                      # 共享配置
    typescript/                # TypeScript 配置
    vite/                      # Vite 配置
    vitest/                    # Vitest 配置
  
  ui/                          # UI 组件库
    src/components/            # shadcn-vue 组件
  
  shared/                      # 共享工具和类型

docs/                          # 文档
  api/                         # API 文档
  architecture.md              # 架构设计
  development.md               # 开发指南

scripts/                       # 工具脚本
  test-*.ts                    # 测试脚本
  check-*.ts                   # 检查脚本
  diagnose-*.ts                # 诊断脚本
  clean-*.ts                   # 清理脚本
  
templates/                     # 项目模板
  nextjs-15-app/               # Next.js 15 应用模板
    app/                       # 应用代码
    k8s/                       # Kubernetes 配置
    ci/                        # CI/CD 配置
  ci-cd/                       # CI/CD 模板
  dockerfiles/                 # Dockerfile 模板
```

## 命名约定

### 包命名
- 应用: `@juanie/[app-name]` (例如: `@juanie/web`, `@juanie/api-gateway`)
- 核心包: 
  - `@juanie/core` - 所有基础设施（database, queue, events, observability, tokens, utils）
  - `@juanie/types` - 类型定义
- 服务层: 
  - `@juanie/service-foundation` (基础层)
  - `@juanie/service-business` (业务层)
  - `@juanie/service-extensions` (扩展层)
- 配置: `@juanie/config-[name]` (例如: `@juanie/config-typescript`)

### 文件命名
- 组件文件: PascalCase (例如: `ProjectCard.vue`)
- 工具文件: kebab-case (例如: `project-service.ts`)
- Schema 文件: kebab-case + `.schema.ts` (例如: `projects.schema.ts`)
- 路由文件: kebab-case + `.router.ts` (例如: `projects.router.ts`)
- 测试文件: 与源文件同名 + `.test.ts` 或 `.spec.ts`

### 代码命名
- 类名: PascalCase (`ProjectService`, `UserController`)
- 函数/变量: camelCase (`createProject`, `userId`)
- 常量: UPPER_SNAKE_CASE (`MAX_RETRIES`, `API_VERSION`)
- 接口/类型: PascalCase (`ProjectConfig`, `UserRole`)
- 枚举: PascalCase (`ProjectStatus`, `DeploymentState`)

## 三层服务架构

### 基础层（Foundation）
提供核心的认证、用户管理和存储功能。

```typescript
import { 
  AuthService, 
  UsersService, 
  OrganizationsService,
  TeamsService,
  StorageService 
} from '@juanie/service-foundation'
```

### 业务层（Business）
提供项目管理、部署管理和 GitOps 功能。依赖基础层。

```typescript
import { 
  ProjectsService, 
  DeploymentsService, 
  GitOpsService 
} from '@juanie/service-business'
```

### 扩展层（Extensions）
提供可选的 AI、监控、通知和安全功能。依赖基础层和业务层。

```typescript
import { 
  AIService, 
  MonitoringService, 
  NotificationsService,
  SecurityService 
} from '@juanie/service-extensions'
```

### 依赖关系
```
Extensions (扩展层)
    ↓ 依赖
Business (业务层)
    ↓ 依赖
Foundation (基础层)
    ↓ 依赖
Core (核心包)
```

## 导入路径

- 使用 workspace 协议引用内部包: `"@juanie/types": "workspace:*"`
- 优先使用命名导出而非默认导出
- 按以下顺序组织导入:
  1. 外部依赖 (例如: `import { Injectable } from '@nestjs/common'`)
  2. 内部包 (例如: `import type { Project } from '@juanie/types'`)
  3. 相对导入 (例如: `import { helper } from './utils'`)

### Core 包导入示例
```typescript
// 数据库
import * as schema from '@juanie/core/database'
import { DatabaseModule } from '@juanie/core/database'

// 队列
import { QueueModule, DEPLOYMENT_QUEUE } from '@juanie/core/queue'

// 事件
import { CoreEventsModule, K3sEvents } from '@juanie/core/events'

// Tokens
import { DATABASE, REDIS } from '@juanie/core/tokens'

// 工具
import { generateId } from '@juanie/core/utils'

// 可观测性
import { Trace } from '@juanie/core/observability'

// SSE (Server-Sent Events)
import { SSEModule } from '@juanie/core/sse'

// 类型
import type { Project, User } from '@juanie/types'
```

## 配置文件位置

- 根级配置: `biome.json`, `turbo.json`, `tsconfig.json`
- 应用级配置: `apps/[app]/tsconfig.json`, `apps/[app]/vite.config.ts`
- 包级配置: `packages/[category]/[name]/tsconfig.json`
- 环境变量: 根目录 `.env` (不提交), `.env.example` (提交)

## 数据库 Schema

所有数据库 schema 定义在 `packages/core/src/database/schemas/` 中，使用 Drizzle ORM。
迁移文件位于 `packages/core/migrations/`。

## 文档组织

- 产品文档: `docs/` 目录
- 包级文档: 每个包的 `README.md`
- API 文档: 通过 tRPC 自动生成
- 架构决策: `docs/architecture.md`
