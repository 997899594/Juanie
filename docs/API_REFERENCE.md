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

```typescript
trpc.projects.create.useMutation({
  name: string
  slug: string
  description?: string
  organizationId: string
  visibility?: 'public' | 'private'
  templateId?: string
})

// 返回
Project
```

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
