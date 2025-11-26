# 项目初始化流程清理 - 第二阶段完成

## 执行时间
2025-11-25

## 清理内容

### 1. 删除未使用的 CreateGitOpsHandler ✅

**删除的文件：**
- `packages/services/business/src/projects/initialization/handlers/create-gitops.handler.ts`

**修改的文件：**
- `packages/services/business/src/projects/initialization/initialization.module.ts`
  - 移除 CreateGitOpsHandler 的导入和注册
- `packages/services/business/src/projects/project-orchestrator.service.ts`
  - 移除 CreateGitOpsHandler 的注入和注册
- `packages/services/business/src/projects/initialization/index.ts`
  - 移除 CreateGitOpsHandler 的导出

**原因：**
- GitOps 创建实际通过 Worker + 事件驱动完成
- CreateGitOpsHandler 从未被真正执行
- 实际流程：SetupRepositoryHandler → Queue → Worker → Event → GitOpsEventHandlerService

### 2. 简化状态机状态 ✅

**状态变化：**

之前（9个状态）：
```
IDLE
CREATING_PROJECT
LOADING_TEMPLATE
RENDERING_TEMPLATE
CREATING_ENVIRONMENTS
SETTING_UP_REPOSITORY
CREATING_GITOPS  ← 删除
FINALIZING
COMPLETED
FAILED
```

现在（8个状态）：
```
IDLE
CREATING_PROJECT
LOADING_TEMPLATE
RENDERING_TEMPLATE
CREATING_ENVIRONMENTS
SETTING_UP_REPOSITORY  → 直接到 FINALIZING
FINALIZING
COMPLETED
FAILED
```

**修改的文件：**
- `packages/services/business/src/projects/initialization/types.ts`
  - 移除 CREATING_GITOPS 状态
  - 移除 GITOPS_CREATED 事件
- `packages/services/business/src/projects/initialization/state-machine.ts`
  - 更新状态转换表：SETTING_UP_REPOSITORY → FINALIZING
  - 移除 CREATING_GITOPS 的事件映射

**原因：**
- CREATING_GITOPS 状态不执行任何操作
- GitOps 创建在 Worker 中异步完成，不在状态机流程中

### 3. 简化认证参数传递 ✅

**移除的参数：**
- `accessToken` 从整个调用链中移除

**修改的接口：**

```typescript
// packages/core/src/events/event-types.ts
export interface GitOpsSetupRequestedEvent {
  projectId: string
  repositoryId: string
  repositoryUrl: string
  repositoryBranch: string
  // accessToken: string  ← 删除
  userId: string  // 只需要 userId，在需要时获取 token
  environments: Array<...>
  jobId?: string
}
```

**修改的文件：**
- `packages/core/src/events/event-types.ts`
  - 移除 accessToken 字段
- `packages/services/business/src/projects/project-initialization.service.ts`
  - requestGitOpsSetup 方法移除 accessToken 参数
- `packages/services/business/src/queue/project-initialization.worker.ts`
  - 调用 requestGitOpsSetup 时不传递 accessToken

**原因：**
- accessToken 在整个调用链中传递，但只在 GitAuthService 中使用一次
- GitAuthService 可以通过 userId 自己获取 OAuth token
- 减少参数传递，降低出错风险

## 保留的架构

### FluxResourcesService.setupProjectGitOps 的 credential 参数

**决定：保留**

**原因：**
- 职责分离清晰：
  - GitOpsEventHandlerService：负责创建 Git 凭证（GitHub Deploy Key / GitLab Token）
  - FluxResourcesService：负责创建 K8s 资源（使用传入的凭证）
- credential 包含重要信息：
  - 凭证类型（github_deploy_key / gitlab_project_token）
  - SSH 私钥或 Access Token
  - 用于判断 Secret 类型（ssh-auth / basic-auth）
- 如果移除，FluxResourcesService 需要重新查询数据库，增加耦合

## 实际流程（清理后）

```
用户创建项目
  ↓
ProjectOrchestrator (状态机)
  ↓
SetupRepositoryHandler (添加到队列)
  ↓
Worker 异步执行
  ↓
ProjectInitializationService.requestGitOpsSetup(userId)  ← 只传 userId
  ↓
发布事件 GitOpsEvents.SETUP_REQUESTED
  ↓
GitOpsEventHandlerService.handleSetupRequest()
  ├─ GitAuthService.setupProjectAuth(userId)  ← 内部获取 OAuth token
  │   ├─ 创建 GitHub Deploy Key 或 GitLab Token
  │   └─ 存储到数据库
  └─ FluxResourcesService.setupProjectGitOps(credential)
      ├─ 创建 Namespace
      ├─ 创建 K8s Secret（使用 credential）
      ├─ 创建 GitRepository
      └─ 创建 Kustomization
```

## 代码统计

**删除：**
- 1 个文件（CreateGitOpsHandler）
- 约 80 行代码

**简化：**
- 1 个状态（CREATING_GITOPS）
- 1 个事件（GITOPS_CREATED）
- 1 个参数（accessToken）

**修改的文件：**
- 7 个文件

## 编译测试

```bash
✅ packages/core: bun run build - 成功
✅ packages/services/business: bun run build - 成功
```

## 收益

1. **代码更简洁**：减少约 80 行未使用的代码
2. **状态机更清晰**：8 个状态 vs 9 个状态
3. **参数传递更简单**：移除冗余的 accessToken 传递
4. **职责更明确**：
   - GitAuthService：负责获取 OAuth token 和创建 Git 凭证
   - GitOpsEventHandlerService：负责协调整个 GitOps 设置流程
   - FluxResourcesService：负责创建 K8s 资源
5. **维护性提升**：更少的代码 = 更少的 bug

## 后续优化建议

### 短期（可选）
1. 考虑合并 LOADING_TEMPLATE 和 RENDERING_TEMPLATE 到 CREATING_PROJECT
2. 添加更详细的错误处理和日志

### 中期（1-2周）
1. 评估是否需要状态机，或改用简单的线性流程
2. 考虑使用 BullMQ 的进度追踪替代状态机

### 长期（1个月+）
1. 使用 External Secrets Operator 管理 Git 凭证
2. 实现真正的回滚机制
3. 添加初始化失败的自动重试

## 相关文档

- [初始化重构方案](./INITIALIZATION_REFACTOR_PROPOSAL.md)
- [立即清理任务清单](./IMMEDIATE_CLEANUP_TASKS.md)
