# 进度条回退问题

## 问题描述

在项目初始化过程中，进度条会出现回退现象：
- 进度从 70% 突然回退到 50%
- 然后再继续增长
- 用户体验不佳，看起来像是出错了

## 根本原因

进度条有两个数据来源：

1. **数据库恢复** (`fetchCurrentStatus`)
   - 页面加载时从数据库读取已保存的进度
   - 例如：恢复到 70%

2. **实时推送** (`subscription`)
   - 后端通过 WebSocket 推送实时进度
   - 可能推送较早的进度事件（例如 50%）

### 时序问题

```
时间线：
T1: 后端发送进度 50% (WebSocket 消息在队列中)
T2: 后端发送进度 70% (保存到数据库)
T3: 用户刷新页面
T4: 前端从数据库恢复进度 70% ✅
T5: 前端收到延迟的 WebSocket 消息 50% ❌ (导致回退)
T6: 前端收到新的 WebSocket 消息 80% ✅
```

## 解决方案

在 `InitializationProgress.vue` 中添加进度单调性检查：

```typescript
if (event.type === 'initialization.progress') {
  const newProgress = event.data?.progress || 0
  
  // 防止进度回退：只接受大于等于当前进度的值
  if (newProgress >= progress.value) {
    progress.value = newProgress
    smoothUpdateProgress(newProgress)
    updateSteps(newProgress)
    if (event.data?.message) currentStep.value = event.data.message
  } else {
    console.log(`忽略回退的进度: ${newProgress}% (当前: ${progress.value}%)`)
  }
}
```

### 核心逻辑

- ✅ 只接受 `newProgress >= currentProgress` 的更新
- ✅ 忽略所有回退的进度值
- ✅ 记录日志便于调试

## 修改的文件

- `apps/web/src/components/InitializationProgress.vue`

## 测试验证

### 场景 1：正常流程
```
0% -> 20% -> 40% -> 60% -> 80% -> 100% ✅
```

### 场景 2：页面刷新
```
数据库: 70%
WebSocket: 50% (忽略) -> 80% (接受) -> 100% ✅
```

### 场景 3：网络延迟
```
当前: 60%
收到: 40% (忽略) -> 50% (忽略) -> 70% (接受) ✅
```

## 用户体验改进

### 之前
- 进度条会突然回退
- 用户困惑，以为出错了
- 视觉上不流畅

### 之后
- 进度条单调递增
- 流畅的用户体验
- 符合用户预期

## 相关问题

### Q: 如果后端真的需要回退进度怎么办？

A: 在正常的初始化流程中，进度应该是单调递增的。如果需要回退，应该：
1. 重置整个初始化流程
2. 从 0% 重新开始
3. 而不是回退到中间某个值

### Q: 会不会漏掉某些进度更新？

A: 不会。我们只是忽略了**过时的**进度值，最新的进度值仍然会被接受。

### Q: 如何调试进度问题？

A: 查看浏览器控制台，会有日志：
```
忽略回退的进度: 50% (当前: 70%)
```

## 最佳实践

### 后端进度推送
```typescript
// ✅ 好的做法：确保进度单调递增
let currentProgress = 0

function updateProgress(newProgress: number) {
  if (newProgress > currentProgress) {
    currentProgress = newProgress
    publishProgress(currentProgress)
  }
}

// ❌ 避免：直接推送可能回退的进度
function updateProgress(newProgress: number) {
  publishProgress(newProgress) // 可能导致回退
}
```

### 前端进度显示
```typescript
// ✅ 好的做法：检查单调性
if (newProgress >= currentProgress) {
  setProgress(newProgress)
}

// ❌ 避免：直接设置
setProgress(newProgress) // 可能导致回退
```

## 未来改进

### 可能的优化
1. **进度版本号**: 为每个进度更新添加版本号，只接受更新版本的进度
2. **时间戳**: 使用时间戳判断进度的新旧
3. **状态机**: 使用状态机管理初始化流程，确保状态转换的正确性

### 示例：使用版本号
```typescript
interface ProgressUpdate {
  progress: number
  version: number // 单调递增的版本号
  timestamp: number
}

function updateProgress(update: ProgressUpdate) {
  if (update.version > currentVersion) {
    currentVersion = update.version
    setProgress(update.progress)
  }
}
```

## 更新日志

- 2025-11-28: 添加进度单调性检查，防止进度回退
