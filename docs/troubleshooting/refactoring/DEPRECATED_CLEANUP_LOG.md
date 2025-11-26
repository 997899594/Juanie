# 废弃代码清理日志

## 2024-11-24 - 队列系统清理

### 删除的文件
- ❌ `packages/core/queue/src/workers/repository.worker.ts` - 被 ProjectInitializationWorker 取代
- ❌ `packages/core/database/` - 迁移到 @juanie/core
- ❌ `packages/core/events/` - 迁移到 @juanie/core
- ❌ `packages/core/observability/` - 迁移到 @juanie/core
- ❌ `packages/core/queue/` - 迁移到 @juanie/core
- ❌ `packages/core/sse/` - 迁移到 @juanie/core
- ❌ `packages/core/tokens/` - 迁移到 @juanie/core
- ❌ `packages/core/utils/` - 迁移到 @juanie/core

### 删除的 Token
- ❌ `REPOSITORY_QUEUE` - 不再使用

### 删除的脚本
- ❌ `scripts/migrate-to-unified-core.sh` - 迁移已完成
- ❌ `scripts/fix-pending-gitops.md` - 临时文档

### 修复的问题
1. **队列路由错误**: SetupRepositoryHandler 使用了错误的任务名称
2. **功能重复**: RepositoryWorker 和 ProjectInitializationWorker 功能重叠
3. **静默失败**: GitOps 资源创建失败但不报错

### 架构改进

**之前**:
```
SetupRepositoryHandler
    ↓ 'create-repository'
RepositoryWorker (只创建仓库)
    ❌ 不创建 GitOps 资源
```

**之后**:
```
SetupRepositoryHandler
    ↓ 'initialize-project'
ProjectInitializationWorker
    ✅ 创建仓库 + GitOps 资源
```

## 清理原则

1. **单一职责**: 每个 worker 只做一件事
2. **及时清理**: 新实现完成后立即删除旧代码
3. **文档化**: 记录删除原因和替代方案
4. **验证**: 确保没有残留引用

## 相关文档

- [队列清理](./queue-cleanup.md)
- [GitOps Worker 修复](../guides/gitops-worker-fix.md)
- [Core 包整合](./core-package-consolidation.md)
