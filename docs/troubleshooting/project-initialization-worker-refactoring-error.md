# 项目初始化 Worker 重构错误修复

## 问题描述

项目初始化失败，错误信息：
```
this.initializationSteps.updateStepProgressWithNotification is not a function
```

## 根本原因

在之前的重构中，Worker 代码调用了 `InitializationStepsService` 中不存在的方法：
1. `updateStepProgressWithNotification()` - 该方法从未实现
2. `markCompleted()` - 该方法从未实现
3. `this.progressManager.markFailed()` - `progressManager` 依赖已被移除

这些是重构过程中遗留的错误代码。

## 解决方案

### 1. 修复 `updateStepProgress()` 方法

**位置**: `packages/services/business/src/queue/project-initialization.worker.ts`

**修改前**:
```typescript
// 使用 InitializationStepsService 统一接口（包含缓存和通知）
await this.initializationSteps.updateStepProgressWithNotification(
  projectId,
  stepName,
  stepProgress,
  message,
)
```

**修改后**:
```typescript
// 更新数据库中的步骤进度
await this.initializationSteps.updateStepProgress(
  projectId,
  stepName,
  stepProgress.toString(),
)
```

### 2. 移除 `markCompleted()` 调用

**位置**: `packages/services/business/src/queue/project-initialization.worker.ts` (finalize 步骤)

**修改前**:
```typescript
await this.updateStepProgress(job, 'finalize', 100, '项目初始化完成！')
await this.initializationSteps.completeStep(projectId, 'finalize')

// 标记完成（自动发布完成事件）
await this.initializationSteps.markCompleted(projectId)
```

**修改后**:
```typescript
await this.updateStepProgress(job, 'finalize', 100, '项目初始化完成！')
await this.initializationSteps.completeStep(projectId, 'finalize')
```

**原因**: `completeStep` 已经完成了步骤标记，不需要额外的 `markCompleted` 调用。

### 3. 移除 `progressManager` 引用

**位置**: `packages/services/business/src/queue/project-initialization.worker.ts` (错误处理部分)

**修改前**:
```typescript
// 标记失败（自动发布失败事件）
const errorMessage = error instanceof Error ? error.message : String(error)
await this.progressManager.markFailed(projectId, errorMessage)

throw error
```

**修改后**:
```typescript
throw error
```

**原因**: 项目状态已经在前面通过数据库更新设置为 `failed`，不需要额外的 `progressManager` 调用。

## 编译问题

修改代码后，需要手动重新编译 `@juanie/service-business` 包：

```bash
cd packages/services/business
bun run build
```

**原因**: Turbo 的 watch 模式有时不会自动触发重新编译，导致运行时仍使用旧代码。

## 验证

修复并重新编译后，项目初始化流程应该能够正常运行：
1. ✅ 步骤进度正确更新到数据库
2. ✅ BullMQ 进度同步更新
3. ✅ 错误处理正确执行
4. ✅ TypeScript 编译通过

## 相关文件

- `packages/services/business/src/queue/project-initialization.worker.ts` - Worker 主文件
- `packages/services/business/src/projects/initialization/initialization-steps.service.ts` - 步骤服务

## 经验教训

1. **重构时要彻底** - 删除旧代码时要搜索所有引用
2. **测试覆盖** - 重构后应该立即测试，避免运行时错误
3. **代码审查** - 重构 PR 应该仔细检查是否有遗漏的引用
4. **TypeScript 限制** - 由于使用了依赖注入，TypeScript 无法在编译时检测到这类错误
5. **手动编译** - 修改 packages 代码后，确保手动运行 `bun run build` 触发重新编译

## 修复时间

2024-12-23 19:20
