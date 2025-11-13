# Design Document

## Overview

本设计文档描述如何将 Project 从 demo 性质改造为生产可用的企业级项目管理系统。设计基于 Phase 1 的 8 个核心需求，重点解决以下问题：

1. **项目初始化自动化** - 从手动配置到一键初始化
2. **模板驱动开发** - 提供生产级的最佳实践模板
3. **资源统一管理** - Project 作为编排器管理所有相关资源
4. **模块间解耦通信** - 通过事件驱动架构避免孤岛
5. **生产级安全控制** - 审批流程和审计日志

### 核心设计原则

1. **Project 是编排器，不是容器** - 负责协调其他模块，而不仅仅是存储数据
2. **事件驱动架构** - 模块间通过事件通信，避免强耦合
3. **模板驱动** - 通过模板封装最佳实践，降低配置复杂度
4. **渐进式增强** - 先实现核心功能，后续迭代增强功能

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         Frontend (Vue)                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Project Wizard   │  │ Project Detail   │  │ Project List  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ tRPC
┌─────────────────────────────────────────────────────────────────┐
│                      API Gateway (NestJS)                       │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Projects Router  │  │ Templates Router │  │ Events Router │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Projects Service (Core)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Project Orchestrator                        │  │
│  │  - 协调项目初始化流程                                      │  │
│  │  - 管理项目生命周期                                        │  │
│  │  - 发布和订阅事件                                          │  │
│  └──────────────────────────────────────────────────────────┘  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐ │
│  │ Template Manager │  │ Health Monitor   │  │ Approval Mgr  │ │
│  └──────────────────┘  └──────────────────┘  └───────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ Events
┌─────────────────────────────────────────────────────────────────┐
│                        Event Bus (Queue)                        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  project.created, project.initialized, deployment.       │  │
│  │  completed, gitops.sync.status, environment.updated      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      Other Services                             │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐│
│  │ Environments │ │ Repositories │ │ GitOps (Flux)│ │ Audit  ││
│  │   Service    │ │   Service    │ │   Service    │ │Service ││
│  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘│
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐           │
│  │ Deployments  │ │ Notification │ │   Git Ops    │           │
│  │   Service    │ │   Service    │ │   Service    │           │
│  └──────────────┘ └──────────────┘ └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

### 模块职责

**Projects Service (核心)**
- Project Orchestrator: 编排项目初始化流程
- Template Manager: 管理项目模板
- Health Monitor: 监控项目健康度
- Approval Manager: 管理部署审批

**Event Bus**
- 基于 Queue Service 实现
- 支持发布/订阅模式
- 解耦模块间通信

**Other Services**
- 各自负责自己的领域逻辑
- 通过事件与 Projects Service 通信



## Components and Interfaces

### 1. Project Orchestrator

**职责：** 编排项目的完整生命周期，协调其他服务

**核心方法：**

```typescript
class ProjectOrchestrator {
  // 创建项目并初始化所有资源
  async createAndInitialize(data: CreateProjectInput): Promise<Project>
  
  // 从模板初始化项目
  async initializeFromTemplate(
    projectId: string,
    templateId: string,
    config: TemplateConfig
  ): Promise<InitializationResult>
  
  // 获取项目的完整状态（包括所有关联资源）
  async getProjectStatus(projectId: string): Promise<ProjectStatus>
  
  // 归档项目
  async archiveProject(projectId: string): Promise<void>
  
  // 恢复项目
  async restoreProject(projectId: string): Promise<void>
}
```

**初始化流程：**

```
1. 创建 Project 记录（status: initializing）
2. 发布 project.created 事件
3. 基于模板创建 Environments
   - 开发环境（development）
   - 测试环境（staging）
   - 生产环境（production）

4. 处理 Git 仓库（根据用户选择）
   
   方案 A - 关联现有仓库：
   4a.1 验证仓库访问权限
   4a.2 连接 Repository 到项目
   4a.3 检查仓库是否已有 K8s 配置
   4a.4 如果没有，创建新分支用于添加配置
   
   方案 B - 创建新仓库：
   4b.1 调用 GitHub/GitLab API 创建新仓库
   4b.2 初始化仓库（README、.gitignore）
   4b.3 如果 includeAppCode=true，生成应用代码模板
   4b.4 连接 Repository 到项目

5. 为每个环境生成 K8s 配置文件
   - k8s/base/（基础配置）
   - k8s/overlays/development/
   - k8s/overlays/staging/
   - k8s/overlays/production/

6. 提交配置文件到 Git 仓库
   - 创建 commit: "chore: add kubernetes configurations"
   - Push 到对应分支

7. 创建 GitOps 资源（Kustomization/HelmRelease）
   - 为每个环境创建对应的 Flux 资源

8. 更新 Project 状态（status: active）
9. 发布 project.initialized 事件
10. 发送通知给创建者
```

**错误处理：**
- 任何步骤失败，回滚已创建的资源
- 记录详细的错误信息
- 更新 Project 状态为 failed
- 通知用户失败原因和修复建议

### 2. Template Manager

**职责：** 管理项目模板，提供模板的 CRUD 和渲染

**数据模型：**

```typescript
interface ProjectTemplate {
  id: string
  name: string
  slug: string
  description: string
  category: 'web' | 'api' | 'microservice' | 'static' | 'fullstack'
  
  // 技术栈信息
  techStack: {
    language: string
    framework: string
    runtime: string
  }
  
  // 默认配置
  defaultConfig: {
    environments: EnvironmentTemplate[]
    resources: ResourceTemplate
    healthCheck: HealthCheckTemplate
    gitops: GitOpsTemplate
  }
  
  // K8s 配置模板（Handlebars 格式）
  k8sTemplates: {
    deployment: string
    service: string
    ingress?: string
    configMap?: string
    secret?: string
  }
  
  // CI/CD 配置模板
  cicdTemplates?: {
    githubActions?: string
    gitlabCI?: string
  }
  
  // 元数据
  tags: string[]
  icon: string
  isPublic: boolean
  createdBy: string
  createdAt: Date
  updatedAt: Date
}

interface EnvironmentTemplate {
  name: string
  type: 'development' | 'staging' | 'production'
  replicas: number
  resources: {
    requests: { cpu: string; memory: string }
    limits: { cpu: string; memory: string }
  }
  envVars: Record<string, string>
  gitops: {
    enabled: boolean
    autoSync: boolean
    gitBranch: string
    gitPath: string
    syncInterval: string
  }
}
```

**核心方法：**

```typescript
class TemplateManager {
  // 获取所有模板
  async listTemplates(filters?: TemplateFilters): Promise<ProjectTemplate[]>
  
  // 获取模板详情
  async getTemplate(templateId: string): Promise<ProjectTemplate>
  
  // 渲染模板（填充变量）
  async renderTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Promise<RenderedTemplate>
  
  // 创建自定义模板（组织管理员）
  async createCustomTemplate(data: CreateTemplateInput): Promise<ProjectTemplate>
  
  // 验证模板配置
  async validateTemplate(template: ProjectTemplate): Promise<ValidationResult>
}
```

**预设模板：**

1. **React 应用模板**
   - Nginx + React 静态文件
   - 健康检查：HTTP GET /
   - 资源：100m CPU, 128Mi 内存
   - 副本数：开发 1，测试 2，生产 3

2. **Node.js API 模板**
   - Node.js + Express
   - 健康检查：HTTP GET /health
   - 就绪探针：HTTP GET /ready
   - 资源：200m CPU, 256Mi 内存
   - 环境变量：NODE_ENV, PORT, DATABASE_URL

3. **Go 微服务模板**
   - Go binary
   - 健康检查：HTTP GET /healthz
   - 资源：100m CPU, 64Mi 内存
   - 优化的资源使用

4. **Python API 模板**
   - Python + FastAPI/Flask
   - 健康检查：HTTP GET /health
   - 资源：200m CPU, 256Mi 内存
   - 环境变量：PYTHON_ENV, DATABASE_URL

5. **静态网站模板**
   - Nginx
   - 健康检查：HTTP GET /
   - 资源：50m CPU, 64Mi 内存
   - 最小资源占用

### 3. Health Monitor

**职责：** 监控项目的整体健康状态

**健康度计算：**

```typescript
interface ProjectHealth {
  score: number // 0-100
  status: 'healthy' | 'warning' | 'critical'
  factors: {
    deploymentSuccessRate: number // 最近 10 次部署的成功率
    gitopsSyncStatus: 'healthy' | 'degraded' | 'failed'
    podHealthStatus: 'healthy' | 'degraded' | 'failed'
    lastDeploymentAge: number // 距离上次部署的天数
  }
  issues: HealthIssue[]
  recommendations: string[]
}

interface HealthIssue {
  severity: 'critical' | 'warning' | 'info'
  category: 'deployment' | 'gitops' | 'resource' | 'security'
  message: string
  affectedResources: string[]
  suggestedAction: string
}
```

**计算逻辑：**

```typescript
class HealthMonitor {
  async calculateHealth(projectId: string): Promise<ProjectHealth> {
    // 1. 获取最近 10 次部署记录
    const deployments = await this.getRecentDeployments(projectId, 10)
    const successRate = this.calculateSuccessRate(deployments)
    
    // 2. 检查 GitOps 资源状态
    const gitopsResources = await this.getGitOpsResources(projectId)
    const gitopsStatus = this.checkGitOpsStatus(gitopsResources)
    
    // 3. 检查 Pod 健康状态
    const pods = await this.getProjectPods(projectId)
    const podStatus = this.checkPodHealth(pods)
    
    // 4. 计算综合评分
    const score = this.calculateScore({
      successRate,
      gitopsStatus,
      podStatus
    })
    
    // 5. 生成问题列表和建议
    const issues = this.detectIssues({
      deployments,
      gitopsResources,
      pods
    })
    
    const recommendations = this.generateRecommendations(issues)
    
    return {
      score,
      status: this.getStatusFromScore(score),
      factors: {
        deploymentSuccessRate: successRate,
        gitopsSyncStatus: gitopsStatus,
        podHealthStatus: podStatus,
        lastDeploymentAge: this.getLastDeploymentAge(deployments)
      },
      issues,
      recommendations
    }
  }
  
  private calculateScore(factors: HealthFactors): number {
    // 部署成功率权重 40%
    const deploymentScore = factors.successRate * 0.4
    
    // GitOps 状态权重 30%
    const gitopsScore = this.gitopsStatusToScore(factors.gitopsStatus) * 0.3
    
    // Pod 健康状态权重 30%
    const podScore = this.podStatusToScore(factors.podStatus) * 0.3
    
    return deploymentScore + gitopsScore + podScore
  }
}
```

### 4. Approval Manager

**职责：** 管理部署审批流程

**数据模型（使用现有表）：**

```typescript
// 现有的 deployment_approvals 表
interface DeploymentApproval {
  id: string
  deploymentId: string
  approverId: string // 单个审批人
  status: 'pending' | 'approved' | 'rejected'
  comments?: string
  decidedAt?: Date
  createdAt: Date
}

// 注意：一个 deployment 会有多条 approval 记录（每个审批人一条）
```

**核心方法：**

```typescript
class ApprovalManager {
  // 创建审批请求（为每个审批人创建一条记录）
  async createApprovalRequest(
    deploymentId: string,
    approvers: string[]
  ): Promise<void> {
    for (const approverId of approvers) {
      await this.db.insert(deploymentApprovals).values({
        deploymentId,
        approverId,
        status: 'pending',
      })
    }
  }
  
  // 批准部署
  async approve(
    approvalId: string,
    approverId: string,
    comment?: string
  ): Promise<ApprovalResult> {
    // 更新该审批人的记录
    await this.db.update(deploymentApprovals)
      .set({
        status: 'approved',
        comments: comment,
        decidedAt: new Date(),
      })
      .where(and(
        eq(deploymentApprovals.id, approvalId),
        eq(deploymentApprovals.approverId, approverId)
      ))
    
    // 检查是否所有审批都完成
    const deployment = await this.getDeploymentFromApproval(approvalId)
    const allApproved = await this.checkAllApproved(deployment.id)
    
    if (allApproved) {
      // 执行部署
      await this.deploymentsService.executeDeploy(deployment.id)
    }
    
    return { success: true, allApproved }
  }
  
  // 拒绝部署
  async reject(
    approvalId: string,
    approverId: string,
    reason: string
  ): Promise<ApprovalResult> {
    // 更新该审批人的记录
    await this.db.update(deploymentApprovals)
      .set({
        status: 'rejected',
        comments: reason,
        decidedAt: new Date(),
      })
      .where(and(
        eq(deploymentApprovals.id, approvalId),
        eq(deploymentApprovals.approverId, approverId)
      ))
    
    // 任何一个拒绝，整个部署失败
    const deployment = await this.getDeploymentFromApproval(approvalId)
    await this.deploymentsService.failDeployment(deployment.id, reason)
    
    return { success: true, rejected: true }
  }
  
  // 检查是否所有审批都完成
  async checkAllApproved(deploymentId: string): Promise<boolean> {
    const approvals = await this.db.query.deploymentApprovals.findMany({
      where: eq(deploymentApprovals.deploymentId, deploymentId),
    })
    
    // 如果有任何一个拒绝，返回 false
    if (approvals.some(a => a.status === 'rejected')) {
      return false
    }
    
    // 如果所有都批准，返回 true
    return approvals.every(a => a.status === 'approved')
  }
  
  // 检查是否需要审批
  async requiresApproval(
    projectId: string,
    environmentId: string
  ): Promise<boolean> {
    const environment = await this.db.query.environments.findFirst({
      where: eq(environments.id, environmentId),
    })
    
    // 生产环境需要审批
    return environment?.type === 'production'
  }
  
  // 获取审批人列表（项目的管理员）
  async getApprovers(
    projectId: string
  ): Promise<string[]> {
    const project = await this.db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })
    
    const admins = await this.db.query.organizationMembers.findMany({
      where: and(
        eq(organizationMembers.organizationId, project.organizationId),
        eq(organizationMembers.role, 'admin')
      ),
    })
    
    return admins.map(a => a.userId)
  }
}
```

**审批流程：**

```
1. 用户发起部署到生产环境
2. 检查环境是否需要审批
3. 如果需要，创建审批请求
4. 通知所有审批人
5. 审批人批准或拒绝
6. 达到最少审批数后，自动执行部署
7. 如果被拒绝，更新部署状态为 failed
8. 记录审批历史到审计日志
```



## Data Models

### 数据库 Schema 变更

#### 1. Projects Table (更新)

```typescript
// packages/core/database/src/schemas/projects.schema.ts

export const projects = pgTable('projects', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  description: text('description'),
  logoUrl: text('logo_url'),
  visibility: text('visibility').notNull().default('private'),
  
  // 更新：项目状态（扩展现有字段的值）
  status: text('status').notNull().default('active'), 
  // 'initializing', 'active', 'inactive', 'archived', 'failed'
  
  // 新增：初始化状态
  initializationStatus: jsonb('initialization_status').$type<{
    step: string // 当前步骤
    progress: number // 0-100
    error?: string // 错误信息
    completedSteps: string[] // 已完成的步骤
  }>(),
  
  // 新增：模板信息
  templateId: text('template_id'), // 使用的模板 ID
  templateConfig: jsonb('template_config'), // 模板配置
  
  // 新增：健康度信息
  healthScore: integer('health_score'), // 0-100
  healthStatus: text('health_status'), // 'healthy', 'warning', 'critical'
  lastHealthCheck: timestamp('last_health_check'),
  
  // 项目配置
  config: jsonb('config').$type<{
    defaultBranch: string
    enableCiCd: boolean
    enableAi: boolean
    // 新增：资源配额
    quota?: {
      maxEnvironments: number
      maxRepositories: number
      maxPods: number
      maxCpu: string
      maxMemory: string
    }
  }>(),
  
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

#### 2. Project Templates Table (新增)

```typescript
// packages/core/database/src/schemas/project-templates.schema.ts

export const projectTemplates = pgTable('project_templates', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  description: text('description'),
  category: text('category').notNull(), // 'web', 'api', 'microservice', etc.
  
  // 技术栈
  techStack: jsonb('tech_stack').$type<{
    language: string
    framework: string
    runtime: string
  }>(),
  
  // 默认配置
  defaultConfig: jsonb('default_config').$type<{
    environments: EnvironmentTemplate[]
    resources: ResourceTemplate
    healthCheck: HealthCheckTemplate
    gitops: GitOpsTemplate
  }>(),
  
  // K8s 配置模板
  k8sTemplates: jsonb('k8s_templates').$type<{
    deployment: string
    service: string
    ingress?: string
    configMap?: string
    secret?: string
  }>(),
  
  // CI/CD 配置模板
  cicdTemplates: jsonb('cicd_templates').$type<{
    githubActions?: string
    gitlabCI?: string
  }>(),
  
  // 元数据
  tags: jsonb('tags').$type<string[]>(),
  icon: text('icon'),
  isPublic: boolean('is_public').default(true),
  isSystem: boolean('is_system').default(false), // 系统预设模板
  
  // 所有者（自定义模板）
  organizationId: uuid('organization_id').references(() => organizations.id),
  createdBy: uuid('created_by').references(() => users.id),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
```

#### 3. Deployment Approvals Table (已存在，无需修改)

```typescript
// packages/core/database/src/schemas/deployment-approvals.schema.ts
// 现有表，已经满足需求

export const deploymentApprovals = pgTable('deployment_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  deploymentId: uuid('deployment_id').notNull().references(() => deployments.id),
  approverId: uuid('approver_id').notNull().references(() => users.id),
  status: text('status').notNull().default('pending'), // 'pending', 'approved', 'rejected'
  comments: text('comments'),
  decidedAt: timestamp('decided_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

// 注意：一个 deployment 会有多条 approval 记录（每个审批人一条）
```

#### 4. Project Events Table (新增)

```typescript
// packages/core/database/src/schemas/project-events.schema.ts

export const projectEvents = pgTable('project_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id').notNull().references(() => projects.id),
  
  // 事件信息
  eventType: text('event_type').notNull(), 
  // 'project.created', 'project.initialized', 'deployment.completed', etc.
  
  eventData: jsonb('event_data'), // 事件数据
  
  // 元数据
  triggeredBy: uuid('triggered_by').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### TypeScript 类型定义

```typescript
// packages/core/types/src/project.types.ts

export interface CreateProjectInput {
  organizationId: string
  name: string
  slug: string
  description?: string
  visibility?: 'public' | 'private' | 'internal'
  
  // 新增：模板相关
  templateId?: string
  templateConfig?: Record<string, any>
  
  // 新增：仓库配置（二选一）
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
    name: string // 仓库名称
    visibility: 'public' | 'private'
    accessToken: string // 用于创建仓库的 token
    includeAppCode?: boolean // 是否包含应用代码模板
  }
}

export interface ProjectStatus {
  project: Project
  
  // 关联资源
  environments: Environment[]
  repositories: Repository[]
  gitopsResources: GitOpsResource[]
  
  // 统计信息
  stats: {
    totalDeployments: number
    successfulDeployments: number
    failedDeployments: number
    lastDeploymentAt?: Date
  }
  
  // 健康度
  health: ProjectHealth
  
  // 资源使用
  resourceUsage: {
    pods: number
    cpu: string
    memory: string
  }
}

export interface InitializationResult {
  success: boolean
  projectId: string
  createdResources: {
    environments: string[]
    repositories: string[]
    gitopsResources: string[]
  }
  errors?: string[]
}
```

## Event-Driven Architecture

### 事件定义

```typescript
// packages/core/types/src/events.types.ts

export type ProjectEvent =
  | ProjectCreatedEvent
  | ProjectInitializedEvent
  | ProjectArchivedEvent
  | ProjectDeletedEvent
  | ProjectHealthChangedEvent

export interface ProjectCreatedEvent {
  type: 'project.created'
  projectId: string
  organizationId: string
  templateId?: string
  createdBy: string
  timestamp: Date
}

export interface ProjectInitializedEvent {
  type: 'project.initialized'
  projectId: string
  createdResources: {
    environments: string[]
    repositories: string[]
    gitopsResources: string[]
  }
  timestamp: Date
}

export interface ProjectHealthChangedEvent {
  type: 'project.health.changed'
  projectId: string
  previousHealth: ProjectHealth
  currentHealth: ProjectHealth
  timestamp: Date
}

export type DeploymentEvent =
  | DeploymentCreatedEvent
  | DeploymentCompletedEvent
  | DeploymentFailedEvent
  | DeploymentApprovalRequestedEvent

export interface DeploymentCompletedEvent {
  type: 'deployment.completed'
  deploymentId: string
  projectId: string
  environmentId: string
  status: 'success' | 'failed'
  timestamp: Date
}

export type GitOpsEvent =
  | GitOpsSyncStatusEvent
  | GitOpsResourceCreatedEvent

export interface GitOpsSyncStatusEvent {
  type: 'gitops.sync.status'
  resourceId: string
  projectId: string
  status: 'ready' | 'reconciling' | 'failed'
  errorMessage?: string
  timestamp: Date
}
```

### 事件发布和订阅

```typescript
// packages/services/projects/src/project-orchestrator.service.ts

@Injectable()
export class ProjectOrchestrator {
  constructor(
    private db: Database,
    private queue: QueueService,
    private environments: EnvironmentsService,
    private repositories: RepositoriesService,
    private flux: FluxService,
    private templates: TemplateManager,
    private audit: AuditService,
    private notifications: NotificationService,
  ) {
    // 订阅相关事件
    this.subscribeToEvents()
  }
  
  private subscribeToEvents() {
    // 订阅部署完成事件
    this.queue.subscribe<DeploymentCompletedEvent>(
      'deployment.completed',
      async (event) => {
        await this.handleDeploymentCompleted(event)
      }
    )
    
    // 订阅 GitOps 同步状态事件
    this.queue.subscribe<GitOpsSyncStatusEvent>(
      'gitops.sync.status',
      async (event) => {
        await this.handleGitOpsSyncStatus(event)
      }
    )
    
    // 订阅环境更新事件
    this.queue.subscribe<EnvironmentUpdatedEvent>(
      'environment.updated',
      async (event) => {
        await this.handleEnvironmentUpdated(event)
      }
    )
  }
  
  // 发布事件
  private async publishEvent(event: ProjectEvent) {
    // 发布到事件总线
    await this.queue.publish(event.type, event)
    
    // 记录到数据库
    await this.db.insert(projectEvents).values({
      projectId: event.projectId,
      eventType: event.type,
      eventData: event,
      triggeredBy: event.createdBy || null,
    })
  }
  
  // 处理部署完成事件
  private async handleDeploymentCompleted(event: DeploymentCompletedEvent) {
    // 更新项目健康度
    const health = await this.healthMonitor.calculateHealth(event.projectId)
    
    await this.db.update(projects)
      .set({
        healthScore: health.score,
        healthStatus: health.status,
        lastHealthCheck: new Date(),
      })
      .where(eq(projects.id, event.projectId))
    
    // 如果健康度变化，发布事件
    if (health.status === 'critical') {
      await this.publishEvent({
        type: 'project.health.changed',
        projectId: event.projectId,
        currentHealth: health,
        timestamp: new Date(),
      })
      
      // 发送告警
      await this.notifications.sendAlert({
        projectId: event.projectId,
        severity: 'critical',
        message: `项目健康度降至 ${health.score}`,
      })
    }
  }
}
```



## Error Handling

### 初始化错误处理

**场景 1: 环境创建失败**

```typescript
try {
  // 创建环境
  const environments = await this.createEnvironments(projectId, template)
} catch (error) {
  // 回滚：删除已创建的项目
  await this.rollbackProject(projectId)
  
  // 记录错误
  await this.updateProjectStatus(projectId, {
    status: 'failed',
    initializationStatus: {
      step: 'create_environments',
      progress: 30,
      error: error.message,
      completedSteps: ['create_project'],
    },
  })
  
  // 通知用户
  await this.notifications.send({
    userId: createdBy,
    type: 'project_initialization_failed',
    message: `项目初始化失败：${error.message}`,
    actions: [
      { label: '重试', action: 'retry_initialization' },
      { label: '查看日志', action: 'view_logs' },
    ],
  })
  
  throw new Error(`环境创建失败: ${error.message}`)
}
```

**场景 2: Git 提交失败**

```typescript
try {
  // 提交配置到 Git
  const commitSha = await this.gitOps.commitConfig(config)
} catch (error) {
  // 不回滚已创建的资源，允许用户手动修复
  await this.updateProjectStatus(projectId, {
    status: 'partial',
    initializationStatus: {
      step: 'commit_to_git',
      progress: 70,
      error: error.message,
      completedSteps: ['create_project', 'create_environments', 'generate_config'],
    },
  })
  
  // 提供修复建议
  await this.notifications.send({
    userId: createdBy,
    type: 'git_commit_failed',
    message: `Git 提交失败：${error.message}`,
    suggestions: [
      '检查 Git 访问令牌是否有效',
      '确认仓库权限是否正确',
      '手动提交配置文件',
    ],
    actions: [
      { label: '重新配置 Git', action: 'reconfigure_git' },
      { label: '跳过 Git 集成', action: 'skip_git' },
    ],
  })
}
```

**场景 3: GitOps 资源创建失败**

```typescript
try {
  // 创建 GitOps 资源
  const gitopsResources = await this.flux.createResources(config)
} catch (error) {
  // 标记为部分成功，允许后续手动创建
  await this.updateProjectStatus(projectId, {
    status: 'active', // 项目可用，但 GitOps 未配置
    initializationStatus: {
      step: 'create_gitops_resources',
      progress: 90,
      error: error.message,
      completedSteps: ['create_project', 'create_environments', 'commit_to_git'],
    },
  })
  
  // 记录警告
  await this.audit.log({
    action: 'project.initialization.warning',
    resourceType: 'project',
    resourceId: projectId,
    message: `GitOps 资源创建失败，项目可用但需要手动配置 GitOps`,
    metadata: { error: error.message },
  })
}
```

### 审批流程错误处理

**场景: 审批超时**

```typescript
// 定时任务：检查超时的审批请求
@Cron('0 */1 * * *') // 每小时执行一次
async checkApprovalTimeouts() {
  const timeoutThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 小时
  
  const timedOutApprovals = await this.db.query.deploymentApprovals.findMany({
    where: and(
      eq(deploymentApprovals.status, 'pending'),
      lt(deploymentApprovals.requestedAt, timeoutThreshold)
    ),
  })
  
  for (const approval of timedOutApprovals) {
    // 自动拒绝
    await this.db.update(deploymentApprovals)
      .set({
        status: 'rejected',
        decidedAt: new Date(),
      })
      .where(eq(deploymentApprovals.id, approval.id))
    
    // 更新部署状态
    await this.db.update(deployments)
      .set({ status: 'failed' })
      .where(eq(deployments.id, approval.deploymentId))
    
    // 通知申请人
    await this.notifications.send({
      userId: approval.requestedBy,
      type: 'approval_timeout',
      message: `部署审批超时（24 小时未响应），已自动拒绝`,
    })
  }
}
```

## Testing Strategy

### 单元测试

**测试 Project Orchestrator**

```typescript
describe('ProjectOrchestrator', () => {
  let orchestrator: ProjectOrchestrator
  let mockDb: MockDatabase
  let mockQueue: MockQueueService
  let mockTemplates: MockTemplateManager
  
  beforeEach(() => {
    // 初始化 mocks
    mockDb = createMockDatabase()
    mockQueue = createMockQueueService()
    mockTemplates = createMockTemplateManager()
    
    orchestrator = new ProjectOrchestrator(
      mockDb,
      mockQueue,
      mockTemplates,
      // ... other dependencies
    )
  })
  
  describe('createAndInitialize', () => {
    it('should create project and initialize all resources', async () => {
      // Arrange
      const input = {
        organizationId: 'org-1',
        name: 'Test Project',
        slug: 'test-project',
        templateId: 'react-app',
      }
      
      mockTemplates.getTemplate.mockResolvedValue(reactAppTemplate)
      
      // Act
      const result = await orchestrator.createAndInitialize(input)
      
      // Assert
      expect(result.success).toBe(true)
      expect(result.createdResources.environments).toHaveLength(3)
      expect(mockQueue.publish).toHaveBeenCalledWith(
        'project.created',
        expect.objectContaining({ projectId: result.projectId })
      )
    })
    
    it('should rollback on environment creation failure', async () => {
      // Arrange
      const input = { /* ... */ }
      mockEnvironments.create.mockRejectedValue(new Error('DB error'))
      
      // Act & Assert
      await expect(orchestrator.createAndInitialize(input)).rejects.toThrow()
      expect(mockDb.delete).toHaveBeenCalledWith(
        expect.objectContaining({ id: expect.any(String) })
      )
    })
  })
  
  describe('handleDeploymentCompleted', () => {
    it('should update project health on deployment completion', async () => {
      // Arrange
      const event: DeploymentCompletedEvent = {
        type: 'deployment.completed',
        deploymentId: 'deploy-1',
        projectId: 'project-1',
        environmentId: 'env-1',
        status: 'success',
        timestamp: new Date(),
      }
      
      mockHealthMonitor.calculateHealth.mockResolvedValue({
        score: 85,
        status: 'healthy',
      })
      
      // Act
      await orchestrator.handleDeploymentCompleted(event)
      
      // Assert
      expect(mockDb.update).toHaveBeenCalledWith(
        projects,
        expect.objectContaining({
          healthScore: 85,
          healthStatus: 'healthy',
        })
      )
    })
  })
})
```

**测试 Template Manager**

```typescript
describe('TemplateManager', () => {
  describe('renderTemplate', () => {
    it('should render deployment template with variables', async () => {
      // Arrange
      const template = {
        k8sTemplates: {
          deployment: `
            apiVersion: apps/v1
            kind: Deployment
            metadata:
              name: {{name}}
            spec:
              replicas: {{replicas}}
              template:
                spec:
                  containers:
                  - name: app
                    image: {{image}}
          `,
        },
      }
      
      const variables = {
        name: 'my-app',
        replicas: 3,
        image: 'my-app:v1.0.0',
      }
      
      // Act
      const rendered = await templateManager.renderTemplate(template.id, variables)
      
      // Assert
      expect(rendered.deployment).toContain('name: my-app')
      expect(rendered.deployment).toContain('replicas: 3')
      expect(rendered.deployment).toContain('image: my-app:v1.0.0')
    })
  })
})
```

### 集成测试

**测试完整的项目初始化流程**

```typescript
describe('Project Initialization E2E', () => {
  it('should create project from template and initialize all resources', async () => {
    // 1. 创建项目
    const project = await projectsService.create(userId, {
      organizationId: 'org-1',
      name: 'E-commerce Frontend',
      slug: 'ecommerce-frontend',
      templateId: 'react-app',
      repository: {
        provider: 'github',
        url: 'https://github.com/test/repo',
        accessToken: 'test-token',
      },
    })
    
    // 2. 等待初始化完成
    await waitFor(() => {
      const status = await projectsService.getStatus(project.id)
      return status.project.status === 'active'
    }, { timeout: 30000 })
    
    // 3. 验证环境已创建
    const environments = await environmentsService.list(userId, project.id)
    expect(environments).toHaveLength(3)
    expect(environments.map(e => e.type)).toEqual(['development', 'staging', 'production'])
    
    // 4. 验证 GitOps 资源已创建
    const gitopsResources = await fluxService.listGitOpsResources(project.id)
    expect(gitopsResources).toHaveLength(3)
    
    // 5. 验证 Git 仓库中有配置文件
    const files = await gitService.listFiles(project.repository.id, 'main')
    expect(files).toContain('k8s/base/deployment.yaml')
    expect(files).toContain('k8s/overlays/development/kustomization.yaml')
    
    // 6. 验证事件已发布
    const events = await projectEventsService.list(project.id)
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: 'project.created' })
    )
    expect(events).toContainEqual(
      expect.objectContaining({ eventType: 'project.initialized' })
    )
  })
})
```

### 性能测试

**测试并发项目创建**

```typescript
describe('Performance Tests', () => {
  it('should handle 10 concurrent project creations', async () => {
    const startTime = Date.now()
    
    const promises = Array.from({ length: 10 }, (_, i) =>
      projectsService.create(userId, {
        organizationId: 'org-1',
        name: `Project ${i}`,
        slug: `project-${i}`,
        templateId: 'react-app',
      })
    )
    
    const results = await Promise.all(promises)
    
    const duration = Date.now() - startTime
    
    expect(results).toHaveLength(10)
    expect(results.every(r => r.status === 'initializing')).toBe(true)
    expect(duration).toBeLessThan(10000) // 应该在 10 秒内完成
  })
})
```

## Security Considerations

### 1. 权限控制

**项目级别的 RBAC**

```typescript
// 检查用户是否有权限执行操作
async function checkProjectPermission(
  userId: string,
  projectId: string,
  requiredPermission: 'read' | 'write' | 'admin'
): Promise<boolean> {
  // 1. 检查是否是组织管理员
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  })
  
  const orgMember = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.organizationId, project.organizationId),
      eq(organizationMembers.userId, userId)
    ),
  })
  
  if (orgMember && ['owner', 'admin'].includes(orgMember.role)) {
    return true
  }
  
  // 2. 检查项目成员权限
  const projectMember = await db.query.projectMembers.findFirst({
    where: and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ),
  })
  
  if (!projectMember) {
    return false
  }
  
  // 3. 根据角色检查权限
  const rolePermissions = {
    admin: ['read', 'write', 'admin'],
    developer: ['read', 'write'],
    viewer: ['read'],
  }
  
  return rolePermissions[projectMember.role]?.includes(requiredPermission) ?? false
}
```

### 2. 敏感信息保护

**Git 访问令牌加密**

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

class SecretManager {
  private algorithm = 'aes-256-gcm'
  private key: Buffer
  
  constructor() {
    // 从环境变量获取加密密钥
    const keyString = process.env.ENCRYPTION_KEY
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY not set')
    }
    this.key = Buffer.from(keyString, 'hex')
  }
  
  encrypt(text: string): string {
    const iv = randomBytes(16)
    const cipher = createCipheriv(this.algorithm, this.key, iv)
    
    let encrypted = cipher.update(text, 'utf8', 'hex')
    encrypted += cipher.final('hex')
    
    const authTag = cipher.getAuthTag()
    
    // 返回 iv:authTag:encrypted
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`
  }
  
  decrypt(encryptedText: string): string {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':')
    
    const iv = Buffer.from(ivHex, 'hex')
    const authTag = Buffer.from(authTagHex, 'hex')
    
    const decipher = createDecipheriv(this.algorithm, this.key, iv)
    decipher.setAuthTag(authTag)
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8')
    decrypted += decipher.final('utf8')
    
    return decrypted
  }
}
```

### 3. 审计日志

**记录所有敏感操作**

```typescript
// 在所有关键操作中记录审计日志
await auditService.log({
  action: 'project.created',
  resourceType: 'project',
  resourceId: project.id,
  userId: createdBy,
  metadata: {
    organizationId: project.organizationId,
    templateId: templateId,
    visibility: project.visibility,
  },
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
})

await auditService.log({
  action: 'deployment.approved',
  resourceType: 'deployment',
  resourceId: deploymentId,
  userId: approverId,
  metadata: {
    projectId: deployment.projectId,
    environmentId: deployment.environmentId,
    comment: comment,
  },
})
```

## Deployment Strategy

### 数据库迁移

```sql
-- Migration: 001_add_project_enhancements.sql

-- 1. 添加新列到 projects 表
ALTER TABLE projects 
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN initialization_status JSONB,
  ADD COLUMN template_id TEXT,
  ADD COLUMN template_config JSONB,
  ADD COLUMN health_score INTEGER,
  ADD COLUMN health_status TEXT,
  ADD COLUMN last_health_check TIMESTAMP;

-- 2. 创建 project_templates 表
CREATE TABLE project_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL,
  tech_stack JSONB,
  default_config JSONB,
  k8s_templates JSONB,
  cicd_templates JSONB,
  tags JSONB,
  icon TEXT,
  is_public BOOLEAN DEFAULT true,
  is_system BOOLEAN DEFAULT false,
  organization_id UUID REFERENCES organizations(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3. deployment_approvals 表已存在，无需创建

-- 4. 创建 project_events 表
CREATE TABLE project_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id),
  event_type TEXT NOT NULL,
  event_data JSONB,
  triggered_by UUID REFERENCES users(id),
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5. 创建索引
CREATE INDEX idx_projects_health_status ON projects(health_status);
CREATE INDEX idx_project_templates_category ON project_templates(category);
CREATE INDEX idx_project_events_type ON project_events(event_type);
CREATE INDEX idx_project_events_project_id ON project_events(project_id);

-- 注意：projects.status 和 deployment_approvals.status 的索引已存在
```

### 部署步骤

1. **数据库迁移**
   ```bash
   npm run db:migrate
   ```

2. **插入系统模板**
   ```bash
   npm run seed:templates
   ```

3. **部署后端服务**
   ```bash
   # 部署新版本的 Projects Service
   kubectl apply -f k8s/projects-service.yaml
   ```

4. **部署前端**
   ```bash
   # 部署新版本的 Web 应用
   kubectl apply -f k8s/web-app.yaml
   ```

5. **验证部署**
   ```bash
   # 检查服务健康状态
   curl http://api-gateway/health
   
   # 检查模板是否加载
   curl http://api-gateway/api/templates
   ```

## Monitoring and Observability

### Prometheus 指标

```typescript
// packages/services/projects/src/metrics.ts

import { Counter, Gauge, Histogram } from 'prom-client'

export const projectMetrics = {
  // 项目总数
  totalProjects: new Gauge({
    name: 'projects_total',
    help: 'Total number of projects',
    labelNames: ['status', 'organization_id'],
  }),
  
  // 项目初始化时间
  initializationDuration: new Histogram({
    name: 'project_initialization_duration_seconds',
    help: 'Time taken to initialize a project',
    labelNames: ['template_id', 'success'],
    buckets: [1, 5, 10, 30, 60, 120],
  }),
  
  // 项目健康度分布
  healthScoreDistribution: new Histogram({
    name: 'project_health_score',
    help: 'Distribution of project health scores',
    labelNames: ['project_id'],
    buckets: [0, 20, 40, 60, 80, 100],
  }),
  
  // 审批请求数
  approvalRequests: new Counter({
    name: 'deployment_approval_requests_total',
    help: 'Total number of deployment approval requests',
    labelNames: ['project_id', 'environment_type', 'status'],
  }),
}
```

### Grafana 仪表板

创建 Grafana 仪表板显示：
- 项目总数和状态分布
- 项目初始化成功率和平均时间
- 项目健康度分布
- 审批请求数和平均审批时间
- 部署频率和成功率（按项目）

## Next Steps

完成设计后的下一步：
1. 评审设计文档
2. 创建实现任务列表
3. 开始编码实现
