# 错误处理指南

本指南说明如何在项目中正确处理错误。

## 核心原则

1. **使用业务错误类** - 不要使用 `throw new Error()`
2. **提供详细日志** - 记录错误上下文信息
3. **用户友好的消息** - 区分技术错误和用户消息
4. **统一错误处理** - 在 Router 层使用 `handleServiceError`

## 业务错误类

### 可用的错误类

位于 `@juanie/core/errors`:

**项目相关:**
- `ProjectNotFoundError` - 项目不存在
- `ProjectAlreadyExistsError` - 项目名称冲突
- `ProjectInitializationError` - 项目初始化失败

**权限相关:**
- `PermissionDeniedError` - 权限不足
- `UnauthorizedError` - 未授权

**资源相关:**
- `ResourceNotFoundError` - 通用资源不存在
- `ResourceConflictError` - 资源冲突

**验证相关:**
- `ValidationError` - 数据验证失败

**组织相关:**
- `OrganizationNotFoundError` - 组织不存在

**环境相关:**
- `EnvironmentNotFoundError` - 环境不存在

**GitOps 相关:**
- `GitOpsSetupError` - GitOps 配置失败

**团队相关:**
- `TeamNotFoundError` - 团队不存在
- `TeamMemberAlreadyExistsError` - 成员已存在

**通知相关:**
- `NotificationNotFoundError` - 通知不存在

**存储相关:**
- `StorageError` - 文件操作失败

**OAuth 相关:**
- `OAuthError` - OAuth 授权失败
- `InvalidStateError` - OAuth 状态无效

**配额相关:**
- `QuotaExceededError` - 配额超限

### 创建自定义错误类

```typescript
import { BusinessError } from '@juanie/core/errors'

export class CustomError extends BusinessError {
  constructor(param: string) {
    super(
      `Technical error message: ${param}`,  // 技术消息（日志）
      'CUSTOM_ERROR',                        // 错误代码
      400,                                   // HTTP 状态码
      false,                                 // 是否可重试
      { param }                              // 上下文信息
    )
  }

  getUserMessage(): string {
    return '用户友好的错误消息'  // 返回给用户的消息
  }
}
```

## Service 层错误处理

### ❌ 错误做法

```typescript
@Injectable()
export class ProjectsService {
  async getProject(projectId: string) {
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId)
    })
    
    // ❌ 不要这样做
    if (!project) {
      throw new Error('项目不存在')
    }
    
    return project
  }
}
```

### ✅ 正确做法

```typescript
import { ProjectNotFoundError } from '@juanie/core/errors'
import { Trace } from '@juanie/core/observability'

@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private db: Database,
    private logger: Logger,
  ) {}

  @Trace('projects.get')
  async getProject(projectId: string) {
    this.logger.log(`Getting project: ${projectId}`)
    
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId)
    })
    
    // ✅ 使用业务错误类
    if (!project) {
      this.logger.warn(`Project not found: ${projectId}`)
      throw new ProjectNotFoundError(projectId)
    }
    
    return project
  }
}
```

### 权限检查示例

```typescript
import { PermissionDeniedError } from '@juanie/core/errors'

@Injectable()
export class ProjectsService {
  async updateProject(userId: string, projectId: string, data: UpdateProjectInput) {
    // 检查权限
    const hasPermission = await this.checkPermission(userId, projectId, 'update')
    
    if (!hasPermission) {
      this.logger.warn(`Permission denied: user ${userId} cannot update project ${projectId}`)
      throw new PermissionDeniedError('project', 'update')
    }
    
    // 执行更新
    return await this.db.update(schema.projects)
      .set(data)
      .where(eq(schema.projects.id, projectId))
      .returning()
  }
}
```

### 配额检查示例

```typescript
import { QuotaExceededError } from '@juanie/core/errors'

@Injectable()
export class ProjectsService {
  async createProject(userId: string, data: CreateProjectInput) {
    // 检查配额
    const quota = await this.getQuota(data.organizationId)
    const current = await this.countProjects(data.organizationId)
    
    if (current >= quota.maxProjects) {
      this.logger.warn(`Quota exceeded for org ${data.organizationId}: ${current}/${quota.maxProjects}`)
      throw new QuotaExceededError('projects', quota.maxProjects, current)
    }
    
    // 创建项目
    return await this.db.insert(schema.projects).values(data).returning()
  }
}
```

## Router 层错误处理

### ❌ 错误做法

```typescript
export const projectsRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      // ❌ 不处理错误，让它传播
      return await ctx.projectsService.getProject(input.id)
    }),
})
```

### ✅ 正确做法

```typescript
import { handleServiceError } from '@juanie/core/errors'

export const projectsRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      try {
        return await ctx.projectsService.getProject(input.id)
      } catch (error) {
        // ✅ 使用统一错误处理
        handleServiceError(error, ctx.logger, {
          operation: 'projects.get',
          projectId: input.id,
          userId: ctx.user?.id,
        })
      }
    }),
})
```

### 使用 withErrorHandling 包装器

```typescript
import { withErrorHandling } from '@juanie/core/errors'

export const projectsRouter = router({
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(
      withErrorHandling(
        async ({ input, ctx }) => {
          return await ctx.projectsService.getProject(input.id)
        },
        undefined, // 使用默认 logger
        ({ input, ctx }) => ({
          operation: 'projects.get',
          projectId: input.id,
          userId: ctx.user?.id,
        })
      )
    ),
})
```

## 错误日志记录

### 日志级别

- **ERROR** - 意外错误、系统错误
- **WARN** - 业务错误、权限错误
- **INFO** - 正常操作
- **DEBUG** - 调试信息

### 日志内容

应该包含：
- 操作名称
- 相关 ID（projectId, userId 等）
- 错误类型和消息
- 上下文信息

```typescript
// ✅ 好的日志
this.logger.warn('Permission denied', {
  userId,
  projectId,
  action: 'update',
  reason: 'not a member'
})

// ❌ 不好的日志
this.logger.warn('Permission denied')
```

## 错误响应格式

### TRPCError 响应

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "项目不存在或已被删除",
    "data": {
      "code": "NOT_FOUND",
      "httpStatus": 404,
      "path": "projects.get"
    }
  }
}
```

### 业务错误上下文

业务错误的 `context` 字段会被记录到日志，但不会返回给客户端（避免泄露敏感信息）。

## 最佳实践

### 1. 早期验证

```typescript
async createProject(data: CreateProjectInput) {
  // ✅ 早期验证
  if (!data.name || data.name.trim().length === 0) {
    throw new ValidationError('name', '项目名称不能为空')
  }
  
  // 继续处理
}
```

### 2. 具体的错误类型

```typescript
// ❌ 不够具体
throw new ResourceNotFoundError('resource', id)

// ✅ 使用具体的错误类
throw new ProjectNotFoundError(id)
```

### 3. 包含上下文信息

```typescript
// ✅ 包含有用的上下文
throw new ProjectInitializationError(projectId, 'Git repository creation failed')
```

### 4. 区分可重试错误

```typescript
// 网络错误、超时等 - 可重试
throw new GitOpsSetupError(projectId, 'Connection timeout')  // retryable: true

// 验证错误、权限错误 - 不可重试
throw new ValidationError('name', 'Invalid format')  // retryable: false
```

### 5. 使用 @Trace 装饰器

```typescript
import { Trace } from '@juanie/core/observability'

@Injectable()
export class ProjectsService {
  @Trace('projects.create')  // ✅ 自动追踪和记录
  async createProject(data: CreateProjectInput) {
    // ...
  }
}
```

## 迁移指南

### 从 throw new Error() 迁移

**之前:**
```typescript
if (!project) {
  throw new Error('项目不存在')
}
```

**之后:**
```typescript
import { ProjectNotFoundError } from '@juanie/core/errors'

if (!project) {
  throw new ProjectNotFoundError(projectId)
}
```

### 从简单错误处理迁移

**之前:**
```typescript
try {
  return await service.doSomething()
} catch (error) {
  console.error(error)
  throw error
}
```

**之后:**
```typescript
import { handleServiceError } from '@juanie/core/errors'

try {
  return await service.doSomething()
} catch (error) {
  handleServiceError(error, this.logger, {
    operation: 'doSomething',
    context: 'additional info'
  })
}
```

## 测试错误处理

```typescript
describe('ProjectsService', () => {
  it('should throw ProjectNotFoundError when project does not exist', async () => {
    await expect(
      service.getProject('non-existent-id')
    ).rejects.toThrow(ProjectNotFoundError)
  })
  
  it('should throw PermissionDeniedError when user lacks permission', async () => {
    await expect(
      service.updateProject('user-id', 'project-id', {})
    ).rejects.toThrow(PermissionDeniedError)
  })
})
```

## 参考

- `packages/core/src/errors/business-errors.ts` - 所有业务错误类
- `packages/core/src/errors/error-handler.ts` - 错误处理工具
- `packages/services/foundation/src/organizations/organizations.service.ts` - 示例实现
