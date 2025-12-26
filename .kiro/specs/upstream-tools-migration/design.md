# 设计文档：上游工具迁移

## 概述

本设计文档描述了从自定义实现系统性迁移到成熟上游工具和 SDK 的技术方案。**Core 层和 Foundation 层已基本完成重构**，本次重点解决 **Business 层的架构设计问题**，包括重复实现、过度抽象和不当的层级依赖。

### 当前状态

✅ **已完成**：
- Core 层：K8s 客户端、Flux CLI、数据库、队列、Redis 已迁移到官方 SDK
- Foundation 层：Git 客户端（GitHub/GitLab）已使用官方 SDK，认证、存储、RBAC 架构清晰

❌ **待解决（Business 层）**：
- GitOps 模块：Core 和 Business 层存在 95%+ 重复的 Flux 实现
- 项目初始化：过度复杂的编排器和状态机
- Git 同步：自定义事件发布器而不是使用 BullMQ/EventEmitter2 内置功能
- 部署管理：未充分利用 Drizzle ORM 关系查询

### 设计目标

1. **消除 Business 层重复** - 删除与 Core 层重复的 Flux、K8s 实现
2. **简化过度抽象** - 移除不必要的编排器、包装器、自定义事件系统
3. **直接使用上游工具** - 在 Business 层直接使用 Core 层提供的客户端
4. **利用 ORM 能力** - 用 Drizzle 关系查询替换原始 SQL
5. **标准化事件处理** - 使用 EventEmitter2 和 BullMQ 内置事件

### 迁移原则

- **删除优先** - 能删就删，不要重构包装器
- **直接依赖** - Business 层直接使用 Core 层客户端，不要再包装一层
- **最小抽象** - 只在真正需要业务逻辑时才抽象
- **测试覆盖** - 删除代码前确保有测试覆盖
- **渐进式清理** - 按模块逐个清理，避免大爆炸式重构

## 架构

### Business 层当前问题分析

#### 问题 1：GitOps 模块重复实现（严重）

**现状**：
```
packages/core/src/flux/
  ├── flux.service.ts          # Core 层 Flux 服务
  ├── flux-cli.service.ts      # Flux CLI 包装器
  └── flux-watcher.service.ts  # Flux 资源监控

packages/services/business/src/gitops/flux/
  ├── flux.service.ts          # Business 层 Flux 服务（95% 重复）
  ├── flux-sync.service.ts     # 同步服务
  ├── flux-resources.service.ts # 资源管理（重复）
  └── flux-watcher.service.ts  # 监控服务（重复）
```

**问题**：
- Core 和 Business 层都实现了 Flux CLI 调用
- 两层都有资源创建、删除、状态查询逻辑
- 代码重复率 95%+，维护成本高
- 违反了分层架构原则

**根本原因**：
- 最初在 Core 层实现，后来在 Business 层又实现了一遍
- 没有及时清理 Core 层的实现
- 缺乏明确的层级职责划分

#### 问题 2：过度抽象的项目初始化（中等）

**现状**：
```typescript
// 过度复杂的编排器
class ProjectInitializationOrchestrator {
  async orchestrate() {
    // 复杂的状态机
    // 自定义进度跟踪
    // 手动事件发布
  }
}

// 自定义进度系统
class ProgressTracker {
  // 重复 BullMQ 的进度功能
}
```

**问题**：
- 自定义编排器重复了 BullMQ Worker 的功能
- 自定义进度跟踪重复了 BullMQ 的 `job.updateProgress()`
- 自定义事件发布重复了 BullMQ 的 `@OnWorkerEvent`
- 代码复杂度高，难以维护

#### 问题 3：Git 同步自定义事件系统（中等）

**现状**：
```typescript
// 自定义事件发布器
class GitSyncEventPublisher {
  async publishSyncStarted() { ... }
  async publishSyncCompleted() { ... }
  async publishSyncFailed() { ... }
}

// 应该直接使用
@OnWorkerEvent('completed')
onCompleted(job: Job) { ... }
```

**问题**：
- 包装了 EventEmitter2，没有增加价值
- 重复了 BullMQ 的作业事件
- 增加了不必要的抽象层

#### 问题 4：未充分利用 Drizzle ORM（轻微）

**现状**：
```typescript
// ❌ 使用原始 SQL
const projects = await db.execute(sql`
  SELECT p.*, e.* 
  FROM projects p 
  LEFT JOIN environments e ON e.project_id = p.id 
  WHERE p.id = ${projectId}
`)

// ✅ 应该使用关系查询
const project = await db.query.projects.findFirst({
  where: eq(projects.id, projectId),
  with: { environments: true }
})
```

**问题**：
- 部分查询仍使用原始 SQL
- 没有利用 Drizzle 的类型推断
- 手动管理事务而不是使用 `db.transaction()`

### 目标架构

```
┌─────────────────────────────────────────────────────────────┐
│                     应用层 (API Gateway)                      │
│                    tRPC 路由 + 中间件                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Business 层（简化后）                        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ GitOps 模块（删除重复实现）                            │  │
│  │  - GitSyncService: 直接使用 Core.FluxCliService      │  │
│  │  - 删除: flux.service.ts, flux-resources.service.ts  │  │
│  │  - 删除: flux-watcher.service.ts                     │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 项目初始化（简化）                                      │  │
│  │  - InitializationWorker: 使用 BullMQ 内置事件        │  │
│  │  - 删除: ProjectInitializationOrchestrator           │  │
│  │  - 删除: ProgressTracker（用 job.updateProgress）    │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ 其他服务                                               │  │
│  │  - ProjectsService: 使用 Drizzle 关系查询            │  │
│  │  - DeploymentsService: 使用 Drizzle 事务 API         │  │
│  │  - 直接使用 EventEmitter2（不包装）                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  Foundation 层（已完成）                      │
│  - GitHubClientService, GitLabClientService                 │
│  - AuthService, StorageService, RBACService                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core 层（已完成）                          │
│  - K8sClientService, FluxCliService                         │
│  - DatabaseClient, QueueModule, RedisModule                 │
└─────────────────────────────────────────────────────────────┘
```

### 架构决策

#### 决策 1：删除 Business 层的 Flux 实现

**决定**：完全删除 `packages/services/business/src/gitops/flux/` 中的重复实现

**理由**：
- Core 层的 FluxCliService 已经提供了所有需要的功能
- Business 层的实现没有增加任何业务价值
- 维护两份代码增加了 bug 风险

**影响**：
- GitSyncService 直接注入 `FluxCliService`
- 删除 3 个重复的服务文件
- 减少约 800 行代码

#### 决策 2：简化项目初始化

**决定**：删除 Orchestrator 和自定义进度系统，直接使用 BullMQ Worker

**理由**：
- BullMQ Worker 本身就是编排器
- BullMQ 提供了完整的进度跟踪和事件系统
- 自定义实现增加了复杂度但没有增加价值

**影响**：
- 删除 ProjectInitializationOrchestrator
- 删除 ProgressTracker
- 使用 `job.updateProgress()` 和 `@OnWorkerEvent`

#### 决策 3：移除自定义事件包装器

**决定**：直接使用 EventEmitter2 和 BullMQ 事件，不再包装

**理由**：
- EventEmitter2 已经很简单，不需要包装
- BullMQ 的作业事件已经足够强大
- 包装器增加了学习成本

**影响**：
- 删除所有 `*EventPublisher` 类
- 服务直接注入 `EventEmitter2`
- Worker 直接使用 `@OnWorkerEvent` 装饰器

#### 决策 4：强制使用 Drizzle 关系查询

**决定**：禁止在 Business 层使用原始 SQL，必须使用关系查询 API

**理由**：
- 关系查询提供类型安全
- 代码更简洁易读
- 自动处理 JOIN 和关系加载

**影响**：
- 重写所有原始 SQL 查询
- 使用 `db.query.*` 和 `with` 选项
- 使用 `db.transaction()` 管理事务

## 组件和接口

### Business 层重构方案

#### 1. GitOps 模块简化

**删除的文件**：
```
packages/services/business/src/gitops/flux/
  ├── flux.service.ts          # 删除 - 使用 Core.FluxCliService
  ├── flux-resources.service.ts # 删除 - 使用 Core.FluxCliService
  └── flux-watcher.service.ts  # 删除 - 使用 Core.FluxWatcherService
```

**保留并重构的文件**：
```typescript
// packages/services/business/src/gitops/git-sync/git-sync.service.ts
import { Injectable } from '@nestjs/common'
import { FluxCliService } from '@juanie/core/flux'  // ✅ 直接使用 Core 层
import { K8sClientService } from '@juanie/core/k8s'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class GitSyncService {
  constructor(
    private readonly fluxCli: FluxCliService,      // ✅ 注入 Core 服务
    private readonly k8sClient: K8sClientService,  // ✅ 注入 Core 服务
    private readonly eventEmitter: EventEmitter2,  // ✅ 直接使用
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(GitSyncService.name)
  }

  /**
   * 同步 Git 仓库到 Flux
   */
  async syncRepository(options: {
    projectId: string
    repoUrl: string
    branch: string
    namespace: string
  }): Promise<void> {
    const { projectId, repoUrl, branch, namespace } = options

    try {
      // ✅ 直接使用 FluxCliService，不再包装
      await this.fluxCli.createGitRepository({
        name: `project-${projectId}`,
        namespace,
        url: repoUrl,
        branch,
        interval: '1m'
      })

      await this.fluxCli.createKustomization({
        name: `project-${projectId}`,
        namespace,
        source: `GitRepository/project-${projectId}`,
        path: './k8s',
        prune: true
      })

      // ✅ 直接使用 EventEmitter2，不再包装
      this.eventEmitter.emit('git-sync.completed', {
        projectId,
        repoUrl,
        timestamp: new Date()
      })

      this.logger.info({ projectId }, 'Git repository synced successfully')
    } catch (error) {
      this.eventEmitter.emit('git-sync.failed', {
        projectId,
        error: error.message
      })
      throw error
    }
  }

  /**
   * 删除 Flux 资源
   */
  async deleteResources(projectId: string, namespace: string): Promise<void> {
    // ✅ 直接使用 FluxCliService
    await this.fluxCli.delete('kustomization', `project-${projectId}`, namespace)
    await this.fluxCli.delete('gitrepository', `project-${projectId}`, namespace)
  }
}
```

#### 2. 项目初始化简化

**删除的文件**：
```
packages/services/business/src/projects/initialization/
  ├── orchestrator.service.ts  # 删除 - BullMQ Worker 本身就是编排器
  └── progress-tracker.ts      # 删除 - 使用 job.updateProgress()
```

**重构的 Worker**：
```typescript
// packages/services/business/src/queue/project-initialization.worker.ts
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Injectable } from '@nestjs/common'
import { InitializationService } from '../projects/initialization/initialization.service'
import { PinoLogger } from 'nestjs-pino'

interface InitializationJobData {
  projectId: string
  userId: string
  templateId: string
}

@Processor('project-initialization')
@Injectable()
export class ProjectInitializationWorker extends WorkerHost {
  constructor(
    private readonly initService: InitializationService,
    private readonly logger: PinoLogger
  ) {
    super()
    this.logger.setContext(ProjectInitializationWorker.name)
  }

  async process(job: Job<InitializationJobData>): Promise<void> {
    const { projectId, userId, templateId } = job.data

    try {
      // 步骤 1: 创建 Git 仓库
      await job.updateProgress(10)  // ✅ 使用 BullMQ 内置进度
      await this.initService.createGitRepository(projectId, userId)

      // 步骤 2: 生成项目文件
      await job.updateProgress(30)
      await this.initService.generateProjectFiles(projectId, templateId)

      // 步骤 3: 推送到 Git
      await job.updateProgress(50)
      await this.initService.pushToGit(projectId)

      // 步骤 4: 设置 Flux
      await job.updateProgress(70)
      await this.initService.setupFlux(projectId)

      // 步骤 5: 创建环境
      await job.updateProgress(90)
      await this.initService.createEnvironments(projectId)

      await job.updateProgress(100)
      this.logger.info({ projectId }, 'Project initialization completed')
    } catch (error) {
      this.logger.error({ projectId, error }, 'Project initialization failed')
      throw error
    }
  }

  // ✅ 使用 BullMQ 内置事件，不需要自定义事件发布器
  @OnWorkerEvent('completed')
  onCompleted(job: Job<InitializationJobData>) {
    this.logger.info({ jobId: job.id, projectId: job.data.projectId }, 'Job completed')
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<InitializationJobData>, error: Error) {
    this.logger.error(
      { jobId: job.id, projectId: job.data.projectId, error },
      'Job failed'
    )
  }

  @OnWorkerEvent('progress')
  onProgress(job: Job<InitializationJobData>, progress: number) {
    this.logger.debug(
      { jobId: job.id, projectId: job.data.projectId, progress },
      'Job progress updated'
    )
  }
}
```

#### 3. 数据库查询优化

**重构前（原始 SQL）**：
```typescript
// ❌ 不要这样做
async getProjectWithDetails(projectId: string) {
  const result = await this.db.execute(sql`
    SELECT 
      p.*,
      e.id as env_id,
      e.name as env_name,
      d.id as deploy_id,
      d.status as deploy_status
    FROM projects p
    LEFT JOIN environments e ON e.project_id = p.id
    LEFT JOIN deployments d ON d.environment_id = e.id
    WHERE p.id = ${projectId}
  `)
  
  // 手动组装数据结构
  return this.transformResult(result)
}
```

**重构后（Drizzle 关系查询）**：
```typescript
// ✅ 使用 Drizzle 关系查询
async getProjectWithDetails(projectId: string) {
  return this.db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      environments: {
        with: {
          deployments: {
            orderBy: desc(deployments.createdAt),
            limit: 10
          }
        }
      },
      organization: true,
      team: true
    }
  })
  // ✅ 自动类型推断，不需要手动转换
}
```

**事务处理优化**：
```typescript
// ❌ 手动事务管理
async createProjectWithEnvironments(data: NewProject) {
  const client = await this.db.connect()
  try {
    await client.query('BEGIN')
    const project = await client.query('INSERT INTO projects ...')
    await client.query('INSERT INTO environments ...')
    await client.query('COMMIT')
    return project
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

// ✅ 使用 Drizzle 事务 API
async createProjectWithEnvironments(data: NewProject) {
  return this.db.transaction(async (tx) => {
    const [project] = await tx.insert(projects).values(data).returning()
    
    await tx.insert(environments).values([
      { projectId: project.id, name: 'development' },
      { projectId: project.id, name: 'staging' },
      { projectId: project.id, name: 'production' }
    ])
    
    return project
  })
  // ✅ 自动处理 COMMIT/ROLLBACK
}
```

#### 4. 事件处理标准化

**删除所有自定义事件发布器**：
```
packages/services/business/src/events/
  ├── project-event-publisher.ts    # 删除
  ├── deployment-event-publisher.ts # 删除
  └── git-sync-event-publisher.ts   # 删除
```

**直接使用 EventEmitter2**：
```typescript
// packages/services/business/src/projects/core/projects.service.ts
import { Injectable } from '@nestjs/common'
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class ProjectsService {
  constructor(
    private readonly eventEmitter: EventEmitter2,  // ✅ 直接注入
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(ProjectsService.name)
  }

  async createProject(data: NewProject): Promise<Project> {
    const project = await this.db.insert(projects).values(data).returning()

    // ✅ 直接发射事件，不需要包装器
    this.eventEmitter.emit('project.created', {
      projectId: project.id,
      userId: data.userId,
      timestamp: new Date()
    })

    return project
  }

  // ✅ 直接监听事件
  @OnEvent('project.created')
  async handleProjectCreated(payload: { projectId: string; userId: string }) {
    this.logger.info(payload, 'Project created event received')
    // 触发初始化作业
    await this.queueService.addInitializationJob(payload)
  }

  // ✅ 支持通配符事件
  @OnEvent('project.*')
  async handleAnyProjectEvent(payload: any) {
    this.logger.debug(payload, 'Project event received')
  }
}
```

### Core 层服务（已完成，供参考）

以下是 Core 层已完成的服务，Business 层应直接使用这些服务：

#### FluxCliService（Core 层）

```typescript
// packages/core/src/flux/flux-cli.service.ts
import { Injectable } from '@nestjs/common'
import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { PinoLogger } from 'nestjs-pino'

const execAsync = promisify(exec)

@Injectable()
export class FluxCliService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(FluxCliService.name)
  }

  async createGitRepository(options: {
    name: string
    namespace: string
    url: string
    branch: string
    interval?: string
    secretRef?: string
  }): Promise<string> {
    const args = [
      'create', 'source', 'git', options.name,
      '--namespace', options.namespace,
      '--url', options.url,
      '--branch', options.branch,
      '--interval', options.interval || '1m'
    ]

    if (options.secretRef) {
      args.push('--secret-ref', options.secretRef)
    }

    return this.execute(args)
  }

  async createKustomization(options: {
    name: string
    namespace: string
    source: string
    path: string
    prune?: boolean
    interval?: string
  }): Promise<string> {
    const args = [
      'create', 'kustomization', options.name,
      '--namespace', options.namespace,
      '--source', options.source,
      '--path', options.path,
      '--interval', options.interval || '1m'
    ]

    if (options.prune) {
      args.push('--prune')
    }

    return this.execute(args)
  }

  async delete(kind: string, name: string, namespace: string): Promise<string> {
    return this.execute(['delete', kind, name, '--namespace', namespace])
  }

  async reconcile(kind: string, name: string, namespace: string): Promise<string> {
    return this.execute(['reconcile', kind, name, '--namespace', namespace])
  }

  private async execute(args: string[]): Promise<string> {
    const command = `flux ${args.join(' ')}`
    this.logger.debug({ command }, 'Executing Flux CLI command')

    try {
      const { stdout, stderr } = await execAsync(command)
      if (stderr) {
        this.logger.warn({ stderr }, 'Flux CLI stderr output')
      }
      return stdout
    } catch (error) {
      this.logger.error({ error, command }, 'Flux CLI command failed')
      throw error
    }
  }
}
```

#### K8sClientService（Core 层）

```typescript
// packages/core/src/k8s/k8s-client.service.ts
import { Injectable, OnModuleInit } from '@nestjs/common'
import * as k8s from '@kubernetes/client-node'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class K8sClientService implements OnModuleInit {
  private kc: k8s.KubeConfig
  private coreApi: k8s.CoreV1Api
  private appsApi: k8s.AppsV1Api
  private customApi: k8s.CustomObjectsApi

  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(K8sClientService.name)
  }

  onModuleInit() {
    this.kc = new k8s.KubeConfig()
    
    if (process.env.K3S_HOST && process.env.K3S_TOKEN) {
      this.kc.loadFromOptions({
        clusters: [{
          name: 'k3s',
          server: process.env.K3S_HOST,
          skipTLSVerify: false
        }],
        users: [{
          name: 'k3s-user',
          token: process.env.K3S_TOKEN
        }],
        contexts: [{
          name: 'k3s-context',
          cluster: 'k3s',
          user: 'k3s-user'
        }],
        currentContext: 'k3s-context'
      })
    } else {
      try {
        this.kc.loadFromCluster()
      } catch {
        this.kc.loadFromDefault()
      }
    }

    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api)
    this.appsApi = this.kc.makeApiClient(k8s.AppsV1Api)
    this.customApi = this.kc.makeApiClient(k8s.CustomObjectsApi)

    this.logger.info('Kubernetes client initialized')
  }

  getCoreApi(): k8s.CoreV1Api {
    return this.coreApi
  }

  getAppsApi(): k8s.AppsV1Api {
    return this.appsApi
  }

  getCustomApi(): k8s.CustomObjectsApi {
    return this.customApi
  }

  getKubeConfig(): k8s.KubeConfig {
    return this.kc
  }
}
```

## 数据模型

### SDK 类型使用

迁移后，我们将直接使用 SDK 提供的类型，而不是创建自定义类型定义：

```typescript
// ✅ 使用 SDK 类型
import type { RestEndpointMethodTypes } from '@octokit/rest'
import type { ProjectSchema } from '@gitbeaker/rest'
import type { V1Pod, V1Deployment } from '@kubernetes/client-node'

// GitHub 类型
type GitHubRepo = RestEndpointMethodTypes['repos']['get']['response']['data']
type GitHubUser = RestEndpointMethodTypes['users']['getAuthenticated']['response']['data']

// GitLab 类型
type GitLabProject = ProjectSchema
type GitLabUser = UserSchema

// Kubernetes 类型
type Pod = V1Pod
type Deployment = V1Deployment

// ❌ 不要创建重复的自定义类型
// interface CustomGitHubRepo { ... }
// interface CustomGitLabProject { ... }
```

### 数据库模型

使用 Drizzle ORM 的类型推断：

```typescript
import * as schema from '@juanie/database'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// ✅ 使用 Drizzle 类型推断
export type Project = InferSelectModel<typeof schema.projects>
export type NewProject = InferInsertModel<typeof schema.projects>

export type Environment = InferSelectModel<typeof schema.environments>
export type NewEnvironment = InferInsertModel<typeof schema.environments>

// ❌ 不要手动定义类型
// interface Project { id: string; name: string; ... }
```



## 数据模型

### SDK 类型使用

迁移后，我们将直接使用 SDK 提供的类型，而不是创建自定义类型定义：

```typescript
// ✅ 使用 SDK 类型
import type { RestEndpointMethodTypes } from '@octokit/rest'
import type { ProjectSchema, UserSchema } from '@gitbeaker/rest'
import type { V1Pod, V1Deployment, V1Secret } from '@kubernetes/client-node'

// GitHub 类型
type GitHubRepo = RestEndpointMethodTypes['repos']['get']['response']['data']
type GitHubUser = RestEndpointMethodTypes['users']['getAuthenticated']['response']['data']
type GitHubBranch = RestEndpointMethodTypes['repos']['getBranch']['response']['data']

// GitLab 类型
type GitLabProject = ProjectSchema
type GitLabUser = UserSchema

// Kubernetes 类型
type Pod = V1Pod
type Deployment = V1Deployment
type Secret = V1Secret

// ❌ 不要创建重复的自定义类型
// interface CustomGitHubRepo { ... }
// interface CustomGitLabProject { ... }
```

### 数据库模型

使用 Drizzle ORM 的类型推断：

```typescript
import * as schema from '@juanie/database'
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm'

// ✅ 使用 Drizzle 类型推断
export type Project = InferSelectModel<typeof schema.projects>
export type NewProject = InferInsertModel<typeof schema.projects>

export type Environment = InferSelectModel<typeof schema.environments>
export type NewEnvironment = InferInsertModel<typeof schema.environments>

export type Deployment = InferSelectModel<typeof schema.deployments>
export type NewDeployment = InferInsertModel<typeof schema.deployments>

// ✅ 关系查询结果类型自动推断
type ProjectWithEnvironments = Awaited<ReturnType<typeof getProjectWithEnvironments>>

async function getProjectWithEnvironments(db: DatabaseClient, projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      environments: {
        with: {
          deployments: true
        }
      }
    }
  })
}

// ❌ 不要手动定义类型
// interface Project { id: string; name: string; ... }
```

### 事件负载类型

```typescript
// ✅ 定义事件负载类型
export interface ProjectCreatedEvent {
  projectId: string
  userId: string
  organizationId: string
  timestamp: Date
}

export interface GitSyncCompletedEvent {
  projectId: string
  repoUrl: string
  branch: string
  commitSha: string
  timestamp: Date
}

export interface DeploymentStatusChangedEvent {
  deploymentId: string
  environmentId: string
  oldStatus: string
  newStatus: string
  timestamp: Date
}

// 使用示例
this.eventEmitter.emit('project.created', {
  projectId: project.id,
  userId: data.userId,
  organizationId: data.organizationId,
  timestamp: new Date()
} satisfies ProjectCreatedEvent)
```

## 正确性属性

*属性是一个特征或行为，应该在系统的所有有效执行中保持为真——本质上是关于系统应该做什么的形式化陈述。属性是人类可读规范和机器可验证正确性保证之间的桥梁。*

### 属性 1：GitHub API 调用使用 Octokit

*对于任何* GitHub API 交互，系统应该使用 `@octokit/rest` SDK 而不是直接的 `fetch()` 调用

**验证：需求 1.1**

### 属性 2：GitLab API 调用使用 Gitbeaker

*对于任何* GitLab API 交互，系统应该使用 `@gitbeaker/rest` SDK 而不是直接的 `fetch()` 调用

**验证：需求 2.1**

### 属性 3：K8s 操作使用官方客户端

*对于任何* Kubernetes 操作，系统应该使用 `@kubernetes/client-node` 官方 SDK

**验证：需求 3.1**

### 属性 4：Flux 操作使用 CLI

*对于任何* Flux 操作，系统应该直接使用 Flux CLI 而不是自定义实现

**验证：需求 4.1**

### 属性 5：YAML 生成来自 Flux

*对于任何* Flux 资源 YAML，生成应该来自 Flux CLI 的原生输出

**验证：需求 4.4**

### 属性 6：复杂查询使用关系 API

*对于任何* 涉及 JOIN 或关系的数据库查询，系统应该使用 Drizzle 的关系查询 API

**验证：需求 5.1**

### 属性 7：事务使用 Drizzle API

*对于任何* 需要事务的数据库操作，系统应该使用 `db.transaction()` API

**验证：需求 5.3**

### 属性 8：作业事件使用 BullMQ

*对于任何* 队列作业事件，系统应该使用 BullMQ 内置的 `@OnWorkerEvent` 装饰器

**验证：需求 6.1**

### 属性 9：作业进度使用 BullMQ

*对于任何* 作业进度跟踪，系统应该使用 `job.updateProgress()` 方法

**验证：需求 6.3**

### 属性 10：作业调度使用 BullMQ

*对于任何* 延迟或定时作业，系统应该使用 BullMQ 的调度 API

**验证：需求 6.5**

### 属性 11：Redis Pub/Sub 使用 ioredis

*对于任何* Redis 发布/订阅操作，系统应该使用 ioredis 内置的 pub/sub 方法

**验证：需求 7.3**

### 属性 12：Lua 脚本使用 ioredis

*对于任何* Redis Lua 脚本执行，系统应该使用 ioredis 的脚本支持

**验证：需求 7.4**

### 属性 13：事件发射使用 EventEmitter2

*对于任何* 应用内事件，系统应该直接使用 `EventEmitter2` 而不是自定义包装器

**验证：需求 8.1**

### 属性 14：通配符事件正常工作

*对于任何* 通配符事件模式（如 `project.*`），EventEmitter2 应该正确匹配和触发监听器

**验证：需求 8.3**

### 属性 15：异步事件处理正常工作

*对于任何* 异步事件处理器，EventEmitter2 应该正确等待 Promise 完成

**验证：需求 8.4**

### 属性 16：事件错误被捕获

*对于任何* 事件处理器中抛出的错误，EventEmitter2 应该捕获并触发错误事件

**验证：需求 8.5**

### 属性 17：日志使用 nestjs-pino

*对于任何* 服务中的日志记录，系统应该使用 `nestjs-pino` 的 `PinoLogger`

**验证：需求 9.1**

### 属性 18：子日志记录器正常工作

*对于任何* 需要上下文的日志，系统应该使用 Pino 的子日志记录器功能

**验证：需求 9.3**

### 属性 19：API 兼容性保持

*对于任何* 迁移后的服务方法，API 签名应该与迁移前保持兼容

**验证：需求 12.2**

### 属性 20：错误类型来自 SDK

*对于任何* SDK 操作的错误处理，系统应该使用 SDK 提供的错误类型

**验证：需求 14.1**

### 属性 21：错误包装仅在必要时

*对于任何* SDK 错误，系统应该仅在添加业务上下文时才包装为域错误

**验证：需求 14.3**

### 属性 22：错误保留 SDK 信息

*对于任何* 包装的 SDK 错误，原始错误代码和消息应该被保留

**验证：需求 14.4**

### 属性 23：重试使用 SDK 机制

*对于任何* 需要重试的操作，系统应该使用 SDK 内置的重试机制

**验证：需求 14.5**

## 错误处理

### SDK 错误处理原则

1. **直接使用 SDK 错误类型**
   ```typescript
   import { RequestError } from '@octokit/request-error'
   import { GitbeakerRequestError } from '@gitbeaker/requester-utils'
   
   try {
     await githubClient.repos.get({ owner, repo })
   } catch (error) {
     if (error instanceof RequestError) {
       // ✅ 使用 SDK 错误类型
       if (error.status === 404) {
         throw new RepositoryNotFoundError(repo)
       }
     }
   }
   ```

2. **仅在必要时包装**
   ```typescript
   // ✅ 添加业务上下文时包装
   try {
     await githubClient.repos.createInOrg({ org, name })
   } catch (error) {
     if (error instanceof RequestError && error.status === 422) {
       throw new RepositoryAlreadyExistsError(name, error)
     }
     throw error // 其他错误直接抛出
   }
   
   // ❌ 不要无意义地包装
   try {
     await githubClient.repos.get({ owner, repo })
   } catch (error) {
     throw new GitHubApiError(error) // 没有增加价值
   }
   ```

3. **保留原始错误信息**
   ```typescript
   export class RepositoryNotFoundError extends BaseError {
     constructor(
       public readonly repository: string,
       public readonly cause?: Error
     ) {
       super(`Repository ${repository} not found`, { cause })
     }
   }
   
   // 使用
   throw new RepositoryNotFoundError(repo, originalError)
   ```

### 重试策略

使用 SDK 内置的重试机制：

```typescript
// ✅ Octokit 内置重试
const octokit = new Octokit({
  auth: token,
  retry: {
    enabled: true,
    retries: 3
  },
  throttle: {
    onRateLimit: (retryAfter, options) => {
      console.warn(`Rate limit hit, retrying after ${retryAfter}s`)
      return true // 自动重试
    }
  }
})

// ✅ ioredis 内置重试
const redis = new Redis({
  host: 'localhost',
  port: 6379,
  retryStrategy: (times) => {
    if (times > 3) {
      return null // 停止重试
    }
    return Math.min(times * 100, 3000) // 指数退避
  }
})

// ❌ 不要自定义重试逻辑
async function retryOperation(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await sleep(1000 * i)
    }
  }
}
```

## 测试策略

### 双重测试方法

我们将使用单元测试和属性测试的组合：

- **单元测试**：验证特定示例、边缘情况和错误条件
- **属性测试**：验证所有输入的通用属性
- 两者互补且都是必需的

### 单元测试重点

单元测试应该关注：

1. **特定示例**
   ```typescript
   describe('GitSyncService', () => {
     it('should create GitRepository and Kustomization', async () => {
       const result = await gitSyncService.syncRepository({
         projectId: 'test-project',
         repoUrl: 'https://github.com/user/repo',
         branch: 'main',
         namespace: 'test-ns'
       })
       
       expect(fluxCli.createGitRepository).toHaveBeenCalledWith({
         name: 'project-test-project',
         namespace: 'test-ns',
         url: 'https://github.com/user/repo',
         branch: 'main',
         interval: '1m'
       })
     })
   })
   ```

2. **边缘情况**
   ```typescript
   it('should handle empty namespace', async () => {
     await expect(
       gitSyncService.syncRepository({
         projectId: 'test',
         repoUrl: 'https://github.com/user/repo',
         branch: 'main',
         namespace: ''
       })
     ).rejects.toThrow('Namespace cannot be empty')
   })
   ```

3. **错误条件**
   ```typescript
   it('should emit failed event on error', async () => {
     fluxCli.createGitRepository.mockRejectedValue(new Error('Flux error'))
     
     const emitSpy = jest.spyOn(eventEmitter, 'emit')
     
     await expect(
       gitSyncService.syncRepository({ ... })
     ).rejects.toThrow()
     
     expect(emitSpy).toHaveBeenCalledWith('git-sync.failed', expect.any(Object))
   })
   ```

### 属性测试配置

使用 `fast-check` 进行属性测试：

```typescript
import fc from 'fast-check'

describe('GitSyncService properties', () => {
  it('Property 4: All Flux operations use CLI', () => {
    fc.assert(
      fc.asyncProperty(
        fc.record({
          projectId: fc.uuid(),
          repoUrl: fc.webUrl(),
          branch: fc.string({ minLength: 1 }),
          namespace: fc.string({ minLength: 1 })
        }),
        async (options) => {
          await gitSyncService.syncRepository(options)
          
          // 验证所有 Flux 操作都通过 FluxCliService
          expect(fluxCli.createGitRepository).toHaveBeenCalled()
          expect(fluxCli.createKustomization).toHaveBeenCalled()
        }
      ),
      { numRuns: 100 }
    )
  })
})
```

### 集成测试

验证迁移后的运行时功能：

```typescript
describe('GitOps Integration', () => {
  it('should complete full project initialization flow', async () => {
    // 创建项目
    const project = await projectsService.create({
      name: 'test-project',
      organizationId: 'org-1'
    })
    
    // 触发初始化
    await queue.add('project-initialization', {
      projectId: project.id,
      userId: 'user-1',
      templateId: 'nextjs-15'
    })
    
    // 等待完成
    await waitForJobCompletion(project.id)
    
    // 验证结果
    const updatedProject = await projectsService.findById(project.id)
    expect(updatedProject.status).toBe('active')
    expect(updatedProject.gitRepoUrl).toBeDefined()
    
    // 验证 Flux 资源
    const gitRepo = await fluxCli.get('gitrepository', `project-${project.id}`, project.namespace)
    expect(gitRepo).toBeDefined()
  })
})
```

### 测试覆盖率目标

- **单元测试覆盖率**：80%+
- **属性测试**：每个正确性属性至少一个测试
- **集成测试**：关键业务流程全覆盖
- **迁移验证**：所有现有测试必须通过

### 迁移验证清单

每个迁移完成后必须验证：

- [ ] 所有现有单元测试通过
- [ ] 所有属性测试通过
- [ ] 集成测试通过
- [ ] TypeScript 编译无错误
- [ ] 代码减少指标达标（目标：减少 30%+）
- [ ] 性能测试通过（不低于迁移前）
- [ ] 文档已更新
- [ ] 导入示例已更新

