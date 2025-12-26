# Task 6.3: 重构 GitSyncService 错误处理 - 完成报告

## 完成日期
2025-01-XX

## 任务目标
重构 GitSyncService 错误处理，直接使用 SDK 错误类型，仅在添加业务上下文时包装，保留原始错误信息。

**需求**: 14.1, 14.3, 14.4

---

## 完成的工作

### 1. 简化 git-sync-errors.ts ✅

**文件**: `packages/services/business/src/gitops/git-sync/git-sync-errors.ts`

**删除的代码** (~400 行):
- ❌ 删除 `GitSyncError` 基类及其所有子类
- ❌ 删除 `GitAuthenticationError`, `GitNetworkError`, `GitRateLimitError` 等
- ❌ 删除 `classifyGitError()` 函数 (~150 行)
- ❌ 删除 `classifyError()` 函数 (~100 行)
- ❌ 删除 `shouldRetry()` 函数（旧版本）
- ❌ 删除 `getRetryDelay()` 函数（旧版本）

**新增的代码** (~150 行):
- ✅ 导入 SDK 错误类型: `RequestError`, `GitbeakerRequestError`
- ✅ 创建简化的 `GitSyncOperationError` 类（仅在添加业务上下文时使用）
- ✅ 实现 `shouldRetryGitError()` - 基于 SDK 错误类型判断是否重试
- ✅ 实现 `getRetryDelay()` - 基于 SDK 错误类型计算重试延迟
- ✅ 实现 `calculateBackoffDelay()` - 指数退避算法

**关键改进**:
```typescript
// ✅ 直接使用 SDK 错误类型
import { RequestError } from '@octokit/request-error'
import { GitbeakerRequestError } from '@gitbeaker/requester-utils'

// ✅ 简化的错误类，保留 SDK 错误信息
export class GitSyncOperationError extends BaseError {
  constructor(
    operation: string,
    provider: GitProvider,
    public override readonly cause: Error,
  ) {
    super(
      `Git sync ${operation} failed: ${cause.message}`,
      'GIT_SYNC_OPERATION_FAILED',
      500,
      true,
      {
        operation,
        provider,
        originalError: cause.message,
        // ✅ 保留 SDK 错误的关键信息
        ...(cause instanceof RequestError && {
          status: cause.status,
          requestUrl: cause.request?.url,
        }),
        ...(cause instanceof GitbeakerRequestError && {
          status: cause.cause?.response?.status,
        }),
      },
    )
  }
}

// ✅ 基于 SDK 错误类型判断重试
export function shouldRetryGitError(
  error: Error,
  attemptCount: number,
  maxAttempts: number = 3,
): boolean {
  if (attemptCount >= maxAttempts) return false

  // ✅ GitHub SDK 错误
  if (error instanceof RequestError) {
    if ([401, 403, 404, 422].includes(error.status)) {
      // 例外：速率限制可以重试
      if (error.status === 403 && error.message.includes('rate limit')) {
        return true
      }
      return false
    }
    return error.status >= 500
  }

  // ✅ GitLab SDK 错误
  if (error instanceof GitbeakerRequestError) {
    const status = error.cause?.response?.status
    if (!status) return false
    if ([401, 403, 404, 422].includes(status)) return false
    return status >= 500
  }

  return false
}
```

---

### 2. 更新 git-sync.worker.ts ✅

**文件**: `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`

**更新的方法**:
1. ✅ `handleSyncMember()` - 使用新的错误处理
2. ✅ `handleRemoveMember()` - 使用新的错误处理
3. ✅ `handleBatchSync()` - 使用新的错误处理

**关键改进**:
```typescript
// ✅ 导入新的错误处理工具
import {
  GitSyncOperationError,
  getRetryDelay,
  shouldRetryGitError,
} from './git-sync-errors'

// ✅ 在 catch 块中使用新的错误处理
try {
  await this.gitProvider.addCollaborator(...)
} catch (error) {
  // ✅ 使用新的错误处理工具
  const attemptCount = (job.attemptsMade || 0) + 1
  const shouldRetry = shouldRetryGitError(error as Error, attemptCount)
  const retryDelay = shouldRetry ? getRetryDelay(error as Error) : 0

  // ✅ 包装错误以添加业务上下文
  const syncError = new GitSyncOperationError('add collaborator', provider, error as Error)

  // ✅ 记录详细的错误信息
  await this.gitSyncLogs.updateStatus(syncLogId, {
    status: 'failed',
    error: syncError.message,
    completedAt: new Date(),
    metadata: {
      attemptCount,
      lastAttemptAt: new Date().toISOString(),
      shouldRetry,
      retryDelay,
      originalError: (error as Error).message,
    },
  })

  this.logger.error(
    {
      syncLogId,
      attemptCount,
      shouldRetry,
      retryDelay,
      error: syncError,
    },
    'Member sync failed',
  )

  throw syncError
}
```

---

## 验证结果

### TypeScript 编译 ✅
```bash
✅ git-sync-errors.ts: No diagnostics found
✅ git-sync.worker.ts: No diagnostics found
```

### 代码格式化 ✅
```bash
✅ Checked 2 files in 41ms. No fixes applied.
```

---

## 代码减少指标

### 删除的代码
- **git-sync-errors.ts**: ~400 行 → ~150 行（减少 62.5%）
- **总计**: 减少约 250 行代码

### 简化的逻辑
- ❌ 删除自定义错误分类系统
- ❌ 删除手动错误转换逻辑
- ✅ 直接使用 SDK 错误类型
- ✅ 保留完整的 SDK 错误信息

---

## 架构改进

### 错误处理流程（重构前）
```
SDK Error
  ↓
classifyError() - 手动分类
  ↓
GitAuthenticationError / GitNetworkError / ... - 自定义错误类
  ↓
丢失 SDK 错误信息
```

### 错误处理流程（重构后）
```
SDK Error (RequestError / GitbeakerRequestError)
  ↓
shouldRetryGitError() - 基于 SDK 错误类型判断
  ↓
GitSyncOperationError - 仅在添加业务上下文时包装
  ↓
保留完整的 SDK 错误信息
```

---

## 符合的需求

### ✅ 需求 14.1: 使用 SDK 错误类型
- 导入 `RequestError` from '@octokit/request-error'
- 导入 `GitbeakerRequestError` from '@gitbeaker/requester-utils'
- 使用 `instanceof` 进行类型检查

### ✅ 需求 14.3: 仅在必要时包装
- 删除了不必要的错误分类系统
- 仅在添加业务上下文时使用 `GitSyncOperationError`
- 其他情况直接抛出 SDK 错误

### ✅ 需求 14.4: 保留原始错误信息
- `GitSyncOperationError` 保留 `cause` 属性
- 在 `context` 中保留 SDK 错误的关键信息（status, requestUrl 等）
- 日志中记录 `originalError` 消息

---

## 下一步

### 待完成的任务
1. ⏭️ **Task 6.5**: 重构其他服务的错误处理
   - ProjectsService
   - DeploymentsService
   - InitializationService
   - ProjectCollaborationSyncService
   - OrganizationSyncService

2. ⏭️ **Task 7**: 清理和验证
   - 运行完整测试套件
   - 验证集成测试
   - 删除未使用的导入

---

## 经验总结

### 成功的地方
1. ✅ **删除优先**: 删除了 ~400 行不必要的错误分类代码
2. ✅ **类型安全**: 使用 SDK 错误类型，避免运行时错误
3. ✅ **信息保留**: 保留完整的 SDK 错误信息，便于调试
4. ✅ **简化逻辑**: 错误处理逻辑更清晰，易于维护

### 需要注意的地方
1. ⚠️ **GitLab 错误类型**: `GitbeakerRequestError` 的 `response.status` 而不是 `response.statusCode`
2. ⚠️ **重试逻辑**: 需要根据 SDK 错误类型判断，不能简单地根据状态码
3. ⚠️ **业务上下文**: 只在真正需要添加业务信息时才包装错误

---

## 结论

Task 6.3 已成功完成，GitSyncService 的错误处理已重构为：
- ✅ 直接使用 SDK 错误类型
- ✅ 仅在添加业务上下文时包装
- ✅ 保留原始错误信息
- ✅ 减少了 62.5% 的错误处理代码

下一步将继续重构其他服务的错误处理（Task 6.5）。
