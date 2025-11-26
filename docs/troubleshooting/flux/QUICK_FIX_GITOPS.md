# GitOps 资源 Pending 问题 - 快速修复指南

## 🎯 问题
项目初始化后，GitOps 资源状态一直是 `pending`，K8s 集群中没有实际资源。

## ✅ 已修复
修改了项目初始化流程，现在会在初始化时直接创建 K8s 资源。

## 📝 修改的文件
1. `packages/core/queue/src/workers/project-initialization.worker.ts` - 初始化 Worker
2. `packages/services/business/src/index.ts` - 导出必要的服务
3. `apps/api-gateway/src/routers/gitops.router.ts` - API 路由

## 🚀 测试新项目

### 前置条件
```bash
# 1. 确保 K3s 运行
export KUBECONFIG=~/.kube/k3s-remote.yaml
kubectl get nodes

# 2. 确保 Flux 运行
kubectl get pods -n flux-system
```

### 创建测试项目
1. 登录系统
2. 前往"设置 > 账户连接"，连接 GitHub/GitLab
3. 创建新项目，选择模板
4. 观察初始化进度，应该看到：
   - "🚀 开始创建 GitOps 资源..."
   - "✅ GitOps 资源创建成功: X 个命名空间, Y 个 GitRepository, Z 个 Kustomization"

### 验证结果
```bash
# 查看创建的资源
kubectl get namespaces | grep project-
kubectl get gitrepositories -A
kubectl get kustomizations -A
```

## 🔍 故障排查

### K3s 未连接
```bash
# 检查配置
echo $K3S_KUBECONFIG_PATH
kubectl get nodes

# 如果失败，检查 .env 文件
grep K3S_KUBECONFIG_PATH .env
```

### 无访问令牌
- 前往"设置 > 账户连接"
- 连接 GitHub 或 GitLab 账户

### 资源创建失败
```bash
# 查看 Flux 日志
kubectl logs -n flux-system deployment/source-controller
kubectl logs -n flux-system deployment/kustomize-controller
```

## 📊 预期结果

每个项目会创建 3 个环境（development、staging、production），每个环境包含：
- 1 个 Namespace
- 1 个 Secret（Git 认证）
- 1 个 GitRepository
- 1 个 Kustomization

总共：3 个 namespace，3 个 GitRepository，3 个 Kustomization

## 📚 详细文档
- [完整修复指南](./gitops-initialization-fix.md)
- [详细总结](./gitops-initialization-summary.md)
