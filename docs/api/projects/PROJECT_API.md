# Project Management API Reference

## Overview

本文档描述项目管理系统的 API 端点，包括项目创建、模板管理、健康度监控和审批流程。

## Base URL

```
http://localhost:3000/api/trpc
```

## Authentication

所有 API 请求需要在 Header 中包含认证令牌：

```
Authorization: Bearer <token>
```

---

## Projects API

### 1. Create Project (创建项目)

使用模板创建新项目并自动初始化所有资源。

**Endpoint:** `projects.create`

**Method:** `POST`

**Request Body:**

```typescript
{
  organizationId: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'
  
  // 模板配置
  templateId?: string
  templateConfig?: {
    environments?: {
      development?: { replicas: number; resources: ResourceConfig }
      staging?: { replicas: number; resources: ResourceConfig }
      production?: { replicas: number; resources: ResourceConfig }
    }
    customEnvVars?: Record<string, string>
  }
  
  // 仓库配置（二选一）
  repository?: {
    // 方案 A：关联现有仓库
    mode: 'existing'
    provider: 'github' | 'gitlab'
    url: string
    accessToken: string
    defaultBranch?: string
  } | {
    // 方案 B：创建新仓库
    mode: 'create'
    provider: 'github' | 'gitlab'
    name: string
    visibility: 'public' | 'private'
    accessToken: string
    includeAppCode?: boolean
  }
}
```

**Response:**

```typescript
{
  success: boolean
  project: {
    id: string
    name: string
    slug: string
    status: 'initializing' | 'active' | 'failed'
    initializationStatus: {
      step: string
      progress: number
      completedSteps: string[]
      error?: string
    }
    createdAt: string
  }
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/trpc/projects.create \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "org-123",
    "name": "My React App",
    "slug": "my-react-app",
    "description": "A production-ready React application",
    "templateId": "react-app",
    "repository": {
      "mode": "create",
      "provider": "github",
      "name": "my-react-app",
      "visibility": "private",
      "accessToken": "ghp_xxxxx",
      "includeAppCode": true
    }
  }'
```

**Example Response:**

```json
{
  "success": true,
  "project": {
    "id": "proj-456",
    "name": "My React App",
    "slug": "my-react-app",
    "status": "initializing",
    "initializationStatus": {
      "step": "create_environments",
      "progress": 30,
      "completedSteps": ["create_project", "validate_template"],
      "error": null
    },
    "createdAt": "2025-11-13T10:00:00Z"
  }
}
```

---

### 2. Get Project Status (获取项目状态)

获取项目的完整状态，包括所有关联资源和统计信息。

**Endpoint:** `projects.getStatus`

**Method:** `GET`

**Query Parameters:**

```typescript
{
  projectId: string
}
```

**Response:**

```typescript
{
  project: Project
  environments: Environment[]
  repositories: Repository[]
  gitopsResources: GitOpsResource[]
  stats: {
    totalDeployments: number
    successfulDeployments: number
    failedDeployments: number
    lastDeploymentAt?: string
  }
  health: ProjectHealth
  resourceUsage: {
    pods: number
    cpu: string
    memory: string
  }
}
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/trpc/projects.getStatus?projectId=proj-456" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "project": {
    "id": "proj-456",
    "name": "My React App",
    "status": "active",
    "healthScore": 85,
    "healthStatus": "healthy"
  },
  "environments": [
    {
      "id": "env-dev",
      "name": "development",
      "type": "development",
      "status": "active"
    },
    {
      "id": "env-prod",
      "name": "production",
      "type": "production",
      "status": "active"
    }
  ],
  "repositories": [
    {
      "id": "repo-789",
      "name": "my-react-app",
      "provider": "github",
      "url": "https://github.com/org/my-react-app"
    }
  ],
  "gitopsResources": [
    {
      "id": "gitops-dev",
      "name": "my-react-app-dev",
      "type": "kustomization",
      "status": "ready"
    }
  ],
  "stats": {
    "totalDeployments": 15,
    "successfulDeployments": 14,
    "failedDeployments": 1,
    "lastDeploymentAt": "2025-11-13T09:30:00Z"
  },
  "health": {
    "score": 85,
    "status": "healthy",
    "factors": {
      "deploymentSuccessRate": 0.93,
      "gitopsSyncStatus": "healthy",
      "podHealthStatus": "healthy",
      "lastDeploymentAge": 0.5
    },
    "issues": [],
    "recommendations": []
  },
  "resourceUsage": {
    "pods": 5,
    "cpu": "500m",
    "memory": "1Gi"
  }
}
```

---

### 3. Get Project Health (获取项目健康度)

获取项目的健康度评分和详细信息。

**Endpoint:** `projects.getHealth`

**Method:** `GET`

**Query Parameters:**

```typescript
{
  projectId: string
}
```

**Response:**

```typescript
{
  score: number // 0-100
  status: 'healthy' | 'warning' | 'critical'
  factors: {
    deploymentSuccessRate: number
    gitopsSyncStatus: 'healthy' | 'degraded' | 'failed'
    podHealthStatus: 'healthy' | 'degraded' | 'failed'
    lastDeploymentAge: number
  }
  issues: Array<{
    severity: 'critical' | 'warning' | 'info'
    category: 'deployment' | 'gitops' | 'resource' | 'security'
    message: string
    affectedResources: string[]
    suggestedAction: string
  }>
  recommendations: string[]
  lastChecked: string
}
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/trpc/projects.getHealth?projectId=proj-456" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "score": 65,
  "status": "warning",
  "factors": {
    "deploymentSuccessRate": 0.7,
    "gitopsSyncStatus": "healthy",
    "podHealthStatus": "degraded",
    "lastDeploymentAge": 2
  },
  "issues": [
    {
      "severity": "warning",
      "category": "deployment",
      "message": "部署成功率低于 80%",
      "affectedResources": ["env-prod"],
      "suggestedAction": "检查最近失败的部署日志，修复配置问题"
    },
    {
      "severity": "warning",
      "category": "resource",
      "message": "生产环境有 2 个 Pod 处于 CrashLoopBackOff 状态",
      "affectedResources": ["pod-abc", "pod-def"],
      "suggestedAction": "查看 Pod 日志，检查应用启动错误"
    }
  ],
  "recommendations": [
    "增加健康检查的超时时间",
    "检查环境变量配置是否正确",
    "考虑增加资源限制"
  ],
  "lastChecked": "2025-11-13T10:00:00Z"
}
```

---

### 4. Archive Project (归档项目)

归档不再活跃的项目，暂停 GitOps 同步但保留所有数据。

**Endpoint:** `projects.archive`

**Method:** `POST`

**Request Body:**

```typescript
{
  projectId: string
  reason?: string
}
```

**Response:**

```typescript
{
  success: boolean
  message: string
}
```

**Example Request:**

```bash
curl -X POST http://localhost:3000/api/trpc/projects.archive \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "proj-456",
    "reason": "项目已迁移到新平台"
  }'
```

---

### 5. Restore Project (恢复项目)

恢复归档的项目，重新启动 GitOps 同步。

**Endpoint:** `projects.restore`

**Method:** `POST`

**Request Body:**

```typescript
{
  projectId: string
}
```

**Response:**

```typescript
{
  success: boolean
  message: string
}
```

---

## Templates API

### 1. List Templates (列出模板)

获取所有可用的项目模板。

**Endpoint:** `templates.list`

**Method:** `GET`

**Query Parameters:**

```typescript
{
  category?: 'web' | 'api' | 'microservice' | 'static' | 'fullstack'
  tags?: string[]
  organizationId?: string // 获取组织自定义模板
}
```

**Response:**

```typescript
{
  templates: Array<{
    id: string
    name: string
    slug: string
    description: string
    category: string
    techStack: {
      language: string
      framework: string
      runtime: string
    }
    tags: string[]
    icon: string
    isPublic: boolean
    isSystem: boolean
  }>
}
```

**Example Request:**

```bash
curl -X GET "http://localhost:3000/api/trpc/templates.list?category=web" \
  -H "Authorization: Bearer <token>"
```

**Example Response:**

```json
{
  "templates": [
    {
      "id": "react-app",
      "name": "React Application",
      "slug": "react-app",
      "description": "生产级 React 应用模板，包含 Nginx 服务器和最佳实践配置",
      "category": "web",
      "techStack": {
        "language": "JavaScript",
        "framework": "React",
        "runtime": "Node.js 18"
      },
      "tags": ["react", "spa", "nginx"],
      "icon": "⚛️",
      "isPublic": true,
      "isSystem": true
    }
  ]
}
```

---

### 2. Get Template (获取模板详情)

获取模板的完整配置信息。

**Endpoint:** `templates.get`

**Method:** `GET`

**Query Parameters:**

```typescript
{
  templateId: string
}
```

**Response:**

```typescript
{
  id: string
  name: string
  description: string
  category: string
  techStack: TechStack
  defaultConfig: {
    environments: EnvironmentTemplate[]
    resources: ResourceTemplate
    healthCheck: HealthCheckTemplate
    gitops: GitOpsTemplate
  }
  k8sTemplates: {
    deployment: string
    service: string
    ingress?: string
  }
  cicdTemplates?: {
    githubActions?: string
    gitlabCI?: string
  }
}
```

---

### 3. Render Template (渲染模板)

使用变量渲染模板，生成实际的 K8s 配置。

**Endpoint:** `templates.render`

**Method:** `POST`

**Request Body:**

```typescript
{
  templateId: string
  variables: {
    projectName: string
    projectSlug: string
    image: string
    replicas: number
    envVars: Record<string, string>
    resources: {
      requests: { cpu: string; memory: string }
      limits: { cpu: string; memory: string }
    }
  }
}
```

**Response:**

```typescript
{
  deployment: string // YAML
  service: string // YAML
  ingress?: string // YAML
  configMap?: string // YAML
}
```

---

## Approvals API

### 1. List Pending Approvals (列出待审批)

获取当前用户待审批的部署列表。

**Endpoint:** `approvals.listPending`

**Method:** `GET`

**Response:**

```typescript
{
  approvals: Array<{
    id: string
    deployment: {
      id: string
      projectId: string
      projectName: string
      environmentName: string
      version: string
    }
    status: 'pending'
    requestedAt: string
    requestedBy: {
      id: string
      name: string
      email: string
    }
  }>
}
```

---

### 2. Approve Deployment (批准部署)

批准待审批的部署。

**Endpoint:** `approvals.approve`

**Method:** `POST`

**Request Body:**

```typescript
{
  approvalId: string
  comment?: string
}
```

**Response:**

```typescript
{
  success: boolean
  allApproved: boolean // 是否所有审批人都已批准
  message: string
}
```

---

### 3. Reject Deployment (拒绝部署)

拒绝待审批的部署。

**Endpoint:** `approvals.reject`

**Method:** `POST`

**Request Body:**

```typescript
{
  approvalId: string
  reason: string
}
```

**Response:**

```typescript
{
  success: boolean
  message: string
}
```

---

## Error Responses

所有 API 在出错时返回统一的错误格式：

```typescript
{
  error: {
    code: string // 错误代码
    message: string // 错误消息
    details?: any // 详细信息
  }
}
```

### 常见错误代码

| 错误代码 | HTTP 状态码 | 说明 |
|---------|-----------|------|
| `UNAUTHORIZED` | 401 | 未认证或令牌无效 |
| `FORBIDDEN` | 403 | 无权限访问资源 |
| `NOT_FOUND` | 404 | 资源不存在 |
| `VALIDATION_ERROR` | 400 | 请求参数验证失败 |
| `CONFLICT` | 409 | 资源冲突（如 slug 已存在） |
| `INTERNAL_ERROR` | 500 | 服务器内部错误 |
| `INITIALIZATION_FAILED` | 500 | 项目初始化失败 |
| `TEMPLATE_NOT_FOUND` | 404 | 模板不存在 |
| `APPROVAL_REQUIRED` | 403 | 需要审批才能执行操作 |

**Example Error Response:**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "项目 slug 已存在",
    "details": {
      "field": "slug",
      "value": "my-react-app"
    }
  }
}
```

---

## Rate Limiting

API 请求受到速率限制：

- **标准用户**: 100 请求/分钟
- **高级用户**: 500 请求/分钟
- **企业用户**: 无限制

超过限制时返回 `429 Too Many Requests`。

---

## Webhooks

系统支持 Webhook 通知关键事件：

### 支持的事件

- `project.created` - 项目创建
- `project.initialized` - 项目初始化完成
- `project.health.changed` - 项目健康度变化
- `deployment.completed` - 部署完成
- `approval.requested` - 审批请求
- `gitops.sync.failed` - GitOps 同步失败

### Webhook Payload

```typescript
{
  event: string
  timestamp: string
  data: any // 事件相关数据
}
```

配置 Webhook 请参考 [Webhook 配置指南](../webhooks/CONFIGURATION.md)。
