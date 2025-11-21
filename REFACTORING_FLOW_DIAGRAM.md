# 项目初始化流程 - 状态机流程图

## 🔄 完整状态转换图

```
                    ┌─────────────────┐
                    │      IDLE       │
                    │   (初始状态)     │
                    └────────┬────────┘
                             │ START
                             ▼
                    ┌─────────────────┐
                    │ CREATING_PROJECT│
                    │  (创建项目记录)  │
                    └────────┬────────┘
                             │ PROJECT_CREATED
                             ▼
                    ┌─────────────────┐
                    │ LOADING_TEMPLATE│◄─── 可选
                    │  (加载模板配置)  │     (有 templateId 时)
                    └────────┬────────┘
                             │ TEMPLATE_LOADED
                             ▼
                    ┌─────────────────┐
                    │RENDERING_TEMPLATE│◄─── 可选
                    │  (渲染模板文件)  │     (有模板且有仓库时)
                    └────────┬────────┘
                             │ TEMPLATE_RENDERED
                             ▼
                    ┌─────────────────┐
                    │CREATING_ENVS    │
                    │ (创建 3 个环境)  │
                    └────────┬────────┘
                             │ ENVIRONMENTS_CREATED
                             ▼
                    ┌─────────────────┐
                    │SETTING_UP_REPO  │◄─── 可选
                    │ (设置 Git 仓库)  │     (有 repository 时)
                    └────────┬────────┘
                             │ REPOSITORY_READY
                             ▼
                    ┌─────────────────┐
                    │ CREATING_GITOPS │◄─── 可选
                    │(创建 GitOps 资源)│     (有仓库且 Flux 已安装)
                    └────────┬────────┘
                             │ GITOPS_CREATED
                             ▼
                    ┌─────────────────┐
                    │   FINALIZING    │
                    │ (更新状态/通知)  │
                    └────────┬────────┘
                             │ FINALIZED
                             ▼
                    ┌─────────────────┐
                    │   COMPLETED     │
                    │   (完成)        │
                    └─────────────────┘

                    任何状态发生错误
                             │ ERROR
                             ▼
                    ┌─────────────────┐
                    │     FAILED      │
                    │   (失败)        │
                    └─────────────────┘
```

---

## 📊 状态详情

### 1. CREATING_PROJECT (10%)

**职责**: 创建项目数据库记录

**输入**:
- userId
- organizationId
- projectData (name, slug, description, etc.)

**输出**:
- projectId

**处理器**: `CreateProjectHandler`

**可能的错误**:
- 项目 slug 已存在
- 数据库连接失败
- 权限不足

---

### 2. LOADING_TEMPLATE (20%)

**职责**: 加载模板配置

**条件**: `canHandle = !!context.templateId`

**输入**:
- templateId

**输出**:
- templatePath

**处理器**: `LoadTemplateHandler`

**可能的错误**:
- 模板不存在
- 模板配置无效

---

### 3. RENDERING_TEMPLATE (30%)

**职责**: 渲染模板文件

**条件**: `canHandle = !!context.templatePath && !!context.repository`

**输入**:
- templatePath
- projectData
- templateConfig

**输出**:
- renderedTemplatePath

**处理器**: `RenderTemplateHandler`

**可能的错误**:
- 模板渲染失败
- 文件系统错误

---

### 4. CREATING_ENVIRONMENTS (50%)

**职责**: 创建 3 个默认环境

**条件**: `canHandle = true` (总是执行)

**输入**:
- projectId
- userId

**输出**:
- environmentIds (3 个)

**处理器**: `CreateEnvironmentsHandler`

**环境列表**:
1. Development (开发环境)
   - approvalRequired: false
   - minApprovals: 0

2. Staging (预发布环境)
   - approvalRequired: true
   - minApprovals: 1

3. Production (生产环境)
   - approvalRequired: true
   - minApprovals: 2

**可能的错误**:
- 环境创建失败
- 部分环境创建失败（会继续）

---

### 5. SETTING_UP_REPOSITORY (70%)

**职责**: 设置 Git 仓库

**条件**: `canHandle = !!context.repository`

**输入**:
- repository (mode, provider, url/name, accessToken)

**输出**:
- repositoryId (快速路径)
- jobIds (慢速路径)

**处理器**: `SetupRepositoryHandler`

**两种模式**:

#### 快速路径 (existing)
```
关联现有仓库 (同步)
  ↓
验证仓库存在
  ↓
创建数据库记录
  ↓
返回 repositoryId
```

#### 慢速路径 (create)
```
创建新仓库 (异步)
  ↓
添加到队列
  ↓
返回 jobId
  ↓
Worker 处理
  ↓
通过 SSE 通知前端
```

**可能的错误**:
- OAuth 令牌无效
- 仓库不存在
- 仓库创建失败
- 权限不足

---

### 6. CREATING_GITOPS (85%)

**职责**: 创建 GitOps 资源

**条件**: `canHandle = !!context.repositoryId && flux.isInstalled()`

**输入**:
- projectId
- repositoryId
- environmentIds

**输出**:
- gitopsResourceIds

**处理器**: `CreateGitOpsHandler`

**为每个环境创建**:
- GitRepository 资源
- Kustomization 资源

**可能的错误**:
- Flux 未安装
- K8s 连接失败
- 资源创建失败（非致命）

---

### 7. FINALIZING (100%)

**职责**: 完成初始化

**条件**: `canHandle = true` (总是执行)

**输入**:
- projectId
- 所有已创建的资源 ID

**输出**:
- 无

**处理器**: `FinalizeHandler`

**操作**:
1. 更新项目状态为 'active'
2. 记录审计日志
3. 发送通知

**可能的错误**:
- 数据库更新失败
- 通知发送失败（非致命）

---

## 🎯 执行路径示例

### 场景 1: 空项目（最简单）

```
IDLE
  → CREATING_PROJECT (10%)
  → LOADING_TEMPLATE (跳过)
  → RENDERING_TEMPLATE (跳过)
  → CREATING_ENVIRONMENTS (50%)
  → SETTING_UP_REPOSITORY (跳过)
  → CREATING_GITOPS (跳过)
  → FINALIZING (100%)
  → COMPLETED
```

**时间**: ~2 秒

---

### 场景 2: 使用模板 + 关联现有仓库（快速）

```
IDLE
  → CREATING_PROJECT (10%)
  → LOADING_TEMPLATE (20%)
  → RENDERING_TEMPLATE (30%)
  → CREATING_ENVIRONMENTS (50%)
  → SETTING_UP_REPOSITORY (70%) [快速路径]
  → CREATING_GITOPS (85%)
  → FINALIZING (100%)
  → COMPLETED
```

**时间**: ~5 秒

---

### 场景 3: 使用模板 + 创建新仓库（慢速）

```
IDLE
  → CREATING_PROJECT (10%)
  → LOADING_TEMPLATE (20%)
  → RENDERING_TEMPLATE (30%)
  → CREATING_ENVIRONMENTS (50%)
  → SETTING_UP_REPOSITORY (70%) [慢速路径，返回 jobId]
  → CREATING_GITOPS (跳过，等待仓库创建)
  → FINALIZING (100%)
  → COMPLETED

后台 Worker:
  → 创建 Git 仓库
  → 推送初始代码
  → 创建 GitOps 资源
  → 通过 SSE 通知前端
```

**时间**: 
- 主流程: ~3 秒
- 后台任务: ~30 秒

---

## 🔍 状态机内部流程

### 执行循环

```typescript
while (currentState !== 'COMPLETED' && currentState !== 'FAILED') {
  // 1. 获取当前状态的处理器
  handler = handlers.get(currentState)
  
  // 2. 检查是否需要执行
  if (!handler.canHandle(context)) {
    // 跳过此状态
    transition(context, getNextEvent(currentState))
    continue
  }
  
  // 3. 更新进度
  context.progress = handler.getProgress()
  
  // 4. 执行处理器
  try {
    await handler.execute(context)
    
    // 5. 转换到下一个状态
    transition(context, getNextEvent(currentState))
  } catch (error) {
    // 6. 错误处理
    context.error = error
    transition(context, 'ERROR')
  }
}
```

---

## 📈 进度追踪

```
0%   ────────────────────────────────────────── IDLE
10%  ████────────────────────────────────────── CREATING_PROJECT
20%  ████████────────────────────────────────── LOADING_TEMPLATE
30%  ████████████────────────────────────────── RENDERING_TEMPLATE
50%  ████████████████████────────────────────── CREATING_ENVIRONMENTS
70%  ████████████████████████████────────────── SETTING_UP_REPOSITORY
85%  ██████████████████████████████████──────── CREATING_GITOPS
100% ██████████████████████████████████████████ COMPLETED
```

---

## 🎨 前端集成

### 监听进度

```typescript
// 前端代码
const { project, jobIds } = await createProject(data)

if (jobIds && jobIds.length > 0) {
  // 有异步任务，监听进度
  const eventSource = new EventSource(`/api/jobs/${jobIds[0]}/progress`)
  
  eventSource.onmessage = (event) => {
    const { state, progress } = JSON.parse(event.data)
    
    // 更新 UI
    updateProgress(progress)
    updateStatus(state)
  }
  
  eventSource.addEventListener('completed', () => {
    eventSource.close()
    showSuccess('项目初始化完成')
  })
  
  eventSource.addEventListener('failed', (event) => {
    eventSource.close()
    showError(event.data)
  })
}
```

---

## 🔧 扩展示例

### 添加新状态: CREATING_DATABASE

```typescript
// 1. 更新状态转换表
CREATING_ENVIRONMENTS: {
  ENVIRONMENTS_CREATED: 'CREATING_DATABASE',  // 新增
},
CREATING_DATABASE: {
  DATABASE_CREATED: 'SETTING_UP_REPOSITORY',  // 新增
},

// 2. 创建处理器
@Injectable()
export class CreateDatabaseHandler implements StateHandler {
  readonly name = 'CREATING_DATABASE'
  
  canHandle(context: InitializationContext): boolean {
    return !!context.databaseConfig
  }
  
  getProgress(): number {
    return 60  // 在环境(50%)和仓库(70%)之间
  }
  
  async execute(context: InitializationContext): Promise<void> {
    const database = await this.databaseService.create(...)
    context.databaseId = database.id
  }
}

// 3. 注册处理器
this.stateMachine.registerHandler(this.createDatabaseHandler)
```

**新的流程图**:
```
CREATING_ENVIRONMENTS (50%)
  ↓
CREATING_DATABASE (60%)  ← 新增
  ↓
SETTING_UP_REPOSITORY (70%)
```

---

## 📝 总结

状态机模式的优势：

1. **清晰的流程** - 一目了然的状态转换
2. **灵活的执行** - 通过 `canHandle` 控制是否执行
3. **易于扩展** - 添加新状态不影响现有代码
4. **易于测试** - 每个状态独立测试
5. **易于调试** - 清晰的执行路径
6. **进度追踪** - 精确的进度百分比
7. **错误处理** - 统一的错误处理机制

这是一个**教科书级别的状态机实现**！
