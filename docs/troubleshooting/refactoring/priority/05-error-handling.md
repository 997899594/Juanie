# 任务 5: 错误处理标准化

**优先级**: 🟡 中  
**预计时间**: 2天  
**依赖**: 无

---

## 📋 问题描述

### 现状

1. **错误处理不统一**
   ```typescript
   // 有的直接 throw Error
   throw new Error('Project not found')
   
   // 有的 throw TRPCError
   throw new TRPCError({ code: 'NOT_FOUND', message: '项目不存在' })
   
   // 有的返回 null
   return null
   ```

2. **错误信息不友好**
   - 技术错误直接暴露给用户
   - 缺少错误上下文
   - 前端难以处理

3. **已有的错误分类未充分利用**
   - `git-sync-errors.ts` 有很好的错误分类
   - 但其他模块没有使用类似模式

### 影响

- ❌ 用户看到技术错误信息
- ❌ 前端错误处理困难
- ❌ 调试困难

---

## 🎯 方案

### 使用 tRPC 错误处理 + 业务错误分类

**核心思路**:
1. **Service 层**: 抛出业务错误类（如 `GitSyncError`）
2. **Router 层**: 捕获并转换为 `TRPCError`
3. **前端**: 统一处理 `TRPCError`

---

## 🔧 实施步骤

### 5.1 扩展业务错误类 (0.5天)

```typescript
// packages/core/src/errors/business-errors.ts

/**
 * 业务错误基类
 */
export abstract class BusinessError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = this.constructor.name
  }

  /**
   * 获取用户友好的错误消息
   */
  abstract getUserMessage(): string

  /**
   * 转换为 TRPCError
   */
  toTRPCError(): TRPCError {
    return new TRPCError({
      code: this.getTRPCCode(),
      message: this.getUserMessage(),
      cause: this,
    })
  }

  private getTRPCCode(): TRPC_ERROR_CODE_KEY {
    if (this.statusCode === 404) return 'NOT_FOUND'
    if (this.statusCode === 403) return 'FORBIDDEN'
    if (this.statusCode === 401) return 'UNAUTHORIZED'
    if (this.statusCode === 409) return 'CONFLICT'
    if (this.statusCode >= 500) return 'INTERNAL_SERVER_ERROR'
    return 'BAD_REQUEST'
  }
}

/**
 * 项目相关错误
 */
export class ProjectNotFoundError extends BusinessError {
  constructor(projectId: string) {
    super(
      `Project ${projectId} not found`,
      'PROJECT_NOT_FOUND',
      404,
      false,
      { projectId },
    )
  }

  getUserMessage(): string {
    return '项目不存在或已被删除'
  }
}

export class ProjectAlreadyExistsError extends BusinessError {
  constructor(name: string) {
    super(
      `Project with name "${name}" already exists`,
      'PROJECT_ALREADY_EXISTS',
      409,
      false,
      { name },
    )
  }

  getUserMessage(): string {
    return `项目名称 "${this.context?.name}" 已存在`
  }
}

export class ProjectInitializationError extends BusinessError {
  constructor(projectId: string, reason: string) {
    super(
      `Failed to initialize project ${projectId}: ${reason}`,
      'PROJECT_INIT_FAILED',
      500,
      true,
      { projectId, reason },
    )
  }

  getUserMessage(): string {
    return '项目初始化失败，请重试或联系管理员'
  }
}

/**
 * 权限相关错误
 */
export class PermissionDeniedError extends BusinessError {
  constructor(resource: string, action: string) {
    super(
      `Permission denied: ${action} on ${resource}`,
      'PERMISSION_DENIED',
      403,
      false,
      { resource, action },
    )
  }

  getUserMessage(): string {
    return '您没有权限执行此操作'
  }
}

/**
 * 资源冲突错误
 */
export class ResourceConflictError extends BusinessError {
  constructor(resource: string, reason: string) {
    super(
      `Resource conflict: ${resource} - ${reason}`,
      'RESOURCE_CONFLICT',
      409,
      false,
      { resource, reason },
    )
  }

  getUserMessage(): string {
    return `操作冲突: ${this.context?.reason}`
  }
}
```

### 5.2 创建错误处理中间件 (0.5天)

```typescript
// apps/api-gateway/src/trpc/error-handler.ts

import { BusinessError } from '@juanie/core/errors'
import { TRPCError } from '@trpc/server'

/**
 * 统一错误处理
 */
export function handleServiceError(error: unknown): never {
  // 如果已经是 TRPCError，直接抛出
  if (error instanceof TRPCError) {
    throw error
  }

  // 如果是业务错误，转换为 TRPCError
  if (error instanceof BusinessError) {
    throw error.toTRPCError()
  }

  // 如果是 Git 同步错误，转换为 TRPCError
  if (error instanceof GitSyncError) {
    throw new TRPCError({
      code: error.statusCode === 404 ? 'NOT_FOUND' : 'BAD_REQUEST',
      message: error.getUserMessage(),
      cause: error,
    })
  }

  // 未知错误
  console.error('Unexpected error:', error)
  throw new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message: '服务器内部错误，请稍后重试',
    cause: error,
  })
}
```

### 5.3 更新 Service 层 (0.5天)

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  async get(userId: string, projectId: string) {
    const project = await this.db.query.projects.findFirst({
      where: and(
        eq(schema.projects.id, projectId),
        isNull(schema.projects.deletedAt),
      ),
    })

    // ✅ 抛出业务错误
    if (!project) {
      throw new ProjectNotFoundError(projectId)
    }

    // 检查权限
    const hasAccess = await this.checkAccess(userId, projectId)
    if (!hasAccess) {
      throw new PermissionDeniedError('project', 'read')
    }

    return project
  }

  async create(userId: string, input: CreateProjectInput) {
    // 检查名称是否已存在
    const existing = await this.db.query.projects.findFirst({
      where: and(
        eq(schema.projects.name, input.name),
        eq(schema.projects.organizationId, input.organizationId),
      ),
    })

    if (existing) {
      throw new ProjectAlreadyExistsError(input.name)
    }

    // 创建项目
    try {
      const project = await this.db.insert(schema.projects)
        .values({ ...input, createdBy: userId })
        .returning()
      
      return project[0]
    } catch (error) {
      throw new ProjectInitializationError(input.name, error.message)
    }
  }
}
```

### 5.4 更新 Router 层 (0.5天)

```typescript
// apps/api-gateway/src/routers/projects.router.ts

@Injectable()
export class ProjectsRouter {
  get router() {
    return this.trpc.router({
      get: this.trpc.protectedProcedure
        .input(projectIdSchema)
        .query(async ({ ctx, input }) => {
          try {
            return await this.projectsService.get(ctx.user.id, input.projectId)
          } catch (error) {
            // ✅ 统一错误处理
            handleServiceError(error)
          }
        }),

      create: this.trpc.protectedProcedure
        .input(createProjectSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.projectsService.create(ctx.user.id, input)
          } catch (error) {
            handleServiceError(error)
          }
        }),
    })
  }
}
```

---

## ✅ 验收标准

- [ ] 所有 Service 层使用业务错误类
- [ ] 所有 Router 层统一错误处理
- [ ] 错误消息用户友好
- [ ] 前端能正确处理所有错误类型
- [ ] 错误日志包含足够的上下文

---

## 📊 预期收益

- ✅ 错误处理统一，代码更清晰
- ✅ 用户看到友好的错误消息
- ✅ 前端错误处理简化
- ✅ 调试更容易（有错误上下文）

---

## 📝 相关文档

- [错误处理指南](../../guides/error-handling.md)
- [tRPC 错误处理](https://trpc.io/docs/server/error-handling)
