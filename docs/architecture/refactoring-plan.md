# 服务重构实施计划

## 阶段 1: 删除 GitOpsOrchestratorService ✅ 准备中

### 需要迁移的方法

从 `GitOpsOrchestratorService` → `FluxService`:

1. **setupProjectGitOps()** - 为项目创建完整的 GitOps 资源栈
2. **cleanupProjectGitOps()** - 清理项目的所有 GitOps 资源
3. **syncGitOpsStatus()** - 同步资源状态
4. **getProjectGitOpsSummary()** - 获取资源摘要
5. **createGitSecret()** (private) - 创建 Git 认证 Secret

### 迁移策略

```typescript
// FluxService 新增方法
class FluxService {
  // ... 现有方法 ...
  
  /**
   * 为项目设置完整的 GitOps 资源栈
   * 包括：Namespace、Secret、GitRepository、Kustomization
   */
  async setupProjectGitOps(data: SetupProjectGitOpsInput): Promise<SetupResult> {
    // 迁移 GitOpsOrchestratorService.setupProjectGitOps() 的逻辑
  }
  
  /**
   * 清理项目的所有 GitOps 资源
   */
  async cleanupProjectGitOps(projectId: string): Promise<CleanupResult> {
    // 迁移 GitOpsOrchestratorService.cleanupProjectGitOps() 的逻辑
  }
  
  /**
   * 同步项目 GitOps 资源状态
   */
  async syncProjectGitOpsStatus(projectId: string): Promise<void> {
    // 迁移 GitOpsOrchestratorService.syncGitOpsStatus() 的逻辑
  }
  
  /**
   * 获取项目 GitOps 资源摘要
   */
  async getProjectGitOpsSummary(projectId: string): Promise<GitOpsSummary> {
    // 迁移 GitOpsOrchestratorService.getProjectGitOpsSummary() 的逻辑
  }
  
  /**
   * 创建 Git 认证 Secret
   */
  private async createGitSecret(...): Promise<void> {
    // 迁移 GitOpsOrchestratorService.createGitSecret() 的逻辑
  }
}
```

### 更新依赖

1. **gitops.router.ts**:
```typescript
// 之前
constructor(private gitopsOrchestrator: GitOpsOrchestratorService) {}

// 之后
constructor(private flux: FluxService) {}
```

2. **business/src/index.ts**:
```typescript
// 删除
export { GitOpsOrchestratorService } from './gitops/gitops-orchestrator.service'
```

3. **删除文件**:
- `gitops-orchestrator.service.ts`
- `gitops-orchestrator.module.ts`

### 预期收益

- 减少 370 行重复代码
- 消除职责重叠
- 简化依赖关系
- FluxService 从 1007 行 → 1200 行（仍需后续拆分）

## 阶段 2: 拆分 FluxService

### 目标

将 FluxService (1200 行) 拆分为 3 个服务：

1. **FluxService** (300 行) - Flux 生命周期管理
   - installFlux()
   - uninstallFlux()
   - checkFluxHealth()
   - isInstalled()
   - recheckInstallation()

2. **FluxResourcesService** (600 行) - Flux 资源 CRUD
   - createGitRepository()
   - createKustomization()
   - createHelmRelease()
   - createGitOpsResource()
   - listGitOpsResources()
   - getGitOpsResource()
   - updateGitOpsResource()
   - deleteGitOpsResource()
   - setupProjectGitOps()
   - cleanupProjectGitOps()

3. **FluxSyncService** (300 行) - 同步和协调
   - triggerReconciliation()
   - syncProjectGitOpsStatus()
   - getProjectGitOpsSummary()
   - waitForReady()
   - getEvents()

### 实施步骤

1. 创建 `flux-resources.service.ts`
2. 创建 `flux-sync.service.ts`
3. 从 FluxService 移动方法
4. 更新 FluxModule
5. 更新所有导入

## 阶段 3: 拆分 ProjectsService

### 目标

将 ProjectsService (1221 行) 拆分为 6 个服务：

1. **ProjectsService** (300 行) - 项目 CRUD
2. **ProjectMembersService** (200 行) - 成员管理
3. **ProjectEnvironmentsService** (200 行) - 环境管理
4. **ProjectDeploymentsService** (250 行) - 部署管理
5. **ProjectApprovalService** (200 行) - 审批流程
6. **ProjectGitOpsService** (150 行) - GitOps 集成

### 实施步骤

1. 创建新服务文件
2. 移动相关方法
3. 更新 ProjectsModule
4. 更新所有导入
5. 更新测试

## 阶段 4: 合并模板服务

### 目标

合并 3 个模板服务为 1 个：

- TemplateLoaderService (356 行)
- TemplateRendererService (391 行)
- TemplateManagerService (588 行)

合并为：
- **TemplateService** (500 行)

### 实施步骤

1. 创建新的 `template.service.ts`
2. 合并所有方法
3. 删除旧服务
4. 更新 Module
5. 更新导入

## 阶段 5: 重命名和清理

### 需要重命名的服务

1. `GitOpsService` → `GitOperationsService`
2. `ProjectOrchestratorService` → 合并到 `ProjectsService`
3. `OneClickDeployService` → 移到 `ProjectDeploymentsService`

### 需要删除的服务

1. ✅ `GitOpsOrchestratorService` (已删除)
2. `ProjectOrchestratorService` (合并)
3. `OneClickDeployService` (合并)

## 实施时间表

| 阶段 | 预计时间 | 优先级 |
|------|---------|--------|
| 阶段 1 | 2 小时 | P0 |
| 阶段 2 | 4 小时 | P0 |
| 阶段 3 | 6 小时 | P0 |
| 阶段 4 | 3 小时 | P1 |
| 阶段 5 | 2 小时 | P1 |
| **总计** | **17 小时** | |

## 风险和缓解

### 风险

1. **破坏现有功能** - 迁移过程中可能引入 bug
2. **依赖关系复杂** - 服务间依赖可能导致循环依赖
3. **测试覆盖不足** - 缺少测试可能无法发现问题

### 缓解措施

1. **逐步迁移** - 一次只重构一个服务
2. **保持兼容** - 使用 Facade 模式提供过渡期
3. **增加测试** - 重构前先写测试
4. **代码审查** - 每个阶段都进行审查

## 成功指标

- [ ] 服务数量从 38 减少到 32
- [ ] 最大服务从 1221 行减少到 600 行
- [ ] 平均服务从 300 行减少到 200 行
- [ ] 代码重复率从 15% 减少到 5%
- [ ] 所有测试通过
- [ ] 应用正常运行

## 下一步

当前正在执行：**阶段 1 - 删除 GitOpsOrchestratorService**

需要完成的任务：
1. ✅ 分析依赖关系
2. ⏳ 将方法迁移到 FluxService
3. ⏳ 更新 gitops.router.ts
4. ⏳ 删除旧文件
5. ⏳ 测试验证
