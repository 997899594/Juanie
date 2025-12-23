# 完整流程自检分析

## 🔍 流程概览

```
用户创建项目
    ↓
1. 创建 Git 仓库
    ↓
2. 推送模板代码（包含 .github/workflows/）
    ↓
3. 调用 GitHub API 触发 workflow
    ↓
4. GitHub Actions 构建镜像
    ↓
5. 推送镜像到 ghcr.io
    ↓
6. 创建 GitOps 资源（Namespace, GitRepository, Kustomization）
    ↓
7. Flux 检测到新镜像
    ↓
8. K8s 部署 Pod
    ↓
9. 完成 ✅
```

## 📋 详细检查清单

### ✅ 步骤 1: 模板文件检查

**检查项**: 模板是否包含所有必需文件

**关键文件**:
- `templates/nextjs-15-app/.github/workflows/build-project-image.yml` ✅ 已添加
- `templates/nextjs-15-app/Dockerfile` ✅ 存在
- `templates/nextjs-15-app/k8s/` ✅ 存在

**模板变量**:
```typescript
{
  projectSlug: 'project-xxx',      // 用于镜像名称
  registry: 'ghcr.io',             // 镜像仓库
  // ... 其他变量
}
```

**问题**: Workflow 文件使用了 Handlebars 语法 `{{ registry }}`，但需要确认模板渲染器支持

---

### ⚠️ 步骤 2: 模板渲染检查

**检查项**: TemplateRenderer 是否正确渲染 workflow 文件

**代码位置**: `packages/services/business/src/projects/template-renderer.service.ts`

**需要验证**:
1. 是否会渲染 `.github/workflows/` 目录下的文件？
2. 是否支持 `{{ variable }}` 语法？
3. 是否会忽略 `.github` 目录？

**潜在问题**: 
- 如果使用 `.gitignore` 过滤，可能会忽略 `.github` 目录
- 需要确认模板引擎（Handlebars/Mustache/其他）

---

### ⚠️ 步骤 3: 文件推送检查

**检查项**: pushFiles 是否推送了 workflow 文件

**代码位置**: `packages/services/business/src/gitops/git-providers/git-provider.service.ts`

**关键代码**:
```typescript
async pushFiles(
  provider: 'github' | 'gitlab',
  accessToken: string,
  fullName: string,
  files: Array<{ path: string; content: string }>,  // 需要包含 .github/workflows/build-project-image.yml
  branch: string,
  commitMessage: string,
): Promise<void>
```

**需要验证**:
- `files` 数组是否包含 `.github/workflows/build-project-image.yml`
- 文件内容是否正确渲染（变量已替换）

---

### ⚠️ 步骤 4: Workflow 触发检查

**检查项**: triggerWorkflow 是否正确调用

**代码位置**: `packages/services/business/src/queue/project-initialization.worker.ts`

**关键代码**:
```typescript
await this.gitProvider.triggerWorkflow(
  provider,
  accessToken,
  repoInfo.fullName,
  'build-project-image.yml',  // ⚠️ 文件名必须匹配
  {
    ref: repoInfo.defaultBranch,
    inputs: {
      project_slug: project.slug,
      tag: 'latest',
    },
  },
)
```

**潜在问题**:
1. **Workflow 文件不存在**: 如果推送时没有包含 workflow 文件，触发会失败
2. **Token 权限不足**: 需要 `workflow` 权限
3. **Workflow 文件名不匹配**: API 需要精确的文件名

---

### ⚠️ 步骤 5: GitHub Actions 权限检查

**检查项**: GITHUB_TOKEN 是否有足够权限

**需要的权限**:
- `contents: read` - 读取代码
- `packages: write` - 推送镜像到 ghcr.io
- `workflow` - 触发 workflow（用户 Token）

**潜在问题**:
- 用户的 OAuth Token 可能没有 `workflow` 权限
- `secrets.GITHUB_TOKEN` 在 Actions 中自动提供，有 `packages: write` 权限

---

### ✅ 步骤 6: Workflow 配置检查

**检查项**: Workflow 文件配置是否正确

**当前配置**:
```yaml
env:
  REGISTRY: {{ registry }}           # ⚠️ 需要渲染为 ghcr.io
  PROJECT_SLUG: {{ projectSlug }}    # ⚠️ 需要渲染为实际 slug

on:
  push:
    branches: [main, master]
    paths-ignore:
      - '**.md'
      - 'docs/**'
      # ✅ 不忽略 .github/**
  workflow_dispatch:
```

**问题**: 
- 如果变量没有正确渲染，workflow 会失败
- 需要确认 `{{ registry }}` 被替换为 `ghcr.io`

---

### ⚠️ 步骤 7: 镜像名称一致性检查

**检查项**: 镜像名称在各处是否一致

**需要一致的地方**:
1. **Workflow**: `ghcr.io/997899594/{{ projectSlug }}:latest`
2. **K8s Deployment**: `ghcr.io/997899594/project-xxx:latest`
3. **模板变量**: `projectSlug` 或 `appName`

**当前问题**:
- Workflow 使用 `{{ projectSlug }}`
- K8s 使用 `{{ appName }}`
- 需要确认两者是否相同

---

### ⚠️ 步骤 8: Development 环境副本数检查

**检查项**: Development 环境默认副本数

**当前配置**: `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml`
```yaml
spec:
  replicas: 0  # ⚠️ 默认 0 副本
```

**影响**:
- 即使镜像存在，Pod 也不会启动
- 需要手动 scale 或修改配置

**建议**: 
- Development 改为 1 副本（用于测试）
- 或者在前端提供 "启动环境" 按钮

---

## 🔧 发现的问题

### 问题 1: 模板变量渲染 ⚠️

**问题**: Workflow 文件使用 `{{ registry }}` 和 `{{ projectSlug }}`，但不确定是否会被渲染

**验证方法**:
```typescript
// 检查 TemplateRenderer 是否支持
const files = await this.templateRenderer.renderTemplateToMemory(
  'nextjs-15-app',
  templateVariables,
)

// 检查是否包含 .github/workflows/build-project-image.yml
const workflowFile = files.find(f => f.path === '.github/workflows/build-project-image.yml')
console.log('Workflow content:', workflowFile?.content)
```

**解决方案**: 需要检查 TemplateRenderer 实现

---

### 问题 2: 镜像名称不一致 ⚠️

**问题**: Workflow 和 K8s 使用的变量名可能不同

**当前状态**:
- Workflow: `{{ projectSlug }}`
- K8s: `{{ appName }}`

**解决方案**: 统一使用 `{{ appName }}` 或确保两者值相同

---

### 问题 3: Development 副本数为 0 ⚠️

**问题**: 即使镜像存在，Pod 也不会启动

**解决方案**:
1. 修改 development 默认副本数为 1
2. 或在文档中说明需要手动启动

---

### 问题 4: Workflow 触发时机 ⚠️

**问题**: 如果 workflow 文件不存在，触发会失败

**当前流程**:
1. 推送模板代码（包含 workflow）
2. 立即触发 workflow

**潜在问题**: 
- GitHub 可能需要几秒钟来识别新的 workflow 文件
- 立即触发可能失败

**解决方案**: 
- 添加延迟（1-2 秒）
- 或者依赖 push 事件自动触发（不手动触发）

---

## 💡 推荐方案

### 方案 A: 依赖 Push 事件（推荐）✅

**优点**:
- 简单可靠
- 不需要额外的 API 调用
- 不需要 workflow 权限

**缺点**:
- 需要等待 GitHub 识别 workflow（通常很快）

**实现**:
```typescript
// 不需要调用 triggerWorkflow
// 推送代码后，GitHub 会自动触发 workflow
await this.pushFilesToRepository(...)
// 完成！
```

**Workflow 配置**:
```yaml
on:
  push:
    branches: [main, master]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

---

### 方案 B: 手动触发 + 延迟

**优点**:
- 可以立即触发
- 可以传递参数

**缺点**:
- 需要 workflow 权限
- 需要处理延迟和重试

**实现**:
```typescript
await this.pushFilesToRepository(...)

// 等待 GitHub 识别 workflow
await new Promise(resolve => setTimeout(resolve, 3000))

// 触发 workflow
try {
  await this.gitProvider.triggerWorkflow(...)
} catch (error) {
  // 失败不阻止项目创建
  this.logger.warn('Failed to trigger workflow:', error)
}
```

---

## 🎯 最终建议

### 1. 采用方案 A（依赖 Push 事件）

**原因**:
- 更简单可靠
- 不需要额外权限
- GitHub 会自动触发

**修改**:
```typescript
// 删除 triggerWorkflow 调用
// await this.gitProvider.triggerWorkflow(...)  // ❌ 删除

// 只需推送代码
await this.pushFilesToRepository(...)
await this.updateStepProgress(job, 'push_template', 95, '代码推送完成，镜像构建将自动开始')
```

---

### 2. 修改 Development 副本数为 1

**文件**: `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml`

```yaml
spec:
  replicas: 1  # 改为 1
```

---

### 3. 统一镜像名称变量

**确保一致**:
```typescript
const templateVariables = {
  appName: project.slug,        // K8s 使用
  projectSlug: project.slug,    // Workflow 使用
  // 或者统一使用一个
}
```

---

### 4. 验证模板渲染

**需要确认**: TemplateRenderer 是否渲染 `.github/workflows/` 目录

---

## 📝 下一步行动

1. ✅ 检查 TemplateRenderer 实现
2. ✅ 修改 Development 副本数为 1
3. ✅ 统一镜像名称变量
4. ✅ 删除 triggerWorkflow 调用（采用方案 A）
5. ✅ 测试完整流程

---

## 🔍 需要检查的代码

1. `packages/services/business/src/projects/template-renderer.service.ts`
   - 是否渲染 `.github` 目录？
   - 使用什么模板引擎？
   - 是否支持 `{{ variable }}` 语法？

2. `packages/services/business/src/queue/project-initialization.worker.ts`
   - `templateVariables` 中 `appName` 和 `projectSlug` 的值
   - 是否需要删除 `triggerWorkflow` 调用

3. `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml`
   - 修改 `replicas: 0` 为 `replicas: 1`
