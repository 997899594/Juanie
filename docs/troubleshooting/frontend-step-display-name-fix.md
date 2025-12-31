# 前端初始化步骤显示英文内部名称问题

**日期**: 2025-01-22  
**状态**: ✅ 已修复

## 问题描述

前端显示项目初始化进度时，`create_environments` 步骤显示的是英文内部名称，而不是中文的 `displayName`。

**截图问题**：
```
✅ 解析凭证
✅ 创建 Git 仓库
✅ 推送项目模板
✅ create_environments  ← ❌ 应该显示"创建环境"
✅ 创建数据库记录
✅ 配置 GitOps
✅ 完成初始化
```

## 根本原因

前端组件 `InitializationProgress.vue` 在从数据库恢复步骤时，**没有映射 `displayName` 字段**：

```typescript
// ❌ 错误：缺少 displayName
steps.value = dbSteps.map(dbStep => ({
  step: dbStep.step,
  status: dbStep.status,
  progress: dbStep.progress,
  // ❌ 缺少 displayName
}))
```

然后在显示时，使用了 `getStepLabel(step.step)` 函数手动映射，但这个函数没有包含新增的 `create_environments` 步骤：

```typescript
function getStepLabel(step: string): string {
  const labels: Record<string, string> = {
    resolve_credentials: '解析凭证',
    create_repository: '创建 Git 仓库',
    push_template: '推送项目模板',
    create_db_records: '创建数据库记录',
    setup_gitops: '配置 GitOps',
    finalize: '完成初始化',
    // ❌ 缺少 create_environments
  }
  return labels[step] || step // 找不到就返回原始名称
}
```

## 解决方案

### 1. 添加 `displayName` 字段到类型定义

```typescript
interface InitializationStep {
  step: string
  displayName?: string // ✅ 添加可选字段
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  progress: number | null
  error: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null
}
```

### 2. 从数据库恢复时映射 `displayName`

```typescript
steps.value = dbSteps.map(dbStep => ({
  step: dbStep.step,
  displayName: dbStep.displayName, // ✅ 添加映射
  status: dbStep.status as InitializationStep['status'],
  progress: dbStep.progress,
  error: dbStep.error,
  startedAt: dbStep.startedAt,
  completedAt: dbStep.completedAt,
  duration: dbStep.duration,
}))
```

### 3. 显示时优先使用 `displayName`

```vue
<span class="text-sm font-medium">
  {{ step.displayName || getStepLabel(step.step) }}
</span>
```

**逻辑**：
- 优先使用数据库中的 `displayName`（后端定义的中文名称）
- 如果没有，fallback 到 `getStepLabel()` 函数（兼容旧数据）

### 4. 更新默认步骤初始化

```typescript
function initializeSteps() {
  steps.value = [
    { step: 'resolve_credentials', displayName: '解析凭证', ... },
    { step: 'create_repository', displayName: '创建 Git 仓库', ... },
    { step: 'push_template', displayName: '推送项目模板', ... },
    { step: 'create_environments', displayName: '创建环境', ... }, // ✅ 新增
    { step: 'create_db_records', displayName: '创建数据库记录', ... },
    { step: 'setup_gitops', displayName: '配置 GitOps', ... },
    { step: 'finalize', displayName: '完成初始化', ... },
  ]
}
```

## 修改的文件

- `apps/web/src/components/InitializationProgress.vue`
  - 添加 `displayName` 到 `InitializationStep` 接口
  - 从数据库恢复时映射 `displayName` 字段
  - 显示时优先使用 `displayName`
  - 更新 `initializeSteps()` 函数，为所有步骤添加 `displayName`

## 验证步骤

1. 重启前端服务
   ```bash
   bun run dev:web
   ```

2. 创建新项目，观察初始化进度

3. 刷新页面，确认步骤名称仍然正确显示（测试从数据库恢复）

## 预期结果

✅ 所有步骤都显示中文名称：
```
✅ 解析凭证
✅ 创建 Git 仓库
✅ 推送项目模板
✅ 创建环境  ← ✅ 正确显示
✅ 创建数据库记录
✅ 配置 GitOps
✅ 完成初始化
```

## 经验教训

### 1. 数据库字段要完整映射

**问题**: 数据库有 `display_name` 字段，但前端恢复时没有映射。

**解决**: 
- 确保前端类型定义与数据库 schema 一致
- 从数据库恢复时，映射所有需要的字段

### 2. 避免硬编码映射函数

**问题**: `getStepLabel()` 函数需要手动维护，容易遗漏新步骤。

**解决**:
- 优先使用数据库中的 `displayName`（单一数据源）
- `getStepLabel()` 只作为 fallback（兼容旧数据）

### 3. 后端是唯一数据源

**原则**: 步骤的定义（名称、顺序、权重）应该由后端统一管理，前端只负责显示。

**好处**:
- 添加新步骤时，只需修改后端
- 前端自动显示正确的步骤名称
- 避免前后端不一致

## 未来改进

### 1. 使用 tRPC 类型推导

让前端自动获得后端的类型定义：

```typescript
// 后端
export const getInitializationSteps = publicProcedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ input }) => {
    return await db.select().from(projectInitializationSteps)
      .where(eq(projectInitializationSteps.projectId, input.projectId))
  })

// 前端自动获得类型
type InitializationStep = Awaited<ReturnType<typeof trpc.projects.getInitializationSteps.query>>[0]
```

### 2. 删除 `getStepLabel()` 函数

既然数据库已经有 `displayName`，就不需要前端维护映射表了：

```typescript
// ❌ 删除这个函数
function getStepLabel(step: string): string { ... }

// ✅ 直接使用 displayName
<span>{{ step.displayName }}</span>
```

## 总结

这是一个典型的 **数据映射不完整** 问题：

- ✅ 后端正确保存了 `displayName`
- ❌ 前端恢复时没有映射这个字段
- ❌ 前端依赖硬编码的映射函数，遗漏了新步骤

修复后，前端直接使用数据库中的 `displayName`，不再需要维护映射表。
