# 立即清理任务清单

## 已确认的冗余代码

### 1. 删除 CreateGitOpsHandler ✅ 可以安全删除

**原因：**
- GitOps 创建实际通过 Worker + 事件驱动完成
- 状态机中的 CREATING_GITOPS 状态从未真正执行 GitOps 创建
- 实际流程：SetupRepositoryHandler → Queue → Worker → Event → GitOpsEventHandlerService

**需要删除的文件：**
```
packages/services/business/src/projects/initialization/handlers/create-gitops.handler.ts
```

**需要修改的文件：**
```typescript
// packages/services/business/src/projects/initialization/initialization.module.ts
// 移除 CreateGitOpsHandler 的导入和注册

// packages/services/business/src/projects/project-orchestrator.service.ts
// 移除 CreateGitOpsHandler 的注入和注册

// packages/services/business/src/projects/initialization/state-machine.ts
// 移除 CREATING_GITOPS 状态（或标记为 SKIP）
```

### 2. 简化状态机状态

**当前状态（9个）：**
```
IDLE
CREATING_PROJECT
LOADING_TEMPLATE
RENDERING_TEMPLATE
CREATING_ENVIRONMENTS
SETTING_UP_REPOSITORY
CREATING_GITOPS  ← 实际不做任何事
FINALIZING
COMPLETED
FAILED
```

**建议简化为（6个）：**
```
IDLE
CREATING_PROJECT  (包含模板加载和渲染)
CREATING_ENVIRONMENTS
SETTING_UP_REPOSITORY  (包含 GitOps 队列化)
FINALIZING
COMPLETED
FAILED
```

**原因：**
- LOADING_TEMPLATE 和 RENDERING_TEMPLATE 可以合并到 CREATING_PROJECT
- CREATING_GITOPS 实际不执行任何操作（工作在 Worker 中）

### 3. 认证流程简化

**当前流程：**
```typescript
// 参数传递链路过长
ProjectOrchestrator 
  → SetupRepositoryHandler (获取 OAuth token)
    → Queue Job (传递 token)
      → Worker
        → ProjectInitializationService.requestGitOpsSetup(accessToken)
          → Event (传递 token)
            → GitOpsEventHandlerService (传递 token)
              → GitAuthService (使用 token)
```

**优化后：**
```typescript
// 只传递 userId，在需要时获取 token
ProjectOrchestrator 
  → SetupRepositoryHandler
    → Queue Job (只传递 userId)
      → Worker
        → ProjectInitializationService.requestGitOpsSetup(userId)
          → Event (只传递 userId)
            → GitOpsEventHandlerService (只传递 userId)
              → GitAuthService (内部获取 token)
```

**修改点：**
```typescript
// GitOpsSetupRequestedEvent
interface GitOpsSetupRequestedEvent {
  projectId: string
  repositoryId: string
  repositoryUrl: string
  repositoryBranch: string
  userId: string  // 只需要 userId
  // 移除 accessToken
  environments: Array<...>
  jobId?: string
}
```

## 执行顺序

1. **第一步：删除 CreateGitOpsHandler**
   - 风险：低
   - 影响：无（未被使用）
   - 时间：10 分钟

2. **第二步：简化状态机**
   - 风险：中
   - 影响：需要测试项目创建流程
   - 时间：30 分钟

3. **第三步：简化认证流程**
   - 风险：中
   - 影响：需要更新事件接口和所有调用点
   - 时间：1 小时

## 预期收益

- **代码减少**：约 200 行
- **复杂度降低**：状态数量减少 33%
- **维护性提升**：清晰的职责划分
- **Bug 减少**：更少的参数传递 = 更少的错误
