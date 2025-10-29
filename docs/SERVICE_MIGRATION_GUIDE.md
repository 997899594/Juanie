# 服务迁移快速指南

本指南总结了从单体 API 迁移服务到独立包的最佳实践。

## 📦 服务包结构

```
packages/services/{service-name}/
├── src/
│   ├── {service-name}.service.ts    # 业务逻辑
│   ├── {service-name}.module.ts     # NestJS 模块
│   └── index.ts                     # 导出
├── test/
│   └── {service-name}.service.spec.ts
├── package.json
├── tsconfig.json                    # 必须启用 experimentalDecorators
└── vitest.config.ts
```

## ✅ 迁移检查清单

### 1. 创建服务包

```bash
mkdir -p packages/services/{service-name}/src
mkdir -p packages/services/{service-name}/test
```

### 2. 创建 package.json

```json
{
  "name": "@juanie/service-{service-name}",
  "dependencies": {
    "@juanie/core-database": "workspace:*",
    "@juanie/core-observability": "workspace:*",
    "@juanie/core-types": "workspace:*",
    "@juanie/core-utils": "workspace:*",
    "@nestjs/common": "^11.1.7",
    "drizzle-orm": "^0.44.7"
  }
}
```

### 3. 创建 tsconfig.json（重要！）

**⚠️ 注意**：服务包不要使用 `composite: true` 或 `incremental: true`，这会导致声明文件生成不完整！

```json
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 4. 迁移 Service

```typescript
import * as schema from '@juanie/core-database/schemas'
import { Trace } from '@juanie/core-observability'
import type { CreateInput, UpdateInput } from '@juanie/core-types'
import { Inject, Injectable } from '@nestjs/common'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'

export const DATABASE = Symbol('DATABASE')

@Injectable()
export class MyService {
  constructor(@Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>) {}

  @Trace('my-service.create')
  async create(userId: string, data: CreateInput) {
    // 业务逻辑
  }
}
```

**关键点：**
- ✅ 使用 `@juanie/core-types` 的类型
- ✅ 添加 `@Trace` 装饰器到关键方法
- ✅ 导出 `DATABASE` 等注入令牌
- ❌ 不要包含路由逻辑
- ❌ 不要定义内联类型

### 5. 创建 Module

```typescript
import { Module } from '@nestjs/common'
import { MyService } from './my.service'

@Module({
  providers: [MyService],
  exports: [MyService],
})
export class MyModule {}
```

### 6. 创建 index.ts

```typescript
export { MyService, DATABASE } from './my.service'
export { MyModule } from './my.module'
```

### 7. 在 API Gateway 创建路由

```typescript
// apps/api-gateway/src/routers/my.router.ts
import { Injectable } from '@nestjs/common'
import { MyService } from '@juanie/service-my'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'

@Injectable()
export class MyRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly myService: MyService,
  ) {}

  get router() {
    return this.trpc.router({
      create: this.trpc.protectedProcedure
        .input(z.object({
          name: z.string().min(1).max(100),
          // Zod 验证
        }))
        .mutation(async ({ ctx, input }) => {
          return await this.myService.create(ctx.user.id, input)
        }),
    })
  }
}
```

### 8. 集成到 TrpcModule

```typescript
// apps/api-gateway/src/trpc/trpc.module.ts
import { MyModule } from '@juanie/service-my'
import { MyRouter } from '../routers/my.router'

@Module({
  imports: [MyModule],
  providers: [TrpcService, TrpcRouter, MyRouter],
  exports: [TrpcService, TrpcRouter],
})
export class TrpcModule {}
```

### 9. 添加到 TrpcRouter

```typescript
// apps/api-gateway/src/trpc/trpc.router.ts
export class TrpcRouter {
  constructor(
    private readonly myRouter: MyRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      my: this.myRouter.router,
    })
  }
}
```

## 🎯 类型定义规范

### 在 core-types 中定义

```typescript
// packages/core/types/src/dtos.ts
export interface CreateMyInput {
  name: string
  description?: string
}

export interface UpdateMyInput {
  name?: string
  description?: string
}
```

### 在服务中使用

```typescript
import type { CreateMyInput } from '@juanie/core-types'

async create(userId: string, data: CreateMyInput) {
  // 实现
}
```

### 在路由中验证

```typescript
.input(z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
}))
```

## ⚠️ 常见错误

### ❌ 错误 1：在服务包中定义路由

```typescript
// ❌ 不要这样做
export class MyRouter {
  get router() {
    return this.trpc.router({ ... })
  }
}
```

**正确做法：** 路由在 API Gateway 中定义

### ❌ 错误 2：使用内联类型

```typescript
// ❌ 不要这样做
async create(data: { name: string; slug: string }) {
  // ...
}
```

**正确做法：** 使用 `@juanie/core-types`

```typescript
// ✅ 这样做
async create(data: CreateMyInput) {
  // ...
}
```

### ❌ 错误 3：忘记启用装饰器

```
错误：修饰器在此处无效
```

**解决：** 在 tsconfig.json 中添加：
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### ❌ 错误 4：在服务包中创建 dto/ 目录

**正确做法：** 所有类型定义在 `@juanie/core-types` 中

## 🚀 构建和测试

```bash
# 构建服务包
cd packages/services/{service-name}
bun install
bun run build

# 测试
bun run test

# 类型检查
bun run type-check
```

## 📊 验证迁移成功

- [ ] 服务包构建成功
- [ ] 类型检查通过
- [ ] API Gateway 启动成功
- [ ] 所有端点正常工作
- [ ] 前端调用方式不变
- [ ] OpenTelemetry 追踪正常
- [ ] 测试通过

## 🎉 完成！

现在你的服务已经成功迁移到独立包，享受模块化带来的好处吧！
