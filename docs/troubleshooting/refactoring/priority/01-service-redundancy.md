# 任务 1: 服务冗余清理

**优先级**: 🔴 高  
**预计时间**: 2天  
**依赖**: 无

---

## 📋 问题描述

### 现状

1. **ProjectInitializationService** 和 **ProjectsService** 功能重叠
   - 两个服务都处理项目创建
   - 初始化逻辑分散在两处
   - 调用关系混乱

2. **GitOpsEventHandlerService** 和 **FluxSyncService** 职责不清
   - 事件监听逻辑重复
   - 不知道该在哪里添加新功能

3. **HealthMonitorService** 多处重复
   - `project-status.service.ts` 有健康检查
   - `credentials/health-monitor.service.ts` 也有健康检查
   - 逻辑不一致

4. **ApprovalManagerService** 功能单一
   - 只有简单的审批逻辑
   - 不需要独立服务

### 影响

- ❌ 代码维护困难，修改一个功能需要改多个地方
- ❌ 容易出现逻辑不一致
- ❌ 增加新人理解成本
- ❌ 测试覆盖困难

---

## 🎯 方案选择

### 方案对比

| 方案 | 优点 | 缺点 | 评分 |
|------|------|------|------|
| A. 合并到单一服务 | 简单直接 | 服务过于庞大，违反单一职责 | ❌ |
| B. 按职责重新划分 | 职责清晰，易维护 | 需要重构调用关系 | ✅ 推荐 |
| C. 保持现状 + 文档 | 改动最小 | 问题依然存在 | ❌ |

### 选择方案 B 的理由

1. **符合单一职责原则** - 每个服务只做一件事
2. **易于测试** - 职责清晰，测试边界明确
3. **便于扩展** - 新功能知道该加在哪里
4. **降低耦合** - 服务间依赖关系清晰

---

## 🔧 实施步骤

### 1.1 合并项目初始化服务 (0.5天)

#### 目标结构

```
packages/services/business/src/projects/
├── projects.service.ts              # ✅ 主服务（保留并增强）
├── initialization/
│   ├── state-machine.ts             # ✅ 状态机（保留）
│   ├── initialization-steps.ts      # ✅ 步骤定义（保留）
│   ├── progress-manager.service.ts  # ✅ 进度管理（保留）
│   └── handlers/                    # ✅ 各步骤处理器（保留）
└── project-initialization.service.ts # ❌ 删除
```

#### 具体改动

**步骤 1**: 将初始化逻辑合并到 `ProjectsService`

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  constructor(
    private readonly stateMachine: ProjectStateMachine,
    private readonly progressManager: ProgressManagerService,
    // ... 其他依赖
  ) {}

  /**
   * 创建项目（包含初始化）
   */
  async create(userId: string, input: CreateProjectInput) {
    // 1. 创建项目记录
    const project = await this.createProjectRecord(userId, input)
    
    // 2. 启动初始化流程
    await this.initializeProject(project.id)
    
    return project
  }

  /**
   * 初始化项目（私有方法）
   */
  private async initializeProject(projectId: string) {
    // 使用状态机管理初始化流程
    const machine = this.stateMachine.create(projectId)
    
    // 发送到队列异步处理
    await this.queue.add('project-init', {
      projectId,
      machineState: machine.initialState,
    })
  }
}
```

**步骤 2**: 删除 `ProjectInitializationService`

```bash
rm packages/services/business/src/projects/project-initialization.service.ts
```

**步骤 3**: 更新所有调用方

```typescript
// apps/api-gateway/src/routers/projects.router.ts

// ❌ 旧代码
await this.projectInitService.initializeProject(projectId)

// ✅ 新代码
await this.projectsService.create(userId, input)
```

---

### 1.2 整合 GitOps 事件处理 (0.5天)

#### 目标结构

```
packages/services/business/src/gitops/
├── flux/
│   ├── flux.service.ts              # ✅ Flux 操作（保留）
│   └── flux-sync.service.ts         # ✅ Flux 同步（保留并增强）
├── gitops-event-handler.service.ts  # ❌ 删除
└── k3s/
    └── k3s.service.ts               # ✅ K8s 操作（保留）
```

#### 具体改动

**步骤 1**: 将事件监听合并到 `FluxSyncService`

```typescript
// packages/services/business/src/gitops/flux/flux-sync.service.ts

@Injectable()
export class FluxSyncService {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly fluxService: FluxService,
  ) {
    // 统一在这里订阅事件
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // 监听 GitRepository 事件
    this.eventEmitter.on('gitops.repository.created', (event) => {
      this.handleRepositoryCreated(event)
    })
    
    // 监听 Kustomization 事件
    this.eventEmitter.on('gitops.kustomization.updated', (event) => {
      this.handleKustomizationUpdated(event)
    })
  }
}
```

**步骤 2**: 删除 `GitOpsEventHandlerService`

```bash
rm packages/services/business/src/gitops/gitops-event-handler.service.ts
```

---

### 1.3 统一健康监控 (0.5天)

#### 目标结构

```
packages/services/business/src/projects/
└── project-status.service.ts  # ✅ 统一的健康检查服务
```

#### 具体改动

**步骤 1**: 增强 `ProjectStatusService`

```typescript
// packages/services/business/src/projects/project-status.service.ts

@Injectable()
export class ProjectStatusService {
  /**
   * 获取项目完整健康状态
   */
  async getHealth(projectId: string) {
    return {
      overall: await this.getOverallHealth(projectId),
      gitops: await this.getGitOpsHealth(projectId),
      credentials: await this.getCredentialsHealth(projectId),
      deployments: await this.getDeploymentsHealth(projectId),
    }
  }

  /**
   * 检查 Git 凭证健康状态
   */
  private async getCredentialsHealth(projectId: string) {
    const project = await this.getProject(projectId)
    
    // 检查凭证是否有效
    const credential = await this.credentialManager.get(project.gitAuthId)
    return await credential.validate()
  }
}
```

**步骤 2**: 删除重复的健康监控服务

```bash
rm packages/services/business/src/gitops/credentials/health-monitor.service.ts
```

---

### 1.4 简化审批流程 (0.5天)

#### 目标结构

```
packages/services/business/src/projects/
└── projects.service.ts  # ✅ 审批逻辑作为私有方法
```

#### 具体改动

**步骤 1**: 将审批逻辑合并到 `ProjectsService`

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  /**
   * 删除项目（需要审批）
   */
  async delete(userId: string, projectId: string) {
    // 检查权限
    await this.checkPermission(userId, projectId, 'delete')
    
    // 审批逻辑
    if (await this.requiresApproval(projectId)) {
      return await this.createApprovalRequest(userId, projectId, 'delete')
    }
    
    // 直接删除
    return await this.performDelete(projectId)
  }

  /**
   * 检查是否需要审批（私有方法）
   */
  private async requiresApproval(projectId: string): Promise<boolean> {
    const project = await this.getProject(projectId)
    
    // 生产环境项目需要审批
    return project.environment === 'production'
  }
}
```

**步骤 2**: 删除 `ApprovalManagerService`

```bash
rm packages/services/business/src/projects/approval-manager.service.ts
```

---

## ✅ 验收标准

### 功能验收

- [ ] 项目创建功能正常
- [ ] 项目初始化流程正常
- [ ] GitOps 同步功能正常
- [ ] 健康检查功能正常
- [ ] 项目删除审批功能正常

### 代码质量

- [ ] 删除了 4 个冗余服务文件
- [ ] 所有 TypeScript 类型检查通过
- [ ] 所有测试通过
- [ ] 没有 ESLint 错误

### 文档更新

- [ ] 更新架构文档
- [ ] 更新 API 文档
- [ ] 更新开发指南

---

## 📊 预期收益

### 代码质量提升

- ✅ 减少 ~500 行重复代码
- ✅ 服务数量从 15 个减少到 11 个
- ✅ 代码职责更清晰

### 开发效率提升

- ✅ 新功能开发时不再困惑该放在哪里
- ✅ Bug 修复更快（不需要改多个地方）
- ✅ 新人上手更容易

### 维护成本降低

- ✅ 测试覆盖更容易
- ✅ 重构风险降低
- ✅ 技术债务减少

---

## 🚨 风险和注意事项

### 潜在风险

1. **调用方更新遗漏**
   - 风险: 可能有地方还在调用旧服务
   - 缓解: 使用 IDE 全局搜索确认

2. **测试覆盖不足**
   - 风险: 重构后可能引入 bug
   - 缓解: 先补充测试，再重构

3. **事件监听丢失**
   - 风险: 合并事件处理时可能遗漏某些事件
   - 缓解: 列出所有事件，逐一迁移

### 回滚方案

如果重构后出现问题：

1. **Git 回滚**: `git revert <commit-hash>`
2. **保留旧代码**: 重构前创建 `legacy/` 目录备份
3. **分步回滚**: 每个子任务独立提交，可单独回滚

---

## 📝 相关文档

- [三层服务架构](../../architecture/three-tier-architecture.md)
- [事件系统设计](../../architecture/event-system.md)
- [服务职责划分](../../guides/service-responsibilities.md)
