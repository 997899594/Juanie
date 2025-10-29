# Juanie - AI DevOps Platform

一个现代化的 AI 驱动的 DevOps 平台，采用 Monorepo 架构。

## 🏗️ 项目结构

```
Juanie/
├── apps/
│   ├── api/                    # 后端 API (NestJS + tRPC)
│   └── web/                    # 前端应用 (Vue 3 + TypeScript)
├── packages/
│   ├── config/                 # 共享配置包
│   │   ├── typescript/         # TypeScript 配置
│   │   ├── vitest/             # Vitest 配置
│   │   └── vite/               # Vite 配置
│   ├── core/                   # 核心共享包
│   │   ├── database/           # 数据库 schemas (Drizzle ORM)
│   │   ├── types/              # 共享类型定义
│   │   └── utils/              # 工具函数
│   ├── shared/                 # 共享组件
│   └── ui/                     # UI 组件库
└── docs/                       # 项目文档
```

## 🚀 快速开始

### 前置要求

- **Bun**: >= 1.0.0
- **Node.js**: >= 22.0.0
- **PostgreSQL**: >= 14

### 安装

```bash
# 克隆仓库
git clone <repository-url>
cd Juanie

# 安装依赖
bun install

# 配置环境变量（在根目录）
cp .env.example .env.local
# 编辑 .env.local 设置数据库连接等

# 设置数据库
createdb juanie
cd apps/api && bun run db:push

# 构建核心包
turbo build --filter="@juanie/core-*"

# 启动开发服务器
turbo dev
```

访问：
- 前端: http://localhost:5173
- 后端 API: http://localhost:3001

## 📦 核心包

### @juanie/core-database

数据库 schemas 和客户端，使用 Drizzle ORM。

```typescript
import * as schema from '@juanie/core-database/schemas'
import { db } from '@juanie/core-database/client'
```

### @juanie/core-types

共享的 TypeScript 类型定义。

```typescript
import type { User, Organization } from '@juanie/core-types/models'
```

### @juanie/core-utils

工具函数集合（ID 生成、日期处理、验证、字符串操作）。

```typescript
import { generateId } from '@juanie/core-utils/id'
import { formatDuration } from '@juanie/core-utils/date'
import { isValidEmail } from '@juanie/core-utils/validation'
```

## 🛠️ 开发

### 常用命令

```bash
# 开发模式
turbo dev

# 构建所有包
turbo build

# 类型检查
turbo type-check

# 运行测试
turbo test

# 代码格式化
bun run lint:fix
```

### Turborepo 缓存

项目使用 Turborepo 进行构建优化，支持智能缓存和并行构建：

```bash
# 首次构建
turbo build --filter="@juanie/core-*"
# Time: 1.3s

# 缓存构建
turbo build --filter="@juanie/core-*"
# Time: 160ms >>> FULL TURBO (88% 性能提升)
```

## 📚 文档

- [包开发指南](./docs/PACKAGE_DEVELOPMENT.md) - 如何创建和管理包
- [开发环境设置](./apps/api/docs/development/SETUP.md) - 详细的开发环境配置
- [测试指南](./apps/api/docs/development/TESTING.md) - 测试最佳实践
- [架构概览](./apps/api/docs/architecture/OVERVIEW.md) - 系统架构说明

## 🧪 测试

```bash
# 运行所有测试
turbo test

# 运行特定包的测试
turbo test --filter="@juanie/core-utils"

# 监听模式
cd packages/core/utils
bun run test:watch

# 测试覆盖率
turbo test --coverage
```

## 🏗️ 技术栈

### 后端
- **框架**: NestJS
- **API**: tRPC (类型安全的 RPC)
- **数据库**: PostgreSQL + Drizzle ORM
- **运行时**: Bun
- **队列**: BullMQ + Redis

### 前端
- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite
- **UI**: Tailwind CSS
- **状态管理**: Pinia
- **路由**: Vue Router

### 工具链
- **Monorepo**: Turborepo
- **包管理**: Bun Workspaces
- **代码质量**: Biome
- **测试**: Vitest
- **类型检查**: TypeScript

## 📈 性能

- **构建缓存**: 88% 性能提升（1.3s → 0.16s）
- **并行构建**: 自动并行构建独立包
- **增量构建**: 只构建变更的包
- **热重载**: 快速的开发体验

## 🤝 贡献

欢迎贡献！请查看 [包开发指南](./docs/PACKAGE_DEVELOPMENT.md) 了解如何添加新功能。

## 📄 许可证

[MIT License](./LICENSE)

## 🔗 相关链接

- [Turborepo](https://turbo.build/repo)
- [Bun](https://bun.sh)
- [NestJS](https://nestjs.com)
- [Vue 3](https://vuejs.org)
- [tRPC](https://trpc.io)
- [Drizzle ORM](https://orm.drizzle.team)
