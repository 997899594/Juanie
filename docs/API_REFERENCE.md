# API 参考文档

本文档提供 Juanie 平台所有 tRPC API 端点的详细说明。

---

## 🔐 认证

所有 API 端点（除了 `auth.*` 外）都需要认证。

### 认证方式

```typescript
// HTTP Header
Authorization: Bearer <access_token>
```

### 获取 Token

```typescript
// 登录
const { accessToken, refreshToken } = await trpc.auth.login.mutate({
  username: 'user@example.com',
  password: 'password',
})

// 刷新 Token
const { accessToken } = await trpc.auth.refresh.mutate({
  refreshToken,
})
```

---

## 📚 API 端点

### 1. 认证 (auth)

#### `auth.login`
用户登录

```typescript
trpc.auth.login.mutate({
  username: string
  password: string
})

// 返回
{
  accessToken: string
  refreshToken: string
  user: User
}
```

#### `auth.register`
用户注册

```typescript
trpc.auth.register.mutate({
  username: string
  email: string
  password: string
  displayName?: string
})

// 返回
{
  user: User
}
```

#### `auth.refresh`
刷新 Token

```typescript
trpc.auth.refresh.mutate({
  refreshToken: string
})

// 返回
{
  accessToken: string
}
```

#### `auth.logout`
用户登出

```typescript
trpc.auth.logout.mutate()

// 返回
{
  success: boolean
}
```

#### `auth.me`
获取当前用户信息

```typescript
trpc.auth.me.query()

// 返回
{
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string
  role: string
}
```

---

### 2. 项目管理 (projects)

#### `projects.list`
获取项目列表

```typescript
trpc.projects.list.useQuery({
  organizationId: string
  status?: 'active' | 'archived'
  page?: number
  limit?: number
})

// 返回
{
  items: Project[]
  total: number
  page: number
  limit: number
}
```

#### `projects.get`
获取项目详情

```typescript
trpc.projects.get.useQuery({
  id: string
})

// 返回
Project
```

#### `projects.create`
创建项目

支持多种创建场景：
- **简单创建**: 只提供基本信息
- **模板创建**: 提供 `templateId` 应用模板
- **仓库创建**: 提供 `repository` 连接 Git 仓库
- **完整创建**: 同时提供模板和仓库

```typescript
trpc.projects.create.useMutation({
  // 必需字段
  name: string
  slug: string
  organizationId: string
  
  // 可选字段
  description?: string
  visibility?: 'public' | 'private' | 'internal'
  logoUrl?: string
  
  // 模板配置（可选）
  templateId?: string
  templateConfig?: Record<string, any>
  
  // 仓库配置（可选）
  repository?: {
    provider: 'github' | 'gitlab'
    name: string
    visibility: 'public' | 'private'
    autoInit?: boolean
  }
})

// 返回
{
  ...Project,
  jobIds?: string[]  // 异步任务 ID（如果有模板或仓库）
}
```

**示例**:

```typescript
// 简单创建
const project = await trpc.projects.create.mutate({
  name: 'My Project',
  slug: 'my-project',
  organizationId: 'org-123',
})

// 使用模板创建
const project = await trpc.projects.create.mutate({
  name: 'Next.js App',
  slug: 'nextjs-app',
  organizationId: 'org-123',
  templateId: 'nextjs-15-app',
  templateConfig: {
    typescript: true,
    tailwind: true,
  },
})

// 连接仓库创建
const project = await trpc.projects.create.mutate({
  name: 'My App',
  slug: 'my-app',
  organizationId: 'org-123',
  repository: {
    provider: 'github',
    name: 'my-org/my-app',
    visibility: 'private',
    autoInit: true,
  },
})

// 完整创建（模板 + 仓库）
const project = await trpc.projects.create.mutate({
  name: 'Full Stack App',
  slug: 'full-stack-app',
  organizationId: 'org-123',
  templateId: 'nextjs-15-app',
  repository: {
    provider: 'github',
    name: 'my-org/full-stack-app',
    visibility: 'private',
  },
})
```

**注意**: 
- 所有创建场景都使用统一的 API 端点
- 如果提供了 `templateId` 或 `repository`，创建过程将异步进行
- 可以通过返回的 `jobIds` 订阅 SSE 事件来跟踪初始化进度

#### `projects.update`
更新项目

```typescript
trpc.projects.update.useMutation({
  id: string
  name?: string
  description?: string
  logoUrl?: string
  visibility?: 'public' | 'private'
})

// 返回
Project
```

#### `projects.delete`
删除项目

```typescript
trpc.projects.delete.useMutation({
  id: string
})

// 返回
{
  success: boolean
}
```

#### `projects.archive`
归档项目

```typescript
trpc.projects.archive.useMutation({
  id: string
})

// 返回
Project
```

#### `projects.restore`
恢复项目

```typescript
trpc.projects.restore.useMutation({
  id: string
})

// 返回
Project
```

---

### 3. 部署管理 (deployments)

#### `deployments.list`
获取部署列表

```typescript
trpc.deployments.list.useQuery({
  projectId: string
  environmentId?: string
  status?: 'pending' | 'running' | 'success' | 'failed'
  page?: number
  limit?: number
})

// 返回
{
  items: Deployment[]
  total: number
}
```

#### `deployments.get`
获取部署详情

```typescript
trpc.deployments.get.useQuery({
  id: string
})

// 返回
Deployment
```

#### `deployments.create`
创建部署

```typescript
trpc.deployments.create.useMutation({
  projectId: string
  environmentId: string
  version: string
  config?: Record<string, any>
})

// 返回
Deployment
```

#### `deployments.rollback`
回滚部署

```typescript
trpc.deployments.rollback.useMutation({
  id: string
  targetDeploymentId: string
})

// 返回
Deployment
```

---

### 4. 流水线 (pipelines)

#### `pipelines.list`
获取流水线列表

```typescript
trpc.pipelines.list.useQuery({
  projectId: string
})

// 返回
Pipeline[]
```

#### `pipelines.get`
获取流水线详情

```typescript
trpc.pipelines.get.useQuery({
  id: string
})

// 返回
Pipeline
```

#### `pipelines.create`
创建流水线

```typescript
trpc.pipelines.create.useMutation({
  projectId: string
  name: string
  config: PipelineConfig
})

// 返回
Pipeline
```

#### `pipelines.run`
运行流水线

```typescript
trpc.pipelines.run.useMutation({
  id: string
  branch?: string
  variables?: Record<string, string>
})

// 返回
PipelineRun
```

#### `pipelines.getRuns`
获取流水线运行记录

```typescript
trpc.pipelines.getRuns.useQuery({
  pipelineId: string
  status?: 'pending' | 'running' | 'success' | 'failed'
  page?: number
  limit?: number
})

// 返回
{
  items: PipelineRun[]
  total: number
}
```

---

### 5. 代码仓库 (repositories)

#### `repositories.list`
获取仓库列表

```typescript
trpc.repositories.list.useQuery({
  projectId: string
})

// 返回
Repository[]
```

#### `repositories.create`
创建仓库

```typescript
trpc.repositories.create.useMutation({
  projectId: string
  name: string
  provider: 'github' | 'gitlab'
  visibility: 'public' | 'private'
  autoInit?: boolean
})

// 返回
Repository
```

#### `repositories.sync`
同步仓库

```typescript
trpc.repositories.sync.useMutation({
  id: string
})

// 返回
Repository
```

---

### 6. 环境管理 (environments)

#### `environments.list`
获取环境列表

```typescript
trpc.environments.list.useQuery({
  projectId: string
})

// 返回
Environment[]
```

#### `environments.create`
创建环境

```typescript
trpc.environments.create.useMutation({
  projectId: string
  name: string
  type: 'development' | 'staging' | 'production'
  config?: Record<string, any>
})

// 返回
Environment
```

#### `environments.update`
更新环境

```typescript
trpc.environments.update.useMutation({
  id: string
  name?: string
  config?: Record<string, any>
})

// 返回
Environment
```

---

### 7. 团队管理 (teams)

#### `teams.list`
获取团队列表

```typescript
trpc.teams.list.useQuery({
  organizationId: string
})

// 返回
Team[]
```

#### `teams.create`
创建团队

```typescript
trpc.teams.create.useMutation({
  organizationId: string
  name: string
  description?: string
})

// 返回
Team
```

#### `teams.addMember`
添加团队成员

```typescript
trpc.teams.addMember.useMutation({
  teamId: string
  userId: string
  role: 'owner' | 'admin' | 'member'
})

// 返回
TeamMember
```

---

### 8. 组织管理 (organizations)

#### `organizations.list`
获取组织列表

```typescript
trpc.organizations.list.useQuery()

// 返回
Organization[]
```

#### `organizations.create`
创建组织

```typescript
trpc.organizations.create.useMutation({
  name: string
  slug: string
  description?: string
})

// 返回
Organization
```

#### `organizations.update`
更新组织

```typescript
trpc.organizations.update.useMutation({
  id: string
  name?: string
  description?: string
  logoUrl?: string
})

// 返回
Organization
```

---

### 9. 成本追踪 (cost-tracking)

#### `costTracking.getProjectCost`
获取项目成本

```typescript
trpc.costTracking.getProjectCost.useQuery({
  projectId: string
  startDate: Date
  endDate: Date
})

// 返回
{
  total: number
  breakdown: CostBreakdown[]
}
```

#### `costTracking.getOrganizationCost`
获取组织成本

```typescript
trpc.costTracking.getOrganizationCost.useQuery({
  organizationId: string
  startDate: Date
  endDate: Date
})

// 返回
{
  total: number
  projects: ProjectCost[]
}
```

---

### 10. AI 助手 (ai-assistants)

#### `aiAssistants.chat`
与 AI 助手对话

```typescript
trpc.aiAssistants.chat.useMutation({
  message: string
  context?: {
    projectId?: string
    code?: string
  }
})

// 返回
{
  response: string
  suggestions?: string[]
}
```

#### `aiAssistants.analyzeCode`
代码分析

```typescript
trpc.aiAssistants.analyzeCode.useMutation({
  code: string
  language: string
})

// 返回
{
  issues: CodeIssue[]
  suggestions: string[]
  score: number
}
```

---

### 11. GitOps (gitops)

#### `gitops.listResources`
获取 GitOps 资源列表

```typescript
trpc.gitops.listResources.useQuery({
  projectId: string
  type?: 'deployment' | 'service' | 'ingress'
})

// 返回
GitOpsResource[]
```

#### `gitops.sync`
同步 GitOps 资源

```typescript
trpc.gitops.sync.useMutation({
  projectId: string
})

// 返回
{
  success: boolean
  syncedResources: number
}
```

---

### 12. 通知 (notifications)

#### `notifications.list`
获取通知列表

```typescript
trpc.notifications.list.useQuery({
  read?: boolean
  page?: number
  limit?: number
})

// 返回
{
  items: Notification[]
  total: number
  unreadCount: number
}
```

#### `notifications.markAsRead`
标记为已读

```typescript
trpc.notifications.markAsRead.useMutation({
  id: string
})

// 返回
Notification
```

#### `notifications.markAllAsRead`
全部标记为已读

```typescript
trpc.notifications.markAllAsRead.useMutation()

// 返回
{
  count: number
}
```

---

### 13. 安全策略 (security-policies)

#### `securityPolicies.list`
获取安全策略列表

```typescript
trpc.securityPolicies.list.useQuery({
  projectId: string
})

// 返回
SecurityPolicy[]
```

#### `securityPolicies.create`
创建安全策略

```typescript
trpc.securityPolicies.create.useMutation({
  projectId: string
  name: string
  type: 'network' | 'access' | 'data'
  rules: PolicyRule[]
})

// 返回
SecurityPolicy
```

---

### 14. 审计日志 (audit-logs)

#### `auditLogs.list`
获取审计日志

```typescript
trpc.auditLogs.list.useQuery({
  organizationId?: string
  projectId?: string
  action?: string
  startDate?: Date
  endDate?: Date
  page?: number
  limit?: number
})

// 返回
{
  items: AuditLog[]
  total: number
}
```

---

### 15. AI 模块 (ai)

AI 模块提供多模型支持、RAG、提示词管理、对话历史等功能。

#### `ai.complete`
AI 同步调用

```typescript
trpc.ai.complete.useMutation({
  provider: 'anthropic' | 'openai' | 'zhipu' | 'qwen' | 'ollama'
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature?: number
  maxTokens?: number
})

// 返回
{
  content: string
  finishReason: 'stop' | 'length' | 'function_call' | 'content_filter'
  usage: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}
```

**示例**:

```typescript
const result = await trpc.ai.complete.mutate({
  provider: 'zhipu',
  model: 'glm-4-flash',
  messages: [
    { role: 'system', content: 'You are a helpful assistant' },
    { role: 'user', content: 'Explain TypeScript generics' }
  ],
  temperature: 0.7,
  maxTokens: 500,
})
```

#### `ai.streamComplete`
AI 流式调用

```typescript
trpc.ai.streamComplete.useMutation({
  provider: string
  model: string
  messages: AIMessage[]
  temperature?: number
  maxTokens?: number
})

// 返回 AsyncIterable<string>
```

#### `ai.chat`
AI 聊天（带上下文管理）

```typescript
trpc.ai.chat.useMutation({
  provider: string
  model: string
  message: string
  projectId?: string
  conversationId?: string
})

// 返回
{
  response: string
  conversationId: string
  usage: TokenUsage
}
```

#### 提示词模板管理

##### `ai.prompts.create`
创建提示词模板

```typescript
trpc.ai.prompts.create.useMutation({
  name: string
  category: 'code-review' | 'config-gen' | 'troubleshooting' | 'general'
  template: string
  variables: string[]
})

// 返回
PromptTemplate
```

##### `ai.prompts.findById`
查询提示词模板

```typescript
trpc.ai.prompts.findById.useQuery({
  id: string
})

// 返回
PromptTemplate
```

##### `ai.prompts.findByCategory`
按分类查询模板

```typescript
trpc.ai.prompts.findByCategory.useQuery({
  category: string
})

// 返回
PromptTemplate[]
```

##### `ai.prompts.render`
渲染提示词模板

```typescript
trpc.ai.prompts.render.useMutation({
  id: string
  variables: Record<string, string>
})

// 返回
{
  rendered: string
}
```

##### `ai.prompts.update`
更新提示词模板

```typescript
trpc.ai.prompts.update.useMutation({
  id: string
  name?: string
  template?: string
  variables?: string[]
})

// 返回
PromptTemplate
```

##### `ai.prompts.delete`
删除提示词模板

```typescript
trpc.ai.prompts.delete.useMutation({
  id: string
})

// 返回
{ success: boolean }
```

#### 对话历史管理

##### `ai.conversations.create`
创建对话

```typescript
trpc.ai.conversations.create.useMutation({
  projectId?: string
  title?: string
})

// 返回
Conversation
```

##### `ai.conversations.addMessage`
添加消息

```typescript
trpc.ai.conversations.addMessage.useMutation({
  conversationId: string
  message: {
    role: 'user' | 'assistant'
    content: string
  }
})

// 返回
Conversation
```

##### `ai.conversations.findById`
查询对话

```typescript
trpc.ai.conversations.findById.useQuery({
  id: string
})

// 返回
Conversation
```

##### `ai.conversations.findByProject`
按项目查询对话

```typescript
trpc.ai.conversations.findByProject.useQuery({
  projectId: string
})

// 返回
Conversation[]
```

##### `ai.conversations.search`
搜索对话

```typescript
trpc.ai.conversations.search.useQuery({
  query: string
  projectId?: string
})

// 返回
Conversation[]
```

##### `ai.conversations.delete`
删除对话

```typescript
trpc.ai.conversations.delete.useMutation({
  id: string
})

// 返回
{ success: boolean }
```

#### 使用统计

##### `ai.usage.getStatistics`
获取使用统计

```typescript
trpc.ai.usage.getStatistics.useQuery({
  projectId?: string
  userId?: string
  provider?: string
  model?: string
  startDate?: Date
  endDate?: Date
})

// 返回
{
  totalTokens: number
  totalCost: number
  requestCount: number
  breakdown: Array<{
    provider: string
    model: string
    tokens: number
    cost: number
    requests: number
  }>
}
```

##### `ai.usage.getCacheHitRate`
获取缓存命中率

```typescript
trpc.ai.usage.getCacheHitRate.useQuery({
  projectId?: string
  startDate?: Date
  endDate?: Date
})

// 返回
{
  hitRate: number
  hits: number
  misses: number
  total: number
}
```

#### 代码审查

##### `ai.codeReview.review`
代码审查

```typescript
trpc.ai.codeReview.review.useMutation({
  code: string
  language: string
  mode?: 'quick' | 'comprehensive'
})

// 返回
{
  score: number
  issues: Array<{
    severity: 'critical' | 'high' | 'medium' | 'low'
    line: number
    message: string
    suggestion: string
  }>
  suggestions: string[]
  strengths: string[]
}
```

##### `ai.codeReview.batchReview`
批量代码审查

```typescript
trpc.ai.codeReview.batchReview.useMutation({
  files: Array<{
    path: string
    code: string
    language: string
  }>
})

// 返回
Array<{
  path: string
  result: CodeReviewResult
}>
```

##### `ai.codeReview.generateSummary`
生成审查摘要

```typescript
trpc.ai.codeReview.generateSummary.useMutation({
  results: CodeReviewResult[]
})

// 返回
{
  overallScore: number
  totalIssues: number
  criticalIssues: number
  summary: string
  recommendations: string[]
}
```

#### 配置生成

##### `ai.config.generateK8sConfig`
生成 Kubernetes 配置

```typescript
trpc.ai.config.generateK8sConfig.useMutation({
  projectName: string
  image: string
  port: number
  replicas?: number
  resources?: {
    requests: { cpu: string, memory: string }
    limits: { cpu: string, memory: string }
  }
})

// 返回
{
  config: string
  suggestions: string[]
}
```

##### `ai.config.generateDockerfile`
生成 Dockerfile

```typescript
trpc.ai.config.generateDockerfile.useMutation({
  language: string
  framework?: string
  version?: string
})

// 返回
{
  dockerfile: string
  suggestions: string[]
}
```

##### `ai.config.generateGitHubActions`
生成 GitHub Actions 配置

```typescript
trpc.ai.config.generateGitHubActions.useMutation({
  language: string
  buildCommand: string
  testCommand?: string
})

// 返回
{
  config: string
  suggestions: string[]
}
```

##### `ai.config.generateGitLabCI`
生成 GitLab CI 配置

```typescript
trpc.ai.config.generateGitLabCI.useMutation({
  language: string
  buildCommand: string
  testCommand?: string
})

// 返回
{
  config: string
  suggestions: string[]
}
```

#### 故障诊断

##### `ai.troubleshoot.diagnose`
故障诊断

```typescript
trpc.ai.troubleshoot.diagnose.useMutation({
  logs: string
  events?: string
  context?: Record<string, any>
})

// 返回
{
  rootCause: string
  analysis: string
  fixSteps: string[]
  estimatedTime: string
  relatedDocs: string[]
}
```

##### `ai.troubleshoot.quickDiagnose`
快速诊断

```typescript
trpc.ai.troubleshoot.quickDiagnose.useMutation({
  error: string
})

// 返回
{
  possibleCauses: string[]
  quickFixes: string[]
}
```

#### RAG (检索增强生成)

##### `ai.rag.embedDocument`
嵌入文档

```typescript
trpc.ai.rag.embedDocument.useMutation({
  projectId: string
  content: string
  metadata: {
    type: 'code' | 'doc' | 'config'
    path: string
    language?: string
  }
})

// 返回
{ success: boolean }
```

##### `ai.rag.search`
语义搜索

```typescript
trpc.ai.rag.search.useQuery({
  projectId: string
  query: string
  limit?: number
})

// 返回
Array<{
  content: string
  metadata: DocumentMetadata
  score: number
}>
```

##### `ai.rag.enhancePrompt`
增强提示词

```typescript
trpc.ai.rag.enhancePrompt.useMutation({
  projectId: string
  prompt: string
  topK?: number
})

// 返回
{
  enhanced: string
  sources: DocumentMetadata[]
}
```

---

## 🔄 实时更新 (SSE)

### 订阅事件

```typescript
// 创建 EventSource 连接
const eventSource = new EventSource('/api/sse/events', {
  headers: {
    Authorization: `Bearer ${accessToken}`,
  },
})

// 监听事件
eventSource.addEventListener('project.updated', (event) => {
  const data = JSON.parse(event.data)
  console.log('Project updated:', data)
})

eventSource.addEventListener('deployment.completed', (event) => {
  const data = JSON.parse(event.data)
  console.log('Deployment completed:', data)
})
```

### 事件类型

- `project.created` - 项目创建
- `project.updated` - 项目更新
- `project.deleted` - 项目删除
- `deployment.started` - 部署开始
- `deployment.completed` - 部署完成
- `deployment.failed` - 部署失败
- `pipeline.running` - 流水线运行中
- `pipeline.completed` - 流水线完成
- `notification.new` - 新通知

---

## 📊 类型定义

### User

```typescript
interface User {
  id: string
  username: string
  email: string
  displayName: string
  avatarUrl?: string
  role: 'super_admin' | 'user'
  createdAt: Date
  updatedAt: Date
}
```

### Project

```typescript
interface Project {
  id: string
  name: string
  slug: string
  description?: string
  organizationId: string
  logoUrl?: string
  visibility: 'public' | 'private'
  status: 'active' | 'archived'
  config?: Record<string, any>
  createdAt: Date
  updatedAt: Date
  deletedAt?: Date
}
```

### Deployment

```typescript
interface Deployment {
  id: string
  projectId: string
  environmentId: string
  version: string
  status: 'pending' | 'running' | 'success' | 'failed'
  startedAt?: Date
  completedAt?: Date
  config?: Record<string, any>
  createdBy: string
  createdAt: Date
}
```

### Pipeline

```typescript
interface Pipeline {
  id: string
  projectId: string
  name: string
  config: PipelineConfig
  status: 'active' | 'disabled'
  createdAt: Date
  updatedAt: Date
}
```

---

## ⚠️ 错误处理

### 错误格式

```typescript
{
  code: string
  message: string
  details?: any
}
```

### 常见错误码

- `UNAUTHORIZED` - 未认证
- `FORBIDDEN` - 无权限
- `NOT_FOUND` - 资源不存在
- `BAD_REQUEST` - 请求参数错误
- `CONFLICT` - 资源冲突
- `INTERNAL_SERVER_ERROR` - 服务器错误

### 错误处理示例

```typescript
try {
  const project = await trpc.projects.create.mutate(data)
} catch (error) {
  if (error.code === 'UNAUTHORIZED') {
    // 跳转到登录页
  } else if (error.code === 'CONFLICT') {
    // 显示冲突提示
  } else {
    // 显示通用错误
  }
}
```

---

**最后更新**: 2024-01-20  
**维护者**: Juanie Team
