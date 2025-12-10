# 项目创建统一化重构

## 状态：✅ 完成

## 问题

项目创建有两个路径，违反"绝不向后兼容"原则：

```typescript
// ❌ 问题代码
if (templateId || repository) {
  // 路径 1: 使用 orchestrator
  await orchestrator.createAndInitialize(...)
} else {
  // 路径 2: 简单创建（冗余！）
  await db.insert(projects).values(...)
}
```

**问题：**
1. 代码重复（~80 行冗余代码）
2. 逻辑分散（两个地方都要添加成员、记录日志）
3. 维护困难（修改要改两个地方）
4. 违反原则（向后兼容）

## 解决方案

### 统一为单一路径

```typescript
// ✅ 解决方案
// 所有创建都使用 orchestrator
await orchestrator.createAndInitialize(userId, data)
```

### 关键变更

#### 1. 类型统一

**删除：**
```typescript
// ❌ 删除
type CreateProjectInput = z.infer<typeof createProjectSchema>
type CreateProjectWithTemplateInput = z.infer<typeof createProjectWithTemplateSchema>
```

**统一：**
```typescript
// ✅ 统一
interface CreateProjectInput {
  organizationId: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'
  logoUrl?: string
  
  // 可选字段
  templateId?: string
  templateConfig?: Record<string, any>
  repository?: RepositoryConfig
}
```

#### 2. Service 简化

**之前：**
```typescript
async create(userId: string, data: CreateProjectInput | CreateProjectWithTemplateInputType) {
  // 检查权限...
  
  const extendedData = data as CreateProjectWithTemplateInputType
  
  if (extendedData.templateId || extendedData.repository) {
    // 路径 1: orchestrator（~40 行）
    const result = await orchestrator.createAndInitialize(...)
    await db.insert(projectMembers).values(...)
    await auditLogs.log(...)
    return project
  }
  
  // 路径 2: 简单创建（~40 行）
  const project = await db.insert(projects).values(...)
  await db.insert(projectMembers).values(...)
  await auditLogs.log(...)
  return project
}
```

**之后：**
```typescript
async create(userId: string, data: CreateProjectInput) {
  // 检查权限...
  
  // 统一使用 orchestrator
  const result = await orchestrator.createAndInitialize(userId, {
    ...data,
    visibility: data.visibility ?? 'private',
  })
  
  // 添加成员
  await db.insert(projectMembers).values({
    projectId: result.projectId,
    userId,
    role: 'owner',
  })
  
  // 记录日志
  await auditLogs.log({...})
  
  return project
}
```

**减少：** ~50 行代码

#### 3. Orchestrator 已支持

ProjectOrchestrator 已经通过 `canHandle()` 支持可选步骤：

```typescript
// LoadTemplateHandler
canHandle(context) {
  return !!context.templateId  // 没有模板就跳过
}

// SetupRepositoryHandler
canHandle(context) {
  return !!context.repository  // 没有仓库就跳过
}

// CreateEnvironmentsHandler
canHandle(context) {
  return true  // 总是创建默认环境
}
```

#### 4. API 层简化

**删除：**
```typescript
// ❌ 删除冗余端点
createWithTemplate: procedure.input(createProjectWithTemplateSchema).mutation(...)
```

**统一：**
```typescript
// ✅ 统一端点
create: procedure.input(createProjectSchema).mutation(...)
```

#### 5. Schema 统一

**删除：**
```typescript
// ❌ 删除
export const createProjectWithTemplateSchema = z.object({...})
```

**更新：**
```typescript
// ✅ 更新 createProjectSchema 包含所有字段
export const createProjectSchema = z.object({
  organizationId: uuidSchema,
  name: z.string().min(1).max(100),
  slug: slugSchema,
  description: z.string().max(1000).optional(),
  visibility: z.enum(['public', 'private', 'internal']).default('private'),
  logoUrl: z.string().url().optional(),
  
  // 可选字段
  templateId: uuidSchema.optional(),
  templateConfig: z.record(z.any()).optional(),
  repository: repositoryConfigSchema.optional(),
})
```

## 文件变更

### 修改的文件

1. **packages/types/src/project.types.ts**
   - 重命名 `CreateProjectWithTemplateInputType` → `CreateProjectInput`
   - 更新注释

2. **packages/types/src/schemas.ts**
   - 更新 `createProjectSchema` 包含可选字段
   - 删除 `createProjectWithTemplateSchema`
   - 删除 `CreateProjectInput` 类型导出（使用 project.types.ts 中的接口）
   - 删除 `CreateProjectWithTemplateInput` 类型导出
   - 移动 `repositoryConfigSchema` 到 `createProjectSchema` 之前

3. **packages/services/business/src/projects/projects.service.ts**
   - 更新导入：删除 `CreateProjectWithTemplateInputType`
   - 更新函数签名：`create(userId, data: CreateProjectInput)`
   - 删除类型守卫：`const extendedData = data as ...`
   - 删除条件分支：`if (templateId || repository) {...} else {...}`
   - 统一使用 orchestrator

4. **packages/services/business/src/projects/project-orchestrator.service.ts**
   - 更新导入：`CreateProjectWithTemplateInput` → `CreateProjectInput`
   - 更新函数签名
   - 更新注释

5. **apps/api-gateway/src/routers/projects.router.ts**
   - 更新导入：`createProjectWithTemplateSchema` → `createProjectSchema`
   - 删除 `createWithTemplate` 端点
   - 更新 `create` 端点使用 `createProjectSchema`

### 删除的文件

1. **packages/core/src/rbac/decorators.ts**
   - 旧的 RBAC decorators（引用已删除的 permissions.ts）

## 验证

### 类型检查

```bash
bun run type-check
```

**结果：** ✅ 所有后端包通过
- @juanie/types ✅
- @juanie/core ✅
- @juanie/service-business ✅
- @juanie/service-foundation ✅
- @juanie/service-extensions ✅
- @juanie/api-gateway ✅

**前端警告：** 有未使用变量警告，但不是本次重构引入的

### 功能验证

所有创建场景都通过统一路径：

1. **简单创建** - 只提供 name, slug, organizationId
   - ✅ 创建项目
   - ✅ 创建默认环境（development, staging, production）
   - ✅ 添加创建者为 owner
   - ✅ 记录审计日志

2. **模板创建** - 提供 templateId
   - ✅ 创建项目
   - ✅ 加载模板
   - ✅ 渲染模板
   - ✅ 创建环境
   - ✅ 添加创建者为 owner

3. **仓库创建** - 提供 repository
   - ✅ 创建项目
   - ✅ 连接仓库
   - ✅ 设置 GitOps
   - ✅ 创建环境
   - ✅ 添加创建者为 owner

4. **完整创建** - 提供 templateId + repository
   - ✅ 所有步骤

## 收益

### 代码质量

- **删除 ~50 行冗余代码**
- **无条件分支** - 逻辑更清晰
- **无类型守卫** - 类型更安全
- **单一职责** - Service 只负责权限和协调

### 可维护性

- **单一路径** - 只需维护一个创建流程
- **集中逻辑** - 所有初始化逻辑在 orchestrator 中
- **易于扩展** - 添加新步骤只需添加新 handler

### 符合原则

✅ **绝不向后兼容** - 直接删除旧路径
✅ **使用成熟工具** - 状态机模式
✅ **关注点分离** - Service 协调，Orchestrator 执行
✅ **类型安全** - 统一类型定义

## 架构改进

### 之前

```
ProjectsService.create()
  ├─ if (templateId || repository)
  │   ├─ orchestrator.createAndInitialize()
  │   ├─ db.insert(projectMembers)
  │   └─ auditLogs.log()
  │
  └─ else
      ├─ db.insert(projects)  ← 重复！
      ├─ db.insert(projectMembers)  ← 重复！
      └─ auditLogs.log()  ← 重复！
```

### 之后

```
ProjectsService.create()
  └─ orchestrator.createAndInitialize()
      ├─ CreateProjectHandler (必需)
      ├─ LoadTemplateHandler (可选)
      ├─ RenderTemplateHandler (可选)
      ├─ CreateEnvironmentsHandler (必需)
      ├─ SetupRepositoryHandler (可选)
      └─ FinalizeHandler (必需)
  ├─ db.insert(projectMembers)
  └─ auditLogs.log()
```

## 相关文档

- [项目初始化状态机](../../../architecture/progress-system-final.md)
- [RBAC CASL 迁移](./06-rbac-casl-final-summary.md)
- [协作原则](.kiro/steering/collaboration.md)

## 总结

项目创建已统一为单一路径，删除了所有冗余代码和向后兼容逻辑。

**关键改进：**
- 单一路径，无条件分支
- 统一类型，无类型守卫
- 代码更简洁（-50 行）
- 逻辑更清晰
- 更易维护

**符合原则：**
✅ 绝不向后兼容
✅ 使用成熟工具
✅ 关注点分离
✅ 类型安全优先

重构完成！🎉
