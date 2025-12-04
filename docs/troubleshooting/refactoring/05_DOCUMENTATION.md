# 文档标准化方案

## 🎯 问题总结

1. **API 文档不完整** - 缺少参数说明和示例
2. **错误处理不一致** - 错误码和消息格式混乱
3. **缺少错误码系统** - 难以定位问题
4. **注释不规范** - JSDoc 使用不一致

## 📋 解决方案

### 1. 统一错误码系统

**错误码定义**:
```typescript
// packages/types/src/errors/error-codes.ts
export const ErrorCodes = {
  // 通用错误 (1000-1999)
  UNKNOWN_ERROR: 'E1000',
  VALIDATION_ERROR: 'E1001',
  UNAUTHORIZED: 'E1002',
  FORBIDDEN: 'E1003',
  NOT_FOUND: 'E1004',
  
  // 项目相关 (2000-2999)
  PROJECT_NOT_FOUND: 'E2000',
  PROJECT_ALREADY_EXISTS: 'E2001',
  PROJECT_INITIALIZATION_FAILED: 'E2002',
  PROJECT_DELETE_FAILED: 'E2003',
  
  // GitOps 相关 (3000-3999)
  GITOPS_SYNC_FAILED: 'E3000',
  GIT_AUTH_FAILED: 'E3001',
  FLUX_RESOURCE_FAILED: 'E3002',
  K8S_CONNECTION_FAILED: 'E3003',
  
  // 部署相关 (4000-4999)
  DEPLOYMENT_FAILED: 'E4000',
  DEPLOYMENT_APPROVAL_REQUIRED: 'E4001',
  DEPLOYMENT_ROLLBACK_FAILED: 'E4002',
} as const

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes]
```

**标准错误类**:
```typescript
// packages/types/src/errors/app-error.ts
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: Record<string, any>,
  ) {
    super(message)
    this.name = 'AppError'
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    }
  }
}

// 便捷工厂函数
export const createError = {
  notFound: (resource: string, id?: string) =>
    new AppError(
      ErrorCodes.NOT_FOUND,
      `${resource} not found${id ? `: ${id}` : ''}`,
      404,
    ),
  
  validation: (message: string, details?: Record<string, any>) =>
    new AppError(
      ErrorCodes.VALIDATION_ERROR,
      message,
      400,
      details,
    ),
  
  unauthorized: (message: string = 'Unauthorized') =>
    new AppError(
      ErrorCodes.UNAUTHORIZED,
      message,
      401,
    ),
  
  forbidden: (message: string = 'Forbidden') =>
    new AppError(
      ErrorCodes.FORBIDDEN,
      message,
      403,
    ),
}
```

**使用示例**:
```typescript
@Injectable()
export class ProjectsService {
  async getProject(id: string) {
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, id),
    })
    
    if (!project) {
      throw createError.notFound('Project', id)
    }
    
    return project
  }
}
```

### 2. API 文档标准

**JSDoc 注释规范**:
```typescript
/**
 * 创建新项目
 * 
 * @description
 * 创建一个新的项目，包括初始化 Git 仓库、配置 GitOps 和创建默认环境。
 * 项目创建是异步过程，会返回 jobId 用于追踪进度。
 * 
 * @param input - 项目创建参数
 * @param input.name - 项目名称（3-50字符，只能包含字母、数字、横线和下划线）
 * @param input.organizationId - 所属组织 ID
 * @param input.templateId - 项目模板 ID（可选）
 * @param input.gitProvider - Git 提供商（github 或 gitlab）
 * 
 * @returns 创建的项目信息和初始化任务 ID
 * @returns {string} project.id - 项目 ID
 * @returns {string} project.jobId - 初始化任务 ID，用于 SSE 订阅进度
 * 
 * @throws {AppError} E2001 - 项目名称已存在
 * @throws {AppError} E1002 - 用户无权限创建项目
 * @throws {AppError} E3001 - Git 认证失败
 * 
 * @example
 * ```typescript
 * const project = await projectsService.createProject({
 *   name: 'my-app',
 *   organizationId: 'org-123',
 *   templateId: 'nextjs-15',
 *   gitProvider: 'github',
 * })
 * 
 * // 订阅初始化进度
 * const eventSource = new EventSource(`/api/sse/progress/${project.jobId}`)
 * ```
 * 
 * @see {@link ProjectStatusService.getStatus} 获取项目状态
 * @see {@link ProgressManagerService.getProgressInfo} 获取初始化进度
 */
async createProject(input: CreateProjectInput): Promise<ProjectWithJob> {
  // 实现
}
```

### 3. tRPC 文档生成

**使用 tRPC Panel**:
```typescript
// apps/api-gateway/src/main.ts
import { renderTrpcPanel } from 'trpc-panel'

app.use('/api/panel', (req, res) => {
  return res.send(
    renderTrpcPanel(appRouter, {
      url: 'http://localhost:3000/api/trpc',
      transformer: 'superjson',
    }),
  )
})
```

**添加描述和示例**:
```typescript
export const projectsRouter = router({
  create: protectedProcedure
    .meta({
      openapi: {
        method: 'POST',
        path: '/projects',
        tags: ['projects'],
        summary: '创建项目',
        description: '创建一个新的项目，包括初始化 Git 仓库和 GitOps 配置',
      },
    })
    .input(createProjectSchema)
    .output(z.object({
      id: z.string().uuid(),
      name: z.string(),
      jobId: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.projectsService.createProject(input)
    }),
})
```

### 4. 错误响应格式

**统一错误响应**:
```typescript
// apps/api-gateway/src/filters/app-error.filter.ts
import { Catch, ExceptionFilter, ArgumentsHost } from '@nestjs/common'
import { AppError } from '@juanie/types'

@Catch(AppError)
export class AppErrorFilter implements ExceptionFilter {
  catch(exception: AppError, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()

    response.status(exception.statusCode).json({
      success: false,
      error: {
        code: exception.code,
        message: exception.message,
        details: exception.details,
        timestamp: new Date().toISOString(),
      },
    })
  }
}
```

**错误响应示例**:
```json
{
  "success": false,
  "error": {
    "code": "E2000",
    "message": "Project not found: proj-123",
    "details": {
      "projectId": "proj-123",
      "organizationId": "org-456"
    },
    "timestamp": "2024-12-04T10:30:00.000Z"
  }
}
```

### 5. 生成 API 文档

**使用 TypeDoc**:
```bash
bun add -D typedoc typedoc-plugin-markdown
```

**配置**:
```json
// typedoc.json
{
  "entryPoints": ["packages/services/*/src/index.ts"],
  "out": "docs/api",
  "plugin": ["typedoc-plugin-markdown"],
  "readme": "none",
  "excludePrivate": true,
  "excludeProtected": true
}
```

**生成命令**:
```json
// package.json
{
  "scripts": {
    "docs:api": "typedoc",
    "docs:serve": "cd docs/api && python -m http.server 8080"
  }
}
```

## 📊 实施清单

### Phase 1: 错误码系统 (2天)

- [ ] 定义完整的错误码
- [ ] 实现 AppError 类
- [ ] 实现错误过滤器
- [ ] 更新所有错误抛出代码

### Phase 2: API 文档 (2天)

- [ ] 为所有公共方法添加 JSDoc
- [ ] 配置 tRPC Panel
- [ ] 添加 API 示例
- [ ] 生成 TypeDoc 文档

### Phase 3: 文档网站 (1天)

- [ ] 设置文档网站（VitePress 或 Docusaurus）
- [ ] 编写快速开始指南
- [ ] 编写 API 使用教程
- [ ] 部署文档网站

## 🎯 预期效果

- **API 文档覆盖率**: 100%
- **错误码标准化**: 所有错误都有唯一码
- **开发效率**: 提升 30%（减少查文档时间）
- **问题定位**: 通过错误码快速定位

## 🔗 相关文档

- [tRPC Panel](https://github.com/iway1/trpc-panel)
- [TypeDoc](https://typedoc.org/)
- [JSDoc 规范](https://jsdoc.app/)
