# Git 工作流指南

本指南介绍如何使用 Git 进行 GitOps 部署，适合熟悉 Git 的开发者。

## 目录

- [仓库结构](#仓库结构)
- [分支策略](#分支策略)
- [Kustomize 工作流](#kustomize-工作流)
- [Helm 工作流](#helm-工作流)
- [多环境管理](#多环境管理)
- [最佳实践](#最佳实践)

---

## 仓库结构

### 推荐的目录结构

```
my-project/
├── .github/
│   └── workflows/          # CI/CD 工作流
├── src/                    # 应用源代码
├── k8s/                    # Kubernetes 配置
│   ├── base/               # 基础配置
│   │   ├── deployment.yaml
│   │   ├── service.yaml
│   │   ├── configmap.yaml
│   │   └── kustomization.yaml
│   └── overlays/           # 环境特定配置
│       ├── development/
│       │   ├── kustomization.yaml
│       │   ├── patch-replicas.yaml
│       │   └── patch-env.yaml
│       ├── staging/
│       │   ├── kustomization.yaml
│       │   └── patch.yaml
│       └── production/
│           ├── kustomization.yaml
│           ├── patch-replicas.yaml
│           ├── patch-resources.yaml
│           └── hpa.yaml
├── charts/                 # Helm Charts（可选）
│   └── my-app/
│       ├── Chart.yaml
│       ├── values.yaml
│       ├── values-dev.yaml
│       ├── values-prod.yaml
│       └── templates/
└── README.md
```

### 文件说明

**`k8s/base/`**: 所有环境共享的基础配置

**`k8s/overlays/`**: 每个环境的特定配置，使用 Kustomize 覆盖基础配置

**`charts/`**: Helm Chart 定义（如果使用 Helm）

---

## 分支策略

### GitFlow 模式

```
main (生产环境)
  ↑
  └── release/v1.2.0
        ↑
        └── develop (开发环境)
              ↑
              └── feature/new-feature
```

**分支映射:**

| 分支 | 环境 | 自动部署 |
|------|------|----------|
| `develop` | development | ✅ 是 |
| `staging` | staging | ✅ 是 |
| `main` | production | ❌ 否（需审批） |

### 工作流程

#### 1. 开发新功能

```bash
# 从 develop 创建功能分支
git checkout develop
git pull origin develop
git checkout -b feature/new-feature

# 开发和测试
# ...

# 提交代码
git add .
git commit -m "feat: add new feature"
git push origin feature/new-feature

# 创建 Pull Request 到 develop
```

#### 2. 部署到开发环境

```bash
# 合并 PR 后，自动部署到开发环境
git checkout develop
git merge feature/new-feature
git push origin develop

# Flux 会在 1 分钟内检测到变更并自动部署
```

#### 3. 部署到生产环境

```bash
# 创建 release 分支
git checkout -b release/v1.2.0 develop

# 更新版本号和配置
# ...

# 合并到 main
git checkout main
git merge release/v1.2.0
git tag v1.2.0
git push origin main --tags

# 在平台 UI 中审批后，Flux 会部署到生产环境
```

---

## Kustomize 工作流

### 基础配置

`k8s/base/deployment.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
  labels:
    app: my-app
spec:
  replicas: 1  # 基础副本数
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: app
        image: ghcr.io/org/my-app:latest
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: NODE_ENV
          value: development
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
```

`k8s/base/service.yaml`:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: my-app
spec:
  selector:
    app: my-app
  ports:
  - port: 80
    targetPort: http
    name: http
  type: ClusterIP
```

`k8s/base/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

resources:
- deployment.yaml
- service.yaml

commonLabels:
  app: my-app
  managed-by: flux

namespace: default
```

### 环境覆盖

#### 开发环境

`k8s/overlays/development/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
- ../../base

namespace: development

# 镜像标签覆盖
images:
- name: ghcr.io/org/my-app
  newTag: develop

# 副本数覆盖
replicas:
- name: my-app
  count: 1

# 补丁
patches:
- path: patch-env.yaml
```

`k8s/overlays/development/patch-env.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: app
        env:
        - name: NODE_ENV
          value: development
        - name: LOG_LEVEL
          value: debug
```

#### 生产环境

`k8s/overlays/production/kustomization.yaml`:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
- ../../base

namespace: production

# 镜像标签覆盖
images:
- name: ghcr.io/org/my-app
  newTag: v1.2.3  # 固定版本

# 副本数覆盖
replicas:
- name: my-app
  count: 5

# 补丁
patches:
- path: patch-env.yaml
- path: patch-resources.yaml

# 额外资源
resources:
- hpa.yaml
- pdb.yaml
```

`k8s/overlays/production/patch-resources.yaml`:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    spec:
      containers:
      - name: app
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
```

`k8s/overlays/production/hpa.yaml`:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: my-app
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: my-app
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

### 本地测试

在提交前，本地测试 Kustomize 配置：

```bash
# 查看生成的 YAML
kustomize build k8s/overlays/production

# 验证 YAML
kustomize build k8s/overlays/production | kubectl apply --dry-run=client -f -

# 查看差异
kustomize build k8s/overlays/production | kubectl diff -f -
```

### 更新镜像版本

#### 方式 1: 修改 kustomization.yaml

```bash
cd k8s/overlays/production

# 编辑 kustomization.yaml
vim kustomization.yaml

# 修改 newTag
images:
- name: ghcr.io/org/my-app
  newTag: v1.2.4  # 更新版本

# 提交
git add kustomization.yaml
git commit -m "chore(deploy): update to v1.2.4"
git push origin main
```

#### 方式 2: 使用 kustomize edit

```bash
cd k8s/overlays/production

# 使用命令更新
kustomize edit set image ghcr.io/org/my-app:v1.2.4

# 提交
git add kustomization.yaml
git commit -m "chore(deploy): update to v1.2.4"
git push origin main
```

---

## Helm 工作流

### Chart 结构

```
charts/my-app/
├── Chart.yaml
├── values.yaml
├── values-dev.yaml
├── values-staging.yaml
├── values-prod.yaml
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── configmap.yaml
    ├── secret.yaml
    ├── hpa.yaml
    └── _helpers.tpl
```

### Chart.yaml

```yaml
apiVersion: v2
name: my-app
description: My Application Helm Chart
type: application
version: 1.0.0
appVersion: "1.2.3"

dependencies: []

maintainers:
- name: Your Name
  email: your.email@example.com
```

### values.yaml (默认值)

```yaml
replicaCount: 3

image:
  repository: ghcr.io/org/my-app
  pullPolicy: IfNotPresent
  tag: ""  # 默认使用 appVersion

imagePullSecrets: []
nameOverride: ""
fullnameOverride: ""

service:
  type: ClusterIP
  port: 80
  targetPort: 8080

ingress:
  enabled: false
  className: nginx
  annotations: {}
  hosts:
    - host: my-app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls: []

resources:
  requests:
    cpu: 100m
    memory: 128Mi
  limits:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: false
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

env:
  NODE_ENV: production

envFrom: []

livenessProbe:
  httpGet:
    path: /health
    port: http
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /ready
    port: http
  initialDelaySeconds: 10
  periodSeconds: 5

nodeSelector: {}
tolerations: []
affinity: {}
```

### 环境特定 Values

#### values-dev.yaml

```yaml
replicaCount: 1

image:
  tag: develop

env:
  NODE_ENV: development
  LOG_LEVEL: debug

resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 256Mi

autoscaling:
  enabled: false
```

#### values-prod.yaml

```yaml
replicaCount: 5

image:
  tag: v1.2.3

env:
  NODE_ENV: production
  LOG_LEVEL: info

resources:
  requests:
    cpu: 500m
    memory: 512Mi
  limits:
    cpu: 2000m
    memory: 2Gi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 70

ingress:
  enabled: true
  className: nginx
  hosts:
    - host: my-app.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: my-app-tls
      hosts:
        - my-app.example.com
```

### 本地测试

```bash
# 验证 Chart
helm lint charts/my-app

# 查看生成的 YAML
helm template my-app charts/my-app -f charts/my-app/values-prod.yaml

# 模拟安装
helm install my-app charts/my-app -f charts/my-app/values-prod.yaml --dry-run --debug

# 查看差异
helm diff upgrade my-app charts/my-app -f charts/my-app/values-prod.yaml
```

### 更新 Chart

```bash
# 修改 values
vim charts/my-app/values-prod.yaml

# 更新版本号
vim charts/my-app/Chart.yaml

# 提交
git add charts/
git commit -m "chore(chart): update production values"
git push origin main

# Flux 会自动检测并升级 HelmRelease
```

---

## 多环境管理

### 策略 1: 分支隔离

每个环境使用独立分支：

```
develop → development 环境
staging → staging 环境
main → production 环境
```

**优点:**

- 环境完全隔离
- 可以独立回滚
- 清晰的发布流程

**缺点:**

- 需要维护多个分支
- 合并冲突可能较多

### 策略 2: 目录隔离

所有环境在同一分支，使用不同目录：

```
k8s/overlays/development/
k8s/overlays/staging/
k8s/overlays/production/
```

**优点:**

- 单一分支，易于管理
- 变更可以同时应用到多个环境

**缺点:**

- 需要小心避免误操作
- 回滚需要 revert commit

### 策略 3: 混合模式（推荐）

开发和测试环境使用同一分支，生产环境使用独立分支：

```
develop → development + staging 环境
main → production 环境
```

**优点:**

- 平衡了灵活性和安全性
- 生产环境有额外保护

### 环境提升流程

#### 从开发到生产

```bash
# 1. 在开发环境测试
git checkout develop
# 修改 k8s/overlays/development/
git commit -m "feat: add new feature"
git push origin develop
# 等待自动部署和测试

# 2. 提升到 staging
# 修改 k8s/overlays/staging/
git commit -m "chore: promote to staging"
git push origin develop
# 等待自动部署和测试

# 3. 提升到生产
git checkout main
git merge develop
# 修改 k8s/overlays/production/
git commit -m "chore: promote to production"
git tag v1.2.3
git push origin main --tags
# 在平台 UI 中审批后部署
```

---

## 最佳实践

### 1. Commit 消息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

<body>

<footer>
```

**类型:**

- `feat`: 新功能
- `fix`: 修复 bug
- `chore`: 配置变更
- `docs`: 文档更新
- `style`: 代码格式
- `refactor`: 重构
- `perf`: 性能优化
- `test`: 测试

**示例:**

```
feat(api): add user authentication

- Implement JWT token generation
- Add login and logout endpoints
- Update user model

Closes #123
```

```
chore(deploy): update production to v1.2.3

- Scale replicas to 5
- Increase memory limit to 2Gi
- Enable HPA

Deployed-By: user@example.com
```

### 2. 版本管理

#### 语义化版本

使用 [Semantic Versioning](https://semver.org/)：

```
MAJOR.MINOR.PATCH

1.2.3
│ │ │
│ │ └─ 补丁版本（bug 修复）
│ └─── 次版本（新功能，向后兼容）
└───── 主版本（破坏性变更）
```

#### Git 标签

```bash
# 创建标签
git tag -a v1.2.3 -m "Release v1.2.3"

# 推送标签
git push origin v1.2.3

# 列出标签
git tag -l

# 删除标签
git tag -d v1.2.3
git push origin :refs/tags/v1.2.3
```

### 3. 配置管理

#### 敏感信息

**不要** 将敏感信息提交到 Git：

```yaml
# ❌ 错误
env:
- name: DATABASE_PASSWORD
  value: "my-secret-password"

# ✅ 正确
env:
- name: DATABASE_PASSWORD
  valueFrom:
    secretKeyRef:
      name: database-secret
      key: password
```

使用 Sealed Secrets 或外部 Secret 管理：

```bash
# 创建 Secret
kubectl create secret generic database-secret \
  --from-literal=password=my-secret-password \
  --dry-run=client -o yaml | \
  kubeseal -o yaml > sealed-secret.yaml

# 提交 sealed-secret.yaml
git add sealed-secret.yaml
git commit -m "chore: add database secret"
```

#### 配置分离

将配置与代码分离：

```yaml
# ConfigMap
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  app.conf: |
    server {
      port: 8080
      timeout: 30s
    }
```

### 4. 代码审查

#### Pull Request 检查清单

- ☐ YAML 语法正确
- ☐ 资源限制合理
- ☐ 健康检查配置正确
- ☐ 敏感信息已移除
- ☐ Commit 消息规范
- ☐ 在开发环境测试通过

#### 自动化检查

使用 GitHub Actions 或 GitLab CI：

```yaml
# .github/workflows/validate.yml
name: Validate K8s Manifests

on: [pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Validate YAML
      run: |
        yamllint k8s/
    
    - name: Validate Kustomize
      run: |
        kustomize build k8s/overlays/production | \
        kubectl apply --dry-run=client -f -
    
    - name: Lint Helm Chart
      run: |
        helm lint charts/my-app
```

### 5. 回滚策略

#### 快速回滚

```bash
# 回滚到上一个版本
git revert HEAD
git push origin main

# 回滚到特定版本
git revert abc123
git push origin main
```

#### 标签回滚

```bash
# 回滚到特定标签
git checkout v1.2.2
git checkout -b hotfix/rollback
# 修改配置
git commit -m "chore: rollback to v1.2.2"
git push origin hotfix/rollback

# 合并到 main
git checkout main
git merge hotfix/rollback
git push origin main
```

### 6. 文档化

在仓库中维护文档：

```
docs/
├── deployment.md       # 部署指南
├── rollback.md         # 回滚流程
├── troubleshooting.md  # 故障排查
└── architecture.md     # 架构说明
```

---

## 常见场景

### 场景 1: 紧急修复

```bash
# 1. 从 main 创建 hotfix 分支
git checkout main
git checkout -b hotfix/critical-bug

# 2. 修复并测试
# ...

# 3. 直接合并到 main
git checkout main
git merge hotfix/critical-bug
git tag v1.2.4
git push origin main --tags

# 4. 回合并到 develop
git checkout develop
git merge hotfix/critical-bug
git push origin develop
```

### 场景 2: 金丝雀发布

```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

bases:
- ../../base

# 创建两个 Deployment
resources:
- deployment-stable.yaml
- deployment-canary.yaml

# Stable 版本
patches:
- target:
    kind: Deployment
    name: my-app-stable
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 9
    - op: replace
      path: /spec/template/spec/containers/0/image
      value: ghcr.io/org/my-app:v1.2.3

# Canary 版本（10% 流量）
- target:
    kind: Deployment
    name: my-app-canary
  patch: |-
    - op: replace
      path: /spec/replicas
      value: 1
    - op: replace
      path: /spec/template/spec/containers/0/image
      value: ghcr.io/org/my-app:v1.2.4
```

### 场景 3: 蓝绿部署

```bash
# 1. 部署绿色环境
kubectl apply -k k8s/overlays/production-green

# 2. 测试绿色环境
# ...

# 3. 切换流量
kubectl patch service my-app -p '{"spec":{"selector":{"version":"green"}}}'

# 4. 删除蓝色环境
kubectl delete -k k8s/overlays/production-blue
```

---

## 相关文档

- [GitOps 快速入门](./QUICK_START.md)
- [UI 操作指南](./UI_GUIDE.md)
- [故障排查指南](./TROUBLESHOOTING.md)
- [API 参考文档](../api/gitops/API_REFERENCE.md)
