# 简化的错误架构设计

## 🤔 问题分析

### 当前问题

**多层错误定义导致维护困难**：
```
Core 层: BaseError + 通用错误类
Foundation 层: 领域错误类 (GitConnectionNotFoundError, OrganizationNotFoundError...)
Business 层: 业务错误类
Types 层: AppError + ErrorFactory (重复！)
```

**问题**：
- ❌ 错误类分散在多个层
- ❌ 不知道该在哪一层定义新错误
- ❌ 错误类重复定义
- ❌ 维护成本高

---

## ✅ 简化方案：单一错误层

### 核心理念

**所有错误定义集中在一个地方**：
```
packages/core/errors/
├── base.ts              # 基础错误类
├── domain-errors.ts     # 所有领域错误
└── index.ts             # 统一导出
```

**其他层只使用，不定义**：
```
Core 层 (定义所有错误) ✅
    ↓ 导出
Foundation 层 (使用错误) ✅
    ↓ 使用
Business 层 (使用错误) ✅
    ↓ 使用
API 层 (捕获并转换) ✅
```


---

## 📁 新的目录结构

```
packages/core/errors/
├── src/
│   ├── base.ts                 # 基础错误类
│   ├── common.ts               # 通用错误 (NotFound, Validation, Unauthorized...)
│   ├── auth.ts                 # 认证相关错误
│   ├── user.ts                 # 用户相关错误
│   ├── organization.ts         # 组织相关错误
│   ├── project.ts              # 项目相关错误
│   ├── gitops.ts               # GitOps 相关错误
│   ├── ai.ts                   # AI 相关错误
│   ├── factory.ts              # 错误工厂（可选）
│   └── index.ts                # 统一导出
└── package.json
```

---

## 💻 实现示例

### 1. 基础错误类

```typescript
// packages/core/errors/src/base.ts
import { TRPCError } from '@trpc/server'
import type { TRPC_ERROR_CODE_KEY } from '@trpc/server/rpc'

export abstract class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
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

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.getUserMessage(),
      statusCode: this.statusCode,
      retryable: this.retryable,
      context: this.context,
    }
  }
}
```

### 2. 通用错误

```typescript
// packages/core/errors/src/common.ts
import { AppError } from './base'

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      `${resource}${id ? ` ${id}` : ''} not found`,
      'NOT_FOUND',
      404,
      false,
      { resource, id }
    )
  }

  getUserMessage(): string {
    return `${this.context?.resource}不存在`
  }
}

export class ValidationError extends AppError {
  constructor(field: string, message: string) {
    super(
      `Validation failed: ${field} - ${message}`,
      'VALIDATION_ERROR',
      400,
      false,
      { field, message }
    )
  }

  getUserMessage(): string {
    return `${this.context?.field}: ${this.context?.message}`
  }
}

export class UnauthorizedError extends AppError {
  constructor(reason?: string) {
    super(
      `Unauthorized: ${reason || 'Authentication required'}`,
      'UNAUTHORIZED',
      401,
      false,
      { reason }
    )
  }

  getUserMessage(): string {
    return '请先登录'
  }
}

export class ForbiddenError extends AppError {
  constructor(resource: string, action: string) {
    super(
      `Permission denied: ${action} on ${resource}`,
      'FORBIDDEN',
      403,
      false,
      { resource, action }
    )
  }

  getUserMessage(): string {
    return '您没有权限执行此操作'
  }
}

export class ConflictError extends AppError {
  constructor(resource: string, reason: string) {
    super(
      `Resource conflict: ${resource} - ${reason}`,
      'CONFLICT',
      409,
      false,
      { resource, reason }
    )
  }

  getUserMessage(): string {
    return `操作冲突: ${this.context?.reason}`
  }
}
```

### 3. 领域错误（按模块组织）

```typescript
// packages/core/errors/src/user.ts
import { AppError } from './base'

export class UserNotFoundError extends AppError {
  constructor(userId: string) {
    super('User not found', 'USER_NOT_FOUND', 404, false, { userId })
  }

  getUserMessage(): string {
    return '用户不存在'
  }
}

export class UserEmailExistsError extends AppError {
  constructor(email: string) {
    super('User email already exists', 'USER_EMAIL_EXISTS', 409, false, { email })
  }

  getUserMessage(): string {
    return '该邮箱已被注册'
  }
}
```

```typescript
// packages/core/errors/src/organization.ts
import { AppError } from './base'

export class OrganizationNotFoundError extends AppError {
  constructor(organizationId: string) {
    super('Organization not found', 'ORGANIZATION_NOT_FOUND', 404, false, { organizationId })
  }

  getUserMessage(): string {
    return '组织不存在'
  }
}

export class NotOrganizationMemberError extends AppError {
  constructor(organizationId: string, userId?: string) {
    super(
      'User is not a member of this organization',
      'NOT_ORGANIZATION_MEMBER',
      403,
      false,
      { organizationId, userId }
    )
  }

  getUserMessage(): string {
    return '您不是该组织的成员'
  }
}
```

```typescript
// packages/core/errors/src/gitops.ts
import { AppError } from './base'

export class GitConnectionNotFoundError extends AppError {
  constructor(provider: string, userId?: string) {
    super(
      `Git connection for ${provider} not found`,
      'GIT_CONNECTION_NOT_FOUND',
      404,
      false,
      { provider, userId }
    )
  }

  getUserMessage(): string {
    const provider = this.context?.provider === 'github' ? 'GitHub' : 'GitLab'
    return `未找到 ${provider} 账号连接，请先连接账号`
  }
}

export class GitSyncFailedError extends AppError {
  constructor(operation: string, reason: string) {
    super(
      `Git sync failed: ${operation} - ${reason}`,
      'GIT_SYNC_FAILED',
      500,
      true, // 可重试
      { operation, reason }
    )
  }

  getUserMessage(): string {
    return `Git 同步失败: ${this.context?.reason}`
  }
}
```

### 4. 统一导出

```typescript
// packages/core/errors/src/index.ts
export { AppError } from './base'

// 通用错误
export {
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
} from './common'

// 用户相关
export {
  UserNotFoundError,
  UserEmailExistsError,
} from './user'

// 组织相关
export {
  OrganizationNotFoundError,
  NotOrganizationMemberError,
} from './organization'

// GitOps 相关
export {
  GitConnectionNotFoundError,
  GitSyncFailedError,
} from './gitops'

// ... 其他模块
```

---

## 🎯 使用方式

### Foundation 层

```typescript
// packages/services/foundation/src/organizations/organizations.service.ts
import { OrganizationNotFoundError, NotOrganizationMemberError } from '@juanie/core/errors'

@Injectable()
export class OrganizationsService {
  async get(orgId: string, userId: string) {
    const org = await this.db.query.organizations.findFirst({
      where: eq(schema.organizations.id, orgId),
    })

    if (!org) {
      throw new OrganizationNotFoundError(orgId)
    }

    const member = await this.getMember(orgId, userId)
    if (!member) {
      throw new NotOrganizationMemberError(orgId, userId)
    }

    return org
  }
}
```

### Business 层

```typescript
// packages/services/business/src/projects/projects.service.ts
import { ProjectNotFoundError, ForbiddenError } from '@juanie/core/errors'

@Injectable()
export class ProjectsService {
  async delete(projectId: string, userId: string) {
    const project = await this.get(projectId, userId)
    
    if (!project) {
      throw new ProjectNotFoundError(projectId)
    }

    const member = await this.getProjectMember(projectId, userId)
    if (member.role !== 'owner') {
      throw new ForbiddenError('project', 'delete')
    }

    await this.db.delete(schema.projects).where(eq(schema.projects.id, projectId))
  }
}
```

### API 层（自动转换）

```typescript
// apps/api-gateway/src/routers/projects.router.ts
export class ProjectsRouter {
  router = this.trpc.router({
    delete: this.trpc.protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ ctx, input }) => {
        try {
          await this.projects.delete(input.id, ctx.user.id)
          return { success: true }
        } catch (error) {
          // AppError 自动转换为 TRPCError
          if (error instanceof AppError) {
            throw error.toTRPCError()
          }
          throw error
        }
      }),
  })
}
```

---

## 📊 对比

| 方面 | 之前（多层定义） | 现在（单层定义） |
|------|----------------|----------------|
| **错误定义位置** | Core, Foundation, Business, Types | 只在 Core |
| **维护成本** | ❌ 高（分散） | ✅ 低（集中） |
| **查找错误** | ❌ 难（不知道在哪层） | ✅ 易（只在一个包） |
| **重复定义** | ❌ 有 | ✅ 无 |
| **导入路径** | ❌ 多个包 | ✅ 单一包 |
| **新增错误** | ❌ 不知道放哪 | ✅ 明确放 Core |

---

## 🚀 迁移步骤

### 1. 创建新的错误包

```bash
# 创建目录结构
mkdir -p packages/core/errors/src

# 创建文件
touch packages/core/errors/src/{base,common,user,organization,project,gitops,ai,auth}.ts
touch packages/core/errors/src/index.ts
touch packages/core/errors/package.json
```

### 2. 移动现有错误

```typescript
// 从 packages/services/foundation/src/errors.ts 移动到
// packages/core/errors/src/organization.ts

// 从 packages/types/src/errors/ 移动到
// packages/core/errors/src/
```

### 3. 更新导入

```bash
# 全局替换
from '@juanie/service-foundation' 
  → '@juanie/core/errors'

from '@juanie/types' 
  → '@juanie/core/errors'
```

### 4. 删除旧文件

```bash
# 删除重复的错误定义
rm packages/services/foundation/src/errors.ts
rm -rf packages/types/src/errors/
```

---

## 💡 最佳实践

### 1. 错误命名规范

```typescript
// ✅ 好的命名
UserNotFoundError
OrganizationMemberAlreadyExistsError
GitSyncFailedError

// ❌ 不好的命名
Error404
UserError
SyncError
```

### 2. 错误分组

**按领域模块分组**，不是按错误类型：
```
✅ user.ts, organization.ts, project.ts
❌ not-found-errors.ts, validation-errors.ts
```

### 3. 错误上下文

**总是提供有用的上下文**：
```typescript
// ✅ 好
throw new UserNotFoundError(userId)

// ❌ 不好
throw new Error('User not found')
```

---

## 🎯 总结

### 核心改变

**从**：多层分散定义  
**到**：单层集中定义

### 优势

1. ✅ **易维护** - 所有错误在一个地方
2. ✅ **易查找** - 不用猜在哪一层
3. ✅ **无重复** - 单一定义源
4. ✅ **易扩展** - 按模块组织，清晰明了
5. ✅ **类型安全** - 统一的错误基类

### 原则

**"错误定义集中，错误使用分散"**

- Core 层：定义所有错误 ✅
- 其他层：只使用错误 ✅
- 没有层级概念的错误 ✅
- 按业务领域组织 ✅

这样的架构**简单、清晰、易维护**！
