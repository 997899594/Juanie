# Business Layer 初始化模块重构 - 剩余问题修复

**日期**: 2024-12-24  
**状态**: ✅ 完成

## 问题描述

在完成初始化模块重构后，发现两个文件仍然引用了已删除的旧服务：

1. `project-status.service.ts` - 引用 `InitializationStepsService`
2. `queue.module.ts` - 引用 `ProgressManagerService`

## 修复内容

### 1. project-status.service.ts

**问题**:
- 导入了已删除的 `InitializationStepsService`
- 在 `getStatus()` 方法中查询初始化步骤

**修复**:
```typescript
// ❌ 删除
import { InitializationStepsService } from './initialization/initialization-steps.service'

// ❌ 删除构造函数依赖
constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  private readonly initializationSteps: InitializationStepsService, // 删除
  private readonly logger: PinoLogger,
)

// ❌ 删除步骤查询
let initializationSteps: schema.ProjectInitializationStep[] = []
if (project.status === 'initializing' || project.status === 'active') {
  initializationSteps = await this.initializationSteps.getProjectSteps(projectId)
}

// ✅ 改为返回空数组
initializationSteps: [], // 不再从数据库查询，前端应该从 WebSocket 获取实时进度
```

**设计决策**:
- 初始化步骤不再持久化到数据库
- 前端应该通过 WebSocket (Redis Pub/Sub) 获取实时进度
- `getStatus()` 返回的 `initializationSteps` 字段保留（向后兼容），但始终为空数组

### 2. queue.module.ts

**问题**:
- 导入了已删除的 `ProgressManagerService`
- 在 providers 中提供该服务

**修复**:
```typescript
// ❌ 删除
import { ProgressManagerService } from '../projects/initialization/progress-manager.service'

// ❌ 删除 provider
providers: [
  ProgressManagerService, // 删除
  ProjectInitializationWorker,
]

// ✅ 简化后
providers: [ProjectInitializationWorker]
```

## 架构说明

### 新的进度追踪方式

**旧方案** (已删除):
```
ProgressManagerService
  ↓
写入数据库 (project_initialization_steps 表)
  ↓
前端轮询查询
```

**新方案** (当前):
```
ProjectInitializationService
  ↓
BullMQ Job Progress (job.updateProgress())
  ↓
Redis Pub/Sub (redis.publish())
  ↓
前端 WebSocket 实时接收
```

### 优势

1. **实时性**: WebSocket 推送，无需轮询
2. **简单性**: 利用 BullMQ 内置功能，无需自建进度管理
3. **可扩展**: 支持子步骤进度追踪
4. **无持久化**: 不污染数据库，进度数据存储在 Redis（临时）

## 验证

运行 Biome 检查：
```bash
bun run biome check --write packages/services/business/src/projects/project-status.service.ts packages/services/business/src/queue/queue.module.ts
```

结果：✅ 无错误

## 相关文档

- [初始化模块重构完成](./BUSINESS-INITIALIZATION-REFACTORING-COMPLETE.md)
- [项目服务编排器移除](./PROJECTS-SERVICE-ORCHESTRATOR-REMOVAL.md)
- [Business Layer 重构计划](./BUSINESS-LAYER-REFACTORING-START.md)

## 下一步

1. ✅ 修复剩余依赖引用
2. ⏭️ 测试初始化流程
3. ⏭️ 验证实时进度推送
4. ⏭️ 继续 Business Layer 其他模块重构
