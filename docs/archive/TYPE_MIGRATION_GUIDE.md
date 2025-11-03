# 类型迁移指南

本文档指导如何将现有代码迁移到使用 `@juanie/core-types` 中的共享类型和 schemas。

## 📋 目录

- [为什么要迁移](#为什么要迁移)
- [迁移步骤](#迁移步骤)
- [迁移示例](#迁移示例)
- [常见问题](#常见问题)

## 为什么要迁移

### 当前问题

1. **类型重复定义**: 每个路由都定义自己的 Zod schemas
2. **维护困难**: 修改类型需要在多个地方更新
3. **不一致性**: 不同地方的类型定义可能不一致
4. **代码冗余**: 大量重复的 schema 定义代码

### 迁移后的好处

1. ✅ **类型一致性**: 所有地方使用相同的类型定义
2. ✅ **减少重复**: 不需要在每个文件中重复定义
3. ✅ **易于维护**: 修改一处，所有地方生效
4. ✅ **更好的 IDE 支持**: 统一的类型定义提供更好的自动完成
5. ✅ **文档化**: 集中的类型定义作为 API 文档

## 迁移步骤

### 步骤 1: 安装依赖

确保 `@juanie/core-types` 已添加到依赖中：

```json
{
  "dependencies": {
    "@juanie/core-types": "workspace:*"
  }
}
```

### 步骤 2: 构建类型包

```bash
bun run build:packages
```

### 步骤 3: 更新导入

将内联的 schema 定义替换为从 `@juanie/core-types` 导入。

### 步骤 4: 验证

运行类型检查和测试：

```bash
bun run type-check
bun run test
```

## 迁移示例

### 示例 1: Organizations Router

#### 迁移前 ❌

```typescript
// apps/api-gateway/src/routers/organizations.router.ts
import { Injectable } from '@nestjs/common'
import { z } from 'zod'
import { TrpcService } from '../trpc/trpc.service'
import { OrganizationsService } from '@juanie/service-organizations'

@Injectable()
export class OrganizationsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  get router() {
    return this.trpc.router({
      // ❌ 内联 schema 定义
      create: this.trpc.protectedProcedure
        .input(
          z.object({
            name: z.string().min(1).max(100),
            slug: z
              .string()
              .min(3)
              .max(50)
              .regex(/^[a-z0-9-]+$/),
            displayName: z.string().max(500).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.organizationsService.create(ctx.user.id, input)
        }),

      // ❌ 内联 schema 定义
      get: this.trpc.protectedProcedure
        .input(z.object({ orgId: z.string() }))
        .query(async ({ ctx, input }) => {
          return await this.organizationsService.get(input.orgId, ctx.user.id)
        }),

      // ❌ 内联 schema 定义
      update: this.trpc.protectedProcedure
        .input(
          z.object({
            orgId: z.string(),
            name: z.string().min(1).max(100).optional(),
            slug: z
              .string()
              .min(3)
              .max(50)
              .regex(/^[a-z0-9-]+$/)
              .optional(),
            displayName: z.string().max(500).optional(),
          }),
        )
        .mutation(async ({ ctx, input }) => {
          return await this.organizationsService.update(input.orgId, ctx.user.id, input)
        }),
    })
  }
}
```

#### 迁移后 ✅

```typescript
// apps/api-gateway/src/routers/organizations.router.ts
import { Injectable } from '@nestjs/common'
import { TrpcService } from '../trpc/trpc.service'
import { OrganizationsService } from '@juanie/service-organizations'
// ✅ 导入共享 schemas
import {
  createOrganizationSchema,
  organizationIdSchema,
  updateOrganizationSchema,
} from '@juanie/core-types'

@Injectable()
export class OrganizationsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  get router() {
    return this.trpc.router({
      // ✅ 使用共享 schema
      create: this.trpc.protectedProcedure
        .input(createOrganizationSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.organizationsService.create(ctx.user.id, input)
        }),

      // ✅ 使用共享 schema
      get: this.trpc.protectedProcedure
        .input(organizationIdSchema)
        .query(async ({ ctx, input }) => {
          return await this.organizationsService.get(input.orgId, ctx.user.id)
        }),

      // ✅ 使用共享 schema
      update: this.trpc.protectedProcedure
        .input(updateOrganizationSchema)
        .mutation(async ({ ctx, input }) => {
          return await this.organizationsService.update(input.orgId, ctx.user.id, input)
        }),
    })
  }
}
```

**改进点**:
- 代码行数减少 ~40%
- 不再需要导入 `z` from `zod`
- Schema 定义集中管理
- 类型自动推导

### 示例 2: Projects Router

#### 迁移前 ❌

```typescript
// apps/api-gateway/src/routers/projects.router.ts
create: this.trpc.protectedProcedure
  .input(
    z.object({
      organizationId: z.string(),
      name: z.string().min(1).max(100),
      slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
      description: z.string().max(1000).optional(),
      visibility: z.enum(['public', 'private', 'internal']).default('private'),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // ...
  }),

addMember: this.trpc.protectedProcedure
  .input(
    z.object({
      projectId: z.string(),
      memberId: z.string(),
      role: z.enum(['owner', 'maintainer', 'developer', 'viewer']),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    // ...
  }),
```

#### 迁移后 ✅

```typescript
// apps/api-gateway/src/routers/projects.router.ts
import {
  createProjectSchema,
  addProjectMemberSchema,
} from '@juanie/core-types'

create: this.trpc.protectedProcedure
  .input(createProjectSchema)
  .mutation(async ({ ctx, input }) => {
    // ...
  }),

addMember: this.trpc.protectedProcedure
  .input(addProjectMemberSchema)
  .mutation(async ({ ctx, input }) => {
    // ...
  }),
```

### 示例 3: Services

#### 迁移前 ❌

```typescript
// packages/services/organizations/src/organizations.service.ts
@Injectable()
export class OrganizationsService {
  // ❌ 使用 any 或自定义接口
  async create(userId: string, data: any) {
    // ...
  }

  async update(orgId: string, userId: string, data: any) {
    // ...
  }
}
```

#### 迁移后 ✅

```typescript
// packages/services/organizations/src/organizations.service.ts
import {
  CreateOrganizationInput,
  UpdateOrganizationInput,
  Organization,
} from '@juanie/core-types'

@Injectable()
export class OrganizationsService {
  // ✅ 使用共享类型
  async create(userId: string, data: CreateOrganizationInput): Promise<Organization> {
    // ...
  }

  async update(
    orgId: string,
    userId: string,
    data: UpdateOrganizationInput,
  ): Promise<Organization> {
    // ...
  }
}
```

### 示例 4: Templates Service

#### 迁移前 ❌

```typescript
// packages/services/templates/src/templates.service.ts
// ❌ 在服务中定义类型
export interface DockerfileConfig {
  runtime: 'nodejs' | 'python' | 'bun'
  version: string
  packageManager?: 'npm' | 'yarn' | 'pnpm' | 'bun' | 'pip' | 'poetry'
  // ...
}

export interface CICDConfig {
  platform: 'github' | 'gitlab'
  runtime: 'nodejs' | 'python' | 'bun'
  // ...
}

@Injectable()
export class TemplatesService {
  async generateDockerfile(config: DockerfileConfig): Promise<string> {
    // ...
  }

  async generateCICD(config: CICDConfig): Promise<string> {
    // ...
  }
}
```

#### 迁移后 ✅

```typescript
// packages/services/templates/src/templates.service.ts
import { z } from 'zod'
import { dockerfileConfigSchema, cicdConfigSchema } from '@juanie/core-types'

// ✅ 使用 Zod 推导类型
type DockerfileConfig = z.infer<typeof dockerfileConfigSchema>
type CICDConfig = z.infer<typeof cicdConfigSchema>

@Injectable()
export class TemplatesService {
  async generateDockerfile(config: DockerfileConfig): Promise<string> {
    // ✅ 可以在运行时验证
    const validated = dockerfileConfigSchema.parse(config)
    // ...
  }

  async generateCICD(config: CICDConfig): Promise<string> {
    // ✅ 可以在运行时验证
    const validated = cicdConfigSchema.parse(config)
    // ...
  }
}
```

## 迁移检查清单

### 路由迁移

- [ ] 移除内联的 `z.object()` 定义
- [ ] 导入对应的 schema from `@juanie/core-types`
- [ ] 更新 `.input()` 调用使用共享 schema
- [ ] 移除不再需要的 `z` 导入
- [ ] 运行类型检查验证

### 服务迁移

- [ ] 将方法参数类型改为使用共享 DTO 类型
- [ ] 将返回类型改为使用共享模型类型
- [ ] 移除服务中自定义的接口定义
- [ ] 运行类型检查验证

### 测试迁移

- [ ] 更新测试中的类型导入
- [ ] 使用共享的工厂函数（如果有）
- [ ] 运行测试验证

## 常见问题

### Q: 如果 `@juanie/core-types` 中没有我需要的类型怎么办？

A: 应该将新类型添加到 `@juanie/core-types` 中：

1. 在相应的文件中添加类型定义
2. 如果是 Zod schema，添加到 `schemas.ts`
3. 如果是 DTO，添加到 `dtos.ts`
4. 如果是模型，添加到 `models.ts`
5. 重新构建类型包: `bun run build:packages`

### Q: 类型不匹配怎么办？

A: 检查以下几点：

1. 确保 `@juanie/core-types` 已构建
2. 重启 TypeScript 服务器
3. 检查导入路径是否正确
4. 确认使用的是最新版本的类型包

### Q: 如何处理特殊的验证逻辑？

A: 可以扩展共享 schema：

```typescript
import { createProjectSchema } from '@juanie/core-types'

// 扩展 schema 添加自定义验证
const extendedSchema = createProjectSchema.extend({
  customField: z.string().optional(),
})

// 或者使用 refine 添加自定义验证
const refinedSchema = createProjectSchema.refine(
  (data) => {
    // 自定义验证逻辑
    return true
  },
  {
    message: '自定义错误信息',
  },
)
```

### Q: 迁移会破坏现有功能吗？

A: 不会，因为：

1. 类型定义保持一致
2. 只是将定义位置从内联改为导入
3. 运行时行为完全相同
4. 可以通过测试验证

### Q: 需要一次性迁移所有文件吗？

A: 不需要，可以逐步迁移：

1. 先迁移新的代码
2. 逐步迁移现有代码
3. 优先迁移经常修改的文件
4. 最后迁移稳定的文件

## 迁移优先级

### 高优先级（建议立即迁移）

1. **新创建的路由和服务** - 直接使用共享类型
2. **经常修改的代码** - 减少未来的维护成本
3. **核心业务逻辑** - 确保类型一致性

### 中优先级（逐步迁移）

1. **现有的路由** - 提高代码质量
2. **服务层** - 统一类型定义
3. **测试代码** - 提高测试可维护性

### 低优先级（可选）

1. **稳定的旧代码** - 如果不经常修改可以暂缓
2. **即将废弃的功能** - 不值得花时间迁移

## 自动化迁移工具

可以使用以下脚本辅助迁移（示例）：

```bash
#!/bin/bash
# migrate-types.sh

# 查找所有使用内联 schema 的文件
find apps/api-gateway/src/routers -name "*.ts" -exec grep -l "z.object" {} \;

# 提示需要手动迁移
echo "以上文件需要迁移到使用共享 schemas"
```

## 验证迁移

迁移完成后，运行以下命令验证：

```bash
# 1. 类型检查
bun run type-check

# 2. 运行测试
bun run test

# 3. 构建应用
bun run build

# 4. 启动开发服务器
bun run dev
```

## 获取帮助

如果在迁移过程中遇到问题：

1. 查看 `packages/core/types/README.md`
2. 查看迁移示例
3. 在团队中寻求帮助
4. 提交 Issue

---

**最后更新**: 2024-10-31
