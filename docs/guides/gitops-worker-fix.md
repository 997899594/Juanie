# GitOps 资源创建修复

## 问题描述

项目初始化时，GitOps 资源只在数据库中创建（状态为 `pending`），但没有在 K8s 集群中实际创建资源（Namespace、GitRepository、Kustomization）。

## 根本原因

### 问题 1: 错误的队列路由

`SetupRepositoryHandler` 使用了错误的任务名称：

```typescript
// ❌ 错误：使用 'create-repository' 任务名称
const job = await this.queue.add('create-repository', {
  projectId: context.projectId,
  userId: context.userId,
  // ...
})
```

这导致任务被 `repository.worker.ts` 处理，而不是 `project-initialization.worker.ts`。

### 问题 2: Worker 功能差异

- **repository.worker.ts**: 只创建 Git 仓库和数据库记录，**不创建 K8s 资源**
- **project-initialization.worker.ts**: 完整流程，包括创建 K8s GitOps 资源

### 问题 3: 静默失败

`project-initialization.worker.ts` 中有 userId 检查：

```typescript
const userId = job.data.userId || ''
if (!userId) {
  this.logger.warn('No userId in job data, skipping GitOps setup')
  await job.log('⚠️ GitOps 资源创建已跳过（无用户信息）')
  return false  // 不抛错，静默跳过
}
```

即使 userId 存在，由于任务被错误的 worker 处理，GitOps 资源也不会被创建。

## 解决方案

### 修改 SetupRepositoryHandler

将任务名称从 `'create-repository'` 改为 `'initialize-project'`，确保任务被正确的 worker 处理：

```typescript
// ✅ 正确：使用 'initialize-project' 任务名称
const job = await this.queue.add('initialize-project', {
  projectId: context.projectId,
  userId: context.userId,
  organizationId: context.organizationId,
  repository: config,
  templateId: context.templateId,
  environmentIds: context.environmentIds,
})
```

### 队列架构说明

```
SetupRepositoryHandler
    ↓ 添加任务到
PROJECT_INITIALIZATION_QUEUE ('project-initialization')
    ↓ 任务名称: 'initialize-project'
    ↓ 被处理
ProjectInitializationWorker
    ↓ 执行完整流程
    ├─ 创建 Git 仓库
    ├─ 推送模板代码
    ├─ 创建数据库记录
    └─ 创建 K8s GitOps 资源 ✅
```

## 验证步骤

### 1. 清理旧数据

```bash
bun run scripts/clean-database.ts
```

### 2. 重启服务

```bash
# 停止现有服务
pkill -f "bun.*api-gateway"

# 启动服务
bun run dev:api
```

### 3. 创建新项目

通过 Web UI 创建一个新项目，选择模板和 GitLab 仓库。

### 4. 检查 K8s 资源

```bash
# 检查命名空间
kubectl get namespaces | grep project-

# 检查 GitRepository
kubectl get gitrepositories -A

# 检查 Kustomization
kubectl get kustomizations -A
```

### 5. 检查数据库

```bash
bun run scripts/diagnose-gitops-pending.ts
```

应该看到 GitOps 资源状态从 `pending` 变为 `ready` 或 `synced`。

## 相关文件

- `packages/services/business/src/projects/initialization/handlers/setup-repository.handler.ts` - 修复的文件
- `packages/core/queue/src/workers/project-initialization.worker.ts` - 正确的 worker
- `packages/core/queue/src/workers/repository.worker.ts` - 旧的 worker（仅处理仓库操作）
- `packages/core/queue/src/queue.module.ts` - 队列注册

## 后续优化

1. **重构 repository.worker.ts**: 考虑废弃或重命名，避免混淆
2. **统一任务命名**: 建立清晰的任务命名约定
3. **改进错误处理**: 将静默失败改为显式错误
4. **添加集成测试**: 验证完整的项目初始化流程

## 时间线

- **2024-11-24**: 发现问题 - GitOps 资源停留在 pending 状态
- **2024-11-24**: 定位根因 - 错误的队列路由
- **2024-11-24**: 实施修复 - 更新 SetupRepositoryHandler
