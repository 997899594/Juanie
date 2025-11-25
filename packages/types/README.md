# @juanie/core-types

共享类型定义包，提供整个应用的类型安全。

## 📦 包含内容

### 1. API 类型 (`api.ts`)

通用的 API 相关类型定义：

```typescript
import { PaginationParams, PaginatedResponse, ApiResponse } from '@juanie/core-types'

// 分页参数
const params: PaginationParams = {
  page: 1,
  limit: 20,
}

// 分页响应
const response: PaginatedResponse<User> = {
  data: users,
  total: 100,
  page: 1,
  limit: 20,
  totalPages: 5,
}
```

### 2. 数据模型 (`models.ts`)

与数据库 schema 对应的类型定义：

```typescript
import { User, Organization, Project } from '@juanie/core-types'

const user: User = {
  id: '123',
  email: 'user@example.com',
  username: 'johndoe',
  // ...
}
```

### 3. DTO 类型 (`dtos.ts`)

服务方法的输入输出类型：

```typescript
import { CreateOrganizationInput, UpdateProjectInput } from '@juanie/core-types'

async function createOrg(input: CreateOrganizationInput) {
  // ...
}
```

### 4. Zod Schemas (`schemas.ts`)

用于 tRPC 路由的输入验证：

```typescript
import { createOrganizationSchema, projectIdSchema } from '@juanie/core-types'

// 在 tRPC 路由中使用
create: trpc.protectedProcedure
  .input(createOrganizationSchema)
  .mutation(async ({ input }) => {
    // input 已经过验证和类型推导
  })
```

## 🎯 使用指南

### 在服务中使用

```typescript
// packages/services/organizations/src/organizations.service.ts
import { CreateOrganizationInput, Organization } from '@juanie/core-types'

@Injectable()
export class OrganizationsService {
  async create(userId: string, input: CreateOrganizationInput): Promise<Organization> {
    // 使用共享类型，确保类型一致性
  }
}
```

### 在路由中使用

```typescript
// apps/api-gateway/src/routers/organizations.router.ts
import { createOrganizationSchema, organizationIdSchema } from '@juanie/core-types'

@Injectable()
export class OrganizationsRouter {
  get router() {
    return this.trpc.router({
      // ✅ 使用共享 schema
      create: this.trpc.protectedProcedure
        .input(createOrganizationSchema)
        .mutation(async ({ input }) => {
          // ...
        }),

      // ✅ 使用共享 schema
      get: this.trpc.protectedProcedure
        .input(organizationIdSchema)
        .query(async ({ input }) => {
          // ...
        }),
    })
  }
}
```

### 在前端使用

```typescript
// apps/web/src/api/organizations.ts
import type { Organization, CreateOrganizationInput } from '@juanie/core-types'

// 类型安全的 API 调用
async function createOrganization(input: CreateOrganizationInput): Promise<Organization> {
  return await trpc.organizations.create.mutate(input)
}
```

## 📋 Schema 命名规范

### 创建操作
- `create{Entity}Schema` - 创建实体的输入 schema
- 例如: `createOrganizationSchema`, `createProjectSchema`

### 更新操作
- `update{Entity}Schema` - 更新实体的输入 schema
- 例如: `updateOrganizationSchema`, `updateProjectSchema`

### ID 查询
- `{entity}IdSchema` - 单个 ID 查询
- 例如: `organizationIdSchema`, `projectIdSchema`

### 列表查询
- `list{Entity}Schema` - 列表查询（包含分页、排序等）
- 例如: `listAuditLogsSchema`, `listCostsSchema`

### 操作
- `{action}{Entity}Schema` - 特定操作
- 例如: `inviteMemberSchema`, `approveDeploymentSchema`

## 🔄 迁移指南

### 从内联 schema 迁移到共享 schema

**之前（❌ 不推荐）:**

```typescript
// 每个路由都定义自己的 schema
create: this.trpc.protectedProcedure
  .input(
    z.object({
      name: z.string().min(1).max(100),
      slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
      displayName: z.string().max(500).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    // ...
  })
```

**之后（✅ 推荐）:**

```typescript
import { createOrganizationSchema } from '@juanie/core-types'

// 使用共享 schema
create: this.trpc.protectedProcedure
  .input(createOrganizationSchema)
  .mutation(async ({ input }) => {
    // ...
  })
```

### 好处

1. **类型一致性**: 所有地方使用相同的类型定义
2. **减少重复**: 不需要在每个文件中重复定义
3. **易于维护**: 修改一处，所有地方生效
4. **类型推导**: TypeScript 自动推导类型
5. **文档化**: 集中的类型定义作为 API 文档

## 🛠️ 开发建议

### 1. 优先使用共享类型

在创建新的路由或服务时，首先检查 `@juanie/core-types` 是否已有相应的类型或 schema。

### 2. 添加新类型

如果需要新的类型，应该添加到相应的文件中：

- **API 通用类型** → `api.ts`
- **数据模型** → `models.ts`
- **DTO 类型** → `dtos.ts`
- **Zod Schemas** → `schemas.ts`

### 3. 保持同步

确保 DTO 类型和 Zod schemas 保持同步：

```typescript
// dtos.ts
export interface CreateOrganizationInput {
  name: string
  slug: string
  displayName?: string
}

// schemas.ts
export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(100),
  slug: slugSchema,
  displayName: z.string().max(500).optional(),
})

// 类型推导应该匹配
type InferredInput = z.infer<typeof createOrganizationSchema>
// InferredInput 应该与 CreateOrganizationInput 兼容
```

### 4. 使用类型推导

利用 Zod 的类型推导功能：

```typescript
import { z } from 'zod'
import { createOrganizationSchema } from '@juanie/core-types'

// 从 schema 推导类型
type CreateOrgInput = z.infer<typeof createOrganizationSchema>

// 或者直接使用 DTO 类型
import type { CreateOrganizationInput } from '@juanie/core-types'
```

## 📚 相关资源

- [Zod 文档](https://zod.dev/)
- [tRPC 文档](https://trpc.io/)
- [TypeScript 文档](https://www.typescriptlang.org/)

## 🔧 故障排查

### 类型不匹配

如果遇到类型不匹配的问题：

1. 确保 `@juanie/core-types` 已构建: `bun run build:packages`
2. 重启 TypeScript 服务器
3. 检查导入路径是否正确

### Schema 验证失败

如果 schema 验证失败：

1. 检查输入数据是否符合 schema 定义
2. 查看 Zod 的错误信息
3. 使用 `.safeParse()` 进行调试

```typescript
const result = createOrganizationSchema.safeParse(input)
if (!result.success) {
  console.log(result.error.issues)
}
```

---

**维护者**: AI DevOps Platform Team  
**最后更新**: 2024-10-31
