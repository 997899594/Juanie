# tRPC 全栈类型安全深度解析

## 什么是 tRPC？

### 传统 API 开发的痛点

**REST API 方式**：
```typescript
// 后端
app.post('/api/users', (req, res) => {
  const { name, email } = req.body  // 类型是 any
  // 没有类型检查，运行时才知道错误
})

// 前端
const createUser = async (data: any) => {
  const response = await fetch('/api/users', {
    method: 'POST',
    body: JSON.stringify(data),  // 类型是 any
  })
  return response.json()  // 返回类型也是 any
}
```

**问题**：
- ❌ 前后端类型不同步
- ❌ 运行时才发现错误
- ❌ 重构困难（改了后端，前端不知道）
- ❌ API 文档容易过时
- ❌ 开发体验差（没有自动补全）

### tRPC 的解决方案

```typescript
// 后端定义
const userRouter = router({
  create: procedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      // input 自动推断类型：{ name: string, email: string }
      return await db.users.create(input)
    }),
})

// 前端调用
const user = await trpc.users.create.mutate({
  name: 'John',
  email: 'john@example.com',  // 自动类型检查和补全
})
// user 的类型自动推断
```

**优势**：
- ✅ **端到端类型安全** - 从数据库到前端
- ✅ **自动类型推断** - 无需手写类型
- ✅ **编译时检查** - 错误在开发时发现
- ✅ **自动补全** - 极佳的开发体验
- ✅ **重构友好** - 改后端，前端立即报错

---

## tRPC 核心概念

### 1. Procedure（过程）

**Query** - 查询数据（GET）
```typescript
const userRouter = router({
  // 获取用户列表
  list: procedure
    .input(z.object({
      page: z.number().default(1),
      limit: z.number().default(10),
    }))
    .query(async ({ input }) => {
      return await db.users.findMany({
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      })
    }),
})
```

**Mutation** - 修改数据（POST/PUT/DELETE）
```typescript
const userRouter = router({
  create: procedure
    .input(z.object({
      name: z.string(),
      email: z.string().email(),
    }))
    .mutation(async ({ input }) => {
      return await db.users.create({ data: input })
    }),
})
```

**Subscription** - 实时数据（WebSocket/SSE）
```typescript
const userRouter = router({
  onStatusChange: procedure
    .input(z.object({ userId: z.string() }))
    .subscription(({ input }) => {
      return observable<UserStatus>((emit) => {
        const unsubscribe = subscribeToUserStatus(input.userId, (status) => {
          emit.next(status)
        })
        return unsubscribe
      })
    }),
})
```

### 2. Input Validation（输入验证）

使用 **Zod** 进行运行时类型检查：

```typescript
const createProjectSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  organizationId: z.string().uuid(),
  template: z.enum(['nextjs', 'react', 'vue']),
  repository: z.object({
    provider: z.enum(['github', 'gitlab']),
    name: z.string(),
    private: z.boolean().default(true),
  }),
})
```

### 3. Context（上下文）

```typescript
interface Context {
  user?: User
  db: Database
  req: Request
}

const createContext = async ({ req }: { req: Request }): Promise<Context> => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const user = token ? await verifyToken(token) : undefined
  
  return {
    user,
    db: getDatabase(),
    req,
  }
}
```

---

## 项目中的 tRPC 架构

### 服务端实现

```typescript
// apps/api-gateway/src/trpc/trpc.service.ts
@Injectable()
export class TrpcService {
  procedure = initTRPC.context<Context>().create({
    transformer: superjson,
    errorFormatter: ({ shape, error }) => ({
      ...shape,
      data: {
        ...shape.data,
        zodError: error.code === 'BAD_REQUEST' && error.cause instanceof ZodError
          ? error.cause.flatten()
          : null,
      },
    }),
  })

  router = this.procedure.router
  publicProcedure = this.procedure
  
  protectedProcedure = this.procedure.use(({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: 'UNAUTHORIZED' })
    }
    return next({ ctx: { ...ctx, user: ctx.user } })
  })
}
```

### Router 实现

```typescript
// apps/api-gateway/src/routers/projects.router.ts
@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly projects: ProjectsService,
  ) {}

  router = this.trpc.router({
    create: this.trpc.protectedProcedure
      .input(createProjectSchema)
      .mutation(async ({ ctx, input }) => {
        return await this.projects.create(ctx.user.id, input)
      }),

    list: this.trpc.protectedProcedure
      .input(z.object({
        page: z.number().default(1),
        limit: z.number().default(10),
      }))
      .query(async ({ ctx, input }) => {
        return await this.projects.list(ctx.user.id, input)
      }),
  })
}
```

---

## 客户端集成

### tRPC 客户端配置

```typescript
// apps/web/src/lib/trpc.ts
import { createTRPCProxyClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from '@juanie/api-gateway'

export const trpc = createTRPCProxyClient<AppRouter>({
  transformer: superjson,
  links: [
    httpBatchLink({
      url: `${import.meta.env.VITE_API_URL}/trpc`,
      headers: () => ({
        authorization: `Bearer ${getAuthToken()}`,
      }),
    }),
  ],
})
```

### Vue 组合式 API

```typescript
// apps/web/src/composables/useProjects.ts
export function useProjects() {
  const { data: projects, isLoading } = trpc.projects.list.useQuery({
    page: 1,
    limit: 10,
  })

  const createProject = trpc.projects.create.useMutation({
    onSuccess: () => {
      // 刷新列表
    },
  })

  return { projects, isLoading, createProject }
}
```

---

## 最佳实践

### 1. 输入验证

```typescript
// 复用 schema
export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
})

export const updateUserSchema = createUserSchema.partial().extend({
  id: z.string(),
})
```

### 2. 错误处理

```typescript
const handleTRPCError = (error: TRPCClientError<AppRouter>) => {
  switch (error.data?.code) {
    case 'UNAUTHORIZED':
      router.push('/login')
      break
    case 'NOT_FOUND':
      showError('资源不存在')
      break
    default:
      showError(error.message)
  }
}
```

### 3. 类型导出

```typescript
export type Project = RouterOutputs['projects']['get']
export type CreateProjectInput = RouterInputs['projects']['create']
```

---

## 总结

### tRPC 的价值

1. **类型安全** - 端到端类型检查
2. **开发体验** - 自动补全和错误提示
3. **重构友好** - 改后端，前端立即知道
4. **性能优秀** - 自动批量请求和缓存
5. **简单易用** - 学习成本低

### 适用场景

✅ **适合**：
- 全栈 TypeScript 项目
- 团队规模中小型
- 快速迭代的产品
- 重视开发体验

❌ **不适合**：
- 多语言团队
- 需要 REST API 的场景
- 已有大量 REST API

**tRPC 让全栈开发变得简单而安全！**
