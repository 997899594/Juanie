# 完整流程分析和解决方案

## ✅ 好消息

### 1. TemplateRenderer 完全支持

**发现**:
- ✅ 使用 Handlebars 模板引擎
- ✅ 支持 `{{ variable }}` 语法
- ✅ **会渲染 `.github` 目录**（不在 ignorePatterns 中）
- ✅ 递归处理所有目录和文件
- ✅ 自动处理文本文件渲染

**ignorePatterns**:
```typescript
private readonly ignorePatterns = [
  'node_modules',
  '.git',           // 只忽略 .git，不忽略 .github
  '.DS_Store',
  'dist',
  'build',
  '.next',
  '.turbo',
  'coverage',
]
```

**结论**: `.github/workflows/build-project-image.yml` 会被正确渲染！

---

## ⚠️ 发现的问题

### 问题 1: 镜像名称不一致 🔴

**当前状态**:

**Worker 传递的变量**:
```typescript
// packages/services/business/src/queue/project-initialization.worker.ts
const templateVariables = {
  appName: project.slug,        // ✅ 用于 K8s
  projectSlug: project.slug,    // ❌ Workflow 需要但可能没传
  registry: 'ghcr.io',          // ❌ 可能没传
}
```

**Workflow 需要**:
```yaml
env:
  REGISTRY: {{ registry }}           # ❌ 如果没传，会是空的
  PROJECT_SLUG: {{ projectSlug }}    # ❌ 如果没传，会是空的
```

**K8s Deployment 需要**:
```yaml
image: {{ registry }}/997899594/{{ appName }}:latest
```

**问题**: 
- Worker 可能没有传递 `registry` 和 `projectSlug`
- 导致 Workflow 中的环境变量为空
- 镜像名称不匹配

---

### 问题 2: Development 副本数为 0 🔴

**当前配置**:
```yaml
# templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml
spec:
  replicas: 0  # ❌ 默认 0 副本
```

**影响**:
- 即使镜像存在，Pod 也不会启动
- 用户看到 "0/0 Ready"，以为失败了

---

### 问题 3: triggerWorkflow 可能失败 🟡

**原因**:
1. Workflow 文件刚推送，GitHub 可能还没识别
2. 用户 Token 可能没有 `workflow` 权限
3. 即使触发成功，也是多余的（push 会自动触发）

**当前代码**:
```typescript
// 推送代码后立即触发
await this.gitProvider.triggerWorkflow(...)
```

**问题**: 
- 如果失败，只记录警告，不影响项目创建
- 但用户会看到 "镜像构建触发失败" 的提示

---

## 🎯 完整解决方案

### 修复 1: 确保传递所有必需变量

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

**当前代码** (约 line 310):
```typescript
const templateVariables = {
  // 项目信息
  projectId: project.id,
  projectName: project.name,
  projectSlug: project.slug,
  description: project.description || `${project.name} - AI DevOps Platform`,

  // K8s 配置
  appName: project.slug,
  registry: this.config.get('REGISTRY_URL') || 'registry.example.com',
  port: 3000,
  domain: this.config.get('APP_DOMAIN') || 'example.com',
  replicas: 1,
  // ...
}
```

**需要确认**: `registry` 是否正确传递

---

### 修复 2: 修改 Development 副本数

**文件**: `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml`

**修改**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dev-project
spec:
  replicas: 1  # 改为 1，方便测试
```

---

### 修复 3: 删除 triggerWorkflow 调用（推荐）

**原因**:
- Push 事件会自动触发 Workflow
- 不需要额外的 API 调用
- 避免权限问题

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

**删除这段代码** (约 line 362-380):
```typescript
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
    },
  )

  await this.updateStepProgress(job, 'push_template', 95, '镜像构建已触发')
  this.logger.info(`✅ Triggered initial build for ${project.slug}`)
} catch (error) {
  // 触发失败不应阻止项目创建
  this.logger.warn(`Failed to trigger initial build:`, error)
  await this.updateStepProgress(
    job,
    'push_template',
    95,
    '镜像构建触发失败（可手动触发）',
  )
}
```

**替换为**:
```typescript
await this.updateStepProgress(
  job,
  'push_template',
  95,
  '代码推送完成，镜像构建将自动开始（约 3-5 分钟）',
)
```

---

## 📝 完整修改清单

### 1. 检查模板变量传递

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

**检查点** (约 line 310):
```typescript
const templateVariables = {
  projectSlug: project.slug,    // ✅ 确保存在
  registry: this.config.get('REGISTRY_URL') || 'ghcr.io',  // ✅ 确保存在
  appName: project.slug,        // ✅ 确保存在
  // ...
}
```

---

### 2. 修改 Development 副本数

**文件**: `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml`

**修改**:
```yaml
spec:
  replicas: 1  # 从 0 改为 1
```

---

### 3. 简化推送流程（删除 triggerWorkflow）

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

**修改** (约 line 362):
```typescript
await this.updateStepProgress(job, 'push_template', 80, `成功推送 ${files.length} 个文件`)

// 删除 triggerWorkflow 调用
await this.updateStepProgress(
  job,
  'push_template',
  95,
  '代码推送完成，镜像构建将自动开始（约 3-5 分钟）',
)
```

---

## 🔄 完整流程（修复后）

```
1. 用户创建项目
   ↓
2. 创建 Git 仓库
   ↓
3. 渲染模板（包含 .github/workflows/）
   - ✅ registry = ghcr.io
   - ✅ projectSlug = project-xxx
   - ✅ appName = project-xxx
   ↓
4. 推送所有文件到 Git
   - ✅ 包含 .github/workflows/build-project-image.yml
   - ✅ Workflow 中的变量已正确替换
   ↓
5. GitHub 自动触发 Workflow（push 事件）
   - ⏱️ 通常在 10-30 秒内开始
   ↓
6. GitHub Actions 构建镜像（2-5 分钟）
   - 构建 Docker 镜像
   - 推送到 ghcr.io/997899594/project-xxx:latest
   ↓
7. 创建 GitOps 资源
   - Namespace
   - GitRepository
   - Kustomization
   - ImagePullSecret
   ↓
8. Flux 检测到新镜像（1-5 分钟）
   - 自动更新 Deployment
   ↓
9. K8s 部署 Pod
   - Development: 1 副本 ✅
   - Staging: 0 副本
   - Production: 1 副本
   ↓
10. 完成 ✅
```

**总耗时**: 3-10 分钟（全自动）

---

## 🎯 为什么这样更好

### 1. 依赖 Push 事件（不手动触发）

**优点**:
- ✅ 简单可靠
- ✅ 不需要 `workflow` 权限
- ✅ GitHub 自动处理
- ✅ 不会因为时序问题失败

**缺点**:
- ⏱️ 需要等待 10-30 秒 GitHub 识别 workflow（可接受）

---

### 2. Development 副本数为 1

**优点**:
- ✅ 用户可以立即看到 Pod 启动
- ✅ 方便测试和调试
- ✅ 资源占用很小（64Mi）

**缺点**:
- 📊 多占用一点资源（可接受）

---

## 📊 资源影响分析

### 当前配置（修改后）

**Development**:
- 副本数: 1
- 内存: 64Mi request, 128Mi limit
- CPU: 50m request, 200m limit

**Staging**:
- 副本数: 0（按需启动）
- 内存: 64Mi request, 128Mi limit
- CPU: 50m request, 200m limit

**Production**:
- 副本数: 1
- 内存: 128Mi request, 256Mi limit
- CPU: 100m request, 500m limit

**总资源（每个项目）**:
- Development: 64Mi + 50m
- Production: 128Mi + 100m
- **总计**: 192Mi + 150m

**集群容量**:
- 可用内存: 约 5Gi
- 可支持项目数: 5Gi / 192Mi ≈ **26 个项目**

---

## ✅ 验证清单

### 创建新项目后检查

1. **GitHub 仓库**
   ```bash
   # 检查 workflow 文件是否存在
   curl -H "Authorization: Bearer $TOKEN" \
     "https://api.github.com/repos/997899594/PROJECT/contents/.github/workflows"
   
   # 应该看到 build-project-image.yml
   ```

2. **Workflow 内容**
   ```bash
   # 检查变量是否正确替换
   curl -H "Authorization: Bearer $TOKEN" \
     "https://api.github.com/repos/997899594/PROJECT/contents/.github/workflows/build-project-image.yml" \
     | jq -r '.content' | base64 -d
   
   # 应该看到:
   # REGISTRY: ghcr.io
   # PROJECT_SLUG: project-xxx
   ```

3. **GitHub Actions**
   ```bash
   # 等待 30 秒后检查
   curl -H "Authorization: Bearer $TOKEN" \
     "https://api.github.com/repos/997899594/PROJECT/actions/runs"
   
   # 应该看到一个 running 或 completed 的 workflow
   ```

4. **镜像**
   ```bash
   # 等待 3-5 分钟后检查
   docker pull ghcr.io/997899594/project-xxx:latest
   
   # 应该成功拉取
   ```

5. **K8s 资源**
   ```bash
   export KUBECONFIG=.kube/k3s-remote.yaml
   
   # 检查 Namespace
   kubectl get ns | grep project-xxx
   
   # 检查 GitRepository
   kubectl get gitrepository -n project-xxx-development
   
   # 检查 Kustomization
   kubectl get kustomization -n project-xxx-development
   
   # 检查 Deployment
   kubectl get deployment -n project-xxx-development
   # 应该看到 1/1 Ready
   
   # 检查 Pod
   kubectl get pods -n project-xxx-development
   # 应该看到 Running 状态
   ```

---

## 🚀 立即执行的修改

我现在就帮你修改这些文件！
