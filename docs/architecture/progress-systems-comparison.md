# 两套进度系统对比分析

## 目的

对比 `ProgressManager` (Redis) 和 `InitializationSteps` (PostgreSQL) 两套进度系统，找出冗余，提供统一方案。

---

## 1. 系统概览

### 系统 A: ProgressManager (Redis)

**文件**: `packages/services/business/src/projects/initialization/progress-manager.service.ts`

**存储**: Redis (内存，临时)

**数据结构**:
```typescript
{
  progress: number,        // 0-100
  message: string,         // "正在创建仓库..."
  metadata?: object,       // 额外信息
  timestamp: number        // 时间戳
}
```

**生命周期**: 1 小时后自动过期

### 系统 B: InitializationSteps (PostgreSQL)

**文件**: `packages/services/business/src/projects/initialization/initialization-steps.service.ts`

**存储**: PostgreSQL (持久化)

**数据结构**:
```typescript
{
  id: string,
  projectId: string,
  step: string,            // "create_repository"
  status: string,          // "running" | "completed" | "failed" | "skipped"
  progress: string,        // "0" - "100"
  error?: string,
  errorStack?: string,
  startedAt: Date,
  completedAt?: Date,
  createdAt: Date,
  updatedAt: Date
}
```

**生命周期**: 永久保存（除非手动删除）

---

## 2. 功能对比

| 功能 | ProgressManager (Redis) | InitializationSteps (PostgreSQL) |
|------|------------------------|----------------------------------|
| **存储位置** | Redis (内存) | PostgreSQL (磁盘) |
| **持久化** | ❌ 临时（1小时） | ✅ 永久 |
| **总体进度** | ✅ 0-100% | ❌ 需要计算 |
| **步骤详情** | ❌ 没有 | ✅ 每个步骤独立记录 |
| **实时更新** | ✅ Redis Pub/Sub | ❌ 需要轮询 |
| **单调性保证** | ✅ 代码检查 | ❌ 没有 |
| **错误信息** | ❌ 只有 message | ✅ error + errorStack |
| **历史查询** | ❌ 1小时后丢失 | ✅ 永久可查 |
| **服务器重启** | ❌ 数据丢失 | ✅ 数据保留 |
| **事件通知** | ✅ Pub/Sub | ❌ 没有 |

---

## 3. 使用场景对比

### Worker 中的使用

```typescript
// project-initialization.worker.ts

// 使用 ProgressManager (Redis)
await this.progressManager.updateProgress(projectId, 50, '正在推送代码...')

// 使用 InitializationSteps (PostgreSQL)
await this.initializationSteps.startStep(projectId, 'push_template')
await this.initializationSteps.completeStep(projectId, 'push_template')
```

### 前端订阅进度

```typescript
// projects.service.ts

async *subscribeToProgress(projectId: string) {
  // 1. 从数据库获取初始状态
  const steps = await this.db.query.projectInitializationSteps.findMany({
    where: eq(schema.projectInitializationSteps.projectId, projectId)
  })
  
  yield { type: 'init', data: { steps } }
  
  // 2. 订阅 Redis 事件（ProgressManager 发布）
  await subscriber.psubscribe(`project:${projectId}`)
  
  // 持续推送事件...
}
```

**关键发现**: 前端同时依赖两套系统！
- 初始状态来自 PostgreSQL
- 实时更新来自 Redis

---

## 4. 数据流分析

### 当前架构的数据流

```
Worker 执行
    ↓
    ├─→ ProgressManager.updateProgress()
    │       ↓
    │   Redis 存储 (临时)
    │       ↓
    │   Redis Pub/Sub 发布事件
    │       ↓
    │   前端 SSE 接收
    │
    └─→ InitializationSteps.startStep()
            ↓
        PostgreSQL 存储 (永久)
            ↓
        前端轮询查询
```

**问题**: 
1. 两次写入（Redis + PostgreSQL）
2. 数据不一致风险（Redis 可能丢失）
3. 前端需要合并两个数据源

---

## 5. 冗余分析

### 重复的功能

| 功能 | ProgressManager | InitializationSteps | 冗余度 |
|------|----------------|---------------------|--------|
| 存储进度 | ✅ Redis | ✅ PostgreSQL | 🔴 100% |
| 记录消息 | ✅ message | ✅ step name | 🟡 50% |
| 错误处理 | ⚠️ 简单 | ✅ 详细 | 🟡 30% |
| 时间戳 | ✅ timestamp | ✅ startedAt/completedAt | 🔴 100% |

### 独有的功能

**ProgressManager 独有**:
- ✅ 单调性保证（进度不回退）
- ✅ Redis Pub/Sub 实时通知
- ✅ 自动过期（1小时）

**InitializationSteps 独有**:
- ✅ 步骤级别详情
- ✅ 错误堆栈
- ✅ 永久历史记录
- ✅ 步骤状态（running/completed/failed/skipped）

---

## 6. 问题总结

### 问题 1: 数据不一致

**场景**: Redis 重启或过期

```typescript
// Redis 中的进度
{ progress: 75, message: "正在配置 GitOps..." }

// PostgreSQL 中的步骤
[
  { step: "create_repository", status: "completed" },
  { step: "push_template", status: "completed" },
  { step: "create_database_records", status: "completed" },
  { step: "setup_gitops", status: "running" }  // ← 卡在这里
]
```

**问题**: Redis 数据丢失后，无法恢复总体进度

### 问题 2: 双重维护

**代码示例**:
```typescript
// Worker 中需要同时更新两个系统
await this.updateStepProgress(job, 'push_template', 50, '正在推送文件...')

private async updateStepProgress(job, stepName, stepProgress, message) {
  // 1. 计算总体进度
  const totalProgress = calculateStepProgress(stepName, stepProgress)
  
  // 2. 更新 ProgressManager (Redis)
  await this.progressManager.updateProgress(projectId, totalProgress, message)
  
  // 3. 更新 BullMQ 进度
  await job.updateProgress(totalProgress)
  
  // 4. 延迟（避免更新过快）
  await new Promise(resolve => setTimeout(resolve, 100))
}
```

**问题**: 每次更新需要操作 3 个地方（Redis + BullMQ + 延迟）

### 问题 3: 前端复杂度

**前端需要合并两个数据源**:
```typescript
// 1. 从 PostgreSQL 获取步骤详情
const steps = await getProjectSteps(projectId)

// 2. 从 Redis 订阅实时进度
const subscription = subscribeToProgress(projectId)

// 3. 合并数据
const mergedData = {
  steps: steps,              // 来自 PostgreSQL
  currentProgress: event.progress,  // 来自 Redis
  currentMessage: event.message     // 来自 Redis
}
```

**问题**: 前端逻辑复杂，容易出错

---

## 7. 统一方案建议

### 方案 A: 只保留 PostgreSQL (推荐)

**架构**:
```
Worker 执行
    ↓
InitializationSteps.updateStep()
    ↓
PostgreSQL 存储
    ↓
Redis Pub/Sub 发布事件 (新增)
    ↓
前端 SSE 接收
```

**优势**:
- ✅ 单一数据源（PostgreSQL）
- ✅ 数据永久保存
- ✅ 服务器重启不丢失
- ✅ 保留实时通知（通过 PostgreSQL NOTIFY 或手动 Pub/Sub）

**实现**:
```typescript
// InitializationStepsService 新增方法
async updateStepProgress(
  projectId: string, 
  step: string, 
  progress: number,
  message: string
): Promise<void> {
  // 1. 更新数据库
  await this.db.update(schema.projectInitializationSteps)
    .set({ progress: progress.toString(), updatedAt: new Date() })
    .where(and(
      eq(schema.projectInitializationSteps.projectId, projectId),
      eq(schema.projectInitializationSteps.step, step)
    ))
  
  // 2. 发布事件到 Redis Pub/Sub
  await this.redis.publish(`project:${projectId}`, JSON.stringify({
    type: 'step.progress',
    data: { projectId, step, progress, message },
    timestamp: Date.now()
  }))
}
```

**需要添加的功能**:
1. 单调性检查（从 ProgressManager 移植）
2. Redis Pub/Sub 发布（从 ProgressManager 移植）
3. 计算总体进度（基于步骤完成度）

### 方案 B: 只保留 Redis

**架构**:
```
Worker 执行
    ↓
ProgressManager.updateProgress()
    ↓
Redis 存储 + Pub/Sub
    ↓
前端 SSE 接收
```

**优势**:
- ✅ 实时性好
- ✅ 代码简单
- ✅ 性能高

**劣势**:
- ❌ 数据临时（1小时后丢失）
- ❌ 服务器重启丢失
- ❌ 没有步骤详情
- ❌ 没有错误堆栈

**不推荐原因**: 丢失了太多有价值的信息

### 方案 C: 混合方案（当前架构优化）

**架构**:
```
Worker 执行
    ↓
    ├─→ InitializationSteps (主)
    │       ↓
    │   PostgreSQL 存储
    │       ↓
    │   Redis Pub/Sub 发布
    │
    └─→ ProgressManager (辅)
            ↓
        Redis 缓存（可选）
```

**优势**:
- ✅ PostgreSQL 作为主数据源
- ✅ Redis 作为缓存和通知
- ✅ 保留所有功能

**劣势**:
- ❌ 仍然需要维护两套系统
- ❌ 复杂度高

---

## 8. 推荐方案详细设计

### 方案 A: 统一到 PostgreSQL

#### 8.1 数据库 Schema (保持不变)

```sql
CREATE TABLE project_initialization_steps (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL,
  step VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,  -- running/completed/failed/skipped
  progress VARCHAR(10),          -- "0" - "100"
  error TEXT,
  error_stack TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 8.2 Service 增强

```typescript
// InitializationStepsService 新增方法

/**
 * 更新步骤进度（带实时通知）
 */
async updateStepProgressWithNotification(
  projectId: string,
  step: string,
  progress: number,
  message: string
): Promise<void> {
  // 1. 单调性检查
  const currentStep = await this.getCurrentStep(projectId)
  if (currentStep && currentStep.step === step) {
    const currentProgress = Number.parseInt(currentStep.progress || '0')
    if (progress < currentProgress) {
      this.logger.warn(`Progress regression rejected: ${progress} < ${currentProgress}`)
      return
    }
  }
  
  // 2. 更新数据库
  await this.updateStepProgress(projectId, step, progress.toString())
  
  // 3. 计算总体进度
  const totalProgress = calculateStepProgress(step, progress)
  
  // 4. 发布事件
  await this.publishProgressEvent(projectId, step, totalProgress, message)
}

/**
 * 发布进度事件到 Redis Pub/Sub
 */
private async publishProgressEvent(
  projectId: string,
  step: string,
  totalProgress: number,
  message: string
): Promise<void> {
  const event = {
    type: 'initialization.progress',
    data: { projectId, step, progress: totalProgress, message },
    timestamp: Date.now()
  }
  
  await this.redis.publish(
    `project:${projectId}`,
    JSON.stringify(event)
  )
}

/**
 * 获取项目总体进度
 */
async getProjectProgress(projectId: string): Promise<number> {
  const steps = await this.getProjectSteps(projectId)
  
  // 计算已完成步骤的进度
  let totalProgress = 0
  for (const step of steps) {
    const stepDef = INITIALIZATION_STEPS.find(s => s.name === step.step)
    if (!stepDef) continue
    
    if (step.status === 'completed') {
      totalProgress = stepDef.progressEnd
    } else if (step.status === 'running') {
      const stepProgress = Number.parseInt(step.progress || '0')
      totalProgress = calculateStepProgress(step.step, stepProgress)
      break  // 当前步骤，不再继续
    }
  }
  
  return totalProgress
}
```

#### 8.3 Worker 简化

```typescript
// project-initialization.worker.ts

// 之前：需要更新两个系统
await this.progressManager.updateProgress(projectId, progress, message)
await this.initializationSteps.updateStepProgress(projectId, step, progress)

// 之后：只更新一个系统
await this.initializationSteps.updateStepProgressWithNotification(
  projectId, 
  step, 
  progress, 
  message
)
```

#### 8.4 前端订阅简化

```typescript
// projects.service.ts

async *subscribeToProgress(projectId: string) {
  // 1. 获取初始状态（从 PostgreSQL）
  const steps = await this.initializationSteps.getProjectSteps(projectId)
  const progress = await this.initializationSteps.getProjectProgress(projectId)
  
  yield {
    type: 'init',
    data: { steps, progress }
  }
  
  // 2. 订阅实时更新（从 Redis Pub/Sub）
  await subscriber.psubscribe(`project:${projectId}`)
  
  // 3. 持续推送事件
  while (isActive) {
    const event = await waitForEvent()
    yield event
  }
}
```

---

## 9. 迁移计划

### 阶段 1: 增强 InitializationSteps (1-2 小时)

1. 添加 Redis 客户端注入
2. 实现 `updateStepProgressWithNotification()`
3. 实现 `getProjectProgress()`
4. 实现 `publishProgressEvent()`

### 阶段 2: 更新 Worker (30 分钟)

1. 替换 `progressManager.updateProgress()` 为 `initializationSteps.updateStepProgressWithNotification()`
2. 移除 `ProgressManager` 依赖
3. 测试进度更新

### 阶段 3: 更新前端订阅 (30 分钟)

1. 修改 `subscribeToProgress()` 使用新的 API
2. 测试实时更新

### 阶段 4: 清理 (30 分钟)

1. 删除 `ProgressManager` 文件
2. 删除相关导入
3. 更新文档

**总计**: 3-4 小时

---

## 10. 对比总结

### 当前架构（两套系统）

**优势**:
- ✅ 功能完整（实时 + 持久化）

**劣势**:
- ❌ 代码冗余（两套系统）
- ❌ 维护成本高（双重更新）
- ❌ 数据不一致风险（Redis 丢失）
- ❌ 前端复杂（合并数据源）

### 推荐方案（统一到 PostgreSQL）

**优势**:
- ✅ 单一数据源（PostgreSQL）
- ✅ 数据可靠（永久保存）
- ✅ 代码简洁（一次更新）
- ✅ 前端简单（单一数据源）
- ✅ 保留实时通知（Redis Pub/Sub）

**劣势**:
- ⚠️ 需要迁移（3-4 小时）
- ⚠️ PostgreSQL 写入略慢（但可接受）

---

## 11. 决策建议

### 推荐：方案 A（统一到 PostgreSQL）

**理由**:
1. **数据可靠性**: PostgreSQL 持久化，不会丢失
2. **代码简洁**: 减少 50% 的进度管理代码
3. **维护成本低**: 只需要维护一套系统
4. **功能完整**: 保留所有功能（实时 + 历史 + 详情）

**实施建议**:
1. 先实现增强版 `InitializationSteps`
2. 在 Worker 中并行运行两套系统（验证）
3. 确认无问题后，移除 `ProgressManager`

**风险评估**: 低
- PostgreSQL 写入性能足够（每秒几百次）
- Redis Pub/Sub 保留实时性
- 数据库事务保证一致性

---

## 12. 下一步行动

### 选项 1: 立即统一（推荐）

1. 我帮你实现增强版 `InitializationSteps`
2. 更新 Worker 代码
3. 测试验证
4. 删除 `ProgressManager`

**时间**: 3-4 小时

### 选项 2: 先优化，再统一

1. 先优化当前架构（减少冗余调用）
2. 观察一段时间
3. 再决定是否统一

**时间**: 1-2 小时优化 + 后续统一

### 选项 3: 保持现状

1. 接受两套系统的复杂度
2. 添加文档说明
3. 定期检查数据一致性

**时间**: 30 分钟文档

---

## 附录：代码证据

### 证据 1: Worker 中的双重更新

```typescript
// packages/services/business/src/queue/project-initialization.worker.ts

private async updateStepProgress(job, stepName, stepProgress, message) {
  const totalProgress = calculateStepProgress(stepName, stepProgress)
  
  // 1. 更新 ProgressManager (Redis)
  const updated = await this.progressManager.updateProgress(
    projectId, 
    totalProgress, 
    message
  )
  
  if (updated) {
    // 2. 更新 BullMQ
    await job.updateProgress(totalProgress)
    await job.log(`[${totalProgress}%] ${message}`)
  }
}

// 同时还要更新 InitializationSteps
await this.initializationSteps.startStep(projectId, 'create_repository')
await this.initializationSteps.completeStep(projectId, 'create_repository')
```

### 证据 2: 前端合并数据源

```typescript
// packages/services/business/src/projects/projects.service.ts

async *subscribeToProgress(projectId: string) {
  // 1. 从 PostgreSQL 获取步骤
  const steps = await this.db.query.projectInitializationSteps.findMany({
    where: eq(schema.projectInitializationSteps.projectId, projectId)
  })
  
  // 2. 计算总进度
  const completedSteps = steps.filter(s => s.status === 'completed').length
  const progress = Math.floor((completedSteps / totalSteps) * 100)
  
  // 3. 发送初始状态
  yield { type: 'init', data: { status, progress, steps } }
  
  // 4. 订阅 Redis 事件（ProgressManager 发布）
  await subscriber.psubscribe(`project:${projectId}`)
  
  // 5. 持续推送事件
  while (isActive) {
    const event = await waitForEvent()
    yield event  // 来自 ProgressManager
  }
}
```

**问题**: 初始状态来自 PostgreSQL，实时更新来自 Redis，需要前端合并。
