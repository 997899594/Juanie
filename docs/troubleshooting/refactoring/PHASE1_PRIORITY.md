# Phase 1 优先任务 - 问题与方案

## 📋 任务清单

按你要求的顺序，这6个任务是当前最优先要解决的：

1. **服务冗余** - 删除 HealthMonitorService 和 ApprovalManagerService
2. **事件系统** - 统一使用 NestJS EventEmitter2
3. **数据库索引** - 添加关键查询索引
4. **软删除** - 添加 deletedAt 支持
5. **错误码系统** - 统一错误码和错误处理
6. **RBAC权限** - 完善权限检查系统

**预计时间**: 10-12 个工作日

---

## 1️⃣ 服务冗余问题

### 问题描述

**HealthMonitorService** (占位实现)
- 文件: `packages/services/business/src/projects/health-monitor.service.ts`
- 问题: 只是占位，实际功能已在 `ProjectStatusService` 中实现
- 影响: 代码冗余，容易混淆

**ApprovalManagerService** (空实现)
- 文件: `packages/services/business/src/projects/approval-manager.service.ts`  
- 问题: 所有方法都是占位，返回 mock 数据
- 影响: 无实际功能，占用代码空间

### 方案选择

**方案 A: 完全删除** ⭐ 推荐
- 删除文件
- 从 module 移除 provider
- 更新所有引用

**方案 B: 移到 _todo 目录**
- 保留代码但标记为未实现
- 不推荐，增加维护负担

### 实施步骤

```bash
# 1. 删除文件
rm packages/services/business/src/projects/health-monitor.service.ts
rm packages/services/business/src/projects/approval-manager.service.ts

# 2. 验证
bun run type-check
```

**需要修改的文件**:
- `packages/services/business/src/projects/projects.module.ts` - 移除 providers
- `packages/services/business/src/index.ts` - 移除 exports

---

## 2️⃣ 事件系统混乱

### 问题描述

当前混用两种事件系统：
- NestJS EventEmitter (部分使用)
- 自定义事件系统 (部分使用)

**影响**:
- 事件追踪困难
- 命名不统一
- 难以调试

### 方案选择

**统一使用 NestJS EventEmitter2** ⭐ 推荐

**优势**:
- NestJS 官方支持
- 功能完整 (wildcard, namespace)
- 类型安全
- 易于测试

### 实施步骤

**1. 安装依赖**:
```bash
cd packages/services/business
bun add @nestjs/event-emitter
```

**2. 注册模块**:
```typescript
// packages/services/business/src/business.module.ts
import { EventEmitterModule } from '@nestjs/event-emitter'

@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
    }),
  ],
})
```

**3. 定义标准事件**:
```typescript
// packages/core/src/events/event-types.ts
export const Events = {
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  GITOPS_SYNC_STARTED: 'gitops.sync.started',
  DEPLOYMENT_STARTED: 'deployment.started',
} as const
```

**4. 使用示例**:
```typescript
// 发送事件
this.eventEmitter.emit(Events.PROJECT_CREATED, { projectId })

// 监听事件
@OnEvent(Events.PROJECT_CREATED)
handleProjectCreated(payload) { }
```

---

## 3️⃣ 数据库索引缺失

### 问题描述

关键查询缺少索引，导致：
- 查询慢 (特别是列表查询)
- 数据库负载高
- 用户体验差

### 方案选择

**添加8组关键索引** ⭐ 推荐

### 实施步骤

**需要添加索引的表**:

```typescript
// 1. projects 表 (已有部分，补充)
index('projects_org_idx').on(table.organizationId),
index('projects_git_repo_idx').on(table.gitRepoUrl),

// 2. environments 表
index('environments_project_idx').on(table.projectId),
index('environments_name_idx').on(table.name),

// 3. deployments 表
index('deployments_project_idx').on(table.projectId),
index('deployments_status_idx').on(table.status),
index('deployments_created_idx').on(table.createdAt),

// 4. project_members 表
index('project_members_project_idx').on(table.projectId),
index('project_members_user_idx').on(table.userId),

// 5. gitops_resources 表
index('gitops_resources_project_idx').on(table.projectId),
index('gitops_resources_status_idx').on(table.status),
```

**执行**:
```bash
# 生成迁移
bun run db:generate

# 应用迁移
bun run db:push
```

---

## 4️⃣ 软删除缺失

### 问题描述

部分表缺少软删除支持：
- 数据删除后无法恢复
- 不符合合规要求
- 关联数据处理复杂

### 方案选择

**添加 deletedAt 字段** ⭐ 推荐

### 实施步骤

**需要添加的表**:
- `environments`
- `deployments`  
- `repositories`
- `gitops_resources`

**代码示例**:
```typescript
// packages/core/src/database/schemas/environments.schema.ts
export const environments = pgTable('environments', {
  // ... 现有字段
  deletedAt: timestamp('deleted_at'),  // ✅ 添加
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

**查询时过滤**:
```typescript
// 查询时排除已删除
.where(and(
  eq(schema.environments.projectId, projectId),
  isNull(schema.environments.deletedAt)  // ✅ 添加过滤
))

// 软删除
.update(schema.environments)
.set({ deletedAt: new Date() })
```

---

## 5️⃣ 错误码系统缺失

### 问题描述

当前错误处理混乱：
- 错误消息不统一
- 难以定位问题
- 前端处理困难
- 无错误码标准

### 方案选择

**建立统一错误码系统** ⭐ 推荐

### 实施步骤

**1. 定义错误码**:
```typescript
// packages/types/src/errors/error-codes.ts
export const ErrorCodes = {
  // 通用 (1000-1999)
  UNKNOWN_ERROR: 'E1000',
  VALIDATION_ERROR: 'E1001',
  UNAUTHORIZED: 'E1002',
  NOT_FOUND: 'E1004',
  
  // 项目 (2000-2999)
  PROJECT_NOT_FOUND: 'E2000',
  PROJECT_ALREADY_EXISTS: 'E2001',
  
  // GitOps (3000-3999)
  GITOPS_SYNC_FAILED: 'E3000',
  GIT_AUTH_FAILED: 'E3001',
} as const
```

**2. 标准错误类**:
```typescript
// packages/types/src/errors/app-error.ts
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
  }
}

// 便捷函数
export const createError = {
  notFound: (resource: string) =>
    new AppError(ErrorCodes.NOT_FOUND, `${resource} not found`, 404),
}
```

**3. 使用**:
```typescript
if (!project) {
  throw createError.notFound('Project')
}
```

---

## 6️⃣ RBAC 权限不完整

### 问题描述

权限检查不一致：
- 部分操作缺少权限检查
- 权限逻辑分散
- 难以维护
- 安全风险

### 方案选择

**统一权限装饰器系统** ⭐ 推荐

### 实施步骤

**1. 定义权限枚举**:
```typescript
// packages/core/src/auth/permissions.ts
export enum Permission {
  PROJECT_CREATE = 'project:create',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  DEPLOYMENT_CREATE = 'deployment:create',
  MEMBER_INVITE = 'member:invite',
}
```

**2. 权限装饰器**:
```typescript
// packages/core/src/auth/permissions.decorator.ts
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata('permissions', permissions)
```

**3. 权限守卫**:
```typescript
// packages/core/src/auth/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.get('permissions', context.getHandler())
    const { user } = context.switchToHttp().getRequest()
    return required.every(p => user.permissions?.includes(p))
  }
}
```

**4. 使用**:
```typescript
@RequirePermissions(Permission.PROJECT_CREATE)
async createProject(data: CreateProjectInput) {
  // 实现
}
```

---

## 📊 实施时间表

| 任务 | 时间 | 依赖 |
|------|------|------|
| 1. 服务冗余 | 1天 | 无 |
| 2. 事件系统 | 2天 | 无 |
| 3. 数据库索引 | 1天 | 无 |
| 4. 软删除 | 1天 | 无 |
| 5. 错误码系统 | 2天 | 无 |
| 6. RBAC权限 | 3天 | 无 |

**总计**: 10天 (可并行执行部分任务)

---

## ✅ 验证清单

每完成一个任务：
- [ ] 运行类型检查: `bun run type-check`
- [ ] 运行测试: `bun test`
- [ ] 手动测试关键流程
- [ ] 检查日志无错误
- [ ] 更新 CHANGELOG.md

---

## 🎯 预期效果

- **代码质量**: 删除 ~200 行冗余代码
- **查询性能**: 提升 50-80%
- **错误定位**: 通过错误码快速定位
- **安全性**: 100% 权限检查覆盖
- **可维护性**: 事件系统统一，易于追踪

---

## 📖 详细文档

- [完整架构方案](./01_ARCHITECTURE.md)
- [数据库优化方案](./02_DATABASE.md)
- [文档标准化方案](./05_DOCUMENTATION.md)
- [安全加固方案](./04_SECURITY.md)
- [执行计划](./EXECUTION_PLAN.md)

---

**创建日期**: 2024-12-04  
**状态**: ✅ 方案完成，待执行  
**优先级**: P0 - 立即执行
