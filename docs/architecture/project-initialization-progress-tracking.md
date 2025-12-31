# 项目初始化进度追踪实现

## 概述

项目初始化进度追踪采用**持久化步骤表 + 实时推送**的方案，提供最佳用户体验和完整审计追踪。

## 架构设计

### 数据持久化

**表结构：** `project_initialization_steps`

```sql
CREATE TABLE project_initialization_steps (
  id UUID PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES projects(id),
  step TEXT NOT NULL,              -- 步骤标识符
  display_name TEXT NOT NULL,      -- 显示名称
  sequence INTEGER NOT NULL,       -- 执行顺序
  status TEXT NOT NULL,            -- pending/running/completed/failed/skipped
  progress INTEGER DEFAULT 0,      -- 0-100
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,                -- 毫秒
  error TEXT,
  error_stack TEXT,
  metadata JSONB,                  -- 灵活存储额外信息
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);
```

### 实时推送

**技术栈：**
- BullMQ Job Progress（内置进度追踪）
- Redis Pub/Sub（跨进程事件推送）
- tRPC Subscription（SSE 实现）

**事件流：**
```
Backend                          Frontend
  │                                 │
  ├─ 批量插入步骤（pending）         │
  ├─ 更新步骤状态（running）         │
  ├─ Redis Pub/Sub 推送 ──────────> │ 实时更新 UI
  ├─ 更新步骤状态（completed）       │
  ├─ Redis Pub/Sub 推送 ──────────> │ 实时更新 UI
  └─ 完成/失败事件 ────────────────> │ 关闭连接
```

## 核心实现

### 后端服务

**文件：** `packages/services/business/src/projects/initialization/initialization.service.ts`

**关键方法：**
1. `initializeStepsInDatabase()` - 批量插入步骤
2. `updateStepStatus()` - 更新步骤状态到数据库
3. `updateProgress()` - 推送实时进度到 Redis
4. `markStepFailed()` - 标记步骤失败

### tRPC 端点

**文件：** `apps/api-gateway/src/routers/projects.router.ts`

**端点：**
- `projects.getInitializationSteps` - 查询步骤详情（用于页面刷新恢复）
- `projects.onInitProgress` - 订阅实时进度（SSE）

### 前端组件

**文件：** `apps/web/src/components/InitializationProgress.vue`

**核心逻辑：**
1. 页面加载时调用 `restoreStepsFromDatabase()` 恢复状态
2. 订阅 SSE 接收实时更新
3. 根据事件类型更新 UI

## 用户体验

### 场景 1：正常初始化
1. 用户创建项目
2. 前端订阅 SSE，实时显示进度
3. 每个步骤完成时更新 UI
4. 初始化完成，显示成功提示

### 场景 2：页面刷新
1. 用户刷新页面
2. 前端调用 `getInitializationSteps` 从数据库恢复状态
3. 如果仍在初始化，继续订阅 SSE
4. 无缝恢复进度显示

### 场景 3：初始化失败
1. 某个步骤失败
2. 后端标记步骤为 `failed`，记录错误信息
3. 前端显示失败提示和错误详情
4. 用户刷新页面仍可查看失败原因

## 优势

✅ **最佳用户体验** - 页面刷新后完整恢复进度  
✅ **完整审计追踪** - 每个步骤的详细时间和错误记录  
✅ **性能分析** - 可统计每个步骤的平均耗时  
✅ **实时反馈** - SSE 推送，无需轮询  
✅ **数据完整性** - 即使 Redis 重启，数据库仍有完整记录

## 相关文件

- Schema: `packages/database/src/schemas/project/project-initialization-steps.schema.ts`
- Migration: `packages/database/src/migrations/0001_add_initialization_steps.sql`
- Service: `packages/services/business/src/projects/initialization/initialization.service.ts`
- Router: `apps/api-gateway/src/routers/projects.router.ts`
- Component: `apps/web/src/components/InitializationProgress.vue`
- Data Model: `docs/architecture/project-initialization-data-model.md`
