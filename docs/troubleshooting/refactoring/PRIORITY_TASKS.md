# 优先重构任务

**目标**: 解决当前系统中最紧迫的6个问题

**预计时间**: 10-12 天

**执行顺序**: 按优先级从高到低

---

## 任务清单

1. ✅ **服务冗余清理** - 2天
2. ✅ **事件系统优化** - 2天  
3. ✅ **数据库索引优化** - 1天
4. ✅ **软删除机制** - 2天
5. ✅ **错误处理标准化** - 2天
6. ✅ **RBAC 权限系统** - 3天

---

## 1. 服务冗余清理

### 📋 问题描述

**现状**:
- `ProjectInitializationService` 和 `ProjectsService` 功能重叠
- `GitOpsEventHandlerService` 和 `FluxSyncService` 职责不清
- `HealthMonitorService` 在多个地方重复实现
- `ApprovalManagerService` 功能单一但独立存在

**影响**:
- 代码维护困难，修改一个功能需要改多个地方
- 容易出现逻辑不一致
- 增加了新人理解成本
- 测试覆盖困难

### 🎯 方案选择

**方案 A: 合并到单一服务** ❌
- 优点: 简单直接
- 缺点: 服务会变得过于庞大，违反单一职责原则

**方案 B: 按职责重新划分** ✅ **推荐**
- 优点: 职责清晰，易于维护和测试
- 缺点: 需要重构现有调用关系

**方案 C: 保持现状，只做文档** ❌
- 优点: 改动最小
- 缺点: 问题依然存在

### 🔧 实施步骤

#### 1.1 合并项目初始化服务 (0.5天)

```typescript
// 目标结构
packages/services/business/src/projects/
├── projects.service.ts           # 主服务（保留）
├── initialization/
│   ├── state-machine.ts          # 状态机（保留）
│   ├── initialization-steps.ts   # 步骤定义（保留）
│   ├── progress-manager.service.ts # 进度管理（保留）
│   └── handlers/                 # 各步骤处理器（保留）
└── project-initialization.service.ts # ❌ 删除，功能合并到 projects.service.ts
```

**改动**:
- 将 `ProjectInitializationService.initializeProject()` 合并到 `ProjectsService.create()`
- 保留状态机和处理器的独立性
- 更新所有调用方

#### 1.2 整合 GitOps 事件处理 (0.5天)

```typescript
// 目标结构
packages/services/business/src/gitops/
├── flux/
│   ├── flux.service.ts           # Flux 操作（保留）
│   └── flux-sync.service.ts      # Flux 同步（保留）
├── gitops-event-handler.service.ts # ❌ 删除，功能合并到 flux-sync.service.ts
└── k3s/
    └── k3s.service.ts            # K8s 操作（保留）
```

**改动**:
- 将事件监听逻辑合并到 `FluxSyncService`
- 使用 NestJS EventEmitter 统一事件处理
- 删除重复的事件订阅代码

#### 1.3 统一健康监控 (0.5天)

```typescript
// 目标结构
packages/services/business/src/
├── projects/
│   └── project-status.service.ts  # 项目状态（保留，增强）
└── gitops/
    └── credentials/
        └── health-monitor.service.ts # ❌ 删除，功能合并到 project-status.service.ts
```

**改动**:
- 将 Git 凭证健康检查合并到 `ProjectStatusService`
- 统一健康检查接口
- 使用定时任务统一调度

#### 1.4 简化审批流程 (0.5天)

```typescript
// 目标结构
packages/services/business/src/projects/
├── projects.service.ts           # 主服务（增强）
└── approval-manager.service.ts   # ❌ 删除，功能合并到 projects.service.ts
```

**改动**:
- 将审批逻辑作为 `ProjectsService` 的私有方法
- 如果未来需要复杂审批流程，再考虑独立服务

### ✅ 验收标准

- [ ] 删除 4 个冗余服务文件
- [ ] 所有功能正常工作
- [ ] 测试全部通过
- [ ] 更新相关文档

---

## 2. 事件系统优化

### 📋 问题描述

**现状**:
- 同时使用 Redis Pub/Sub、NestJS EventEmitter、BullMQ 三种事件机制
- 事件命名不统一（`project:init`, `project.created`, `PROJECT_CREATED`）
- 事件数据结构不一致
- 缺少事件版本控制
- 没有事件重放机制

**影响**:
- 开发者不知道该用哪种事件机制
- 事件丢失难以追踪
- 系统升级时事件兼容性问题
- 调试困难

### 🎯 方案选择

**方案 A: 统一使用 Redis Pub/Sub** ❌
- 优点: 支持分布式
- 缺点: 无持久化，事件可能丢失

**方案 B: 统一使用 BullMQ** ❌
- 优点: 有持久化和重试
- 缺点: 不适合实时事件

**方案 C: 分层使用 + 统一规范** ✅ **推荐**
- 优点: 各取所长，职责清晰
- 缺点: 需要制定规范

### 🔧 实施步骤

#### 2.1 定义事件分层规范 (0.5天)

```typescript
// packages/core/src/events/event-types.ts

/**
 * 事件分层规范:
 * 
 * 1. 领域事件 (Domain Events) - 使用 NestJS EventEmitter
 *    - 同步处理
 *    - 应用内部
 *    - 例如: user.created, project.updated
 * 
 * 2. 集成事件 (Integration Events) - 使用 BullMQ
 *    - 异步处理
 *    - 需要持久化和重试
 *    - 例如: deployment.queued, gitops.sync
 * 
 * 3. 实时事件 (Realtime Events) - 使用 Redis Pub/Sub
 *    - 推送到前端
 *    - 不需要持久化
 *    - 例如: progress.updated, status.changed
 */

// 事件命名规范: <domain>.<action>.<status>
export const DomainEvents = {
  // 项目事件
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  
  // 初始化事件
  INIT_STARTED: 'project.init.started',
  INIT_STEP_COMPLETED: 'project.init.step_completed',
  INIT_COMPLETED: 'project.init.completed',
  INIT_FAILED: 'project.init.failed',
} as const

export const IntegrationEvents = {
  // 部署事件
  DEPLOYMENT_QUEUED: 'deployment.queued',
  DEPLOYMENT_PROCESSING: 'deployment.processing',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  
  // GitOps 事件
  GITOPS_SYNC_QUEUED: 'gitops.sync.queued',
  GITOPS_SYNC_COMPLETED: 'gitops.sync.completed',
} as const

export const RealtimeEvents = {
  // 进度事件
  PROGRESS_UPDATED: 'progress.updated',
  STATUS_CHANGED: 'status.changed',
} as const
```

