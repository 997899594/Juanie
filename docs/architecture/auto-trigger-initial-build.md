# 自动触发首次镜像构建

## 问题

创建项目后，模板代码已推送到 Git 仓库，但镜像不存在，导致 Pod 处于 `ImagePullBackOff` 状态。

**原因**: 通过 API 推送的代码不会触发 GitHub Actions（只有 `git push` 才会触发）

## 解决方案对比

### 方案 1: 手动触发（当前）❌

**流程**:
```
创建项目 → 推送代码 → Pod ImagePullBackOff → 手动触发构建 → 等待 → 部署成功
```

**问题**:
- 需要人工介入
- 用户体验差
- 不符合自动化理念

### 方案 2: 空提交触发 ✅

**流程**:
```
创建项目 → 推送代码 → 自动空提交 → 触发 GitHub Actions → 自动构建 → 部署成功
```

**实现**:
```typescript
// 推送模板代码后，立即创建一个空提交
await this.gitProvider.createCommit(
  provider,
  accessToken,
  fullName,
  [],  // 空文件列表
  branch,
  'chore: trigger initial build',
  {
    allowEmpty: true,  // 允许空提交
  }
)
```

**优势**:
- ✅ 全自动
- ✅ 无需人工介入
- ✅ 用户体验好

### 方案 3: GitHub API 触发 ✅✅ (推荐)

**流程**:
```
创建项目 → 推送代码 → 调用 GitHub API → 触发 GitHub Actions → 自动构建 → 部署成功
```

**实现**:
```typescript
// 使用 GitHub API 直接触发 workflow
await this.gitProvider.triggerWorkflow(
  provider,
  accessToken,
  fullName,
  'build-project-image.yml',
  {
    ref: branch,
    inputs: {
      project_slug: projectSlug,
      tag: 'latest',
    },
  }
)
```

**优势**:
- ✅ 最直接
- ✅ 不产生额外提交
- ✅ 可传递参数
- ✅ 立即触发

### 方案 4: Webhook 触发 ⚡

**流程**:
```
创建项目 → 推送代码 → 发送 Webhook → GitHub Actions → 自动构建 → 部署成功
```

**实现**:
```typescript
// 使用 repository_dispatch 事件
await this.gitProvider.dispatchEvent(
  provider,
  accessToken,
  fullName,
  'build-image',
  {
    project_slug: projectSlug,
    tag: 'latest',
  }
)
```

**GitHub Actions 配置**:
```yaml
on:
  repository_dispatch:
    types: [build-image]
  push:
    branches: [main, master]
```

**优势**:
- ✅ 解耦
- ✅ 灵活
- ✅ 可扩展

## 推荐方案：GitHub API 触发

### 实现步骤

#### 1. 添加 GitProvider 方法

```typescript
// packages/services/business/src/gitops/git-providers/git-provider.service.ts

async triggerWorkflow(
  provider: 'github' | 'gitlab',
  accessToken: string,
  fullName: string,
  workflowFile: string,
  options: {
    ref: string
    inputs?: Record<string, string>
  }
): Promise<void> {
  if (provider === 'github') {
    const [owner, repo] = fullName.split('/')
    
    await this.octokit.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id: workflowFile,
      ref: options.ref,
      inputs: options.inputs,
    })
    
    this.logger.info(`✅ Triggered workflow ${workflowFile} for ${fullName}`)
  } else {
    // GitLab CI 触发
    await this.gitlab.post(
      `/projects/${encodeURIComponent(fullName)}/trigger/pipeline`,
      {
        token: accessToken,
        ref: options.ref,
        variables: options.inputs,
      }
    )
  }
}
```

#### 2. 在项目初始化中调用

```typescript
// packages/services/business/src/queue/project-initialization.worker.ts

private async pushTemplateCode(...) {
  // ... 推送模板代码
  
  await this.updateStepProgress(job, 'push_template', 80, `成功推送 ${files.length} 个文件`)
  
  // 触发首次镜像构建
  await this.updateStepProgress(job, 'push_template', 90, '触发镜像构建...')
  
  try {
    await this.gitProvider.triggerWorkflow(
      provider,
      accessToken,
      repoInfo.fullName,
      'build-project-image.yml',
      {
        ref: repoInfo.defaultBranch,
        inputs: {
          project_slug: project.slug,
          tag: 'latest',
        },
      }
    )
    
    await this.updateStepProgress(job, 'push_template', 95, '镜像构建已触发')
    this.logger.info(`✅ Triggered initial build for ${project.slug}`)
  } catch (error) {
    // 触发失败不应阻止项目创建
    this.logger.warn(`Failed to trigger initial build:`, error)
    await this.updateStepProgress(job, 'push_template', 95, '镜像构建触发失败（可手动触发）')
  }
}
```

#### 3. 更新 GitHub Actions Workflow

确保 workflow 支持 `workflow_dispatch`:

```yaml
# .github/workflows/build-project-image.yml
on:
  push:
    branches: [main, master]
    paths-ignore:
      - '**.md'
      - 'docs/**'
  workflow_dispatch:  # 支持 API 触发
    inputs:
      project_slug:
        description: 'Project slug'
        required: true
        type: string
      tag:
        description: 'Image tag'
        required: false
        default: 'latest'
        type: string
```

### 完整流程

```
1. 用户创建项目
   ↓
2. 创建 Git 仓库
   ↓
3. 推送模板代码
   ↓
4. 调用 GitHub API 触发 workflow ✨
   ↓
5. GitHub Actions 开始构建镜像
   ↓ (2-5 分钟)
6. 镜像推送到 ghcr.io
   ↓
7. Flux 检测到新镜像
   ↓ (1-5 分钟)
8. K8s 部署 Pod
   ↓
9. 完成 ✅
```

**总耗时**: 3-10 分钟（全自动）

### 用户体验

**优化前**:
```
创建项目 → 等待 → ImagePullBackOff → 手动触发 → 等待 → 成功
```

**优化后**:
```
创建项目 → 等待 3-10 分钟 → 成功 ✅
```

## 错误处理

### 触发失败

**原因**:
- GitHub Token 权限不足
- Workflow 文件不存在
- 网络问题

**处理**:
```typescript
try {
  await this.gitProvider.triggerWorkflow(...)
} catch (error) {
  // 记录错误但不抛出
  this.logger.warn(`Failed to trigger initial build:`, error)
  
  // 在前端显示提示
  await this.updateStepProgress(
    job,
    'push_template',
    95,
    '镜像构建触发失败，请手动触发或等待代码推送'
  )
}
```

### 构建失败

**监控**:
```typescript
// 可选：轮询 GitHub Actions 状态
const runId = await this.gitProvider.getLatestWorkflowRun(...)
const status = await this.gitProvider.getWorkflowRunStatus(runId)

if (status === 'failure') {
  this.logger.error(`Initial build failed for ${project.slug}`)
  // 发送通知
}
```

## 权限要求

### GitHub Token

需要以下权限：
- ✅ `repo` - 访问仓库
- ✅ `workflow` - 触发 workflow
- ✅ `write:packages` - 推送镜像

### 配置

```bash
# .env
GITHUB_PACKAGES_TOKEN=ghp_...  # 需要包含 workflow 权限
```

## 监控和通知

### 前端显示

```vue
<template>
  <div v-if="project.status === 'initializing'">
    <Progress :value="progress" />
    <p>{{ currentStep }}</p>
    
    <!-- 镜像构建状态 -->
    <div v-if="buildStatus">
      <Badge :variant="buildStatus.status">
        {{ buildStatus.message }}
      </Badge>
      <a :href="buildStatus.url" target="_blank">
        查看构建日志
      </a>
    </div>
  </div>
</template>
```

### 后端通知

```typescript
// 构建完成后发送通知
await this.notificationService.send({
  userId,
  type: 'project_ready',
  title: '项目已就绪',
  message: `项目 ${project.name} 已成功部署`,
  link: `/projects/${project.id}`,
})
```

## 最佳实践

### 1. 异步触发

不要等待构建完成，立即返回：
```typescript
// ✅ 好
await this.gitProvider.triggerWorkflow(...)
// 立即继续下一步

// ❌ 坏
await this.gitProvider.triggerWorkflow(...)
await this.waitForBuildComplete()  // 阻塞 5 分钟
```

### 2. 错误容忍

触发失败不应阻止项目创建：
```typescript
try {
  await this.gitProvider.triggerWorkflow(...)
} catch (error) {
  // 记录但不抛出
  this.logger.warn(error)
}
```

### 3. 用户提示

在前端显示构建状态：
```
✅ 项目创建成功
⏳ 镜像正在构建中（预计 3-5 分钟）
📦 构建完成，正在部署...
✅ 部署成功！
```

### 4. 降级方案

如果自动触发失败，提供手动选项：
```
⚠️  自动构建触发失败
💡 请手动触发构建或推送代码
🔗 [手动触发] [查看文档]
```

## 总结

通过 GitHub API 自动触发首次镜像构建，实现真正的全自动化项目创建流程：

**关键改进**:
- ✅ 零人工介入
- ✅ 3-10 分钟完成
- ✅ 用户体验极佳
- ✅ 符合现代化 DevOps

**下一步**:
1. 实现 `triggerWorkflow` 方法
2. 在项目初始化中调用
3. 添加前端状态显示
4. 测试完整流程
