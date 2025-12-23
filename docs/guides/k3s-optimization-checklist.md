# K3s 资源优化执行清单

## 优化成果

✅ **资源使用降低 75%**: 从 256Mi → 64Mi  
✅ **支持项目数提升 4x**: 从 5 个 → 20-25 个  
✅ **按需启动**: Dev/Staging 默认 0 副本  
✅ **镜像仓库**: GitHub Container Registry（免费）

## 立即执行步骤

### 1. 更新环境变量 ⏱️ 1 分钟

```bash
# 编辑 .env 文件
echo "REGISTRY_URL=ghcr.io" >> .env

# 重启后端
bun run dev:api
```

### 2. 配置 ImagePullSecret ⏱️ 自动

**自动配置** ✅:

新项目创建时会自动配置 ImagePullSecret，使用用户自己的 GitHub Token。

**工作原理**:
- 每个用户使用自己的 GitHub OAuth Token
- 镜像路径自动使用用户的 GitHub 用户名：`ghcr.io/<username>/<project>`
- ImagePullSecret 在项目初始化时自动创建

**验证**:
```bash
kubectl get secret ghcr-secret -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

### 3. 构建项目镜像 ⏱️ 5 分钟

**方式 1: GitHub Actions（推荐）**

1. 进入 GitHub 仓库
2. Actions → "Build Project Image"
3. Run workflow
4. 输入 `project_slug`: `011`
5. 等待构建完成

**方式 2: 本地构建**

```bash
# 登录 GHCR
echo <github-token> | docker login ghcr.io -u 997899594 --password-stdin

# 构建并推送
docker build -t ghcr.io/997899594/011:latest .
docker push ghcr.io/997899594/011:latest
```

### 4. 重新部署项目 ⏱️ 2 分钟

```bash
# 触发 Flux 重新部署
flux reconcile kustomization <project-name>-production -n flux-system --kubeconfig=.kube/k3s-remote.yaml

# 或删除 Pod 让 K8s 重建
kubectl delete pod -l app=<project-slug> -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

### 5. 验证部署 ⏱️ 3 分钟

```bash
# 检查集群资源
./scripts/check-k3s-resources.sh

# 检查 Pod 状态
kubectl get pods -A --kubeconfig=.kube/k3s-remote.yaml | grep project-

# 检查 Pod 资源使用
kubectl top pods -A --kubeconfig=.kube/k3s-remote.yaml | grep project-
```

**预期结果**:
- ✅ Pod 状态: Running
- ✅ 内存使用: 60-80Mi（实际）
- ✅ 内存请求: 64-128Mi（配置）
- ✅ 无 ImagePullBackOff 错误

## 日常操作

### 启动 Dev 环境

```bash
# 启动
kubectl scale deployment dev-<project-slug> --replicas=1 \
  -n project-<project-id>-development \
  --kubeconfig=.kube/k3s-remote.yaml

# 检查状态
kubectl get pods -n project-<project-id>-development --kubeconfig=.kube/k3s-remote.yaml

# 查看日志
kubectl logs -f deployment/dev-<project-slug> \
  -n project-<project-id>-development \
  --kubeconfig=.kube/k3s-remote.yaml
```

### 停止 Dev 环境

```bash
kubectl scale deployment dev-<project-slug> --replicas=0 \
  -n project-<project-id>-development \
  --kubeconfig=.kube/k3s-remote.yaml
```

### 批量停止所有 Dev 环境

```bash
kubectl get deployments -A --kubeconfig=.kube/k3s-remote.yaml | \
  grep "project-.*-development" | \
  awk '{print $2 " -n " $1}' | \
  xargs -I {} kubectl scale deployment {} --replicas=0 --kubeconfig=.kube/k3s-remote.yaml
```

### 检查资源使用

```bash
# 快速检查
./scripts/check-k3s-resources.sh

# 详细检查
kubectl top nodes --kubeconfig=.kube/k3s-remote.yaml
kubectl top pods -A --kubeconfig=.kube/k3s-remote.yaml
```

## 故障排查

### 问题 1: ImagePullBackOff

**症状**: Pod 状态显示 `ImagePullBackOff`

**原因**: 
- 用户的 GitHub Token 过期或无效
- 镜像不存在
- 镜像路径错误

**解决**:
```bash
# 1. 检查 secret
kubectl get secret ghcr-secret -n <namespace> --kubeconfig=.kube/k3s-remote.yaml

# 2. 检查镜像路径是否正确（应该是用户的 GitHub 用户名）
kubectl get deployment <deployment-name> -n <namespace> -o yaml --kubeconfig=.kube/k3s-remote.yaml | grep image:

# 3. 让用户重新连接 GitHub（刷新 Token）
# 在前端: Settings → Git Connections → Reconnect GitHub

# 4. 重新初始化项目（会重新创建 ImagePullSecret）
# 或手动重启 Pod
kubectl rollout restart deployment <deployment-name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml
```

### 问题 2: Pending (资源不足)

**症状**: Pod 状态显示 `Pending`，Events 显示 `Insufficient memory`

**原因**: 集群内存不足

**解决**:
```bash
# 1. 停止不使用的 dev/staging 环境
kubectl get deployments -A --kubeconfig=.kube/k3s-remote.yaml | grep development
kubectl scale deployment <name> --replicas=0 -n <namespace> --kubeconfig=.kube/k3s-remote.yaml

# 2. 删除失败的项目
kubectl delete ns <failed-namespace> --kubeconfig=.kube/k3s-remote.yaml

# 3. 检查资源使用
./scripts/check-k3s-resources.sh
```

### 问题 3: CrashLoopBackOff

**症状**: Pod 反复重启

**原因**: 应用启动失败

**解决**:
```bash
# 1. 查看日志
kubectl logs <pod-name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml

# 2. 查看详细信息
kubectl describe pod <pod-name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml

# 3. 检查环境变量
kubectl get deployment <deployment-name> -n <namespace> -o yaml --kubeconfig=.kube/k3s-remote.yaml | grep -A 10 env:
```

### 问题 4: GitRepository 失败

**症状**: `flux get sources git` 显示 `False`

**原因**: 仓库不存在或访问权限不足

**解决**:
```bash
# 1. 检查 GitRepository
kubectl get gitrepositories -A --kubeconfig=.kube/k3s-remote.yaml

# 2. 查看详细错误
kubectl describe gitrepository <name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml

# 3. 删除失败的项目
kubectl delete ns <namespace> --kubeconfig=.kube/k3s-remote.yaml
```

## 监控指标

### 健康指标

- ✅ **Pod Running 率**: > 90%
- ✅ **内存使用率**: < 80%
- ✅ **Pending Pods**: 0
- ✅ **Failed Pods**: 0
- ✅ **GitRepository 成功率**: 100%

### 检查命令

```bash
# 每日检查
./scripts/check-k3s-resources.sh

# 每周清理
kubectl get ns --kubeconfig=.kube/k3s-remote.yaml | grep project- | \
  awk '{print $1}' | \
  xargs -I {} kubectl get pods -n {} --kubeconfig=.kube/k3s-remote.yaml
```

## 成本分析

### 当前配置（3.6GB 集群）

| 环境 | 内存请求 | 副本数 | 总内存 |
|------|---------|--------|--------|
| Development | 64Mi | 0 | 0 |
| Staging | 96Mi | 0 | 0 |
| Production | 128Mi | 1 | 128Mi |

**支持项目数**: 3200Mi ÷ 128Mi = 25 个

### 扩容方案

| 集群内存 | 支持项目数 | 成本/月 |
|---------|-----------|---------|
| 3.6GB | 25 个 | 当前 |
| 8GB | 60 个 | +$10 |
| 16GB | 120 个 | +$30 |

## 下一步优化

### 短期（1-2周）

- [ ] 添加 HPA 自动缩容（dev/staging）
- [ ] 配置自动构建（Push 触发）
- [ ] 添加镜像扫描（安全检查）

### 中期（1-2月）

- [ ] 部署 K3s 内置 Registry（加速拉取）
- [ ] 配置 Prometheus 监控
- [ ] 添加告警规则

### 长期（3-6月）

- [ ] 迁移到 Cloudflare R2（降低成本）
- [ ] 添加 Worker 节点（水平扩展）
- [ ] 实现多集群管理

## 参考文档

- [K3s 资源优化实施完成](./k3s-resource-optimization-implementation.md)
- [配置 GitHub Container Registry](./setup-github-container-registry.md)
- [容器镜像仓库方案对比](../architecture/container-registry-solutions.md)
- [立即优化方案](../architecture/immediate-optimization-plan.md)

## 总结

通过降低资源请求（75%）+ 按需启动策略 + GitHub Container Registry，3.6GB 集群从无法运行变为可支持 20-25 个项目。整体方案零成本、配置简单、效果显著。

**总耗时**: 约 20 分钟  
**成本**: $0  
**效果**: 支持项目数提升 4x
