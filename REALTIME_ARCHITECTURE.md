# 实时通信架构

## 概述

使用 **tRPC Subscription** 实现项目初始化进度的实时推送，简洁、类型安全、易维护。

## 架构

```
前端 (Vue)
  ↓ trpc.projects.onInitProgress.subscribe()
tRPC Subscription
  ↓
ProjectsService.subscribeToProgress()
  ↓
EventBus (Redis Pub/Sub)
  ↑
JobEventPublisher (监听 BullMQ 事件)
  ↑
Worker (项目初始化任务)
```

## 核心组件

### 1. 后端 - tRPC Subscription

**文件**: `apps/api-gateway/src/routers/projects.router.ts`

```typescript
onInitProgress: this.trpc.protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .subscription(async ({ input }) => {
    return this.projectsService.subscribeToProgress(input.projectId)
  })
```

### 2. 服务层 - Async Generator

**文件**: `packages/services/projects/src/projects.service.ts`

```typescript
async *subscribeToProgress(projectId: string) {
  const channel = `project:${projectId}`
  const eventBus = this.orchestrator.eventBus
  
  // 订阅 Redis channel
  await eventBus.subscribe(channel, handler)
  
  // 持续推送事件
  while (isActive) {
    const event = await getNextEvent()
    yield event
  }
}
```

### 3. 前端 - tRPC Client

**文件**: `apps/web/src/components/InitializationProgress.vue`

```typescript
trpc.projects.onInitProgress.subscribe(
  { projectId },
  {
    onData: (event) => {
      // 处理进度更新
      progress.value = event.data.progress
    },
    onError: (err) => {
      // 处理错误
    }
  }
)
```

## 优势

1. **类型安全**: 完整的 TypeScript 类型推导
2. **统一 API**: 所有接口都通过 tRPC，无需单独的 SSE 端点
3. **自动重连**: tRPC 客户端自动处理断线重连
4. **简单配置**: 无需处理 CORS、SSE 头等底层细节
5. **易于测试**: 标准的 async generator，易于单元测试

## 事件流

1. Worker 更新任务进度 → BullMQ 事件
2. JobEventPublisher 监听 BullMQ → 发布到 Redis (`project:${projectId}`)
3. ProjectsService 订阅 Redis → yield 事件
4. tRPC 推送事件 → 前端
5. 前端更新 UI

## 清理的旧代码

- ❌ `apps/api-gateway/src/controllers/sse.controller.ts`
- ❌ 原生 EventSource 实现
- ❌ 手动 CORS 处理
- ❌ SSE 响应头管理

## 保留的核心模块

- ✅ `packages/core/sse` - EventBus (Redis Pub/Sub)
- ✅ `packages/core/queue` - JobEventPublisher
- ✅ tRPC infrastructure

## 最佳实践

1. **使用 tRPC subscription** 而不是原生 SSE
2. **EventBus 只用于内部事件分发**，不直接暴露给前端
3. **所有实时通信统一通过 tRPC**
4. **保持简单**，避免过度设计
