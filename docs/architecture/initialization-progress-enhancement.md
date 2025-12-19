# 项目初始化进度展示增强

## 概述

完成了项目初始化进度展示的增强，采用"渐进式跳转"交互模式（行业标准），并展示详细的步骤列表和进度信息。

## 实现方案

### 1. 交互流程

遵循 Vercel/GitHub 等平台的最佳实践：

1. 用户在 ProjectWizard 中创建项目
2. 创建成功后立即跳转到项目详情页
3. 在详情页顶部显示初始化进度卡片
4. 实时展示详细的步骤列表和进度

### 2. 详细步骤展示

InitializationProgress 组件现在展示：

- **5 个初始化步骤**：
  - 创建 Git 仓库 (create_repository) - 0-20%
  - 推送项目模板 (push_template) - 20-50%
  - 创建数据库记录 (create_database_records) - 50-60%
  - 配置 GitOps (setup_gitops) - 60-90%
  - 完成初始化 (finalize) - 90-100%

- **每个步骤的详细信息**：
  - 状态图标（运行中/完成/失败/等待/跳过）
  - 实时子任务消息（如"正在创建仓库: xxx"、"已渲染 15 个文件，准备推送..."）
  - 步骤内进度条（显示当前步骤的完成百分比）
  - 开始时间
  - 耗时
  - 错误信息（可展开查看）
  - 错误堆栈（可展开查看）

### 3. 子任务进度展示

每个步骤内部都有详细的子任务进度，例如：

**create_repository (0-20%)**:
- 0%: 开始创建 Git 仓库...
- 30%: 正在创建仓库: project-name
- 70%: 仓库创建成功，初始化分支...
- 100%: 仓库创建成功: owner/repo-name

**push_template (20-50%)**:
- 0%: 准备推送模板代码...
- 10%: 准备模板变量...
- 20%: 渲染模板文件...
- 40%: 已渲染 15 个文件，准备推送...
- 60%: 正在推送 15 个文件...
- 80%: 成功推送 15 个文件
- 100%: 模板代码推送完成

**setup_gitops (60-90%)**:
- 0%: 开始配置 GitOps...
- 10%: 获取项目信息...
- 20%: 获取仓库信息...
- 30%: 验证访问权限...
- 50%: 创建 Kubernetes 资源...
- 80%: 配置 Flux CD...
- 100%: GitOps 资源创建完成

### 4. 数据流

```
后端 Worker (project-initialization.worker.ts)
  ↓
调用 updateStepProgress(job, stepName, progress, message)
  ↓
ProgressManager.updateProgress(projectId, totalProgress, message)
  ↓
发布 Redis Pub/Sub 事件 (initialization.progress)
  ↓
SSE 订阅 (projects.onInitProgress) 接收事件
  ↓
查询 InitializationStepsService.getProjectSteps()
  ↓
返回事件 + steps 数组 + 子任务消息
  ↓
前端 InitializationProgress 组件
  ↓
实时更新步骤列表、进度条和子任务消息
```

## 技术实现

### 后端 (apps/api-gateway/src/routers/projects.router.ts)

SSE 订阅在每次事件推送时，都会查询最新的步骤列表并返回：

```typescript
subscriber.on('message', async (_channel, message) => {
  const event = JSON.parse(message)
  
  // 查询当前所有步骤
  const steps = await this.initializationSteps.getProjectSteps(input.projectId)
  
  // 发送事件和步骤数组
  emit.next({
    ...event,
    steps: steps.map((step) => ({
      step: step.step,
      status: step.status,
      progress: step.progress,
      error: step.error,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      duration: /* 计算耗时 */
    }))
  })
})
```

### 前端 (apps/web/src/components/InitializationProgress.vue)

组件接收 SSE 推送的步骤数据并展示：

```vue
<template>
  <!-- 总体进度条 -->
  <div class="progress-bar">{{ progress }}%</div>
  
  <!-- 详细步骤列表 -->
  <div v-for="step in steps" :key="step.step">
    <!-- 步骤状态图标 -->
    <Loader2 v-if="step.status === 'running'" />
    <CheckCircle2 v-else-if="step.status === 'completed'" />
    
    <!-- 步骤信息 -->
    <div>{{ getStepLabel(step.step) }}</div>
    <div>{{ step.progress }}%</div>
    <div>耗时: {{ formatDuration(step.duration) }}</div>
    
    <!-- 当前子任务消息（实时更新） -->
    <div v-if="step.status === 'running'" class="animate-pulse">
      {{ currentStepMessage(step.step) }}
    </div>
    
    <!-- 步骤内进度条 -->
    <div v-if="step.status === 'running'" class="progress-bar">
      <div :style="{ width: `${step.progress}%` }" />
    </div>
    
    <!-- 错误详情（可展开） -->
    <div v-if="step.error && expandedSteps.has(step.step)">
      <div>{{ step.error }}</div>
      <pre v-if="step.errorStack">{{ step.errorStack }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
// 存储每个步骤的当前子任务消息
const stepMessages = ref<Map<string, string>>(new Map())

// 根据总进度判断当前步骤并更新消息
function getCurrentStepByProgress(progress: number): string | null {
  if (progress < 20) return 'create_repository'
  if (progress < 50) return 'push_template'
  if (progress < 60) return 'create_database_records'
  if (progress < 90) return 'setup_gitops'
  if (progress <= 100) return 'finalize'
  return null
}

// SSE 事件处理
if (event.type === 'initialization.progress') {
  const newProgress = event.data?.progress || 0
  const newMessage = event.data?.message || ''
  
  progress.value = newProgress
  currentMessage.value = newMessage
  
  // 更新当前步骤的子任务消息
  const currentStep = getCurrentStepByProgress(newProgress)
  if (currentStep) {
    stepMessages.value.set(currentStep, newMessage)
  }
}
</script>
```

## 用户体验

### 优点

1. **即时反馈**：创建后立即跳转，用户不需要等待
2. **详细透明**：展示每个步骤的详细进度和状态
3. **错误可见**：失败时可以查看详细的错误信息和堆栈
4. **符合预期**：遵循行业标准的交互模式

### 动画效果

- 使用 v-motion 实现流畅的进入动画
- 步骤列表逐个淡入
- 进度条平滑过渡
- 状态图标旋转/缩放动画

## 文件修改

### 修改的文件

1. `apps/web/src/components/InitializationProgress.vue`
   - 添加详细步骤列表展示
   - 添加步骤展开/折叠功能
   - 添加时间和耗时格式化
   - 添加错误详情展示

2. `apps/web/src/views/ProjectDetail.vue`
   - 修正事件处理函数名称
   - 确保初始化完成后刷新状态

3. `apps/web/src/components/ProjectWizard.vue`（之前已完成）
   - 删除弹窗进度显示
   - 创建成功后立即跳转

## 测试建议

1. 创建新项目，观察跳转和进度展示
2. 查看每个步骤的详细信息
3. 模拟失败场景，查看错误展示
4. 刷新页面，确保进度恢复正常

## 后续优化

1. 添加步骤日志查看功能
2. 支持重试失败的步骤
3. 添加步骤预估时间
4. 优化移动端展示
