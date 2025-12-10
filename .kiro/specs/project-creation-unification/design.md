# 项目创建统一化 - 设计文档

## 概述

将项目创建从两个路径（简单创建 + 模板初始化）统一为单一路径，所有创建都通过 ProjectOrchestrator 处理。

## 架构

### 当前架构（问题）

```
ProjectsService.create()
  ├─ if (templateId || repository)
  │   └─ ProjectOrchestrator.createAndInitialize() ✅
  │       ├─ 创建项目
  │       ├─ 应用模板
  │       ├─ 连接仓库
  │       ├─ 创建环境
  │       └─ 设置 GitOps
  │
  └─ else (简单创建) ❌ 冗余路径
      ├─ 直接插入数据库
      ├─ 添加成员
      └─ 记录日志
```

### 目标架构（统一）

```
ProjectsService.create()
  └─ ProjectOrchestrator.createAndInitialize() ✅ 唯一路径
      ├─ 创建项目（必需）
      ├─ 应用模板（可选）
      ├─ 连接仓库（可选）
      ├─ 创建环境（可选）
      └─ 设置 GitOps（可选）
```

## 组件和接口

### 1. 统一输入类型

**删除：**
```typescript
// ❌ 删除 CreateProjectInput
export type CreateProjectInput = z.infer<typeof createProjectSchema>
```

**重命名：**
```typescript
// ✅ CreateProjectWithTemplateInputType → CreateProjectInput
export interface CreateProjectInput {
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

### 2. ProjectsService.create()

**重构后：**
```typescript
async create(
  userId: string,
  data: CreateProjectInput, // 统一类型
): Promise<typeof schema.projects.$inferSelect & { jobIds?: string[] }> {
  // 1. 检查组织
  const organization = await this.getOrganization(data.organizationId)
  
  // 2. 检查权限
  await this.assertCan(userId, 'create', 'Project')
  
  // 3. 统一使用 orchestrator（无条件分支）
  const result = await this.orchestrator.createAndInitialize(userId, {
    ...data,
    visibility: data.visibility ?? 'private',
  })
  
  // 4. 处理结果
  if (!result.success) {
    throw new ProjectInitializationError(result.projectId, result.error)
  }
  
  // 5. 添加创建者为 owner
  await this.addProjectMember(result.projectId, userId, 'owner')
  
  // 6. 记录审计日志
  await this.auditLogs.log({
    userId,
    organizationId: data.organizationId,
    action: 'project.created',
    resourceType: 'project',
    resourceId: result.projectId,
    metadata: {
      templateId: data.templateId,
      hasRepository: !!data.repository,
    },
  })
  
  // 7. 返回项目
  return await this.getProjectById(result.projectId)
}
```

### 3. ProjectOrchestrator 增强

**支持最小化创建：**
```typescript
async createAndInitialize(
  userId: string,
  data: CreateProjectInput,
): Promise<InitializationResult> {
  // 1. 创建项目（必需）
  const project = await this.createProject(data)
  
  // 2. 应用模板（可选）
  if (data.templateId) {
    await this.applyTemplate(project.id, data.templateId, data.templateConfig)
  }
  
  // 3. 连接仓库（可选）
  if (data.repository) {
    await this.connectRepository(project.id, data.repository)
  }
  
  // 4. 创建默认环境（如果没有模板）
  if (!data.templateId) {
    await this.createDefaultEnvironments(project.id)
  }
  
  // 5. 设置 GitOps（如果有仓库）
  if (data.repository) {
    await this.setupGitOps(project.id)
  }
  
  return {
    success: true,
    projectId: project.id,
    createdResources: {...},
    jobIds: [...],
  }
}
```

## 数据模型

无变化，数据库 schema 保持不变。

## 正确性属性

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: 单一路径

*For any* project creation request, the system should use ProjectOrchestrator regardless of whether template or repository is provided
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: 类型统一

*For any* project creation request, the input type should be CreateProjectInput without type guards or casting
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: 功能保持

*For any* project creation scenario (simple, with template, with repository), all expected resources should be created correctly
**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5**

### Property 4: 成员自动添加

*For any* project creation, the creator should automatically become project owner
**Validates: Requirements 3.4**

### Property 5: 审计日志

*For any* project creation, an audit log entry should be created with correct metadata
**Validates: Requirements 3.5**

## 错误处理

保持现有错误处理：
- `OrganizationNotFoundError` - 组织不存在
- `PermissionDeniedError` - 权限不足
- `ProjectInitializationError` - 初始化失败
- `ProjectNotFoundError` - 项目未找到

## 测试策略

### 单元测试

1. **简单项目创建**
   - 输入：organizationId, name, slug
   - 验证：项目创建，创建者为 owner，无模板/仓库

2. **模板项目创建**
   - 输入：organizationId, name, slug, templateId
   - 验证：项目创建，模板应用，创建者为 owner

3. **仓库项目创建**
   - 输入：organizationId, name, slug, repository
   - 验证：项目创建，仓库连接，GitOps 设置

4. **完整项目创建**
   - 输入：organizationId, name, slug, templateId, repository
   - 验证：所有资源创建

### 属性测试

**Feature: project-creation-unification, Property 1: Single path**
```typescript
test('all project creation uses orchestrator', async () => {
  const spy = jest.spyOn(orchestrator, 'createAndInitialize')
  
  // 简单创建
  await service.create(userId, { organizationId, name, slug })
  expect(spy).toHaveBeenCalledTimes(1)
  
  // 模板创建
  await service.create(userId, { organizationId, name, slug, templateId })
  expect(spy).toHaveBeenCalledTimes(2)
  
  // 仓库创建
  await service.create(userId, { organizationId, name, slug, repository })
  expect(spy).toHaveBeenCalledTimes(3)
})
```

**Feature: project-creation-unification, Property 3: Functionality preserved**
```typescript
test('simple creation works correctly', async () => {
  const result = await service.create(userId, {
    organizationId,
    name: 'Test Project',
    slug: 'test-project',
  })
  
  expect(result.id).toBeDefined()
  expect(result.name).toBe('Test Project')
  
  // 验证成员
  const members = await service.listMembers(userId, result.id)
  expect(members).toContainEqual(
    expect.objectContaining({ userId, role: 'owner' })
  )
})
```

## 迁移计划

### 阶段 1: 类型重构
1. 重命名 `CreateProjectWithTemplateInputType` → `CreateProjectInput`
2. 删除旧的 `CreateProjectInput` 类型
3. 更新所有导入

### 阶段 2: Service 重构
1. 删除 `ProjectsService.create()` 中的条件分支
2. 统一使用 `orchestrator.createAndInitialize()`
3. 移除类型守卫和类型转换

### 阶段 3: Orchestrator 增强
1. 支持最小化创建（无模板/仓库）
2. 添加默认环境创建逻辑
3. 优化可选步骤处理

### 阶段 4: API 更新
1. 更新 projects.router.ts 使用统一类型
2. 更新 Zod schema
3. 删除类型转换逻辑

### 阶段 5: 前端更新
1. 更新 ProjectWizard 组件
2. 更新 useProjects composable
3. 确保所有创建场景正常工作

### 阶段 6: 测试和验证
1. 运行所有单元测试
2. 运行属性测试
3. 手动测试所有创建场景
4. 验证审计日志正确

### 阶段 7: 清理
1. 删除所有"向后兼容"注释
2. 删除未使用的类型
3. 更新文档

## 风险和缓解

### 风险 1: 破坏现有功能
**缓解:** 完整的测试覆盖，逐步迁移

### 风险 2: 性能影响
**缓解:** Orchestrator 已经是异步的，性能影响可忽略

### 风险 3: 前端兼容性
**缓解:** 前端已经使用扩展类型，无需修改

## 成功标准

1. ✅ 只有一个项目创建路径
2. ✅ 只有一个输入类型
3. ✅ 无条件分支
4. ✅ 无类型守卫
5. ✅ 所有测试通过
6. ✅ 所有功能正常
7. ✅ 代码更简洁
8. ✅ 无"向后兼容"注释
