# Flux 安装指南

本文档详细介绍如何在 AI DevOps 平台中安装和配置 Flux CD。

## 目录

- [前置条件](#前置条件)
- [安装方式](#安装方式)
- [验证安装](#验证安装)
- [配置 Flux](#配置-flux)
- [故障排查](#故障排查)

---

## 前置条件

### 系统要求

- Kubernetes 集群: 1.20+
- kubectl: 已配置并可访问集群
- 网络: 可访问 GitHub/GitLab 等 Git 仓库

### 权限要求

- 集群管理员权限（用于安装 Flux 组件）
- Git 仓库读写权限（用于同步配置）

---

## 安装方式

### 方式 1: 通过平台 UI 安装（推荐）

这是最简单的安装方式，平台会自动处理所有配置。

#### 步骤

1. 登录平台
2. 进入 **项目设置 → GitOps**
3. 点击 **安装 Flux** 按钮
4. 配置安装选项：
   - **命名空间**: `flux-system` (默认)
   - **版本**: 选择 Flux 版本（推荐最新稳定版）
5. 点击 **确认安装**
6. 等待安装完成（约 30-60 秒）

#### 安装过程

平台会自动执行以下操作：

1. 下载 Flux CLI
2. 创建 `flux-system` 命名空间
3. 安装 Flux 组件：
   - source-controller
   - kustomize-controller
   - helm-controller
   - notification-controller
4. 配置 RBAC 权限
5. 验证安装状态

---

### 方式 2: 使用 Flux CLI 手动安装

如果需要更多控制，可以手动安装。

#### 1. 安装 Flux CLI

**macOS:**

```bash
brew install fluxcd/tap/flux
```

**Linux:**

```bash
curl -s https://fluxcd.io/install.sh | sudo bash
```

**验证安装:**

```bash
flux version
```

#### 2. 检查集群兼容性

```bash
flux check --pre
```

输出示例：

```
► checking prerequisites
✔ Kubernetes 1.28.0 >=1.20.6-0
✔ prerequisites checks passed
```

#### 3. 安装 Flux

**基础安装:**

```bash
flux install --namespace=flux-system
```

**自定义安装:**

```bash
flux install \
  --namespace=flux-system \
  --network-policy=false \
  --components=source-controller,kustomize-controller,helm-controller,notification-controller
```

**指定版本:**

```bash
flux install \
  --namespace=flux-system \
  --version=v2.2.0
```

#### 4. 验证安装

```bash
flux check
```

输出示例：

```
► checking prerequisites
✔ Kubernetes 1.28.0 >=1.20.6-0
► checking controllers
✔ source-controller: deployment ready
✔ kustomize-controller: deployment ready
✔ helm-controller: deployment ready
✔ notification-controller: deployment ready
✔ all checks passed
```

---

### 方式 3: 使用 kubectl 安装

如果无法使用 Flux CLI，可以直接使用 kubectl。

#### 1. 下载 Flux 清单

```bash
curl -s https://fluxcd.io/install.yaml > flux-install.yaml
```

#### 2. 应用清单

```bash
kubectl apply -f flux-install.yaml
```

#### 3. 等待 Pod 就绪

```bash
kubectl wait --for=condition=ready pod \
  --all \
  --namespace=flux-system \
  --timeout=5m
```

---

### 方式 4: 使用 Helm 安装

Flux 也提供 Helm Chart。

#### 1. 添加 Helm 仓库

```bash
helm repo add fluxcd https://fluxcd-community.github.io/helm-charts
helm repo update
```

#### 2. 安装 Flux

```bash
helm install flux fluxcd/flux2 \
  --namespace flux-system \
  --create-namespace
```

#### 3. 自定义配置

创建 `values.yaml`:

```yaml
# values.yaml
sourceController:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

kustomizeController:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi

helmController:
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 512Mi
```

安装：

```bash
helm install flux fluxcd/flux2 \
  --namespace flux-system \
  --create-namespace \
  --values values.yaml
```

---

## 验证安装

### 1. 检查命名空间

```bash
kubectl get namespace flux-system
```

### 2. 检查 Pod 状态

```bash
kubectl get pods -n flux-system
```

期望输出：

```
NAME                                      READY   STATUS    RESTARTS   AGE
source-controller-xxxxx                   1/1     Running   0          2m
kustomize-controller-xxxxx                1/1     Running   0          2m
helm-controller-xxxxx                     1/1     Running   0          2m
notification-controller-xxxxx             1/1     Running   0          2m
```

### 3. 检查 Deployment

```bash
kubectl get deployments -n flux-system
```

### 4. 检查 CRD

```bash
kubectl get crds | grep fluxcd
```

期望输出：

```
alerts.notification.toolkit.fluxcd.io
buckets.source.toolkit.fluxcd.io
gitrepositories.source.toolkit.fluxcd.io
helmcharts.source.toolkit.fluxcd.io
helmreleases.helm.toolkit.fluxcd.io
helmrepositories.source.toolkit.fluxcd.io
kustomizations.kustomize.toolkit.fluxcd.io
...
```

### 5. 使用 Flux CLI 检查

```bash
flux check
```

### 6. 查看日志

```bash
# 查看所有 Flux 日志
flux logs --all-namespaces --follow

# 查看特定控制器日志
kubectl logs -n flux-system -l app=source-controller
kubectl logs -n flux-system -l app=kustomize-controller
```

---

## 配置 Flux

### 1. 配置 Git 仓库访问

#### 使用 SSH 密钥

```bash
# 生成 SSH 密钥
ssh-keygen -t ed25519 -C "flux@devops-platform" -f flux-ssh-key

# 创建 Kubernetes Secret
kubectl create secret generic git-ssh-key \
  --from-file=identity=flux-ssh-key \
  --from-file=identity.pub=flux-ssh-key.pub \
  --from-literal=known_hosts="$(ssh-keyscan github.com)" \
  --namespace=flux-system

# 添加公钥到 Git 仓库
cat flux-ssh-key.pub
# 复制内容，添加到 GitHub/GitLab 的 Deploy Keys
```

#### 使用 HTTPS Token

```bash
# 创建 Secret
kubectl create secret generic git-https-credentials \
  --from-literal=username=git \
  --from-literal=password=<your-token> \
  --namespace=flux-system
```

### 2. 创建 GitRepository 资源

```yaml
# git-repository.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 1m
  url: ssh://git@github.com/org/my-app
  ref:
    branch: main
  secretRef:
    name: git-ssh-key
```

应用：

```bash
kubectl apply -f git-repository.yaml
```

### 3. 创建 Kustomization 资源

```yaml
# kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: flux-system
spec:
  interval: 5m
  path: ./k8s/overlays/production
  prune: true
  sourceRef:
    kind: GitRepository
    name: my-app
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: my-app
    namespace: default
```

应用：

```bash
kubectl apply -f kustomization.yaml
```

### 4. 配置通知

#### Slack 通知

```yaml
# slack-provider.yaml
apiVersion: notification.toolkit.fluxcd.io/v1beta1
kind: Provider
metadata:
  name: slack
  namespace: flux-system
spec:
  type: slack
  channel: deployments
  address: https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
---
apiVersion: notification.toolkit.fluxcd.io/v1beta1
kind: Alert
metadata:
  name: slack-alert
  namespace: flux-system
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
  - kind: GitRepository
    name: '*'
  - kind: Kustomization
    name: '*'
```

应用：

```bash
kubectl apply -f slack-provider.yaml
```

---

## 升级 Flux

### 使用 Flux CLI

```bash
# 检查可用版本
flux version

# 升级到最新版本
flux install --namespace=flux-system

# 升级到特定版本
flux install --namespace=flux-system --version=v2.3.0
```

### 使用 kubectl

```bash
# 下载新版本清单
curl -s https://fluxcd.io/install.yaml > flux-install-new.yaml

# 应用更新
kubectl apply -f flux-install-new.yaml
```

### 使用 Helm

```bash
# 更新 Helm 仓库
helm repo update

# 升级 Flux
helm upgrade flux fluxcd/flux2 \
  --namespace flux-system
```

---

## 卸载 Flux

### 使用 Flux CLI

```bash
# 卸载 Flux（保留 CRD）
flux uninstall --namespace=flux-system

# 完全卸载（包括 CRD）
flux uninstall --namespace=flux-system --crds
```

### 使用 kubectl

```bash
# 删除 Flux 资源
kubectl delete -f flux-install.yaml

# 删除命名空间
kubectl delete namespace flux-system

# 删除 CRD
kubectl delete crds -l app.kubernetes.io/part-of=flux
```

---

## 故障排查

### 问题 1: Pod 无法启动

```bash
# 查看 Pod 状态
kubectl get pods -n flux-system

# 查看 Pod 详情
kubectl describe pod -n flux-system <pod-name>

# 查看日志
kubectl logs -n flux-system <pod-name>
```

常见原因：

- 镜像拉取失败
- 资源不足
- RBAC 权限问题

### 问题 2: Git 连接失败

```bash
# 查看 GitRepository 状态
kubectl get gitrepository -n flux-system

# 查看详细信息
kubectl describe gitrepository -n flux-system <name>

# 测试 Git 连接
kubectl run -it --rm debug --image=alpine/git --restart=Never -- \
  git ls-remote <git-url>
```

### 问题 3: 同步失败

```bash
# 查看 Kustomization 状态
kubectl get kustomization -n flux-system

# 查看事件
kubectl get events -n flux-system --sort-by='.lastTimestamp'

# 手动触发同步
flux reconcile kustomization <name>
```

### 问题 4: 资源占用过高

```bash
# 查看资源使用
kubectl top pod -n flux-system

# 调整资源限制
kubectl set resources deployment source-controller -n flux-system \
  --limits=cpu=1000m,memory=1Gi \
  --requests=cpu=500m,memory=512Mi
```

---

## 最佳实践

### 1. 资源配置

为生产环境配置适当的资源限制：

```yaml
resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

### 2. 高可用

为关键组件启用多副本：

```bash
kubectl scale deployment source-controller -n flux-system --replicas=2
kubectl scale deployment kustomize-controller -n flux-system --replicas=2
```

### 3. 监控

配置 Prometheus 监控 Flux 指标：

```yaml
apiVersion: v1
kind: Service
metadata:
  name: source-controller-metrics
  namespace: flux-system
spec:
  selector:
    app: source-controller
  ports:
  - port: 8080
    name: metrics
```

### 4. 备份

定期备份 Flux 配置：

```bash
# 导出所有 Flux 资源
flux export source git --all > backup/git-sources.yaml
flux export kustomization --all > backup/kustomizations.yaml
flux export helmrelease --all > backup/helmreleases.yaml
```

### 5. 安全

- 使用 SSH 密钥而不是 HTTPS Token
- 定期轮换 Git 凭证
- 限制 Flux 的 RBAC 权限
- 启用 Pod Security Standards

---

## 相关文档

- [Docker Compose 部署指南](./DOCKER_COMPOSE.md)
- [环境变量配置](./ENVIRONMENT_VARIABLES.md)
- [GitOps 快速入门](../gitops/QUICK_START.md)
- [故障排查指南](../gitops/TROUBLESHOOTING.md)
- [Flux 官方文档](https://fluxcd.io/docs/)
