# 项目初始化流程重构方案

## 当前问题

### 1. GitOps 创建路径重复
- `CreateGitOpsHandler` 未被使用
- 事件驱动路径才是实际执行的
- 状态机中的 `CREATING_GITOPS` 状态空转

### 2. 认证流程冗余
- OAuth token 传递链路过长
- 凭证在数据库和 K8s 重复存储
- 每个 namespace 创建相同的 Secret

### 3. 状态机过度设计
- 9 个状态但都是线性执行
- 没有真正的分支和回滚
- 可以简化为顺序执行

## 优化方案

### 方案 1：简化为线性流程（推荐）

```typescript
// 简化后的初始化服务
class ProjectInitializationService {
  async initialize(data: CreateProjectInput): Promise<Project> {
    // 1. 创建项目记录
    const project = await this.createProject(data)
    
    // 2. 创建环境
    const environments = await this.createEnvironments(project.id)
    
    // 3. 如果有仓库，设置 GitOps
    if (data.repositoryUrl) {
      await this.setupGitOps({
        projectId: project.id,
        repositoryUrl: data.repositoryUrl,
        userId: data.userId,
        environments,
      })
    }
    
    return project
  }
  
  private async setupGitOps(data: SetupGitOpsInput) {
    // 3.1 创建 Git 凭证（GitHub Deploy Key / GitLab Token）
    const credential = await this.gitAuth.createCredential(data)
    
    // 3.2 创建 K8s 资源（Namespace + Secret + GitRepository + Kustomization）
    await this.fluxResources.setupProject({
      ...data,
      credential,
    })
  }
}
```

**优点：**
- 代码简洁，易于理解
- 没有状态机的复杂性
- 错误处理直接用 try-catch
- 适合 80% 的场景

**缺点：**
- 失去了状态追踪能力
- 无法暂停/恢复
- 不适合长时间运行的任务

### 方案 2：保留状态机但简化（折中）

```typescript
// 简化状态机：只保留关键状态
type InitState = 
  | 'CREATING_PROJECT'
  | 'CREATING_ENVIRONMENTS' 
  | 'SETTING_UP_GITOPS'  // 合并 REPOSITORY + GITOPS
  | 'COMPLETED'
  | 'FAILED'

// 移除不必要的 Handler
// - LoadTemplateHandler (模板加载可以在创建项目时同步完成)
// - RenderTemplateHandler (渲染可以在创建项目时同步完成)
// - CreateGitOpsHandler (已被事件驱动替代)
```

**优点：**
- 保留状态追踪
- 代码量减少 50%
- 仍然支持进度报告

**缺点：**
- 仍有一定复杂度
- 需要维护状态机逻辑

### 方案 3：异步任务队列（最灵活）

```typescript
// 使用 BullMQ 队列处理初始化
class ProjectInitializationQueue {
  async enqueue(data: CreateProjectInput): Promise<string> {
    // 添加任务到队列
    const job = await this.queue.add('initialize-project', data)
    return job.id
  }
}

// Worker 处理
class ProjectInitializationWorker {
  async process(job: Job<CreateProjectInput>) {
    // 1. 创建项目
    await job.updateProgress(20)
    const project = await this.createProject(job.data)
    
    // 2. 创建环境
    await job.updateProgress(50)
    await this.createEnvironments(project.id)
    
    // 3. 设置 GitOps
    await job.updateProgress(80)
    await this.setupGitOps(project.id, job.data)
    
    await job.updateProgress(100)
    return project
  }
}
```

**优点：**
- 天然支持重试和错误恢复
- 进度追踪由队列管理
- 可以处理长时间任务
- 支持分布式执行

**缺点：**
- 需要 Redis 和 BullMQ
- 增加系统复杂度
- 调试相对困难

## 认证流程优化

### 当前流程
```
User OAuth → GitAuthService → Database + K8s Secrets (每个 namespace)
```

### 优化后
```typescript
// 1. 简化凭证创建
class GitAuthService {
  async createCredential(data: {
    projectId: string
    repositoryUrl: string
    userId: string
  }): Promise<GitCredential> {
    // 自动检测 provider
    const provider = this.detectProvider(data.repositoryUrl)
    
    // 获取用户 OAuth token（只用一次）
    const oauthToken = await this.getOAuthToken(data.userId, provider)
    
    // 创建长期凭证
    if (provider === 'github') {
      return await this.createGitHubDeployKey(data, oauthToken)
    } else {
      return await this.createGitLabToken(data, oauthToken)
    }
  }
}

// 2. K8s Secret 优化：使用 Secret 引用
// 只在一个 namespace 创建 Secret，其他 namespace 引用
// 或者使用 External Secrets Operator
```

## 推荐方案

**短期（立即执行）：**
1. 删除 `CreateGitOpsHandler`（已不使用）
2. 简化状态机：合并 REPOSITORY + GITOPS 状态
3. 移除 LoadTemplate 和 RenderTemplate Handler（同步执行）

**中期（1-2 周）：**
1. 评估是否需要状态机
2. 如果不需要复杂的状态追踪，改为方案 1（线性流程）
3. 如果需要进度追踪，改为方案 3（队列）

**长期（1 个月+）：**
1. 使用 External Secrets Operator 管理 Git 凭证
2. 实现真正的回滚机制
3. 添加初始化失败的自动重试

## 立即可执行的清理

### 删除未使用的代码
- `packages/services/business/src/projects/initialization/handlers/create-gitops.handler.ts`
- 状态机中的 `CREATING_GITOPS` 状态处理

### 简化认证流程
- 移除 `accessToken` 参数传递（在 GitAuthService 内部获取）
- 统一 URL 格式转换逻辑

### 文档更新
- 更新架构文档，说明实际使用的是事件驱动流程
- 删除过时的状态机文档
