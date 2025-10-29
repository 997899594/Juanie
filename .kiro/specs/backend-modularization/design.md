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
    "./client": "./dist/client.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "drizzle-orm": "^0.44.7",
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
│   └── index.ts                   # 主入口
├── package.json
└── tsconfig.json
```

**迁移步骤**:
1. 复制 `apps/api/src/database/schemas/` → `packages/core/database/src/schemas/`
2. 复制 `apps/api/src/database/database.module.ts` → `packages/core/database/src/client.ts`
3. 创建 package.json 和 tsconfig.json
4. 构建包：`bun run build`
5. 更新 `apps/api` 的导入路径

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
// src/models.ts
export interface User {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
}

// src/api.ts
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
```

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

#### 服务包结构模板

以 `auth` 服务为例：

```
packages/services/auth/
├── src/
│   ├── auth.service.ts          # 业务逻辑
│   ├── auth.router.ts           # tRPC 路由
│   ├── auth.module.ts           # NestJS 模块
│   ├── dto/                     # 数据传输对象
│   │   ├── login.dto.ts
│   │   └── register.dto.ts
│   └── index.ts                 # 导出
├── test/
│   ├── auth.service.spec.ts
│   └── auth.router.spec.ts
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

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
    "./router": "./dist/auth.router.js",
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
    "@juanie/core-types": "workspace:*",
    "@juanie/core-utils": "workspace:*",
    "@nestjs/common": "^11.1.7",
    "@trpc/server": "^11.7.0",
    "arctic": "^3.7.0",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "@juanie/config-vitest": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^4.0.4"
  }
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
import { router } from './trpc.service';
import { authRouter } from '@juanie/service-auth/router';
import { organizationsRouter } from '@juanie/service-organizations/router';
import { teamsRouter } from '@juanie/service-teams/router';
import { projectsRouter } from '@juanie/service-projects/router';
import { pipelinesRouter } from '@juanie/service-pipelines/router';
import { deploymentsRouter } from '@juanie/service-deployments/router';
// ... 其他服务

export const appRouter = router({
  health: procedure.query(() => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })),
  auth: authRouter,
  organizations: organizationsRouter,
  teams: teamsRouter,
  projects: projectsRouter,
  pipelines: pipelinesRouter,
  deployments: deploymentsRouter,
  // ... 其他路由
});

export type AppRouter = typeof appRouter;
```

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

## 成功指标

- ✅ 所有核心包创建完成
- ✅ 至少 3 个服务模块成功提取
- ✅ API Gateway 可以正常运行
- ✅ 所有现有测试通过
- ✅ 构建时间减少 50%+
- ✅ 测试时间减少 50%+
- ✅ 前端代码无需修改
- ✅ API 行为完全一致

## 下一步

Phase 1 完成后 → Phase 2
Phase 2 完成后 → 考虑长期改进（微服务）
