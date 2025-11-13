# GitOps 故障排查指南

本指南帮助你诊断和解决 GitOps 部署中的常见问题。

## 目录

- [Flux 安装问题](#flux-安装问题)
- [Git 同步问题](#git-同步问题)
- [部署失败问题](#部署失败问题)
- [性能问题](#性能问题)
- [网络问题](#网络问题)
- [诊断工具](#诊断工具)

---

## Flux 安装问题

### 问题 1: Flux 安装失败

**症状:**

```
❌ Flux 安装失败
错误: context deadline exceeded
```

**可能原因:**

1. K3s 集群未就绪
2. 网络连接问题
3. 资源不足

**解决方案:**

```bash
# 1. 检查 K3s 集群状态
kubectl get nodes
kubectl get pods -A

# 2. 检查资源使用
kubectl top nodes
kubectl top pods -A

# 3. 检查网络连接
curl -I https://github.com/fluxcd/flux2

# 4. 手动安装 Flux
flux install --namespace=flux-system

# 5. 查看安装日志
kubectl logs -n flux-system -l app=source-controller
```

---

### 问题 2: Flux 组件 Pod 无法启动

**症状:**

```
source-controller: CrashLoopBackOff
kustomize-controller: ImagePullBackOff
```

**解决方案:**

```bash
# 1. 查看 Pod 详情
kubectl describe pod -n flux-system <pod-name>

# 2. 查看日志
kubectl logs -n flux-system <pod-name>

# 3. 检查镜像拉取
kubectl get events -n flux-system

# 4. 如果是镜像拉取问题，配置镜像加速
kubectl edit deployment -n flux-system source-controller
# 修改镜像地址为国内镜像源

# 5. 重启 Pod
kubectl rollout restart deployment -n flux-system source-controller
```

---

### 问题 3: Flux 版本不兼容

**症状:**

```
⚠️ Flux 版本过旧，某些功能不可用
```

**解决方案:**

```bash
# 1. 检查当前版本
flux version

# 2. 升级 Flux
flux install --namespace=flux-system

# 3. 验证升级
flux check

# 4. 如果升级失败，先卸载再安装
flux uninstall --namespace=flux-system
flux install --namespace=flux-system
```

---

## Git 同步问题

### 问题 4: Git 认证失败

**症状:**

```
❌ GitRepository 'my-repo' reconciliation failed
错误: authentication required
```

**可能原因:**

1. SSH 密钥未配置
2. Personal Access Token 过期
3. 仓库权限不足

**解决方案:**

#### 使用 SSH 密钥

```bash
# 1. 生成 SSH 密钥
ssh-keygen -t ed25519 -C "flux@example.com" -f flux-ssh-key

# 2. 添加公钥到 Git 仓库
cat flux-ssh-key.pub
# 复制内容，添加到 GitHub/GitLab 的 Deploy Keys

# 3. 在平台 UI 中配置 Secret
# 或使用 kubectl 创建
kubectl create secret generic git-ssh-key \
  --from-file=identity=flux-ssh-key \
  --from-file=known_hosts=known_hosts \
  -n flux-system

# 4. 更新 GitRepository 配置
kubectl edit gitrepository -n flux-system my-repo
# 添加 secretRef:
#   name: git-ssh-key
```

#### 使用 HTTPS + Token

```bash
# 1. 创建 Personal Access Token
# GitHub: Settings → Developer settings → Personal access tokens

# 2. 创建 Secret
kubectl create secret generic git-https-token \
  --from-literal=username=git \
  --from-literal=password=<your-token> \
  -n flux-system

# 3. 更新 GitRepository 配置
kubectl edit gitrepository -n flux-system my-repo
# 添加 secretRef:
#   name: git-https-token
```

---

### 问题 5: Git 仓库无法访问

**症状:**

```
❌ unable to clone repository
错误: dial tcp: lookup github.com: no such host
```

**解决方案:**

```bash
# 1. 检查 DNS 解析
kubectl run -it --rm debug --image=busybox --restart=Never -- nslookup github.com

# 2. 检查网络连接
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- curl -I https://github.com

# 3. 检查代理设置
kubectl get deployment -n flux-system source-controller -o yaml | grep -i proxy

# 4. 配置代理（如果需要）
kubectl set env deployment/source-controller \
  -n flux-system \
  HTTPS_PROXY=http://proxy.example.com:8080

# 5. 检查防火墙规则
# 确保允许访问 Git 仓库的 IP 和端口
```

---

### 问题 6: Git 同步延迟过高

**症状:**

```
⚠️ Git commit 已推送 10 分钟，但 Flux 还未同步
```

**解决方案:**

```bash
# 1. 检查同步间隔配置
kubectl get gitrepository -n flux-system my-repo -o yaml | grep interval

# 2. 缩短同步间隔
kubectl patch gitrepository my-repo -n flux-system \
  --type merge \
  -p '{"spec":{"interval":"1m"}}'

# 3. 手动触发同步
flux reconcile source git my-repo

# 4. 检查 source-controller 负载
kubectl top pod -n flux-system -l app=source-controller

# 5. 如果负载过高，增加副本数
kubectl scale deployment source-controller -n flux-system --replicas=2
```

---

## 部署失败问题

### 问题 7: Kustomization 应用失败

**症状:**

```
❌ Kustomization 'my-app' reconciliation failed
错误: failed to apply manifests
```

**解决方案:**

```bash
# 1. 查看详细错误
kubectl describe kustomization -n flux-system my-app

# 2. 查看事件
kubectl get events -n flux-system --sort-by='.lastTimestamp'

# 3. 手动测试 Kustomize
git clone <your-repo>
cd <your-repo>
kustomize build k8s/overlays/production | kubectl apply --dry-run=client -f -

# 4. 检查 YAML 语法
kustomize build k8s/overlays/production | yamllint -

# 5. 查看 kustomize-controller 日志
kubectl logs -n flux-system -l app=kustomize-controller --tail=100

# 6. 如果是资源冲突，检查现有资源
kubectl get all -n <namespace>
```

---

### 问题 8: HelmRelease 安装失败

**症状:**

```
❌ HelmRelease 'my-app' install failed
错误: chart requires kubeVersion: >=1.20.0
```

**解决方案:**

```bash
# 1. 检查 K8s 版本
kubectl version --short

# 2. 查看 HelmRelease 详情
kubectl describe helmrelease -n flux-system my-app

# 3. 查看 Helm 日志
kubectl logs -n flux-system -l app=helm-controller --tail=100

# 4. 手动测试 Helm Chart
helm template my-app charts/my-app -f values-prod.yaml

# 5. 验证 Chart
helm lint charts/my-app

# 6. 检查依赖
helm dependency list charts/my-app

# 7. 如果是版本问题，更新 Chart.yaml
vim charts/my-app/Chart.yaml
# 修改 kubeVersion 或升级 K8s
```

---

### 问题 9: 健康检查失败

**症状:**

```
❌ Health check failed for Deployment/my-app
错误: deployment not ready: 0/3 pods ready
```

**解决方案:**

```bash
# 1. 查看 Pod 状态
kubectl get pods -n <namespace> -l app=my-app

# 2. 查看 Pod 详情
kubectl describe pod -n <namespace> <pod-name>

# 3. 查看 Pod 日志
kubectl logs -n <namespace> <pod-name>

# 4. 常见问题排查

# 4.1 镜像拉取失败
kubectl get events -n <namespace> | grep -i "pull"
# 解决: 检查镜像地址、凭证、网络

# 4.2 资源不足
kubectl describe node | grep -A 5 "Allocated resources"
# 解决: 增加节点或减少资源请求

# 4.3 健康检查配置错误
kubectl get deployment -n <namespace> my-app -o yaml | grep -A 10 "livenessProbe"
# 解决: 调整 initialDelaySeconds、timeoutSeconds

# 4.4 应用启动失败
kubectl logs -n <namespace> <pod-name> --previous
# 解决: 检查应用日志，修复代码或配置

# 5. 临时禁用健康检查（调试用）
kubectl patch deployment my-app -n <namespace> \
  --type json \
  -p='[{"op": "remove", "path": "/spec/template/spec/containers/0/livenessProbe"}]'
```

---

### 问题 10: 资源依赖问题

**症状:**

```
❌ Kustomization 'my-app' waiting for dependencies
等待: database (not ready)
```

**解决方案:**

```bash
# 1. 查看依赖状态
kubectl get kustomization -n flux-system

# 2. 检查依赖资源
kubectl describe kustomization -n flux-system database

# 3. 手动触发依赖同步
flux reconcile kustomization database

# 4. 如果依赖有问题，先修复依赖
# 然后等待自动重试，或手动触发
flux reconcile kustomization my-app

# 5. 如果依赖配置错误，更新配置
kubectl edit kustomization -n flux-system my-app
# 修改 dependsOn 字段
```

---

## 性能问题

### 问题 11: Flux 占用资源过高

**症状:**

```
⚠️ source-controller CPU 使用率 > 80%
⚠️ kustomize-controller 内存使用 > 1Gi
```

**解决方案:**

```bash
# 1. 查看资源使用
kubectl top pod -n flux-system

# 2. 增加资源限制
kubectl set resources deployment source-controller -n flux-system \
  --limits=cpu=1000m,memory=1Gi \
  --requests=cpu=500m,memory=512Mi

# 3. 优化同步间隔
# 减少频繁同步的资源数量
kubectl get gitrepository -n flux-system -o yaml | grep interval

# 4. 启用缓存
kubectl set env deployment/source-controller -n flux-system \
  ENABLE_CACHE=true

# 5. 分散同步时间
# 为不同资源设置不同的同步间隔
# 避免所有资源同时同步

# 6. 水平扩展
kubectl scale deployment source-controller -n flux-system --replicas=2
```

---

### 问题 12: 大型仓库同步慢

**症状:**

```
⚠️ Git 仓库克隆耗时 > 5 分钟
仓库大小: 2GB
```

**解决方案:**

```bash
# 1. 启用浅克隆
kubectl patch gitrepository my-repo -n flux-system \
  --type merge \
  -p '{"spec":{"gitImplementation":"go-git","ref":{"branch":"main","depth":1}}}'

# 2. 只克隆特定分支
kubectl patch gitrepository my-repo -n flux-system \
  --type merge \
  -p '{"spec":{"ref":{"branch":"main"}}}'

# 3. 使用 Git LFS
# 确保 source-controller 支持 LFS

# 4. 分离配置仓库
# 将 K8s 配置移到独立的小仓库

# 5. 使用 OCI 仓库（Flux v2.1+）
# 将配置打包为 OCI artifact
flux push artifact oci://ghcr.io/org/my-app-config:v1.0.0 \
  --path=./k8s \
  --source=my-repo \
  --revision=main@sha1:abc123
```

---

## 网络问题

### 问题 13: Webhook 通知失败

**症状:**

```
❌ Webhook notification failed
错误: connection refused
```

**解决方案:**

```bash
# 1. 检查 notification-controller
kubectl get pods -n flux-system -l app=notification-controller

# 2. 查看日志
kubectl logs -n flux-system -l app=notification-controller

# 3. 检查 Provider 配置
kubectl get provider -n flux-system

# 4. 测试 Webhook URL
kubectl run -it --rm debug --image=curlimages/curl --restart=Never -- \
  curl -X POST <webhook-url> -d '{"test":"message"}'

# 5. 检查防火墙规则
# 确保 K3s 集群可以访问 Webhook URL

# 6. 配置代理（如果需要）
kubectl set env deployment/notification-controller -n flux-system \
  HTTPS_PROXY=http://proxy.example.com:8080
```

---

### 问题 14: 镜像拉取失败

**症状:**

```
❌ ImagePullBackOff
错误: failed to pull image "ghcr.io/org/my-app:v1.0.0"
```

**解决方案:**

```bash
# 1. 检查镜像是否存在
docker pull ghcr.io/org/my-app:v1.0.0

# 2. 检查镜像拉取凭证
kubectl get secret -n <namespace> | grep docker

# 3. 创建镜像拉取凭证
kubectl create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=<username> \
  --docker-password=<token> \
  -n <namespace>

# 4. 配置 ServiceAccount
kubectl patch serviceaccount default -n <namespace> \
  -p '{"imagePullSecrets":[{"name":"ghcr-secret"}]}'

# 5. 或在 Deployment 中指定
kubectl patch deployment my-app -n <namespace> \
  --type merge \
  -p '{"spec":{"template":{"spec":{"imagePullSecrets":[{"name":"ghcr-secret"}]}}}}'

# 6. 配置镜像加速（国内）
# 修改 containerd 配置
vim /etc/containerd/config.toml
# 添加镜像加速地址
```

---

## 诊断工具

### 工具 1: Flux CLI

```bash
# 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 检查 Flux 状态
flux check

# 查看所有资源
flux get all

# 查看特定资源
flux get sources git
flux get kustomizations
flux get helmreleases

# 手动触发同步
flux reconcile source git my-repo
flux reconcile kustomization my-app

# 暂停/恢复同步
flux suspend kustomization my-app
flux resume kustomization my-app

# 导出配置
flux export source git my-repo > my-repo.yaml

# 查看日志
flux logs --all-namespaces --follow
```

---

### 工具 2: 平台内置诊断

在平台 UI 中使用诊断工具：

**GitOps 健康检查:**

1. 进入 **项目 → GitOps → 诊断**
2. 点击 **运行健康检查**
3. 查看检查结果：
   - ✅ Flux 组件状态
   - ✅ Git 连接性
   - ✅ K8s API 访问
   - ✅ 资源同步状态

**自动修复:**

系统会自动检测并修复常见问题：

- 重启异常的 Flux 组件
- 刷新过期的 Git 凭证
- 清理僵尸资源
- 重新同步失败的资源

---

### 工具 3: kubectl 调试

```bash
# 查看所有 Flux 资源
kubectl get all -n flux-system

# 查看 GitRepository 状态
kubectl get gitrepository -A

# 查看 Kustomization 状态
kubectl get kustomization -A

# 查看 HelmRelease 状态
kubectl get helmrelease -A

# 查看事件
kubectl get events -A --sort-by='.lastTimestamp' | grep -i flux

# 查看日志
kubectl logs -n flux-system -l app=source-controller --tail=100
kubectl logs -n flux-system -l app=kustomize-controller --tail=100
kubectl logs -n flux-system -l app=helm-controller --tail=100

# 进入 Pod 调试
kubectl exec -it -n flux-system <pod-name> -- sh
```

---

### 工具 4: 日志分析

```bash
# 导出所有 Flux 日志
kubectl logs -n flux-system -l app=source-controller --tail=1000 > source.log
kubectl logs -n flux-system -l app=kustomize-controller --tail=1000 > kustomize.log
kubectl logs -n flux-system -l app=helm-controller --tail=1000 > helm.log

# 搜索错误
grep -i error *.log
grep -i failed *.log
grep -i timeout *.log

# 分析同步时间
grep "reconciliation finished" *.log | awk '{print $NF}'
```

---

## 常见错误码

| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| `FLUX_NOT_INSTALLED` | Flux 未安装 | 安装 Flux |
| `GIT_AUTH_FAILED` | Git 认证失败 | 配置 SSH 密钥或 Token |
| `GIT_CLONE_FAILED` | Git 克隆失败 | 检查网络和仓库地址 |
| `YAML_INVALID` | YAML 格式错误 | 验证 YAML 语法 |
| `RESOURCE_NOT_FOUND` | 资源不存在 | 检查资源名称和命名空间 |
| `DEPENDENCY_NOT_READY` | 依赖未就绪 | 等待依赖或修复依赖 |
| `HEALTH_CHECK_FAILED` | 健康检查失败 | 检查 Pod 状态和日志 |
| `TIMEOUT` | 操作超时 | 增加超时时间或优化性能 |
| `INSUFFICIENT_PERMISSIONS` | 权限不足 | 检查 RBAC 配置 |
| `CONFLICT` | 资源冲突 | 解决冲突或删除旧资源 |

---

## 预防措施

### 1. 监控告警

配置告警规则，及时发现问题：

- Flux 组件异常
- 同步失败超过 3 次
- 同步延迟超过 10 分钟
- Git 认证失败

### 2. 定期检查

每周执行健康检查：

```bash
# 运行 Flux 检查
flux check

# 查看资源状态
flux get all

# 检查资源使用
kubectl top pod -n flux-system
```

### 3. 备份配置

定期备份 Flux 配置：

```bash
# 导出所有 Flux 资源
flux export source git --all > backup/git-sources.yaml
flux export kustomization --all > backup/kustomizations.yaml
flux export helmrelease --all > backup/helmreleases.yaml
```

### 4. 测试环境

在生产环境部署前，先在测试环境验证：

- 在开发环境测试配置变更
- 使用 `--dry-run` 验证 YAML
- 检查变更预览和影响分析

---

## 获取帮助

如果问题仍未解决：

1. **查看文档:**
   - [GitOps 快速入门](./QUICK_START.md)
   - [UI 操作指南](./UI_GUIDE.md)
   - [Git 工作流指南](./GIT_WORKFLOW.md)

2. **查看 Flux 文档:**
   - https://fluxcd.io/docs/

3. **联系支持:**
   - 平台管理员
   - 技术支持团队
   - 提交 Issue

4. **社区资源:**
   - Flux Slack: https://slack.cncf.io/
   - GitHub Discussions: https://github.com/fluxcd/flux2/discussions

---

## 调试检查清单

在寻求帮助前，请收集以下信息：

- ☐ Flux 版本: `flux version`
- ☐ K8s 版本: `kubectl version`
- ☐ 错误消息和日志
- ☐ 资源配置: `kubectl get <resource> -o yaml`
- ☐ 事件历史: `kubectl get events`
- ☐ 重现步骤
- ☐ 预期行为 vs 实际行为

这些信息将帮助快速定位和解决问题。
