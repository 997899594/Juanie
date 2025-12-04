# 任务 5 & 6 实施总结

**日期**: 2024-12-04  
**状态**: 基础架构完成，待应用到业务代码

---

## 任务 5: 错误处理标准化

### ✅ 已完成

#### 1. 业务错误类体系

**文件**: `packages/core/src/errors/business-errors.ts`

创建了完整的业务错误类层次结构：

```typescript
BusinessError (抽象基类)
├── ProjectNotFoundError
├── ProjectAlreadyExistsError
├── ProjectInitializationError
├── PermissionDeniedError
├── UnauthorizedError
├── ResourceNotFoundError
├── ResourceConflictError
├── ValidationError
├── OrganizationNotFoundError
├── EnvironmentNotFoundError
└── GitOpsSetupError
```

**特性**:
- ✅ 自动转换为 TRPCError
- ✅ 用户友好的错误消息
- ✅ 包含错误上下文
- ✅ 支持重试标记
- ✅ HTTP 状态码映射

#### 2. 错误处理工具

**文件**: `packages/core/src/errors/error-handler.ts`

```typescript
// 统一错误处理函数
handleServiceError(error: unknown): never

// 异步错误处理包装器
withErrorHandling<T>(fn: T): (...args) => Promise<ReturnType<T>>
```

**使用示例**:

```typescript
// Service 层
async getProject(projectId: string) {
  const project = await this.db.query.projects.findFirst(...)
  
  if (!project) {
    throw new ProjectNotFoundError(projectId)
  }
  
  return project
}

// Router 层
get: procedure.query(async ({ input }) => {
  try {
    return await this.service.getProject(input.projectId)
  } catch (error) {
    handleServiceError(error) // 自动转换为 TRPCError
  }
})
```

### 📋 待完成任务

1. **更新现有 Service 层**
   - ProjectsService
   - EnvironmentsService
   - DeploymentsService
   - OrganizationsService
   - 其他业务服务

2. **更新 Router 层**
   - 所有 tRPC router 使用 `handleServiceError`
   - 统一错误响应格式

3. **前端错误处理**
   - 更新 tRPC 客户端错误处理
   - 显示用户友好的错误消息
   - 错误日志记录

---

## 任务 6: RBAC 权限系统

### ✅ 已完成

#### 1. 权限模型定义

**文件**: `packages/core/src/rbac/permissions.ts`

**资源类型**:
```typescript
enum Resource {
  ORGANIZATION = 'organization',
  PROJECT = 'project',
  ENVIRONMENT = 'environment',
  DEPLOYMENT = 'deployment',
  MEMBER = 'member',
  TEAM = 'team',
}
```

**操作类型**:
```typescript
enum Action {
  READ = 'read',
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  DEPLOY = 'deploy',
  MANAGE_MEMBERS = 'manage_members',
  MANAGE_SETTINGS = 'manage_settings',
  MANAGE_TEAMS = 'manage_teams',
}
```

**角色定义**:

组织角色:
- `OWNER`: 完全控制（所有权限）
- `ADMIN`: 项目管理（创建、编辑项目，管理团队）
- `MEMBER`: 只读访问

项目角色:
- `ADMIN`: 项目管理 + 成员管理
- `MEMBER`: 项目编辑 + 部署
- `VIEWER`: 只读访问

#### 2. RBAC 服务

**文件**: `packages/core/src/rbac/rbac.service.ts`

**核心方法**:

```typescript
class RBACService {
  // 检查权限
  async can(userId, resource, action, resourceId): Promise<boolean>
  
  // 断言权限（无权限抛出错误）
  async assert(userId, resource, action, resourceId): Promise<void>
  
  // 获取角色
  async getRole(userId, resource, resourceId): Promise<string | null>
  
  // 获取所有权限
  async getPermissions(userId, resource, resourceId): Promise<Permission[]>
  
  // 批量检查权限
  async canBatch(userId, checks): Promise<boolean[]>
  
  // 便捷方法
  async isOrganizationMember(userId, organizationId): Promise<boolean>
  async isProjectMember(userId, projectId): Promise<boolean>
  async isOrganizationOwner(userId, organizationId): Promise<boolean>
  async isProjectAdmin(userId, projectId): Promise<boolean>
}
```

**权限检查逻辑**:

1. **项目权限**: 先检查项目成员角色，再检查组织管理员权限
2. **环境权限**: 通过所属项目检查
3. **部署权限**: 通过所属环境 → 项目检查
4. **成员管理**: 需要 MANAGE_MEMBERS 权限
5. **团队管理**: 需要组织的 MANAGE_TEAMS 权限

#### 3. 权限装饰器

**文件**: `packages/core/src/rbac/decorators.ts`

```typescript
// 通用权限装饰器
@RequirePermission(Resource.PROJECT, Action.DELETE)
async deleteProject(userId: string, projectId: string) {
  // 权限检查由 Guard 自动完成
}

// 便捷装饰器
@RequireOrganizationOwner()
async deleteOrganization() { }

@RequireProjectAdmin()
async addMember() { }
```

#### 4. RBAC 模块

**文件**: `packages/core/src/rbac/rbac.module.ts`

```typescript
@Global()
@Module({
  providers: [RBACService],
  exports: [RBACService],
})
export class RBACModule {}
```

### 📋 待完成任务

1. **集成到业务服务**
   - 在所有 Service 中注入 RBACService
   - 替换现有的权限检查逻辑
   - 使用 `rbac.assert()` 进行权限检查

2. **创建 RBAC Guard**（可选）
   - 实现 NestJS Guard
   - 自动检查装饰器标记的权限
   - 与 tRPC 集成

3. **测试**
   - 单元测试：权限检查逻辑
   - 集成测试：完整的权限流程
   - 边界情况测试

---

## 使用示例

### Service 层使用错误处理 + RBAC

```typescript
@Injectable()
export class ProjectsService {
  constructor(
    private readonly rbac: RBACService,
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
  ) {}

  async get(userId: string, projectId: string) {
    // ✅ RBAC 权限检查
    await this.rbac.assert(userId, Resource.PROJECT, Action.READ, projectId)
    
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
    })

    // ✅ 业务错误
    if (!project) {
      throw new ProjectNotFoundError(projectId)
    }

    return project
  }

  async update(userId: string, projectId: string, data: UpdateProjectInput) {
    // ✅ RBAC 权限检查
    await this.rbac.assert(userId, Resource.PROJECT, Action.UPDATE, projectId)
    
    // 检查名称冲突
    if (data.name) {
      const existing = await this.db.query.projects.findFirst({
        where: and(
          eq(schema.projects.name, data.name),
          eq(schema.projects.organizationId, project.organizationId),
        ),
      })
      
      if (existing && existing.id !== projectId) {
        throw new ProjectAlreadyExistsError(data.name, project.organizationId)
      }
    }
    
    return await this.db
      .update(schema.projects)
      .set(data)
      .where(eq(schema.projects.id, projectId))
      .returning()
  }

  async delete(userId: string, projectId: string) {
    // ✅ RBAC 权限检查
    await this.rbac.assert(userId, Resource.PROJECT, Action.DELETE, projectId)
    
    await this.db
      .delete(schema.projects)
      .where(eq(schema.projects.id, projectId))
  }
}
```

### Router 层使用错误处理

```typescript
@Injectable()
export class ProjectsRouter {
  constructor(
    private readonly trpc: TRPCService,
    private readonly service: ProjectsService,
  ) {}

  get router() {
    return this.trpc.router({
      get: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .query(async ({ ctx, input }) => {
          try {
            return await this.service.get(ctx.user.id, input.projectId)
          } catch (error) {
            // ✅ 统一错误处理
            handleServiceError(error)
          }
        }),

      update: this.trpc.protectedProcedure
        .input(updateProjectSchema)
        .mutation(async ({ ctx, input }) => {
          try {
            return await this.service.update(ctx.user.id, input.projectId, input.data)
          } catch (error) {
            handleServiceError(error)
          }
        }),

      delete: this.trpc.protectedProcedure
        .input(z.object({ projectId: z.string() }))
        .mutation(async ({ ctx, input }) => {
          try {
            await this.service.delete(ctx.user.id, input.projectId)
            return { success: true }
          } catch (error) {
            handleServiceError(error)
          }
        }),
    })
  }
}
```

### 前端错误处理

```typescript
// composables/useProjects.ts
export function useProjects() {
  const { $trpc } = useNuxtApp()
  const toast = useToast()

  async function deleteProject(projectId: string) {
    try {
      await $trpc.projects.delete.mutate({ projectId })
      toast.success('项目已删除')
    } catch (error) {
      if (error instanceof TRPCClientError) {
        // ✅ 显示用户友好的错误消息
        toast.error(error.message)
      } else {
        toast.error('删除失败，请重试')
      }
    }
  }

  return { deleteProject }
}
```

---

## 文件清单

### 新增文件

**错误处理**:
- `packages/core/src/errors/business-errors.ts` - 业务错误类
- `packages/core/src/errors/error-handler.ts` - 错误处理工具
- `packages/core/src/errors/index.ts` - 导出

**RBAC**:
- `packages/core/src/rbac/permissions.ts` - 权限模型定义
- `packages/core/src/rbac/rbac.service.ts` - RBAC 服务
- `packages/core/src/rbac/rbac.module.ts` - RBAC 模块
- `packages/core/src/rbac/decorators.ts` - 权限装饰器
- `packages/core/src/rbac/index.ts` - 导出

### 待修改文件

**Service 层** (需要集成 RBAC 和错误处理):
- `packages/services/business/src/projects/projects.service.ts`
- `packages/services/business/src/projects/project-members.service.ts`
- `packages/services/business/src/environments/environments.service.ts`
- `packages/services/business/src/deployments/deployments.service.ts`
- `packages/services/foundation/src/organizations/organizations.service.ts`
- `packages/services/foundation/src/teams/teams.service.ts`

**Router 层** (需要使用 handleServiceError):
- `apps/api-gateway/src/routers/projects.router.ts`
- `apps/api-gateway/src/routers/environments.router.ts`
- `apps/api-gateway/src/routers/deployments.router.ts`
- `apps/api-gateway/src/routers/organizations.router.ts`
- `apps/api-gateway/src/routers/teams.router.ts`

---

## 下一步行动

### 优先级 1: 应用到核心服务

1. **ProjectsService** - 项目管理
   - 集成 RBAC
   - 使用业务错误类
   - 更新 Router

2. **ProjectMembersService** - 成员管理
   - 集成 RBAC
   - 使用业务错误类
   - 更新 Router

### 优先级 2: 扩展到其他服务

3. **EnvironmentsService** - 环境管理
4. **DeploymentsService** - 部署管理
5. **OrganizationsService** - 组织管理
6. **TeamsService** - 团队管理

### 优先级 3: 测试和文档

7. 编写单元测试
8. 编写集成测试
9. 更新 API 文档
10. 编写使用指南

---

## 技术亮点

### 错误处理

✅ **类型安全**: 所有错误都有明确的类型  
✅ **用户友好**: 自动转换为友好的错误消息  
✅ **上下文丰富**: 包含错误上下文用于调试  
✅ **自动转换**: 无缝集成 tRPC 错误系统  
✅ **可重试**: 支持标记可重试的错误

### RBAC

✅ **细粒度控制**: 资源级 + 操作级权限  
✅ **层级继承**: 组织管理员自动拥有项目权限  
✅ **易于扩展**: 新增角色和权限很简单  
✅ **性能优化**: 批量权限检查  
✅ **便捷方法**: 提供常用权限检查的快捷方法

---

## 预期收益

### 错误处理

- ✅ 用户体验提升：看到友好的错误消息
- ✅ 开发效率提升：统一的错误处理模式
- ✅ 调试效率提升：丰富的错误上下文
- ✅ 代码质量提升：类型安全的错误处理

### RBAC

- ✅ 安全性提升：细粒度的权限控制
- ✅ 代码质量提升：权限检查逻辑统一
- ✅ 可维护性提升：权限规则集中管理
- ✅ 可扩展性提升：易于添加新角色和权限

---

## 相关文档

- [任务 5: 错误处理标准化](./05-error-handling.md)
- [任务 6: RBAC 权限系统](./06-rbac.md)
- [进度跟踪](./PROGR