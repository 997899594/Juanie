# GitOps 深度解析：K3s + Flux

## 第一部分：核心概念

### 1.1 什么是 GitOps？

**传统部署方式**：
```
开发者 → SSH 到服务器 → 手动执行命令 → 部署完成
```

**问题**：
- ❌ 不可追溯（谁改了什么？）
- ❌ 不可重复（每次部署可能不一样）
- ❌ 不安全（需要给开发者服务器权限）
- ❌ 难以回滚（出问题了怎么办？）

**GitOps 方式**：
```
开发者 → 推送代码到 Git → Flux 自动检测 → 自动部署到 K8s
```

**优势**：
- ✅ **Git 是唯一真相来源** - 所有配置都在 Git 里
- ✅ **声明式** - 描述"想要什么"，而不是"怎么做"
- ✅ **自动化** - 推送即部署
- ✅ **可审计** - Git 历史记录一切
- ✅ **易回滚** - Git revert 即可

### 1.2 GitOps 的设计哲学

#### 核心原则

**1. 声明式（Declarative）**

```yaml
# 不是告诉系统"怎么做"
# 而是告诉系统"我想要什么"

apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3  # 我想要 3 个副本
  template:
    spec:
      containers:
      - name: app
        image: my-app:v1.0.0
```

系统会自动：
- 创建 3 个 Pod
- 如果 Pod 挂了，自动重启
- 如果改成 5 个，自动扩容

**2. 版本控制（Versioned）**

```bash
# 所有变更都有记录
git log --oneline

a1b2c3d 增加副本数到 5
d4e5f6g 更新镜像到 v1.0.1
g7h8i9j 添加环境变量
```

**3. 自动拉取（Pull-based）**

```
传统 CI/CD (Push):
CI 服务器 --推送--> 生产环境

GitOps (Pull):
Flux (在集群内) --拉取--> Git 仓库
```

**为什么 Pull 更好？**
- ✅ 更安全（不需要给 CI 服务器集群权限）
- ✅ 更可靠（集群自己控制部署节奏）
- ✅ 更简单（不需要配置复杂的 CI/CD 流水线）

**4. 持续协调（Continuous Reconciliation）**

```
Flux 每分钟检查：
1. Git 里的配置是什么？
2. 集群里的实际状态是什么？
3. 不一致？立即修复！
```

**例子**：
- 你在 Git 里说要 3 个副本
- 有人手动删了 1 个 Pod
- Flux 发现不对，自动创建回来
- **集群永远和 Git 保持一致**

---

## 第二部分：Kubernetes 基础

### 2.1 为什么需要 Kubernetes？

**问题场景**：
```
你有 10 个微服务，每个服务 3 个副本 = 30 个容器
- 如何分配到不同服务器？
- 如何负载均衡？
- 如何自动重启挂掉的容器？
- 如何滚动更新？
- 如何管理配置和密钥？
```

**Kubernetes 解决方案**：
```
你只需要告诉 K8s："我要 3 个副本"
K8s 自动：
- 调度到合适的节点
- 配置负载均衡
- 健康检查和自动重启
- 滚动更新（零停机）
- 管理配置和密钥
```

### 2.2 K8s 核心概念

#### Pod - 最小部署单元

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: my-app
spec:
  containers:
  - name: app
    image: nginx:latest
    ports:
    - containerPort: 80
```

**理解**：
- Pod = 1 个或多个容器的组合
- 共享网络和存储
- 是 K8s 调度的最小单位

#### Deployment - 管理 Pod 的副本

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 3  # 想要 3 个副本
  selector:
    matchLabels:
      app: my-app
  template:  # Pod 模板
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: nginx:latest
```

**Deployment 做什么？**
- 创建和管理 ReplicaSet
- 滚动更新
- 回滚
- 扩缩容

#### Service - 服务发现和负载均衡

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app  # 选择哪些 Pod
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP  # 集群内访问
```

**Service 类型**：
- **ClusterIP** - 集群内部访问（默认）
- **NodePort** - 通过节点 IP + 端口访问
- **LoadBalancer** - 云厂商负载均衡器
- **Ingress** - HTTP/HTTPS 路由（推荐）

#### Ingress - HTTP 路由

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: my-app
            port:
              number: 80
```

**Ingress 做什么？**
- 域名路由
- SSL/TLS 终止
- 路径路由
- 负载均衡

### 2.3 K8s 工作流程

```
1. 你创建 Deployment
   ↓
2. Deployment 创建 ReplicaSet
   ↓
3. ReplicaSet 创建 Pod
   ↓
4. Scheduler 分配 Pod 到节点
   ↓
5. Kubelet 在节点上启动容器
   ↓
6. Service 提供负载均衡
   ↓
7. Ingress 提供外部访问
```

---

## 第三部分：K3s - 轻量级 Kubernetes

### 3.1 为什么选择 K3s？

**标准 Kubernetes**：
- 复杂（10+ 个组件）
- 资源占用大（至少 4GB 内存）
- 安装困难

**K3s**：
- 简单（单个二进制文件）
- 轻量（512MB 内存即可）
- 一条命令安装

### 3.2 K3s 架构

```
┌─────────────────────────────────────┐
│           K3s Server                │
│  ┌──────────────────────────────┐  │
│  │  API Server                  │  │
│  │  Scheduler                   │  │
│  │  Controller Manager          │  │
│  │  Embedded etcd (或 SQLite)   │  │
│  └──────────────────────────────┘  │
│                                     │
│  ┌──────────────────────────────┐  │
│  │  Kubelet                     │  │
│  │  Containerd                  │  │
│  │  Traefik (Ingress)           │  │
│  └──────────────────────────────┘  │
└─────────────────────────────────────┘
```

**K3s 特点**：
- ✅ 内置 Containerd（不需要 Docker）
- ✅ 内置 Traefik（不需要单独装 Ingress）
- ✅ 内置 Local Path Provisioner（自动存储）
- ✅ 支持 SQLite（单节点不需要 etcd）

### 3.3 K3s vs K8s

| 特性 | K8s | K3s |
|------|-----|-----|
| 安装 | 复杂 | 一条命令 |
| 内存 | 4GB+ | 512MB+ |
| 存储后端 | etcd | SQLite/etcd |
| Ingress | 需要安装 | 内置 Traefik |
| 适用场景 | 大型集群 | 边缘/IoT/单机 |

### 3.4 K3s 安装详解

```bash
curl -sfL https://get.k3s.io | sh -
```

**这条命令做了什么？**

1. 下载 K3s 二进制文件
2. 创建 systemd 服务
3. 启动 K3s
4. 生成 kubeconfig（`/etc/rancher/k3s/k3s.yaml`）
5. 安装 kubectl（作为 k3s kubectl）

**验证安装**：
```bash
# 查看节点
k3s kubectl get nodes

# 查看所有 Pod
k3s kubectl get pods -A

# 查看 Traefik（内置 Ingress）
k3s kubectl get pods -n kube-system | grep traefik
```

---

## 第四部分：Flux - GitOps 引擎

### 4.1 Flux 架构

```
┌─────────────────────────────────────────────┐
│              Flux System                    │
│                                             │
│  ┌────────────────────────────────────┐    │
│  │  Source Controller                 │    │
│  │  - 监听 Git 仓库                    │    │
│  │  - 拉取代码                         │    │
│  │  - 检测变化                         │    │
│  └────────────────────────────────────┘    │
│              ↓                              │
│  ┌────────────────────────────────────┐    │
│  │  Kustomize Controller              │    │
│  │  - 读取 Kubernetes 配置             │    │
│  │  - 应用到集群                       │    │
│  │  - 持续协调                         │    │
│  └────────────────────────────────────┘    │
│              ↓                              │
│  ┌────────────────────────────────────┐    │
│  │  Helm Controller                   │    │
│  │  - 管理 Helm Charts                 │    │
│  └────────────────────────────────────┘    │
│              ↓                              │
│  ┌────────────────────────────────────┐    │
│  │  Notification Controller           │    │
│  │  - 发送通知                         │    │
│  │  - Webhook                          │    │
│  └────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
```

### 4.2 Flux 核心资源

#### GitRepository - 定义 Git 源

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: default
spec:
  url: https://github.com/user/repo.git
  interval: 1m  # 每分钟检查一次
  ref:
    branch: main
  secretRef:
    name: git-auth  # Git 认证
```

**GitRepository 做什么？**
1. 每 1 分钟拉取 Git 仓库
2. 检测是否有新提交
3. 如果有变化，触发 Kustomization

#### Kustomization - 定义如何部署

```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: my-app
  namespace: default
spec:
  sourceRef:
    kind: GitRepository
    name: my-app
  path: ./k8s  # 配置文件路径
  prune: true  # 删除不再需要的资源
  interval: 5m  # 每 5 分钟协调一次
  timeout: 2m
```

**Kustomization 做什么？**
1. 从 GitRepository 读取配置
2. 应用到集群
3. 持续检查集群状态
4. 如果不一致，自动修复

### 4.3 Flux 工作流程

```
1. 开发者推送代码到 Git
   ↓
2. Source Controller 检测到变化
   ↓
3. 拉取最新代码
   ↓
4. Kustomize Controller 读取配置
   ↓
5. 应用到 Kubernetes 集群
   ↓
6. 持续监控，确保一致性
   ↓
7. 如果有人手动改了配置，自动恢复
```

### 4.4 Flux 安装详解

```bash
# 1. 安装 Flux CLI
curl -s https://fluxcd.io/install.sh | sudo bash

# 2. 检查集群是否满足条件
flux check --pre

# 3. 安装 Flux 到集群
flux install
```

**`flux install` 做了什么？**

1. 创建 `flux-system` 命名空间
2. 安装 CRDs（Custom Resource Definitions）
   - GitRepository
   - Kustomization
   - HelmRelease
   - 等等
3. 部署 4 个 Controller
   - source-controller
   - kustomize-controller
   - helm-controller
   - notification-controller

**验证安装**：
```bash
# 查看 Flux 组件
kubectl get pods -n flux-system

# 检查 Flux 状态
flux check

# 查看所有 Flux 资源
flux get all -A
```

---

## 第五部分：实战案例

### 5.1 完整的 GitOps 流程

#### 场景：部署一个 Web 应用

**1. 准备 Git 仓库**

```bash
mkdir my-app-gitops
cd my-app-gitops
git init

mkdir -p k8s
```

**2. 创建 Kubernetes 配置**

`k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    metadata:
      labels:
        app: web-app
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
```

`k8s/service.yaml`:
```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-app
spec:
  selector:
    app: web-app
  ports:
  - port: 80
    targetPort: 80
```

`k8s/ingress.yaml`:
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: web-app
spec:
  rules:
  - host: app.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: web-app
            port:
              number: 80
```

**3. 推送到 Git**

```bash
git add .
git commit -m "Initial deployment"
git push origin main
```

**4. 配置 Flux**

```bash
# 创建 GitRepository
flux create source git my-app \
  --url=https://github.com/user/my-app-gitops \
  --branch=main \
  --interval=1m

# 创建 Kustomization
flux create kustomization my-app \
  --source=my-app \
  --path="./k8s" \
  --prune=true \
  --interval=5m
```

**5. 验证部署**

```bash
# 查看 Flux 资源
flux get sources git
flux get kustomizations

# 查看 K8s 资源
kubectl get deployments
kubectl get pods
kubectl get services
kubectl get ingress
```

**6. 更新应用**

```bash
# 修改 deployment.yaml，增加副本数
sed -i 's/replicas: 3/replicas: 5/' k8s/deployment.yaml

# 提交并推送
git add k8s/deployment.yaml
git commit -m "Scale to 5 replicas"
git push

# 等待 1 分钟，Flux 自动检测并部署
# 查看变化
kubectl get deployments
# 应该看到 5 个副本
```

### 5.2 多环境管理

#### 目录结构

```
my-app-gitops/
├── base/                    # 基础配置
│   ├── deployment.yaml
│   ├── service.yaml
│   └── kustomization.yaml
├── overlays/
│   ├── development/         # 开发环境
│   │   └── kustomization.yaml
│   ├── staging/             # 预发布环境
│   │   └── kustomization.yaml
│   └── production/          # 生产环境
│       └── kustomization.yaml
```

**base/kustomization.yaml**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - deployment.yaml
  - service.yaml
```

**overlays/development/kustomization.yaml**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namePrefix: dev-
namespace: development

replicas:
  - name: web-app
    count: 1  # 开发环境只要 1 个副本
```

**overlays/production/kustomization.yaml**:
```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
  - ../../base

namePrefix: prod-
namespace: production

replicas:
  - name: web-app
    count: 5  # 生产环境 5 个副本
```

**配置 Flux**:
```bash
# 开发环境
flux create kustomization my-app-dev \
  --source=my-app \
  --path="./overlays/development" \
  --prune=true \
  --interval=1m

# 生产环境
flux create kustomization my-app-prod \
  --source=my-app \
  --path="./overlays/production" \
  --prune=true \
  --interval=5m
```

---

## 第六部分：高级主题

### 6.1 密钥管理

**问题**：如何安全地存储密钥？

**方案 1：Sealed Secrets**

```bash
# 1. 安装 Sealed Secrets
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.5/controller.yaml

# 2. 创建普通 Secret
kubectl create secret generic db-password \
  --from-literal=password=mysecret \
  --dry-run=client -o yaml > secret.yaml

# 3. 加密
kubeseal -f secret.yaml -w sealed-secret.yaml

# 4. 提交加密后的 Secret 到 Git
git add sealed-secret.yaml
git commit -m "Add encrypted secret"
git push

# 5. Flux 自动部署，Sealed Secrets Controller 自动解密
```

**方案 2：SOPS + Age**

```bash
# 1. 生成密钥
age-keygen -o age.key

# 2. 加密文件
sops --encrypt --age $(cat age.key.pub) secret.yaml > secret.enc.yaml

# 3. 提交加密文件
git add secret.enc.yaml
git push

# 4. 配置 Flux 使用 SOPS
flux create kustomization my-app \
  --source=my-app \
  --path="./k8s" \
  --decryption-provider=sops \
  --decryption-secret=sops-age
```

### 6.2 镜像自动更新

```yaml
# 配置镜像仓库
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImageRepository
metadata:
  name: my-app
spec:
  image: docker.io/user/my-app
  interval: 1m

---
# 配置镜像策略
apiVersion: image.toolkit.fluxcd.io/v1beta2
kind: ImagePolicy
metadata:
  name: my-app
spec:
  imageRepositoryRef:
    name: my-app
  policy:
    semver:
      range: 1.0.x  # 只更新 1.0.x 版本

---
# 配置自动更新
apiVersion: image.toolkit.fluxcd.io/v1beta1
kind: ImageUpdateAutomation
metadata:
  name: my-app
spec:
  sourceRef:
    kind: GitRepository
    name: my-app
  git:
    commit:
      author:
        name: fluxbot
        email: flux@example.com
  update:
    path: ./k8s
    strategy: Setters
```

### 6.3 通知和告警

```yaml
# 配置 Slack 通知
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Provider
metadata:
  name: slack
spec:
  type: slack
  channel: deployments
  secretRef:
    name: slack-webhook

---
# 配置告警
apiVersion: notification.toolkit.fluxcd.io/v1beta3
kind: Alert
metadata:
  name: my-app
spec:
  providerRef:
    name: slack
  eventSeverity: info
  eventSources:
    - kind: Kustomization
      name: my-app
```

---

## 第七部分：最佳实践

### 7.1 Git 仓库组织

**单仓库（Monorepo）**:
```
gitops-repo/
├── infrastructure/      # 基础设施
│   ├── ingress/
│   ├── cert-manager/
│   └── monitoring/
├── apps/
│   ├── app1/
│   ├── app2/
│   └── app3/
└── clusters/
    ├── dev/
    ├── staging/
    └── production/
```

**多仓库（Polyrepo）**:
```
infrastructure-gitops/   # 基础设施仓库
app1-gitops/             # 应用 1 仓库
app2-gitops/             # 应用 2 仓库
```

### 7.2 分支策略

**方案 1：环境分支**
```
main → production
staging → staging
develop → development
```

**方案 2：目录分离**
```
main 分支:
  ├── overlays/development/
  ├── overlays/staging/
  └── overlays/production/
```

### 7.3 回滚策略

```bash
# 方法 1：Git revert
git revert HEAD
git push

# 方法 2：暂停自动同步
flux suspend kustomization my-app

# 手动回滚
kubectl rollout undo deployment/my-app

# 恢复自动同步
flux resume kustomization my-app
```

---

## 总结

### GitOps 的价值

1. **可靠性** - Git 是唯一真相来源
2. **可审计** - 所有变更都有记录
3. **安全性** - 不需要给 CI/CD 集群权限
4. **自动化** - 推送即部署
5. **一致性** - 集群永远和 Git 保持一致

### 学习路径

1. ✅ 理解 Kubernetes 基础
2. ✅ 掌握 K3s 安装和使用
3. ✅ 学习 Flux 核心概念
4. ✅ 实践简单的 GitOps 流程
5. ✅ 探索高级功能（密钥管理、镜像更新）
6. ✅ 应用到生产环境

### 下一步

- 在你的服务器上实践完整流程
- 配置多环境部署
- 集成 CI/CD 流水线
- 添加监控和告警

**GitOps 不是银弹，但它是现代 DevOps 的最佳实践之一。**
