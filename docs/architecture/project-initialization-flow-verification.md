# 项目初始化流程验证

## 完整流程路径

### 1. 用户创建项目

**入口**: `apps/api-gateway/src/routers/projects.router.ts`

```typescript
projects.create
  ↓
ProjectsService.create(userId, data)
```

---

### 2. 创建项目并初始化

**文件**: `packages/services/business/src/projects/projects.service.ts`

```typescript
async create(userId: string, data: CreateProjectInput) {
  // 1. 检查组织权限
  // 2. 调用 orchestrator
  const result = await this.orchestrator.createAndInitialize(userId, data)
  
  // 3. 返回项目和 jobIds
  return { ...result.project, jobIds: result.jobIds }
}
```

---

### 3. 编排器创建项目和队列任务

**文件**: `packages/services/business/src/projects/project-orchestrator.service.ts`

```typescript
async createAndInitialize(userId: string, data: CreateProjectInput) {
  // 1. 创建项目记录（status: 'initializing'）
  const project = await this.db.insert(schema.projects).values(...)
  
  // 2. 创建环境记录
  const environments = await this.createEnvironments(project.id, ...)
  
  // 3. 创建初始化步骤记录
  await this.initializationSteps.createSteps(project.id)
  
  // 4. 添加到队列
  const job = await this.queue.add('initialize-project', {
    projectId: project.id,
    userId,
    repository: data.repository,
    environmentIds: environments.map(e => e.id)
  })
  
  return { success: true, project, jobIds: [job.id] }
}
```

---

### 4. Worker 处理初始化任务

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

```typescript
async handleProjectInitialization(job: Job) {
  const { projectId, userId, repository, environmentIds } = job.data
  
  try {
    // 步骤 1: 创建 Git 仓库 (0-20%)
    const repoInfo = await this.createRepository(job, repository)
    
    // 步骤 2: 推送模板代码 (20-50%)
    await this.pushTemplateCode(job, project, ...)
    
    // 步骤 3: 创建数据库记录 (50-60%)
    const dbRepository = await this.createRepositoryRecord(...)
    
    // 步骤 4: 配置 GitOps (60-90%)
    const gitopsCreated = await this.createGitOpsResources(
      job,
      projectId,
      dbRepository.id,
      environmentIds,
      repoInfo.fullName
    )
    
    // 步骤 5: 完成初始化 (90-100%)
    await this.db.update(schema.projects)
      .set({ status: 'active', initializationCompletedAt: new Date() })
      .where(eq(schema.projects.id, projectId))
    
    await this.progressManager.markCompleted(projectId)
    
  } catch (error) {
    // 标记失败
    await this.progressManager.markFailed(projectId, error.message)
    throw error
  }
}
```

---

### 5. 创建 GitOps 资源（关键步骤）

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

```typescript
private async createGitOpsResources(
  job: Job,
  projectId: string,
  repositoryId: string,
  environmentIds: string[],
  repositoryFullName: string
): Promise<boolean> {
  
  // 1. 获取项目和环境信息
  const [project] = await this.db.select()...
  const environments = await this.db.select()...
  
  // 2. 获取仓库信息
  const [repository] = await this.db.select()...
  
  // 3. 获取用户 ID（从 job data）
  const userId = job.data.userId
  
  // 4. 获取 OAuth token
  const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
    userId,
    repository.provider
  )
  
  if (!gitConnection?.accessToken) {
    // 没有 token，只创建数据库记录
    return false
  }
  
  // 5. 直接同步创建 GitOps 资源（不使用事件）
  const result = await this.fluxResources.setupProjectGitOps({
    projectId,
    repositoryId,
    repositoryUrl: repository.cloneUrl,
    repositoryBranch: repository.defaultBranch || 'main',
    userId,
    environments: environments.map(env => ({
      id: env.id,
      type: env.type,
      name: env.name
    }))
  })
  
  return result.success
}
```

**关键点**:
- ✅ **直接调用** `fluxResources.setupProjectGitOps()`
- ✅ **不使用事件** - 没有 `eventPublisher.publishDomain()`
- ✅ **同步执行** - 可以直接获取结果
- ✅ **错误处理清晰** - try-catch 直接捕获

---

### 6. 设置 GitOps 资源栈

**文件**: `packages/services/business/src/gitops/flux/flux-resources.service.ts`

```typescript
async setupProjectGitOps(data: {
  projectId: string
  repositoryId: string
  repositoryUrl: string
  repositoryBranch: string
  userId: string
  environments: Array<{ id: string, type: string, name: string }>
}): Promise<{
  success: boolean
  namespaces: string[]
  gitRepositories: string[]
  kustomizations: string[]
  errors: string[]
}> {
  
  // 1. 创建项目凭证
  const credential = await this.credentialManager.createProjectCredential({
    projectId: data.projectId,
    userId: data.userId
  })
  
  // 2. 获取 GitHub 连接信息（用于 ImagePullSecret）
  const gitConnection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(
    data.userId,
    'github'
  )
  
  const githubUsername = gitConnection.username
  const githubToken = gitConnection.accessToken
  
  // 3. 为每个环境创建资源
  for (const environment of data.environments) {
    const namespace = `project-${projectId}-${environment.type}`
    
    // 3.1 创建 Namespace
    await this.k3s.createNamespace(namespace)
    
    // 3.2 创建 ImagePullSecret（用户自己的 GitHub Token）
    await this.createImagePullSecret(namespace, githubUsername, githubToken)
    
    // 3.3 同步 Git Secret
    await this.credentialManager.syncToK8s(projectId, credential)
    
    // 3.4 创建 GitRepository
    await this.createGitRepository({
      name: `${projectId}-repo`,
      namespace,
      url: httpsUrl,
      branch: data.repositoryBranch,
      secretRef: `${projectId}-git-auth`,
      interval: intervals.gitRepo  // 环境差异化配置
    })
    
    // 3.5 创建 Kustomization
    await this.createKustomization({
      name: `${projectId}-${environment.type}`,
      namespace,
      gitRepositoryName: `${projectId}-repo`,
      path: `./k8s/overlays/${environment.type}`,
      interval: intervals.kustomization  // 环境差异化配置
    })
    
    // 3.6 创建数据库记录
    await this.db.insert(schema.gitopsResources).values(...)
  }
  
  return { success: true, ... }
}
```

---

## 关键验证点

### ✅ 1. 没有事件驱动

**搜索结果**:
```bash
# 搜索 requestGitOpsSetup
grep -r "requestGitOpsSetup" packages/services/business/src/
# 结果：无（已删除）

# 搜索 markGitOpsSetupFailed
grep -r "markGitOpsSetupFailed" packages/services/business/src/
# 结果：无（已删除）

# 搜索 GITOPS_SETUP_REQUESTED 事件发布
grep -r "GITOPS_SETUP_REQUESTED" packages/services/business/src/
# 结果：只有 FluxSyncService 的监听器（无发布者）
```

### ✅ 2. 没有 projectSlug

**搜索结果**:
```bash
# 搜索 projectSlug
grep -r "projectSlug" packages/services/business/src/
# 结果：无

grep -r "project.slug" packages/services/business/src/
# 结果：无
```

### ✅ 3. 使用 projectName

**验证**:
- ✅ Worker 传递 `projectName` 给模板渲染器
- ✅ 模板文件使用 `<%= projectName %>`
- ✅ GitHub Actions workflow 使用 `PROJECT_NAME`
- ✅ K8s YAML 使用 `<%= projectName %>`

### ✅ 4. 多租户支持

**验证**:
- ✅ 每个用户使用自己的 `gitConnections` 记录
- ✅ ImagePullSecret 使用用户的 GitHub Token
- ✅ 镜像名称格式：`ghcr.io/<github-username>/<project-name>:latest`

---

## 流程图

```
用户创建项目
  ↓
ProjectsService.create()
  ↓
ProjectOrchestrator.createAndInitialize()
  ├─ 创建项目记录（status: 'initializing'）
  ├─ 创建环境记录
  ├─ 创建初始化步骤记录
  └─ 添加到 BullMQ 队列
  ↓
ProjectInitializationWorker.handleProjectInitialization()
  ├─ 步骤 1: 创建 Git 仓库 (0-20%)
  ├─ 步骤 2: 推送模板代码 (20-50%)
  │   └─ 使用 projectName 渲染模板
  ├─ 步骤 3: 创建数据库记录 (50-60%)
  ├─ 步骤 4: 配置 GitOps (60-90%)
  │   └─ 直接调用 FluxResourcesService.setupProjectGitOps()
  │       ├─ 创建项目凭证
  │       ├─ 获取用户 GitHub 连接
  │       └─ 为每个环境创建资源
  │           ├─ Namespace
  │           ├─ ImagePullSecret（用户 Token）
  │           ├─ Git Secret
  │           ├─ GitRepository
  │           ├─ Kustomization
  │           └─ 数据库记录
  └─ 步骤 5: 完成初始化 (90-100%)
      └─ 更新项目状态为 'active'
```

---

## 测试验证步骤

### 1. 重启后端

```bash
bun run dev:api
```

### 2. 创建新项目

通过前端或 API 创建项目，观察日志：

```
✅ 应该看到：
[ProjectInitializationWorker] Processing project initialization
[ProjectInitializationWorker] [create_repository] 0% -> 总进度 0% - 开始创建 Git 仓库...
[ProjectInitializationWorker] [create_repository] 100% -> 总进度 20% - 仓库创建成功
[ProjectInitializationWorker] [push_template] 0% -> 总进度 20% - 准备推送模板代码...
[ProjectInitializationWorker] [push_template] 100% -> 总进度 50% - 模板代码推送完成
[ProjectInitializationWorker] [setup_gitops] 0% -> 总进度 60% - 开始配置 GitOps...
[FluxResourcesService] Creating credential for project xxx
[FluxResourcesService] ✅ Retrieved GitHub credentials for user xxx
[FluxResourcesService] Creating namespace: project-xxx-development
[FluxResourcesService] Creating ImagePullSecret in project-xxx-development
[FluxResourcesService] ✅ ImagePullSecret created in project-xxx-development for user xxx
[FluxResourcesService] Creating GitRepository: xxx-repo in project-xxx-development
[FluxResourcesService] Creating Kustomization: xxx-development in project-xxx-development
[ProjectInitializationWorker] [setup_gitops] 100% -> 总进度 90% - GitOps 资源创建完成
[ProjectInitializationWorker] [finalize] 100% -> 总进度 100% - 项目初始化完成！

❌ 不应该看到：
- requestGitOpsSetup
- markGitOpsSetupFailed
- GITOPS_SETUP_REQUESTED
- projectSlug
- project.slug
```

### 3. 检查镜像名称

```bash
# 查看 GitHub Actions workflow
cat <repo>/.github/workflows/build-project-image.yml

# 应该看到：
PROJECT_NAME: <project-name>
IMAGE_NAME: ghcr.io/${{ github.repository_owner }}/${{ env.PROJECT_NAME }}
```

### 4. 检查 Pod 状态

```bash
kubectl get pods -n project-<project-id>-development

# 应该看到：
NAME                           READY   STATUS    RESTARTS   AGE
<project-name>-xxx-xxx         1/1     Running   0          5m

# 不应该看到：
ImagePullBackOff
ErrImagePull
```

### 5. 检查镜像拉取

```bash
kubectl describe pod <pod-name> -n project-<project-id>-development

# 应该看到：
Successfully pulled image "ghcr.io/<github-username>/<project-name>:latest"

# 不应该看到：
Failed to pull image "ghcr.io/unknown/..."
```

---

## 总结

✅ **流程路径正确**:
- Worker 直接调用 FluxResourcesService
- 不使用事件驱动
- 同步执行，错误处理清晰

✅ **变量使用正确**:
- 使用 projectName，不使用 projectSlug
- 镜像名称格式正确
- 多租户隔离正确

✅ **代码清理完成**:
- 删除废弃方法
- 删除 projectSlug 相关代码
- 保留但不使用的事件监听器（无影响）

---

**文档创建时间**: 2025-12-23  
**最后更新**: 2025-12-23
