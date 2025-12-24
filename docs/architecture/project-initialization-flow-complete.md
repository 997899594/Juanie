# 项目初始化完整流程（2025-01-22 最新版）

**状态**: ✅ 已验证  
**最后更新**: 2025-01-22

## 流程概览

```
前端 → tRPC Router → ProjectsService → ProjectOrchestrator → StateMachine → Handlers → Worker
```

## 详细流程

### 1. 前端发起请求

**文件**: `apps/web/src/components/ProjectWizard.vue`

```typescript
const result = await trpc.projects.create.mutate({
  organizationId: '...',
  name: 'my-project',
  templateId: 'nextjs-15-app',
  repository: {
    provider: 'github',
    mode: 'create',
    name: 'my-project',
    visibility: 'private',
    accessToken: '__USE_OAUTH__',  // 使用 OAuth
    defaultBranch: 'main'
  }
})
```

### 2. tRPC Router 接收请求

**文件**: `apps/api-gateway/src/routers/projects.router.ts`

```typescript
create: this.trpc.protectedProcedure
  .input(createProjectSchema)
  .mutation(async ({ ctx, input }) => {
    return await this.projectsService.create(ctx.user.id, input)
  })
```

**职责**:
- 验证输入（Zod schema）
- 提取用户信息
- 调用 ProjectsService

### 3. ProjectsService 处理

**文件**: `packages/services/business/src/projects/projects.service.ts`

```typescript
async create(userId: string, data: CreateProjectInput) {
  // 1. 检查组织是否存在
  const [organization] = await this.db
    .select()
    .from(schema.organizations)
    .where(eq(schema.organizations.id, data.organizationId))
    .limit(1)

  // 2. 检查权限
  const ability = await this.caslAbilityFactory.createForUser(userId, data.organizationId)
  if (!ability.can('create', 'Project')) {
    throw new PermissionDeniedError('Project', 'create')
  }

  // 3. 调用 orchestrator
  const result = await this.orchestrator.createAndInitialize(userId, {
    ...data,
    visibility: data.visibility ?? 'private',
  })

  // 4. 处理结果
  if (!result.success || !result.project) {
    throw new ProjectInitializationError(...)
  }

  return {
    ...result.project,
    jobIds: result.jobIds,
  }
}
```

**职责**:
- 权限检查
- 委托给 Orchestrator
- 错误处理

### 4. ProjectOrchestrator 协调

**文件**: `packages/services/business/src/projects/project-orchestrator.service.ts`

```typescript
async createAndInitialize(userId: string, data: CreateProjectInput) {
  // 创建初始化上下文
  const context: InitializationContext = {
    userId,
    organizationId: data.organizationId,
    projectData: {
      name: data.name,
      slug: data.slug,
      description: data.description,
      logoUrl: data.logoUrl,
      visibility: data.visibility,
    },
    templateId: data.templateId,
    templateConfig: data.templateConfig,
    repository: data.repository,
    currentState: 'IDLE',
    progress: 0,
  }

  // 执行状态机
  const result = await this.stateMachine.execute(context)
  return result
}
```

**职责**:
- 创建初始化上下文
- 委托给状态机
- 返回结果

### 5. StateMachine 执行状态转换

**文件**: `packages/services/business/src/projects/initialization/state-machine.service.ts`

**状态流转**:
```
IDLE
  ↓
CREATING_PROJECT (CreateProjectHandler)
  ↓
LOADING_TEMPLATE (LoadTemplateHandler) - 如果有 templateId
  ↓
RENDERING_TEMPLATE (RenderTemplateHandler) - 如果有模板
  ↓
CREATING_ENVIRONMENTS (CreateEnvironmentsHandler)
  ↓
SETTING_UP_REPOSITORY (SetupRepositoryHandler) - 如果有 repository
  ↓
FINALIZING (FinalizeHandler)
  ↓
COMPLETED
```

### 6. 关键 Handler 详解

#### 6.1 CreateProjectHandler

**文件**: `packages/services/business/src/projects/initialization/handlers/create-project.handler.ts`

```typescript
async execute(context: InitializationContext) {
  // 创建项目记录
  const [project] = await db.insert(schema.projects).values({
    organizationId: context.organizationId,
    name: context.projectData.name,
    slug: context.projectData.slug,
    description: context.projectData.description,
    visibility: context.projectData.visibility,
    status: 'initializing',
  }).returning()

  context.projectId = project.id
  context.project = project
}
```

#### 6.2 LoadTemplateHandler

**文件**: `packages/services/business/src/projects/initialization/handlers/load-template.handler.ts`

```typescript
async execute(context: InitializationContext) {
  if (!context.templateId) return

  // 从数据库加载模板
  const template = await db.query.projectTemplates.findFirst({
    where: eq(schema.projectTemplates.id, context.templateId)
  })

  context.templatePath = template.path
}
```

#### 6.3 RenderTemplateHandler

**文件**: `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`

```typescript
async execute(context: InitializationContext) {
  if (!context.templatePath || !context.projectId) return

  const [project] = await db.select()
    .from(schema.projects)
    .where(eq(schema.projects.id, context.projectId))
    .limit(1)

  // ✅ 使用 projectName，不使用 projectSlug
  const result = await this.renderer.renderTemplate(
    context.templatePath,
    {
      projectName: project.name,  // ✅ 正确
      description: project.description || undefined,
      ...context.templateConfig,
    },
    outputDir,
  )
}
```

#### 6.4 CreateEnvironmentsHandler

**文件**: `packages/services/business/src/projects/initialization/handlers/create-environments.handler.ts`

```typescript
async execute(context: InitializationContext) {
  // 创建默认环境
  const environments = await db.insert(schema.environments).values([
    { projectId: context.projectId, name: 'Development', type: 'development' },
    { projectId: context.projectId, name: 'Staging', type: 'staging' },
    { projectId: context.projectId, name: 'Production', type: 'production' },
  ]).returning()

  context.environmentIds = environments.map(e => e.id)
}
```

#### 6.5 SetupRepositoryHandler

**文件**: `packages/services/business/src/projects/initialization/handlers/setup-repository.handler.ts`

```typescript
async execute(context: InitializationContext) {
  if (!context.repository || !context.projectId) return

  // 解析 OAuth token
  const resolvedConfig = await this.resolveAccessToken(context)

  if (resolvedConfig.mode === 'existing') {
    // 快速路径：关联现有仓库
    await this.connectExistingRepository(context, resolvedConfig)
  } else {
    // 慢速路径：创建新仓库（异步）
    await this.queueRepositoryCreation(context, resolvedConfig)
  }
}

private async queueRepositoryCreation(context, config) {
  // ✅ 使用 project-initialization 队列
  const job = await this.queue.add('initialize-project', {
    projectId: context.projectId,
    userId: context.userId,
    organizationId: context.organizationId,
    repository: config,
    templateId: context.templateId,
    environmentIds: context.environmentIds,
  })

  context.jobIds = [job.id]
}
```

### 7. Worker 异步处理

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

```typescript
async handleProjectInitialization(job: Job) {
  const { projectId, userId, repository, environmentIds } = job.data

  try {
    // 步骤 1: 创建 Git 仓库 (0-20%)
    const repoInfo = await this.createRepository(job, repository)

    // 步骤 2: 推送模板代码 (20-50%)
    await this.pushTemplateCode(job, project, repository.provider, 
      repository.accessToken, repoInfo, repository.username)

    // 步骤 3: 创建数据库记录 (50-60%)
    const dbRepository = await this.createRepositoryRecord(
      projectId, repository.provider, repoInfo)

    // 步骤 4: 配置 GitOps (60-90%)
    await this.createGitOpsResources(job, projectId, 
      dbRepository.id, environmentIds, repoInfo.fullName)

    // 步骤 5: 完成初始化 (90-100%)
    await this.db.update(schema.projects)
      .set({ status: 'active', initializationCompletedAt: new Date() })
      .where(eq(schema.projects.id, projectId))

    await this.progressManager.markCompleted(projectId)
  } catch (error) {
    await this.progressManager.markFailed(projectId, error.message)
    throw error
  }
}
```

#### 7.1 推送模板代码

```typescript
private async pushTemplateCode(job, project, provider, accessToken, repoInfo, githubUsername) {
  // ✅ 准备模板变量（使用 projectName）
  const templateVariables = {
    projectId: project.id,
    projectName: project.name,  // ✅ 正确
    description: project.description || `${project.name} - AI DevOps Platform`,
    githubUsername: githubUsername || 'unknown',  // ✅ 从 OAuth 获取
    appName: project.name,
    registry: 'ghcr.io',
    port: 3000,
    domain: this.config.get('APP_DOMAIN') || 'example.com',
    replicas: 1,
    // ...
  }

  // 渲染模板到内存
  const files = await this.templateRenderer.renderTemplateToMemory(
    'nextjs-15-app',
    templateVariables,
  )

  // 推送到 Git 仓库
  await this.pushFilesToRepository(
    job, provider, accessToken, repoInfo.fullName, files, repoInfo.defaultBranch
  )
}
```

#### 7.2 创建 GitOps 资源

```typescript
private async createGitOpsResources(job, projectId, repositoryId, environmentIds, repositoryFullName) {
  // 获取项目信息
  const [project] = await this.db.select()
    .from(schema.projects)
    .where(eq(schema.projects.id, projectId))
    .limit(1)

  // 获取环境信息
  const environments = await this.db.select()
    .from(schema.environments)
    .where(eq(schema.environments.projectId, projectId))

  // 获取仓库信息
  const [repository] = await this.db.select()
    .from(schema.repositories)
    .where(eq(schema.repositories.id, repositoryId))
    .limit(1)

  // ✅ 直接同步创建 GitOps 资源（不使用事件）
  const result = await this.fluxResources.setupProjectGitOps({
    projectId,
    repositoryId,
    repositoryUrl: repository.cloneUrl,
    repositoryBranch: repository.defaultBranch || 'main',
    userId: job.data.userId,
    environments: environments.map(env => ({
      id: env.id,
      type: env.type,
      name: env.name,
    })),
  })

  return result.success
}
```

## 关键数据流

### 模板变量传递

```
CreateProjectHandler
  ↓ (project.name)
RenderTemplateHandler
  ↓ (projectName: project.name)
TemplateRenderer
  ↓ (EJS 渲染)
Worker.pushTemplateCode
  ↓ (projectName: project.name, githubUsername: from OAuth)
Git Repository Files
  ↓
GitHub Actions Workflow
  ↓ (PROJECT_NAME, GITHUB_USERNAME)
Docker Image
  ↓ (ghcr.io/<username>/<projectName>:tag)
K8s Deployment
```

### 仓库信息传递

```
SetupRepositoryHandler
  ↓ (queue job with repository config)
Worker.createRepository
  ↓ (create Git repo via API)
Worker.createRepositoryRecord
  ↓ (insert into repositories table)
  ↓ (fullName: "username/repo-name")
Worker.createGitOpsResources
  ↓ (use repository.fullName)
FluxResourcesService
  ↓ (create GitRepository CR)
Flux CD
  ↓ (sync from Git)
K8s Cluster
```

## 废弃的路径（已删除）

### ❌ 使用 projectSlug

```typescript
// ❌ 错误（已删除）
const repoFullName = `${project.organizationId}/${project.slug}`

// ✅ 正确（当前）
const [repository] = await this.db.select()
  .from(schema.repositories)
  .where(eq(schema.repositories.projectId, projectId))
  .limit(1)
const repoFullName = repository.fullName
```

### ❌ 使用事件发布 GitOps 资源

```typescript
// ❌ 错误（已删除）
await this.eventPublisher.publishDomain<GitOpsSetupRequestedEvent>({
  type: IntegrationEvents.GITOPS_SETUP_REQUESTED,
  // ...
})

// ✅ 正确（当前）
const result = await this.fluxResources.setupProjectGitOps({
  projectId,
  repositoryId,
  // ...
})
```

### ❌ 双重错误处理

```typescript
// ❌ 错误（已删除）
private async readAndRenderFile(...) {
  try {
    const content = await fs.readFile(...)
    try {
      return await ejs.render(content, variables)
    } catch (error) {
      // 静默忽略错误
      return content
    }
  } catch (error) {
    // 静默忽略错误
    return ''
  }
}

// ✅ 正确（当前）
private async readAndRenderFile(...) {
  const content = await fs.readFile(...)
  return await ejs.render(content, variables)  // 让错误正常抛出
}
```

## 验证清单

- [x] 前端发送正确的请求格式
- [x] tRPC Router 正确验证输入
- [x] ProjectsService 正确检查权限
- [x] ProjectOrchestrator 正确创建上下文
- [x] StateMachine 按正确顺序执行 Handler
- [x] CreateProjectHandler 创建项目记录
- [x] LoadTemplateHandler 加载模板路径
- [x] RenderTemplateHandler 使用 `projectName`（不是 `projectSlug`）
- [x] CreateEnvironmentsHandler 创建默认环境
- [x] SetupRepositoryHandler 队列化仓库创建
- [x] Worker 解析 OAuth token
- [x] Worker 创建 Git 仓库
- [x] Worker 推送模板代码（使用 `projectName` 和 `githubUsername`）
- [x] Worker 创建数据库记录（`repositories.fullName`）
- [x] Worker 直接创建 GitOps 资源（不使用事件）
- [x] FluxResourcesService 创建 K8s 资源
- [x] 模板文件使用 `<%= projectName %>`
- [x] GitHub Actions workflow 使用 `PROJECT_NAME` 和 `GITHUB_USERNAME`
- [x] K8s deployment 使用正确的镜像名称

## 相关文档

- [projectSlug 移除完成](../troubleshooting/projectslug-removal-complete.md)
- [模板系统 EJS 迁移](./template-system-ejs-migration.md)
- [K8s 部署镜像名称错误](../troubleshooting/k8s-deployment-wrong-image-name.md)
