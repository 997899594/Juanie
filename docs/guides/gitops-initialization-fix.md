# GitOps 资源初始化修复指南

## 问题描述

之前的项目初始化流程中，GitOps 资源（GitRepository、Kustomization）只创建了数据库记录，状态为 `pending`，但没有在 K8s 集群中创建实际的资源。

## 解决方案

修改了 `project-initialization.worker.ts` 中的 `createGitOpsResources` 方法，在初始化时直接调用 `FluxResourcesService.setupProjectGitOps()` 创建完整的 K8s 资源栈。

## 修改内容

### 1. 项目初始化 Worker

**文件**: `packages/core/queue/src/workers/project-initialization.worker.ts`

**改动**:
- 在 `createGitOpsResources` 方法中动态导入 `FluxResourcesService`、`K3sService` 等服务
- 创建服务实例并调用 `setupProjectGitOps()` 方法
- 直接在 K8s 集群中创建 Namespace、GitRepository、Kustomization 资源
- 同时创建数据库记录，状态根据实际创建结果设置

### 2. 服务导出

**文件**: `packages/services/business/src/index.ts`

**改动**:
- 导出 `YamlGeneratorService` 和 `FluxMetricsService`，供 Worker 使用

## 工作流程

```
项目初始化
  ↓
创建 Git 仓库
  ↓
推送模板代码
  ↓
创建数据库记录
  ↓
【新增】创建 GitOps 资源
  ├─ 检查 K3s 连接
  ├─ 获取 OAuth 访问令牌
  ├─ 为每个环境创建:
  │   ├─ Namespace (project-{projectId}-{env})
  │   ├─ Git Secret (认证信息)
  │   ├─ GitRepository (Flux 资源)
  │   └─ Kustomization (Flux 资源)
  └─ 更新数据库状态
  ↓
项目初始化完成
```

## 创建的资源

对于每个环境（development、staging、production），会创建：

1. **Namespace**: `project-{projectId}-{environmentType}`
2. **Secret**: `{projectId}-git-auth` (Git 认证)
3. **GitRepository**: `{projectId}-repo` (Flux GitRepository CRD)
4. **Kustomization**: `{projectId}-{environmentType}` (Flux Kustomization CRD)

## 前置条件

1. **K3s 集群已连接**
   - 环境变量 `K3S_KUBECONFIG_PATH` 已配置
   - K3s 集群可访问

2. **Flux 已安装**
   - Flux controllers 运行在 `flux-system` namespace
   - GitRepository 和 Kustomization CRDs 已安装

3. **OAuth 令牌可用**
   - 用户已连接 GitHub 或 GitLab 账户
   - OAuth 令牌有效且未过期

## 验证方法

### 1. 检查 K8s 资源

```bash
# 设置 kubeconfig
export KUBECONFIG=~/.kube/k3s-remote.yaml

# 查看项目的 namespace
kubectl get namespaces | grep project-

# 查看 GitRepository 资源
kubectl get gitrepositories -A

# 查看 Kustomization 资源
kubectl get kustomizations -A

# 查看特定项目的资源（替换 PROJECT_ID）
kubectl get all -n project-{PROJECT_ID}-development
```

### 2. 检查数据库记录

```sql
-- 查看 GitOps 资源状态
SELECT 
  id,
  project_id,
  type,
  name,
  namespace,
  status,
  created_at
FROM gitops_resources
WHERE project_id = 'YOUR_PROJECT_ID'
ORDER BY created_at DESC;
```

### 3. 查看初始化日志

在项目创建过程中，查看进度消息：
- "🚀 开始创建 GitOps 资源..."
- "✅ GitOps 资源创建成功: X 个命名空间, Y 个 GitRepository, Z 个 Kustomization"

## 故障排查

### 问题 1: K3s 未连接

**症状**: 日志显示 "⚠️ K3s 未连接，跳过 GitOps 资源创建"

**解决**:
```bash
# 检查 kubeconfig 路径
echo $K3S_KUBECONFIG_PATH

# 测试连接
kubectl get nodes

# 检查 Flux 状态
kubectl get pods -n flux-system
```

### 问题 2: 无有效的访问令牌

**症状**: 日志显示 "⚠️ GitOps 资源创建已跳过（无有效的访问令牌）"

**解决**:
1. 前往"设置 > 账户连接"
2. 连接 GitHub 或 GitLab 账户
3. 确保授权成功

### 问题 3: GitOps 资源创建失败

**症状**: 日志显示 "❌ GitOps 资源创建失败: ..."

**解决**:
1. 检查错误信息
2. 验证 Git 仓库 URL 和分支是否正确
3. 确认 K8s 集群有足够权限创建资源
4. 检查 Flux controllers 是否正常运行

## 测试新项目

创建一个新项目来测试修复：

1. 登录系统
2. 确保已连接 GitHub/GitLab 账户
3. 创建新项目，选择模板
4. 观察初始化进度
5. 验证 K8s 资源已创建

## 回滚方案

如果新流程有问题，可以临时禁用 GitOps 资源创建：

在 `createGitOpsResources` 方法开头添加：
```typescript
return false; // 临时禁用
```

## 后续优化

1. **重试机制**: 如果创建失败，自动重试
2. **健康检查**: 定期检查资源状态并同步到数据库
3. **手动触发**: 提供 API 端点手动创建 GitOps 资源
4. **批量修复**: 为已有的 pending 资源提供批量创建功能

## 相关文件

- `packages/core/queue/src/workers/project-initialization.worker.ts`
- `packages/services/business/src/gitops/flux/flux-resources.service.ts`
- `packages/services/business/src/gitops/flux/flux-sync.service.ts`
- `packages/services/business/src/gitops/k3s/k3s.service.ts`
