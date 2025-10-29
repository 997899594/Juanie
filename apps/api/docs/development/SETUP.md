# 开发环境设置

本文档说明如何设置 Juanie 后端开发环境。

## 前置要求

- **Bun**: >= 1.0.0
- **Node.js**: >= 22.0.0
- **PostgreSQL**: >= 14
- **Redis**: >= 6 (可选，用于队列)

## 项目结构

Juanie 使用 Monorepo 架构，由 Turborepo 管理：

```
Juanie/
├── apps/
│   ├── api/                    # 后端 API 应用
│   └── web/                    # 前端应用
├── packages/
│   ├── config/                 # 共享配置
│   │   ├── typescript/         # TypeScript 配置
│   │   ├── vitest/             # Vitest 配置
│   │   └── vite/               # Vite 配置
│   ├── core/                   # 核心共享包
│   │   ├── database/           # 数据库 schemas 和客户端
│   │   ├── types/              # 共享类型定义
│   │   └── utils/              # 工具函数
│   ├── services/               # 业务服务包（未来）
│   ├── shared/                 # 共享组件
│   └── ui/                     # UI 组件库
├── turbo.json                  # Turborepo 配置
└── package.json                # 根配置
```

## 快速开始

### 1. 克隆仓库

```bash
git clone <repository-url>
cd Juanie
```

### 2. 安装依赖

```bash
bun install
```

这会安装所有 workspace 的依赖。

### 3. 配置环境变量

复制环境变量模板：

```bash
cp apps/api/.env.example apps/api/.env.local
```

编辑 `apps/api/.env.local` 并设置必要的变量：

```env
# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/juanie

# Redis（可选）
REDIS_URL=redis://localhost:6379

# OAuth（如需要）
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# 其他配置...
```

### 4. 设置数据库

```bash
# 创建数据库
createdb juanie

# 运行迁移
cd apps/api
bun run db:push
```

### 5. 构建核心包

在开发之前，需要先构建核心包：

```bash
# 从项目根目录
turbo build --filter="@juanie/core-*"
```

或者使用 Turborepo 的依赖自动构建：

```bash
turbo dev --filter="@juanie/api"
```

### 6. 启动开发服务器

```bash
# 从项目根目录
turbo dev --filter="@juanie/api"

# 或者直接在 apps/api 目录
cd apps/api
bun run dev
```

API 将在 `http://localhost:3001` 启动。

## 核心包说明

### @juanie/core-database

包含所有 Drizzle ORM schemas 和数据库客户端。

**使用方式**：

```typescript
import * as schema from '@juanie/core-database/schemas'
import { db } from '@juanie/core-database/client'

// 使用 schemas
const users = await db.select().from(schema.users)
```

**位置**: `packages/core/database/`

**构建**: `turbo build --filter="@juanie/core-database"`

### @juanie/core-types

共享的 TypeScript 类型定义。

**使用方式**：

```typescript
import type { User, Organization } from '@juanie/core-types/models'
import type { PaginatedResponse } from '@juanie/core-types/api'
```

**位置**: `packages/core/types/`

**构建**: `turbo build --filter="@juanie/core-types"`

### @juanie/core-utils

共享的工具函数。

**使用方式**：

```typescript
import { generateId } from '@juanie/core-utils/id'
import { formatDuration } from '@juanie/core-utils/date'
import { isValidEmail } from '@juanie/core-utils/validation'
import { slugify } from '@juanie/core-utils/string'

const id = generateId()
const duration = formatDuration(3665) // "1h 1m 5s"
```

**位置**: `packages/core/utils/`

**构建**: `turbo build --filter="@juanie/core-utils"`

**测试**: `turbo test --filter="@juanie/core-utils"`

## 开发工作流

### 构建

```bash
# 构建所有包
turbo build

# 构建特定包
turbo build --filter="@juanie/api"

# 构建核心包
turbo build --filter="@juanie/core-*"

# 构建包及其依赖
turbo build --filter="@juanie/api..."
```

### 类型检查

```bash
# 检查所有包
turbo type-check

# 检查特定包
turbo type-check --filter="@juanie/api"
```

### 测试

```bash
# 运行所有测试
turbo test

# 运行特定包的测试
turbo test --filter="@juanie/core-utils"

# 监听模式
cd packages/core/utils
bun run test:watch
```

### 代码格式化和 Lint

```bash
# 格式化代码
bun run lint:fix

# 检查代码
bun run lint
```

### 数据库操作

```bash
cd apps/api

# 生成迁移
bun run db:generate

# 应用迁移
bun run db:migrate

# 推送 schema（开发环境）
bun run db:push

# 打开 Drizzle Studio
bun run db:studio
```

## Turborepo 缓存

Turborepo 会自动缓存构建结果，大幅提升构建速度。

### 缓存工作原理

1. 首次构建会执行完整构建
2. 后续构建如果输入未变化，会使用缓存
3. 只有变更的包会重新构建

### 查看缓存效果

```bash
# 首次构建
turbo build --filter="@juanie/core-*"
# Tasks: 3 successful, 3 total
# Time: 1.3s

# 再次构建（使用缓存）
turbo build --filter="@juanie/core-*"
# Tasks: 3 successful, 3 total
# Cached: 3 cached, 3 total
# Time: 160ms >>> FULL TURBO
```

### 清除缓存

```bash
# 清除 Turborepo 缓存
rm -rf .turbo

# 清除包的构建输出
turbo clean
```

## 添加新包

参考 [包开发指南](../../../docs/PACKAGE_DEVELOPMENT.md) 了解如何创建新包。

### 快速步骤

1. 创建包目录：`packages/core/my-package/`
2. 添加 `package.json` 和 `tsconfig.json`
3. 编写代码
4. 构建：`turbo build --filter="@juanie/core-my-package"`
5. 在其他包中使用：添加 `"@juanie/core-my-package": "workspace:*"` 到依赖

## 常见任务

### 添加新的数据库表

1. 在 `packages/core/database/src/schemas/` 创建新的 schema 文件
2. 在 `packages/core/database/src/schemas/index.ts` 导出
3. 重新构建 database 包：`turbo build --filter="@juanie/core-database"`
4. 生成迁移：`cd apps/api && bun run db:generate`
5. 应用迁移：`bun run db:migrate`

### 添加新的工具函数

1. 在 `packages/core/utils/src/` 添加函数
2. 在 `packages/core/utils/src/index.ts` 导出
3. 编写测试：`packages/core/utils/test/`
4. 运行测试：`turbo test --filter="@juanie/core-utils"`
5. 构建：`turbo build --filter="@juanie/core-utils"`

### 更新依赖

```bash
# 更新所有依赖
bun update

# 更新特定依赖
bun update <package-name>

# 检查过时的依赖
bun outdated
```

## 性能优化

### 并行构建

Turborepo 会自动并行构建独立的包：

```bash
# 这会并行构建所有核心包
turbo build --filter="@juanie/core-*"
```

### 增量构建

只构建变更的包：

```bash
# 只构建自上次提交以来变更的包
turbo build --filter="[HEAD^1]"
```

### 开发模式优化

使用 `dev` 脚本会自动构建依赖：

```bash
# 这会先构建核心包，然后启动 API
turbo dev --filter="@juanie/api"
```

## 故障排查

### 构建失败

1. 清理并重新安装：
```bash
rm -rf node_modules
rm -rf packages/*/node_modules
rm -rf apps/*/node_modules
bun install
```

2. 清理构建输出：
```bash
turbo clean
```

3. 重新构建：
```bash
turbo build
```

### 类型错误

1. 确保核心包已构建：
```bash
turbo build --filter="@juanie/core-*"
```

2. 重启 TypeScript 服务器（在 IDE 中）

### 数据库连接问题

1. 检查 PostgreSQL 是否运行
2. 验证 `DATABASE_URL` 环境变量
3. 测试连接：
```bash
psql $DATABASE_URL
```

### 端口被占用

```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>

# 或使用项目脚本
bun run clean:processes
```

## IDE 设置

### VS Code

推荐安装的扩展：

- Biome (biomejs.biome)
- TypeScript Vue Plugin (Vue.volar)
- Vitest (vitest.explorer)

### 工作区设置

项目已包含 `.vscode/settings.json` 配置。

## 相关文档

- [包开发指南](../../../docs/PACKAGE_DEVELOPMENT.md)
- [测试指南](./TESTING.md)
- [架构概览](../architecture/OVERVIEW.md)
- [Turborepo 文档](https://turbo.build/repo/docs)
