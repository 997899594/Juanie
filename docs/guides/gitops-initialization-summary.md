# GitOps 资源初始化 - 问题解决总结

## 🎯 问题描述

在项目初始化过程中，GitOps 资源（GitRepository、Kustomization）一直处于 `pending` 状态，没有在 K8s 集群中创建实际的资源。

### 根本原因

之前的实现只在数据库中创建了 `gitops_resources` 记录，但没有调用 K8s API 创建实际的资源对象。

## ✅ 解决方案

修改项目初始化 Worker，在初始化阶段直接创建完整的 K8s 资源栈。

### 核心改动

**文件**: `packages/core/queue/src/workers/project-initialization.worker.ts`

**改动内容**:

1. **动态导入服务**
   ```typescript
   const { FluxResourcesService, K3sService, YamlGeneratorService, FluxMetricsService } =
     await import('@juanie/service-business')
   const { EventEmitter2 } = await import('@nestjs/event-emitter')
   ```

2. **创建服务实例**
   ```typescript
   const eventEmitter = new EventEmitter2()
   const k3sService = new K3sService(this.config as any, eventEmitter)
   await k3sService.onModuleInit()
   
   const yamlGenerator = new YamlGeneratorService()
   const metricsService = new FluxMetricsService()
   const fluxResources = new FluxResourcesService(
     this.db,
     this.config as any,
     k3sService,
     yamlGenerator,
     metricsService,
   )
   ```

3. **调用 setupProjectGitOps**
   ```typescript
   const result = await fluxResources.setupProjectGitOps({
     projectId,
     repositoryId,
     repositoryUrl: repository.cloneUrl,
     repositoryBranch: repository.defaultBranch || 'main',
     accessToken,
     environments: environments.map((env) => ({
       id: env.id,
       type: env.type as 'development' | 'staging' | 'production',
       name: env.name,
     })),
   })
   ```

## 📋 创建的资源

对于每个环境（development、staging、production），系统会创建：

### 1. Kubernetes Namespace
```
project-{projectId}-development
project-{projectId}-staging
project-{projectId}-production
```

### 2. Git 认证 Secret
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: {projectId}-git-auth
  namespace: project-{projectId}-{env}
type: Opaque
data:
  username: Z2l0  # base64("git")
  password: {base64(accessToken)}
```

### 3. Flux GitRepository
```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: {projectId}-repo
  namespace: project-{projectId}-{env}
spec:
  url: {repositoryUrl}
  ref:
    branch: {defaultBranch}
  secretRef:
    name: {projectId}-git-auth
  interval: 1m
```

### 4. Flux Kustomization
```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: {projectId}-{env}
  namespace: project-{projectId}-{env}
spec:
  sourceRef:
    kind: GitRepository
    name: {projectId}-repo
  path: ./k8s/overlays/{env}
  prune: true
  interval: 5m
  timeout: 2m
```

## 🔍 验证方法

### 1. 查看 K8s 资源

```bash
# 设置 kubeconfig
export KUBECONFIG=~/.kube/k3s-remote.yaml

# 查看所有项目 namespace
kubectl get namespaces | grep project-

# 查看 GitRepository 资源
kubectl get gitrepositories -A

# 查看 Kustomization 资源
kubectl get kustomizations -A

# 查看特定项目的资源详情
PROJECT_ID="your-project-id"
kubectl get all,gitrepositories,kustomizations -n project-${PROJECT_ID}-development
```

### 2. 检查资源状态

```bash
# 查看 GitRepository 状态
kubectl describe gitrepository {projectId}-repo -n project-{projectId}-development

# 查看 Kustomization 状态
kubectl describe kustomization {projectId}-development -n project-{projectId}-development

# 查看 Flux 事件
kubectl get events -n project-{projectId}-development --sort-by='.lastTimestamp'
```

### 3. 查看数据库记录

```sql
SELECT 
  id,
  project_id,
  environment_id,
  type,
  name,
  namespace,
  status,
  error_message,
  created_at,
  updated_at
FROM gitops_resources
WHERE project_id = 'your-project-id'
ORDER BY created_at DESC;
```

## 📊 初始化流程

```
1. 创建项目 (0-10%)
   └─ 数据库记录创建

2. 加载模板 (10-20%)
   └─ 读取模板配置

3. 创建环境 (20-30%)
   └─ development, staging, production

4. 创建 Git 仓库 (30-40%)
   └─ GitHub/GitLab API 调用

5. 推送模板代码 (40-60%)
   └─ Git Tree API 批量提交

6. 创建数据库记录 (60-70%)
   └─ repositories 表

7. 创建 GitOps 资源 (70-90%) ⭐ 新增
   ├─ 检查 K3s 连接
   ├─ 获取 OAuth 令牌
   ├─ 为每个环境创建:
   │   ├─ Namespace
   │   ├─ Git Secret
   │   ├─ GitRepository
   │   └─ Kustomization
   └─ 更新数据库状态

8. 更新项目状态 (90-100%)
   └─ status: 'active'
```

## ⚠️ 前置条件

### 1. K3s 集群已连接
```bash
# 检查环境变量
echo $K3S_KUBECONFIG_PATH

# 测试连接
kubectl get nodes
```

### 2. Flux 已安装
```bash
# 检查 Flux controllers
kubectl get pods -n flux-system

# 应该看到:
# - source-controller
# - kustomize-controller
# - helm-controller
# - notification-controller
```

### 3. OAuth 令牌可用
- 用户已在"设置 > 账户连接"中连接 GitHub 或 GitLab
- OAuth 令牌状态为 `active`

## 🐛 故障排查

### 问题 1: K3s 未连接

**日志**: `⚠️ K3s 未连接，跳过 GitOps 资源创建`

**解决**:
```bash
# 检查 kubeconfig
cat ~/.kube/k3s-remote.yaml

# 测试连接
kubectl --kubeconfig ~/.kube/k3s-remote.yaml get nodes

# 检查环境变量
grep K3S_KUBECONFIG_PATH .env
```

### 问题 2: 无有效的访问令牌

**日志**: `⚠️ GitOps 资源创建已跳过（无有效的访问令牌）`

**解决**:
1. 登录系统
2. 前往"设置 > 账户连接"
3. 点击"连接 GitHub" 或 "连接 GitLab"
4. 完成 OAuth 授权流程

### 问题 3: GitOps 资源创建失败

**日志**: `❌ GitOps 资源创建失败: ...`

**排查步骤**:
```bash
# 1. 检查 Flux 状态
kubectl get pods -n flux-system

# 2. 查看 Flux 日志
kubectl logs -n flux-system deployment/source-controller
kubectl logs -n flux-system deployment/kustomize-controller

# 3. 检查 CRD 是否安装
kubectl get crd | grep flux

# 4. 验证 RBAC 权限
kubectl auth can-i create gitrepositories --all-namespaces
kubectl auth can-i create kustomizations --all-namespaces
```

## 🧪 测试新项目

1. **准备环境**
   ```bash
   # 确保 K3s 运行
   kubectl get nodes
   
   # 确保 Flux 运行
   kubectl get pods -n flux-system
   ```

2. **连接 OAuth**
   - 登录系统
   - 前往"设置 > 账户连接"
   - 连接 GitHub 或 GitLab

3. **创建项目**
   - 点击"新建项目"
   - 选择模板（如 Next.js 15）
   - 配置仓库信息
   - 点击"创建"

4. **观察进度**
   - 查看初始化进度条
   - 注意 "🚀 开始创建 GitOps 资源..." 消息
   - 等待 "✅ GitOps 资源创建成功" 消息

5. **验证结果**
   ```bash
   # 查看创建的资源
   kubectl get namespaces | grep project-
   kubectl get gitrepositories -A
   kubectl get kustomizations -A
   ```

## 📈 性能优化

当前实现已经优化：

1. **并行创建**: 使用 `Promise.allSettled` 并行创建多个环境的资源
2. **批量提交**: Git 代码推送使用 Tree API 一次性提交所有文件
3. **Server-Side Apply**: K8s 资源使用 SSA 实现幂等性
4. **错误隔离**: 单个环境失败不影响其他环境

## 🔄 后续改进

1. **重试机制**: 失败时自动重试
2. **状态同步**: 定期同步 K8s 资源状态到数据库
3. **健康检查**: 定期检查资源健康状态
4. **手动触发**: 提供 API 端点手动创建/修复资源

## 📚 相关文档

- [GitOps 资源初始化修复指南](./gitops-initialization-fix.md)
- [Flux 安装指南](./flux-installation.md)
- [K3s 远程访问配置](./k3s-remote-access.md)
- [部署测试指南](./deployment-test.md)
