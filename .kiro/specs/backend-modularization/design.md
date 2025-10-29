# 后端模块化 Monorepo - 设计文档

## 概述

本设计采用**渐进式重构**策略，分两个阶段将单体后端转换为模块化 Monorepo：
1. **Phase 1**: 提取共享代码到核心包（1-2周）
2. **Phase 2**: 拆分服务模块并创建 API Gateway（1-2月）

## 目标架构

### 最终目录结构

```
Juanie/
├── apps/
│   ├── api-gateway/              # 新增：API 聚合层
│   │   ├── src/
│   │   │   ├── main.ts          # 入口文件
│   │   │   ├── trpc/            # tRPC 配置
│   │   │   │   └── router.ts    # 聚合所有服务路由
│   │   │   └── config/          # 配置
│   │   ├── package.json
│   │   └── tsconfig.json
│   ├── api/                      # 保留：逐步迁移
│   └── web/
│
├── packages/
│   ├── core/                     # 新增：核心共享包
│   │   ├── database/            # 数据库 schemas
│   │   │   ├── src/
│   │   │   │   ├── schemas/    # Drizzle schemas
│   │   │   │   ├── client.ts   # 数据库客户端
│   │   │   │   └── index.ts
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── types/               # 共享类型
│   │   │   ├── src/
│   │   │   │   ├── api.ts      # API 类型
│   │   │   │   ├── models.ts   # 数据模型类型
│   │   │   │   └── index.ts
│   │   │   └── package.json
│   │   └── utils/               # 工具函数
│   │       ├── src/
│   │       │   ├── crypto.ts
│   │       │   ├── date.ts
│   │       │   └── index.ts
│   │       └── package.json
│   │
│   ├── services/                 # 新增：业务服务包
│   │   ├── auth/
│   │   │   ├── src/
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── auth.router.ts
│   │   │   │   ├── auth.module.ts
│   │   │   │   └── index.ts
│   │   │   ├── test/
│   │   │   ├── package.json
│   │   │   └── tsconfig.json
│   │   ├── organizations/
│   │   ├── teams/
│   │   ├── projects/
│   │   ├── pipelines/
│   │   ├── deployments/
│   │   ├── ai-assistants/
│   │   └── ... (其他服务)
│   │
│   ├── config/                   # 新增：共享配置
│   │   ├── typescript/
│   │   │   ├── base.json
│   │   │   ├── node.json
│   │   │   └── package.json
│   │   └── vitest/
│   │       ├── vitest.config.ts
│   │       └── package.json
│   │
│   ├── shared/                   # 保留
│   └── ui/                       # 保留
```

## Phase 1: 立即改进（1-2周）

### 1.1 创建核心包结构

#### packages/core/database

**职责**: 
- 提供所有 Drizzle schemas
- 提供数据库客户端配置
- 提供 DatabaseModule（NestJS 全局模块）
- 导出类型推导

**package.json**:
```json
{
  "name": "@juanie/core-database",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./schemas": "./dist/schemas/index.js",
    "./client": "./dist/client.js",
    "./module": "./dist/database.module.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@juanie/core-tokens": "workspace:*",
    "@nestjs/common": "^11.1.7",
    "@nestjs/config": "^3.3.0",
    "drizzle-orm": "^0.44.7",
    "ioredis": "^5.4.2",
    "postgres": "^3.4.7"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "typescript": "^5.9.3"
  }
}
```

**目录结构**:
```
packages/core/database/
├── src/
│   ├── schemas/
│   │   ├── users.schema.ts
│   │   ├── organizations.schema.ts
│   │   ├── projects.schema.ts
│   │   └── index.ts              # 导出所有 schemas
│   ├── client.ts                  # 数据库客户端
│   ├── database.module.ts         # NestJS 全局模块
│   └── index.ts                   # 主入口
├── package.json
└── tsconfig.json
```

**database.module.ts** (NestJS 全局模块):
```typescript
import * as schema from './schemas'
import { DATABASE, REDIS } from '@juanie/core-tokens'
import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import Redis from 'ioredis'
import postgres from 'postgres'

@Global()
@Module({
  providers: [
    {
      provide: DATABASE,
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>('DATABASE_URL')
        if (!connectionString) {
          throw new Error('DATABASE_URL 环境变量未设置')
        }
        const client = postgres(connectionString)
        return drizzle(client, { schema })
      },
      inject: [ConfigService],
    },
    {
      provide: REDIS,
      useFactory: (config: ConfigService) => {
        const redisUrl = config.get<string>('REDIS_URL') || 'redis://localhost:6379'
        return new Redis(redisUrl)
      },
      inject: [ConfigService],
    },
  ],
  exports: [DATABASE, REDIS],
})
export class DatabaseModule {}
```

**为什么 DatabaseModule 应该在 core/database？**
- ✅ 基础设施代码，不是业务逻辑
- ✅ 所有应用（api-gateway、未来的其他服务）都需要
- ✅ 符合关注点分离原则
- ✅ 便于统一管理数据库连接配置

**迁移步骤**:
1. 复制 `apps/api/src/database/schemas/` → `packages/core/database/src/schemas/`
2. 创建 `packages/core/database/src/database.module.ts`（NestJS 全局模块）
3. 创建 `packages/core/database/src/client.ts`（可选的直接客户端访问）
4. 创建 package.json 和 tsconfig.json
5. 构建包：`bun run build`
6. 更新应用层从 `@juanie/core-database/module` 导入 DatabaseModule

#### packages/core/types

**职责**:
- 共享的 TypeScript 类型定义
- API 请求/响应类型
- 业务模型类型

**package.json**:
```json
{
  "name": "@juanie/core-types",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./api": "./dist/api.js",
    "./models": "./dist/models.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch"
  },
  "dependencies": {
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "typescript": "^5.9.3"
  }
}
```

**内容示例**:
```typescript
// src/models.ts - 数据模型类型（与数据库 schema 对应）
export interface User {
  id: string
  email: string
  username: string | null
  displayName: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Organization {
  id: string
  name: string
  slug: string
  displayName: string | null
  quotas: OrganizationQuotas
  createdAt: Date
  updatedAt: Date
}

// src/api.ts - API 通用类型
export interface PaginationParams {
  page?: number
  limit?: number
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// src/dtos.ts - 数据传输对象（用于服务方法参数）
export interface CreateOrganizationInput {
  name: string
  slug: string
  displayName?: string
}

export interface UpdateOrganizationInput {
  name?: string
  slug?: string
  displayName?: string
}

export interface SuccessResponse {
  success: boolean
  message?: string
}
```

**类型使用规范**:
1. **服务层** - 使用 `@juanie/core-types` 的类型作为方法参数和返回值
2. **路由层** - 使用 Zod schemas 进行运行时验证
3. **不要** 在服务包中定义 dto/ 目录（类型集中管理）

#### packages/core/utils

**职责**:
- 共享的工具函数
- 加密、日期处理、验证等

**package.json**:
```json
{
  "name": "@juanie/core-utils",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run"
  },
  "dependencies": {
    "nanoid": "^5.0.9"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "@juanie/config-vitest": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^4.0.4"
  }
}
```

#### packages/core/observability

**职责**:
- 共享的可观测性工具
- `@Trace` 装饰器用于方法追踪
- OpenTelemetry 辅助函数

**关键文件**:
```typescript
// src/trace.decorator.ts
export function Trace(spanName?: string) {
  // 自动创建 OpenTelemetry span
  // 记录方法参数、执行时间、错误
}

export function withSpan<T>(name: string, fn: Function) {
  // 手动创建 span
}
```

**使用示例**:
```typescript
import { Trace } from '@juanie/core-observability'

@Injectable()
export class MyService {
  @Trace('my-service.create')
  async create(data: CreateInput) {
    // 自动追踪
  }
}
```

### 1.2 创建共享配置包

#### packages/config/typescript

**base.json**:
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "allowJs": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "exclude": ["node_modules", "dist"]
}
```

**node.json**:
```json
{
  "extends": "./base.json",
  "compilerOptions": {
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"]
  }
}
```

### 1.3 更新根配置

#### 更新 turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "stream",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**", ".next/**", "build/**"]
    },
    "build:packages": {
      "dependsOn": ["^build:packages"],
      "outputs": ["dist/**"],
      "cache": true
    },
    "dev": {
      "dependsOn": ["^build:packages"],
      "cache": false,
      "persistent": true
    },
    "type-check": {
      "dependsOn": ["^build:packages"],
      "inputs": ["$TURBO_DEFAULT$", "tsconfig*.json"],
      "outputs": ["**/*.tsbuildinfo"]
    },
    "test": {
      "dependsOn": ["^build:packages"],
      "inputs": ["$TURBO_DEFAULT$", "**/*.test.ts", "**/*.spec.ts"],
      "outputs": ["coverage/**"]
    },
    "lint": {
      "inputs": ["$TURBO_DEFAULT$", "biome.json"]
    }
  },
  "globalDependencies": [
    "**/.env*",
    "tsconfig.json",
    "biome.json",
    "bun.config.ts",
    "package.json"
  ],
  "globalEnv": ["NODE_ENV", "DATABASE_URL"]
}
```

## Phase 2: 短期改进（1-2月）

### 2.1 提取服务模块

#### 服务包结构模板（最佳实践）

以 `auth` 服务为例：

```
packages/services/auth/
├── src/
│   ├── auth.service.ts          # 业务逻辑（使用 @juanie/core-types 的类型）
│   ├── auth.module.ts           # NestJS 模块
│   └── index.ts                 # 导出服务和模块
├── test/
│   └── auth.service.spec.ts     # 单元测试
├── package.json
├── tsconfig.json                # 必须启用 experimentalDecorators
└── vitest.config.ts
```

**重要变更：**
- ❌ **不再包含** `auth.router.ts` - 路由在 API Gateway 中定义
- ❌ **不再包含** `dto/` 目录 - 类型定义在 `@juanie/core-types` 中
- ✅ **只包含** 纯业务逻辑（Service + Module）
- ✅ **使用** `@Trace` 装饰器（来自 `@juanie/core-observability`）
- ✅ **使用** 共享类型（来自 `@juanie/core-types`）

**package.json**:
```json
{
  "name": "@juanie/service-auth",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./service": "./dist/auth.service.js",
    "./module": "./dist/auth.module.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@juanie/core-database": "workspace:*",
    "@juanie/core-observability": "workspace:*",
    "@juanie/core-types": "workspace:*",
    "@juanie/core-utils": "workspace:*",
    "@nestjs/common": "^11.1.7",
    "drizzle-orm": "^0.44.7",
    "postgres": "^3.4.7"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "@juanie/config-vitest": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^4.0.4"
  }
}
```

**tsconfig.json** (必须启用装饰器):
```json
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

#### 服务间依赖规则

```
允许的依赖方向：
services/auth → core/*
services/organizations → core/*, services/auth
services/projects → core/*, services/organizations
services/pipelines → core/*, services/projects

禁止的依赖：
❌ core/* → services/*
❌ 循环依赖
```

### 2.2 创建 API Gateway

#### apps/api-gateway 结构

```
apps/api-gateway/
├── src/
│   ├── main.ts                  # 入口文件
│   ├── app.module.ts            # 根模块
│   ├── trpc/
│   │   ├── trpc.service.ts     # tRPC 配置
│   │   ├── trpc.router.ts      # 路由聚合
│   │   └── trpc.module.ts
│   ├── config/
│   │   └── configuration.ts
│   └── observability/           # 监控
│       ├── tracing.ts
│       └── metrics.ts
├── test/
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

**main.ts**:
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { initTracing } from './observability/tracing';

async function bootstrap() {
  // 初始化追踪
  initTracing();

  const app = await NestFactory.create(AppModule);
  
  // CORS
  app.enableCors();
  
  await app.listen(process.env.PORT || 3001);
  console.log(`🚀 API Gateway running on http://localhost:${process.env.PORT || 3001}`);
}

bootstrap();
```

**trpc/trpc.router.ts**:
```typescript
import { Injectable } from '@nestjs/common'
import { AuthRouter } from '../routers/auth.router'
import { OrganizationsRouter } from '../routers/organizations.router'
import { TrpcService } from './trpc.service'

@Injectable()
export class TrpcRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authRouter: AuthRouter,
    private readonly organizationsRouter: OrganizationsRouter,
    // ... 其他路由
  ) {}

  get appRouter() {
    return this.trpc.router({
      health: this.trpc.procedure.query(() => ({
        status: 'ok',
        timestamp: new Date().toISOString(),
      })),
      auth: this.authRouter.router,
      organizations: this.organizationsRouter.router,
      // ... 其他路由
    })
  }
}

export type AppRouter = TrpcRouter['appRouter']
```

**routers/auth.router.ts** (路由在 Gateway 中定义):
```typescript
import { Injectable } from '@nestjs/common'
import { AuthService } from '@juanie/service-auth'
import { TRPCError } from '@trpc/server'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class AuthRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly authService: AuthService,
  ) {}

  get router() {
    return this.trpc.router({
      githubAuthUrl: this.trpc.procedure.query(async () => {
        return await this.authService.getGitHubAuthUrl()
      }),

      githubCallback: this.trpc.procedure
        .input(z.object({ 
          code: z.string(), 
          state: z.string() 
        }))
        .mutation(async ({ input }) => {
          const user = await this.authService.handleGitHubCallback(
            input.code, 
            input.state
          )
          // ... 处理逻辑
        }),
    })
  }
}
```

**关键点**:
- ✅ 路由定义在 API Gateway 的 `routers/` 目录
- ✅ 注入服务包的 Service（不是 Router）
- ✅ Zod schemas 在路由层定义（灵活验证）
- ✅ 服务包只提供业务逻辑

**package.json**:
```json
{
  "name": "@juanie/api-gateway",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "bun --hot src/main.ts",
    "build": "bun build src/main.ts --outdir dist --target bun",
    "start": "bun run dist/main.js",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@juanie/service-auth": "workspace:*",
    "@juanie/service-organizations": "workspace:*",
    "@juanie/service-teams": "workspace:*",
    "@juanie/service-projects": "workspace:*",
    "@juanie/service-pipelines": "workspace:*",
    "@juanie/service-deployments": "workspace:*",
    "@nestjs/common": "^11.1.7",
    "@nestjs/core": "^11.1.7",
    "@nestjs/platform-fastify": "^11.1.7",
    "@trpc/server": "^11.7.0",
    "reflect-metadata": "^0.2.2"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "typescript": "^5.9.3"
  }
}
```

### 2.3 迁移策略

#### 渐进式迁移步骤

1. **保持双运行**
   - `apps/api` 继续运行（旧）
   - `apps/api-gateway` 新建（新）
   - 两者共存，逐步迁移流量

2. **按模块迁移**
   ```
   Week 1-2: auth, users
   Week 3-4: organizations, teams
   Week 5-6: projects, repositories
   Week 7-8: pipelines, deployments
   ```

3. **验证每个模块**
   - 单元测试通过
   - 集成测试通过
   - API 行为一致

4. **切换流量**
   - 使用环境变量控制
   - 逐步增加新 gateway 流量
   - 监控错误率

5. **清理旧代码**
   - 所有模块迁移完成后
   - 删除 `apps/api`
   - 重命名 `api-gateway` → `api`

### 2.4 类型安全保证

#### tRPC 类型导出

```typescript
// packages/services/auth/src/auth.router.ts
import { router, procedure } from '@juanie/core-trpc';
import { z } from 'zod';

export const authRouter = router({
  login: procedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
    }))
    .mutation(async ({ input }) => {
      // 实现
    }),
});

export type AuthRouter = typeof authRouter;
```

#### 前端类型使用

```typescript
// apps/web/src/api/client.ts
import type { AppRouter } from '@juanie/api-gateway';
import { createTRPCProxyClient } from '@trpc/client';

export const trpc = createTRPCProxyClient<AppRouter>({
  // 配置
});

// 完全类型安全
const result = await trpc.auth.login.mutate({
  email: 'user@example.com',
  password: 'password123',
});
```

## 数据流

### 请求流程

```
前端 (apps/web)
  ↓ tRPC 调用
API Gateway (apps/api-gateway)
  ↓ 路由到对应服务
Service Package (packages/services/*)
  ↓ 调用数据库
Core Database (packages/core/database)
  ↓ 返回数据
Service Package
  ↓ 返回响应
API Gateway
  ↓ 返回给前端
前端
```

### 依赖关系图

```
apps/api-gateway
  ├─→ packages/services/auth
  │     ├─→ packages/core/database
  │     ├─→ packages/core/types
  │     └─→ packages/core/utils
  ├─→ packages/services/organizations
  │     ├─→ packages/core/database
  │     ├─→ packages/core/types
  │     └─→ packages/services/auth
  └─→ packages/services/projects
        ├─→ packages/core/database
        ├─→ packages/core/types
        └─→ packages/services/organizations

apps/web
  └─→ apps/api-gateway (类型导入)
```

## 构建和部署

### 本地开发

```bash
# 安装依赖
bun install

# 构建所有包
turbo build

# 开发模式（自动构建依赖）
turbo dev --filter=@juanie/api-gateway

# 运行测试
turbo test
```

### CI/CD 优化

```yaml
# .github/workflows/ci.yml
- name: Build
  run: turbo build --filter=[HEAD^1] --cache-dir=.turbo

- name: Test
  run: turbo test --filter=[HEAD^1] --cache-dir=.turbo
```

只构建和测试变更的包，利用 Turborepo 缓存。

## 性能优化

### 构建性能

- **Before**: 全量构建 ~60s
- **After**: 增量构建 ~15s（75% 提升）

### 测试性能

- **Before**: 串行测试 ~120s
- **After**: 并行测试 ~30s（75% 提升）

### 开发体验

- **Before**: 修改任何文件都需要重启整个应用
- **After**: 只重新构建变更的包，热重载更快

## 风险和缓解

### 风险 1: 循环依赖

**缓解**: 
- 使用 `madge` 工具检测循环依赖
- CI 中添加检查
- 明确的依赖规则

### 风险 2: 类型不匹配

**缓解**:
- 所有包都使用 TypeScript strict mode
- tRPC 提供端到端类型安全
- 集成测试覆盖

### 风险 3: 构建顺序问题

**缓解**:
- Turborepo 自动处理依赖顺序
- 明确的 `dependsOn` 配置

### 风险 4: 迁移过程中的 Bug

**缓解**:
- 渐进式迁移，保持旧代码运行
- 每个模块迁移后充分测试
- 可以快速回滚

## 架构最佳实践（实践中总结）

### 1. 服务包设计原则

**✅ 应该包含：**
- Service 类（业务逻辑）
- Module 类（NestJS 模块）
- 使用 `@juanie/core-types` 的类型
- 使用 `@Trace` 装饰器追踪关键方法

**❌ 不应该包含：**
- Router 类（路由在 Gateway 中定义）
- dto/ 目录（类型集中在 core-types）
- Zod schemas（验证在路由层）

### 2. 类型架构

```
@juanie/core-types (TypeScript 类型)
         ↓
服务包 Service (使用类型)
         ↓
API Gateway Router (Zod 验证 + 调用 Service)
         ↓
前端 (tRPC 类型推导)
```

**示例：**
```typescript
// 1. 定义类型
// packages/core/types/src/dtos.ts
export interface CreateOrganizationInput {
  name: string
  slug: string
}

// 2. 服务使用类型
// packages/services/organizations/src/organizations.service.ts
async create(userId: string, data: CreateOrganizationInput) {
  // 实现
}

// 3. 路由验证 + 调用
// apps/api-gateway/src/routers/organizations.router.ts
create: this.trpc.protectedProcedure
  .input(z.object({
    name: z.string().min(1).max(100),
    slug: z.string().regex(/^[a-z0-9-]+$/),
  }))
  .mutation(async ({ ctx, input }) => {
    return await this.organizationsService.create(ctx.user.id, input)
  })
```

### 3. 可观测性

**使用 `@Trace` 装饰器：**
```typescript
import { Trace } from '@juanie/core-observability'

@Injectable()
export class OrganizationsService {
  @Trace('organizations.create')
  async create(userId: string, data: CreateOrganizationInput) {
    // 自动追踪：方法参数、执行时间、错误
  }
}
```

**追踪层级：**
- HTTP 请求（自动 - OpenTelemetry）
- tRPC Procedure（自动 - OpenTelemetry）
- Service 方法（手动 - @Trace 装饰器）
- 数据库查询（自动 - OpenTelemetry）

### 4. 依赖注入

**服务包导出注入令牌：**
```typescript
// packages/services/auth/src/auth.service.ts
export const DATABASE = Symbol('DATABASE')
export const REDIS = Symbol('REDIS')

@Injectable()
export class AuthService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private redis: Redis,
  ) {}
}
```

**Gateway 提供全局依赖：**
```typescript
// apps/api-gateway/src/database/database.module.ts
@Global()
@Module({
  providers: [
    { provide: DATABASE, useFactory: ... },
    { provide: REDIS, useFactory: ... },
  ],
  exports: [DATABASE, REDIS],
})
export class DatabaseModule {}
```

### 5. TypeScript 配置

**服务包必须启用装饰器：**
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

## 成功指标

- ✅ 所有核心包创建完成
- ✅ 至少 3 个服务模块成功提取
- ✅ API Gateway 可以正常运行
- ✅ 所有现有测试通过
- ✅ 构建时间减少 50%+
- ✅ 测试时间减少 50%+
- ✅ 前端代码无需修改
- ✅ API 行为完全一致
- ✅ 完整的可观测性（追踪、指标）
- ✅ 类型安全的端到端链路

## 下一步

Phase 1 完成后 → Phase 2
Phase 2 完成后 → 考虑长期改进（微服务）
