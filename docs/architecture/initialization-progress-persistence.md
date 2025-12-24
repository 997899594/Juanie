# 项目初始化进度持久化方案

> 确保刷新页面后进度不丢失，初始化继续进行

## 🎯 核心需求

**用户场景**：
1. 用户点击"创建项目"
2. 初始化进行到 50%
3. 用户刷新页面或关闭浏览器
4. 重新打开页面，应该看到：
   - ✅ 当前进度（50%）
   - ✅ 已完成的步骤（绿色勾）
   - ✅ 正在进行的步骤（蓝色转圈）
   - ✅ 初始化继续进行（不会重新开始）

---

## ✅ 现有实现（已支持）

### 1. 数据库持久化

```typescript
// project_initialization_steps 表
{
  id: uuid,
  projectId: uuid,
  step: 'create_project' | 'create_environments' | ...,
  status: 'pending' | 'running' | 'completed' | 'failed',
  progress: '0' | '50' | '100',
  startedAt: timestamp,
  completedAt: timestamp,
}
```

**优势**：
- ✅ 持久化：数据库记录永久保存
- ✅ 可恢复：刷新后可以查询当前状态
- ✅ 可追溯：可以看到每个步骤的完成时间

### 2. 前端恢复逻辑

```typescript
// InitializationProgress.vue
async function fetchCurrentStatus() {
  // 1. 查询项目状态
  const projectStatus = await trpc.projects.getStatus.query({ 
    projectId: props.projectId 
  })
  
  // 2. 如果已完成，直接显示 100%
  if (project.status === 'active') {
    status.value = 'completed'
    progress.value = 100
    return
  }
  
  // 3. 如果失败，显示错误
  if (project.status === 'failed') {
    status.value = 'failed'
    errorMessage.value = project.initializationError
    return
  }
  
  // 4. 如果正在初始化，连接 SSE 订阅
  if (project.status === 'initializing') {
    connectSubscription()
  }
}

onMounted(() => {
  fetchCurrentStatus()  // 页面加载时恢复状态
})
```

### 3. 后端订阅逻辑

```typescript
// ProjectsService.subscribeToProgress()
async *subscribeToProgress(projectId: string) {
  // 1. 先发送当前状态（从数据库查询）
  const project = await this.db.query.projects.findFirst({ ... })
  const steps = await this.db.query.projectInitializationSteps.findMany({ ... })
  
  yield {
    type: 'init',
    data: {
      status: project.status,
      progress: calculateProgress(steps),  // 根据已完成步骤计算
      steps,  // 发送所有步骤详情
    }
  }
  
  // 2. 如果已完成，直接结束
  if (project.status === 'active' || project.status === 'failed') {
    return
  }
  
  // 3. 持续监听 Redis 事件
  while (isActive) {
    const event = await waitForEvent()
    yield event
  }
}
```

---

## 🔄 改进后的实现（方案 A）

### 关键点：保持数据库持久化

```typescript
// ✅ 保留：InitializationStepsService（数据库持久化）
async create(userId: string, data: CreateProjectInput) {
  const projectId = generateId()
  
  try {
    // 步骤 1: 创建项目 (0% → 20%)
    await this.initSteps.startStep(projectId, 'create_project')  // 写入数据库
    await this.createProjectHandler.execute(context)
    await this.initSteps.completeStep(projectId, 'create_project')  // 更新数据库
    
    // 步骤 2: 创建环境 (20% → 40%)
    await this.initSteps.startStep(projectId, 'create_environments')  // 写入数据库
    await this.createEnvironmentsHandler.execute(context)
    await this.initSteps.completeStep(projectId, 'create_environments')  // 更新数据库
    
    // ... 更多步骤
  } catch (error) {
    // 标记当前步骤失败
    const currentStep = await this.initSteps.getCurrentStep(projectId)
    if (currentStep) {
      await this.initSteps.failStep(projectId, currentStep.step, error.message)
    }
  }
}
```

### 数据流

```
用户刷新页面
    ↓
前端: fetchCurrentStatus()
    ↓
后端: getStatus() → 查询数据库
    ↓
返回: {
  project: { status: 'initializing' },
  steps: [
    { step: 'create_project', status: 'completed', progress: '100' },
    { step: 'create_environments', status: 'running', progress: '50' },
    { step: 'setup_repository', status: 'pending', progress: '0' },
  ]
}
    ↓
前端: 显示当前进度 + 连接 SSE
    ↓
后端: 继续执行（不会重新开始）
```

---

## 🎨 用户体验对比

### 场景 1：刷新页面（初始化进行中）

**改进前（现有实现）**：
```
1. 用户刷新页面
2. 前端查询数据库 → 看到当前进度（50%）
3. 连接 SSE → 继续接收实时更新
4. ✅ 进度不丢失，初始化继续
```

**改进后（方案 A）**：
```
1. 用户刷新页面
2. 前端查询数据库 → 看到当前进度（50%）
3. 连接 SSE → 继续接收实时更新
4. ✅ 进度不丢失，初始化继续
```

**结论**：✅ **完全相同**

### 场景 2：服务器重启（初始化进行中）

**改进前（现有实现）**：
```
1. 服务器重启
2. BullMQ Worker 重新启动
3. 从队列中恢复未完成的任务
4. ✅ 初始化继续（从断点恢复）
```

**改进后（方案 A）**：
```
1. 服务器重启
2. 初始化进程中断
3. ❌ 需要手动重试（或实现自动恢复）
```

**结论**：⚠️ **需要额外处理**

---

## 🛡️ 服务器重启恢复方案

### 方案 1：幂等性设计（推荐）

```typescript
// 每个 Handler 都是幂等的
class CreateProjectHandler {
  async execute(context: InitializationContext): Promise<void> {
    // 检查是否已创建
    const existing = await this.db.query.projects.findFirst({
      where: eq(projects.id, context.projectId)
    })
    
    if (existing) {
      this.logger.info('Project already exists, skipping creation')
      return  // 跳过，不重复创建
    }
    
    // 创建项目
    await this.db.insert(projects).values({ ... })
  }
}
```

**优势**：
- ✅ 可以安全地重新执行整个流程
- ✅ 不会重复创建资源
- ✅ 简单可靠

### 方案 2：断点恢复

```typescript
async create(userId: string, data: CreateProjectInput) {
  const projectId = data.projectId || generateId()
  
  // 查询已完成的步骤
  const completedSteps = await this.initSteps.getCompletedSteps(projectId)
  
  // 从断点继续
  if (!completedSteps.includes('create_project')) {
    await this.createProjectHandler.execute(context)
  }
  
  if (!completedSteps.includes('create_environments')) {
    await this.createEnvironmentsHandler.execute(context)
  }
  
  // ... 更多步骤
}
```

**优势**：
- ✅ 精确恢复到断点
- ✅ 不会重复执行已完成的步骤
- ⚠️ 需要额外的恢复逻辑

### 方案 3：后台任务守护进程

```typescript
// 定时检查未完成的初始化
@Cron('*/5 * * * *')  // 每 5 分钟
async checkStuckInitializations() {
  const stuckProjects = await this.db.query.projects.findMany({
    where: and(
      eq(projects.status, 'initializing'),
      lt(projects.updatedAt, new Date(Date.now() - 10 * 60 * 1000))  // 10 分钟无更新
    )
  })
  
  for (const project of stuckProjects) {
    this.logger.warn(`Retrying stuck initialization: ${project.id}`)
    await this.retryInitialization(project.id)
  }
}
```

**优势**：
- ✅ 自动恢复卡住的初始化
- ✅ 用户无感知
- ⚠️ 需要额外的守护进程

---

## 📊 对比总结

| 场景 | 现有实现 | 方案 A (幂等性) | 方案 A (断点恢复) | 方案 A (守护进程) |
|------|---------|----------------|------------------|------------------|
| **刷新页面** | ✅ 完美 | ✅ 完美 | ✅ 完美 | ✅ 完美 |
| **关闭浏览器** | ✅ 继续 | ✅ 继续 | ✅ 继续 | ✅ 继续 |
| **服务器重启** | ✅ 自动恢复 | ⚠️ 需重试 | ✅ 自动恢复 | ✅ 自动恢复 |
| **进程崩溃** | ✅ 队列恢复 | ⚠️ 需重试 | ✅ 断点恢复 | ✅ 守护恢复 |
| **实现复杂度** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **性能** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🎯 推荐方案

### 短期：方案 A + 幂等性设计

```typescript
// 1. 每个 Handler 都是幂等的
// 2. 用户可以手动重试（前端提供"重试"按钮）
// 3. 99% 的情况下不会有问题（服务器很少重启）

// 前端：重试按钮
<UiButton 
  v-if="status === 'failed'" 
  @click="retryInitialization"
>
  重试初始化
</UiButton>
```

**优势**：
- ✅ 实现简单（只需要幂等性）
- ✅ 性能最优（无队列开销）
- ✅ 覆盖 99% 的场景
- ⚠️ 服务器重启需要手动重试（但很少发生）

### 长期：方案 A + 守护进程

```typescript
// 1. 幂等性设计（基础）
// 2. 守护进程自动恢复（高级）
// 3. 完全无感知的用户体验

@Cron('*/5 * * * *')
async checkStuckInitializations() {
  // 自动恢复卡住的初始化
}
```

**优势**：
- ✅ 完全自动化
- ✅ 用户无感知
- ✅ 覆盖 100% 的场景
- ⚠️ 需要额外的守护进程

---

## 💡 关键洞察

### 1. 数据库是真相源

```typescript
// ✅ 正确：数据库记录每个步骤的状态
await this.initSteps.startStep(projectId, 'create_project')
await this.initSteps.completeStep(projectId, 'create_project')

// ❌ 错误：只在内存中记录状态
let currentStep = 'create_project'  // 刷新后丢失
```

### 2. 幂等性是关键

```typescript
// ✅ 幂等：可以安全地重复执行
async createProject(context) {
  const existing = await this.findProject(context.projectId)
  if (existing) return existing  // 已存在，直接返回
  
  return await this.db.insert(projects).values({ ... })
}

// ❌ 非幂等：重复执行会出错
async createProject(context) {
  return await this.db.insert(projects).values({ ... })  // 重复执行会报错
}
```

### 3. 前端恢复逻辑

```typescript
// ✅ 正确：先查询数据库，再连接 SSE
onMounted(async () => {
  await fetchCurrentStatus()  // 从数据库恢复状态
  connectSubscription()       // 连接实时更新
})

// ❌ 错误：只连接 SSE
onMounted(() => {
  connectSubscription()  // 刷新后看不到历史进度
})
```

---

## 🚀 实现步骤

### 阶段 1：保持现有行为（1 天）

```typescript
// 1. 保留 InitializationStepsService（数据库持久化）
// 2. 保留前端恢复逻辑（fetchCurrentStatus）
// 3. 移除状态机和队列
// 4. 测试刷新页面场景
```

### 阶段 2：添加幂等性（2 天）

```typescript
// 1. 为每个 Handler 添加幂等性检查
// 2. 添加前端"重试"按钮
// 3. 测试服务器重启场景
```

### 阶段 3：添加守护进程（可选，3 天）

```typescript
// 1. 实现定时任务检查卡住的初始化
// 2. 自动重试失败的初始化
// 3. 监控和告警
```

---

## 📝 总结

**回答你的问题**：

> 改完后，创建过程中刷新页面，进度还能保留并且接着进行吗？

✅ **是的，完全可以！**

**原因**：
1. ✅ 数据库持久化：`project_initialization_steps` 表记录每个步骤
2. ✅ 前端恢复逻辑：`fetchCurrentStatus()` 查询数据库恢复状态
3. ✅ 后端继续执行：初始化进程不会因为前端刷新而中断

**唯一的区别**：
- 现有实现：服务器重启后，BullMQ 自动恢复
- 改进方案：服务器重启后，需要手动重试（或添加守护进程）

**但实际上**：
- 服务器重启很少发生（可能几个月一次）
- 用户刷新页面很常见（每天几十次）
- 所以改进方案覆盖了 99% 的场景

**如果需要 100% 覆盖**：
- 添加守护进程（定时检查卡住的初始化）
- 或者保留 BullMQ（但只用于长时间任务）
