# 进度系统重构记录

## 问题描述

### 原有设计的问题

1. **双数据源冲突**
   - 数据库存储进度
   - WebSocket 实时推送进度
   - 两个数据源可能不一致，导致进度回退

2. **职责分散**
   - 前端计算步骤和进度
   - 后端也计算进度
   - 逻辑重复，难以维护

3. **缺乏单调性保证**
   - 没有机制防止进度回退
   - 前端需要防御性编程
   - 用户体验差

### 症状

- 进度条偶尔回退（从 60% 跳回 50%）
- 页面刷新后进度不准确
- 前端需要复杂的进度计算逻辑

## 解决方案

### 设计原则

**正确、完整、简洁而不简单**

- ✅ 单一数据源：Redis 作为进度的唯一真相源
- ✅ 单调性保证：后端自动拒绝进度回退
- ✅ 职责分离：后端计算进度，前端只负责展示
- ✅ 事件驱动：通过 SSE 实时推送进度更新

### 核心组件

#### 1. ProgressManagerService

**职责：** 管理进度的唯一真相源

```typescript
@Injectable()
export class ProgressManagerService {
  // 更新进度（自动保证单调性）
  async updateProgress(
    projectId: string,
    progress: number,
    message: string,
  ): Promise<boolean> {
    // 1. 获取当前进度
    const currentProgress = await this.getCurrentProgress(projectId)
    
    // 2. 检查单调性
    if (progress < currentProgress) {
      this.logger.warn(`Rejected progress regression: ${progress}% < ${currentProgress}%`)
      return false
    }
    
    // 3. 更新 Redis
    await this.redis.set(progressKey, JSON.stringify({ progress, message }))
    
    // 4. 发布事件
    await this.publishProgressEvent(projectId, progress, message)
    
    return true
  }
}
```

#### 2. InitializationSteps

**职责：** 定义标准的初始化步骤

```typescript
export const INITIALIZATION_STEPS = [
  { name: 'create_repository', progressStart: 0, progressEnd: 20 },
  { name: 'push_template', progressStart: 20, progressEnd: 50 },
  { name: 'create_database_records', progressStart: 50, progressEnd: 60 },
  { name: 'setup_gitops', progressStart: 60, progressEnd: 90 },
  { name: 'finalize', progressStart: 90, progressEnd: 100 },
]

// 计算步骤内的进度
export function calculateStepProgress(stepName: string, stepProgress: number): number {
  const range = getStepProgressRange(stepName)
  return range.start + ((range.end - range.start) * stepProgress) / 100
}
```

#### 3. Worker 使用方式

```typescript
// 更新步骤内进度（自动计算总体进度）
await this.updateStepProgress(job, 'create_repository', 0, '开始创建...')
await this.createRepository(...)
await this.updateStepProgress(job, 'create_repository', 100, '创建成功')

// ProgressManager 自动：
// 1. 计算总体进度（0% -> 0%, 100% -> 20%）
// 2. 检查单调性
// 3. 更新 Redis
// 4. 发布事件
```

#### 4. 前端组件（纯展示）

```vue
<script setup>
// 只接收事件，不计算进度
function connectSubscription() {
  unsubscribe = trpc.projects.onInitProgress.subscribe(
    { projectId },
    {
      onData: (event) => {
        if (event.type === 'initialization.progress') {
          // 直接使用后端的进度值（已保证单调性）
          progress.value = event.data.progress
          currentMessage.value = event.data.message
        }
      }
    }
  )
}
</script>
```

## 实施步骤

### 1. 创建核心组件

- ✅ `ProgressManagerService` - 进度管理器
- ✅ `initialization-steps.ts` - 步骤定义
- ✅ 注册到 `ProjectInitializationModule`

### 2. 更新 Worker

- ✅ 注入 `ProgressManagerService`
- ✅ 使用 `updateStepProgress()` 替代手动计算
- ✅ 使用 `markCompleted()` 和 `markFailed()`

### 3. 简化前端

- ✅ 移除进度计算逻辑
- ✅ 移除步骤判断逻辑
- ✅ 只保留 UI 展示和动画

### 4. 测试验证

- ✅ 单元测试：步骤进度计算
- ✅ 集成测试：Redis 存储和事件发布
- ✅ 单调性测试：进度回退保护

## 测试结果

```bash
$ bun run scripts/test-progress-system.ts

1️⃣ 测试步骤进度计算
✅ 所有步骤的进度范围正确

2️⃣ 测试当前步骤获取
✅ 根据进度值能正确识别当前步骤

3️⃣ 测试 ProgressManager
✅ 正常进度更新成功
✅ 进度回退被正确拒绝
✅ 完成标记正常工作

4️⃣ 验证事件
✅ 总共收到 6 个事件（5 个进度 + 1 个完成）
✅ 进度单调性验证通过
```

## 优势

### 1. 单一数据源

- Redis 是进度的唯一真相源
- 避免数据库和 WebSocket 的状态不一致
- 简化状态管理

### 2. 单调性保证

- 后端自动检查进度单调性
- 前端不需要防御性编程
- 用户体验更好（进度永不回退）

### 3. 职责清晰

- 后端：计算进度、保证正确性
- 前端：展示进度、提供交互
- 各司其职，易于维护

### 4. 可扩展性

- 步骤定义集中管理
- 添加新步骤只需修改 `INITIALIZATION_STEPS`
- 进度计算自动适配

### 5. 可测试性

- ProgressManager 可独立测试
- Worker 可 mock ProgressManager
- 前端可 mock SSE 事件

## 代码变更统计

### 新增文件

- `packages/services/business/src/projects/initialization/progress-manager.service.ts` (150 行)
- `packages/services/business/src/projects/initialization/initialization-steps.ts` (80 行)
- `docs/architecture/progress-system.md` (500 行)
- `scripts/test-progress-system.ts` (150 行)

### 修改文件

- `packages/services/business/src/queue/project-initialization.worker.ts`
  - 添加 ProgressManager 依赖
  - 使用 `updateStepProgress()` 替代手动计算
  - 简化进度更新逻辑（-50 行，+30 行）

- `apps/web/src/components/InitializationProgress.vue`
  - 移除进度计算逻辑
  - 移除步骤判断逻辑
  - 简化为纯展示组件（-150 行，+80 行）

### 删除文件

- `docs/architecture/initialization-progress-system.md` (旧设计文档)

### 总计

- 新增：~880 行
- 删除：~200 行
- 净增加：~680 行（主要是文档和测试）
- 核心代码净减少：~90 行（简化了逻辑）

## 迁移指南

### 对于开发者

如果你在其他地方使用了进度系统，需要：

1. **使用 ProgressManager 更新进度**
   ```typescript
   // ❌ 旧方式
   await this.redis.publish(`project:${id}`, JSON.stringify({ progress: 50 }))
   
   // ✅ 新方式
   await this.progressManager.updateProgress(id, 50, '步骤描述')
   ```

2. **使用步骤进度计算**
   ```typescript
   // ❌ 旧方式
   const progress = 20 + (30 * stepProgress) / 100
   
   // ✅ 新方式
   const progress = calculateStepProgress('push_template', stepProgress)
   ```

3. **前端只接收事件**
   ```typescript
   // ❌ 旧方式
   if (newProgress >= currentProgress) {
     progress.value = newProgress
   }
   
   // ✅ 新方式
   progress.value = event.data.progress // 后端已保证单调性
   ```

### 对于用户

无需任何操作，系统会自动升级。用户体验改进：

- ✅ 进度条不再回退
- ✅ 页面刷新后进度准确
- ✅ 进度更新更流畅

## 相关文档

- [进度系统架构](../../architecture/progress-system.md) - 详细的架构设计
- [测试脚本](../../scripts/test-progress-system.ts) - 进度系统测试

## 总结

这次重构遵循了**正确、完整、简洁而不简单**的设计原则：

- **正确**：单一数据源 + 单调性保证 = 进度永不回退
- **完整**：支持恢复、错误处理、自动清理
- **简洁**：职责清晰，前端只负责展示
- **不简单**：考虑了边界情况、性能、可扩展性

这是一个**生产级别**的实现，而不是临时方案。
