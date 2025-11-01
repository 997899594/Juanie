# 后端开发指南

## 概述

本项目采用模块化的 Monorepo 架构，使用 NestJS + tRPC 构建后端服务。所有服务都是独立的 npm 包，通过统一的 API Gateway 对外提供服务。

## 架构概览

```
apps/
  └── api-gateway/          # API 网关（NestJS + tRPC）
packages/
  ├── core/                 # 核心包
  │   ├── database/         # 数据库 Schema（Drizzle ORM）
  │   ├── types/            # 公共类型定义（Zod + TypeScript）
  │   ├── tokens/           # 依赖注入 Token
  │   ├── queue/            # 消息队列（BullMQ）
  │   ├── observability/    # 可观测性（日志、追踪）
  │   └── utils/            # 工具函数
  └── services/             # 业务服务
      ├── ai-assistants/    # AI 助手服务
      ├── audit-logs/       # 审计日志服务
      ├── auth/             # 认证服务
      ├── cost-tracking/    # 成本追踪服务
      ├── deployments/      # 部署服务
      ├── environments/     # 环境管理服务
      ├── notifications/    # 通知服务
      ├── organizations/    # 组织管理服务
      ├── pipelines/        # Pipeline 服务
      ├── projects/         # 项目管理服务
      ├── repositories/     # 仓库管理服务
      ├── teams/            # 团队管理服务
      ├── templates/        # 模板服务
      └── users/            # 用户服务
```

## 核心概念

### 1. 类型系统

所有类型定义集中在 `@juanie/core-types` 包中：

```typescript
// packages/core/types/src/schemas.ts

// 1. 定义 Zod Schema（用于验证）
export const createProjectSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private', 'internal']).default('private'),
  logoUrl: z.string().url().optional(),
})

// 2. 从 Schema 推导 TypeScript 类型
export type CreateProjectInput = z.infer<typeof createProjectSchema>
```

**优势：**
- 单一数据源：类型和验证规则来自同一个 schema
- 类型安全：编译时捕获类型错误
- 运行时验证：使用 Zod 进行输入验证
- 易于维护：修改 schema 自动更新所有相关类型

### 2. 服务层

每个服务都是独立的 NestJS 模块：

```typescript
// packages/services/projects/src/projects.service.ts
import type { CreateProjectInput } from '@juanie/core-types'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  async create(userId: string, data: CreateProjectInput) {
    // 业务逻辑
    return await this.db.insert(schema.projects).values(data).returning()
  }
}
```

**最佳实践：**
- 使用依赖注入
- 使用公共类型（从 `@juanie/core-types` 导入）
- 添加 `@Trace` 装饰器用于追踪
- 实现完整的错误处理

### 3. API 路由

使用 tRPC 定义 API 路由：

```typescript
// apps/api-gateway/src/routers/projects.router.ts
import { createProjectSchema } from '@juanie/core-types'

@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projectsService: ProjectsService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.projectsService.create(ctx.user.id, input)
        }),
    })
  }
}
```

**最佳实践：**
- 使用公共 schema 进行输入验证
- 使用 `protectedProcedure` 保护需要认证的接口
- 使用 getter 模式定义 router（`get router()`）
- 实现完整的错误处理

## 开发流程

### 1. 创建新服务

```bash
# 1. 创建服务目录
mkdir -p packages/services/my-service/src

# 2. 创建 package.json
cat > packages/services/my-service/package.json << 'EOF'
{
  "name": "@juanie/service-my-service",
  "version": "0.0.1",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@juanie/core-database": "workspace:*",
    "@juanie/core-tokens": "workspace:*",
    "@juanie/core-types": "workspace:*",
    "@nestjs/common": "^10.0.0",
    "drizzle-orm": "^0.36.4"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "typescript": "^5.7.2"
  }
}
EOF

# 3. 创建 tsconfig.json
cat > packages/services/my-service/tsconfig.json << 'EOF'
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF

# 4. 创建服务文件
cat > packages/services/my-service/src/my-service.service.ts << 'EOF'
import { Injectable } from '@nestjs/common'
import { Inject } from '@nestjs/common'
import { DATABASE } from '@juanie/core-tokens'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '@juanie/core-database/schemas'

@Injectable()
export class MyService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  async list() {
    // 实现业务逻辑
    return []
  }
}
EOF

# 5. 创建导出文件
cat > packages/services/my-service/src/index.ts << 'EOF'
export * from './my-service.service'
EOF

# 6. 安装依赖
bun install
```

### 2. 添加类型定义

在 `packages/core/types/src/schemas.ts` 中添加：

```typescript
// 1. 定义 Schema
export const createMyResourceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
})

export const updateMyResourceSchema = z.object({
  id: uuidSchema,
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
})

// 2. 导出类型
export type CreateMyResourceInput = z.infer<typeof createMyResourceSchema>
export type UpdateMyResourceInput = Omit<z.infer<typeof updateMyResourceSchema>, 'id'>
```

### 3. 创建路由

在 `apps/api-gateway/src/routers/` 中创建路由文件：

```typescript
// apps/api-gateway/src/routers/my-resource.router.ts
import { Injectable } from '@nestjs/common'
import { createMyResourceSchema, updateMyResourceSchema } from '@juanie/core-types'
import { MyService } from '@juanie/service-my-service'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class MyResourceRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly myService: MyService,
  ) {}

  get router() {
    return this.trpc.router({
      list: this.trpc.protectedProcedure.query(async ({ ctx }) => {
        return await this.myService.list()
      }),

      create: this.trpc.protectedProcedure
        .input(createMyResourceSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.myService.create(ctx.user.id, input)
        }),

      update: this.trpc.protectedProcedure
        .input(updateMyResourceSchema)
        .mutation(async ({ ctx, input }) => {
          const { id, ...data } = input
          return await this.myService.update(ctx.user.id, id, data)
        }),
    })
  }
}
```

### 4. 注册路由

在 `apps/api-gateway/src/trpc/trpc.router.ts` 中注册：

```typescript
import { MyResourceRouter } from '../routers/my-resource.router'

@Injectable()
export class TrpcRouter {
  constructor(
    // ... 其他路由
    private readonly myResourceRouter: MyResourceRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      // ... 其他路由
      myResource: this.myResourceRouter.router,
    })
  }
}
```

在 `apps/api-gateway/src/app.module.ts` 中注册模块：

```typescript
import { MyService } from '@juanie/service-my-service'
import { MyResourceRouter } from './routers/my-resource.router'

@Module({
  providers: [
    // ... 其他服务
    MyService,
    MyResourceRouter,
  ],
})
export class AppModule {}
```

## 测试

### 运行类型检查

```bash
# 检查所有包
bun run type-check

# 检查特定包
cd packages/services/my-service && bun run type-check
```

### 运行单元测试

```bash
# 运行所有测试
bun test

# 运行特定服务的测试
cd packages/services/my-service && bun test
```

## 常见问题

### 1. 类型错误：找不到类型

**问题：** `Cannot find module '@juanie/core-types'`

**解决：**
```bash
# 1. 确保依赖已安装
bun install

# 2. 构建类型包
cd packages/core/types && bun run build

# 3. 重新运行类型检查
bun run type-check
```

### 2. tRPC 类型推断错误

**问题：** `The inferred type of 'router' cannot be named`

**解决：** 在 `tsconfig.json` 中禁用声明文件生成：
```json
{
  "compilerOptions": {
    "declaration": false,
    "declarationMap": false
  }
}
```

### 3. 服务注入失败

**问题：** `Nest can't resolve dependencies`

**解决：**
1. 确保服务已在模块中注册
2. 确保使用了正确的 Token（如 `DATABASE`）
3. 检查依赖注入顺序

## 代码规范

### 1. 命名规范

- **文件名**：kebab-case（`my-service.service.ts`）
- **类名**：PascalCase（`MyService`）
- **变量/函数**：camelCase（`myFunction`）
- **常量**：UPPER_SNAKE_CASE（`DATABASE_URL`）
- **类型**：PascalCase（`CreateProjectInput`）

### 2. 导入顺序

```typescript
// 1. Node.js 内置模块
import { readFile } from 'fs/promises'

// 2. 第三方库
import { Injectable } from '@nestjs/common'
import { z } from 'zod'

// 3. 内部包
import { DATABASE } from '@juanie/core-tokens'
import type { CreateProjectInput } from '@juanie/core-types'

// 4. 相对导入
import { TrpcService } from '../trpc/trpc.service'
```

### 3. 错误处理

```typescript
// ✅ 正确：抛出有意义的错误
if (!project) {
  throw new Error('项目不存在')
}

// ✅ 正确：使用 tRPC 错误
throw new TRPCError({
  code: 'NOT_FOUND',
  message: '项目不存在',
})

// ❌ 错误：不处理错误
const project = await this.db.select()...
return project[0] // 可能为 undefined
```

## 性能优化

### 1. 数据库查询

```typescript
// ✅ 正确：只查询需要的字段
const projects = await this.db
  .select({
    id: schema.projects.id,
    name: schema.projects.name,
  })
  .from(schema.projects)

// ❌ 错误：查询所有字段
const projects = await this.db.select().from(schema.projects)
```

### 2. 缓存

```typescript
// 使用 Redis 缓存
const cached = await this.redis.get(`project:${id}`)
if (cached) {
  return JSON.parse(cached)
}

const project = await this.db.select()...
await this.redis.set(`project:${id}`, JSON.stringify(project), 'EX', 3600)
return project
```

### 3. 批量操作

```typescript
// ✅ 正确：批量插入
await this.db.insert(schema.projects).values(projects)

// ❌ 错误：循环插入
for (const project of projects) {
  await this.db.insert(schema.projects).values(project)
}
```

## 部署

### 开发环境

```bash
# 启动所有服务
docker-compose up -d

# 启动 API Gateway
cd apps/api-gateway && bun run dev
```

### 生产环境

```bash
# 构建所有包
bun run build

# 启动生产服务
docker-compose -f docker-compose.prod.yml up -d
```

## 相关文档

- [项目结构](../PROJECT_STRUCTURE.md)
- [架构分析](../ARCHITECTURE_ANALYSIS.md)
- [类型系统](../TYPE_ARCHITECTURE_FINAL.md)
- [部署指南](./DEPLOYMENT.md)
- [监控指南](./MONITORING.md)
