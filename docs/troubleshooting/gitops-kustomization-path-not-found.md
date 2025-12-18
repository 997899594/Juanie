# GitOps Kustomization Path Not Found

## 问题描述

项目创建成功后，GitOps 资源一直处于 `reconciling` 状态，Kustomization 报错：

```
kustomization path not found: stat /tmp/kustomization-*/k8s/overlays/development: no such file or directory
```

## 根本原因

发现了**两个独立的 bug**：

### Bug 1: 异步队列依赖临时文件（已修复）

在项目初始化的异步队列流程中：
1. **同步流程**会将模板渲染到 `/tmp/projects/${projectId}` 目录
2. **异步队列任务**期望从该目录读取文件并推送到 Git 仓库
3. 但队列任务执行时，`/tmp` 目录可能不存在或已被清理
4. 导致推送失败或推送空文件列表

### Bug 2: 模板目录名与代码不一致（新发现，已修复）

**问题**：
- 模板文件使用短名：`k8s/overlays/dev`, `k8s/overlays/prod`
- 代码期望完整名：`k8s/overlays/development`, `k8s/overlays/production`
- Flux Kustomization 配置的路径是完整名，但仓库里是短名
- 导致 Flux 找不到路径：`kustomization path not found`

**影响**：
- 即使 Bug 1 修复后，使用模板创建的项目仍然会失败
- 只有使用 `pushInitialCode` 创建的项目才能正常工作

## 解决方案

### 修复 Bug 1: 直接在 worker 中推送默认代码

不依赖同步流程的模板渲染：

### 修改文件

`packages/services/business/src/queue/project-initialization.worker.ts`

**修改前**：
```typescript
// 步骤 2: 推送模板代码
const templateOutputDir = `/tmp/projects/${projectId}`
await this.pushRenderedTemplate(
  job,
  resolvedRepository.provider,
  resolvedRepository.accessToken,
  repoInfo,
  templateOutputDir,
)
```

**修改后**：
```typescript
// 步骤 2: 推送模板代码
// 直接推送默认代码（包含 k8s 配置），不依赖模板渲染
await this.pushInitialCode(
  job,
  resolvedRepository.provider,
  resolvedRepository.accessToken,
  repoInfo,
)
```

### 删除的方法

- `pushRenderedTemplate()` - 不再需要从 `/tmp` 读取文件
- `getDefaultK8sFiles()` - k8s 文件已内联到 `pushInitialCode()`

### 更新的方法

`pushInitialCode()` 现在：
1. 包含完整的 k8s 目录结构（base + overlays）
2. 添加进度更新
3. 作为主要推送方法，而不是后备方案

---

### 修复 Bug 2: 统一模板目录名

**修改的文件**：

1. **重命名模板目录**：
```bash
mv templates/nextjs-15-app/k8s/overlays/dev templates/nextjs-15-app/k8s/overlays/development
mv templates/nextjs-15-app/k8s/overlays/prod templates/nextjs-15-app/k8s/overlays/production
```

2. **添加 staging 环境**：
```bash
mkdir -p templates/nextjs-15-app/k8s/overlays/staging
```

3. **更新文档引用**：
- `templates/nextjs-15-app/TEMPLATE_SUMMARY.md`
- `templates/nextjs-15-app/README.md`
- `.kiro/specs/gitops-integration/design.md`

**原则**：
- 统一使用完整环境名：`development`, `staging`, `production`
- 不使用缩写：~~`dev`~~, ~~`prod`~~
- 保持代码、模板、文档的一致性

## 验证

创建新项目后，检查：

1. **Git 仓库包含 k8s 目录**：
```bash
# 检查仓库内容
curl -H "Authorization: token $GITHUB_TOKEN" \
  https://api.github.com/repos/USER/REPO/contents/k8s
```

2. **Kustomization 状态正常**：
```bash
kubectl --kubeconfig ~/.kube/k3s-remote.yaml \
  get kustomizations -n project-${PROJECT_ID}-development
```

应该看到 `READY=True` 或具体的错误信息（不再是 path not found）

## 相关文件

- `packages/services/business/src/queue/project-initialization.worker.ts` - 队列任务处理
- `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts` - 模板渲染（同步流程）
- `packages/services/business/src/gitops/flux/flux-resources.service.ts` - GitOps 资源创建

## 教训

1. **异步任务不应依赖临时文件** - `/tmp` 目录不可靠
2. **后备方案应该是主要方案** - 如果后备方案总是有效，就应该作为默认方案
3. **关注点分离** - 队列任务应该自包含，不依赖外部状态
