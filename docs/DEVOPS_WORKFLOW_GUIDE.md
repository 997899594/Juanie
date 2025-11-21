# Juanie DevOps 平台完整使用指南

## 📋 目录

1. [平台架构概览](#平台架构概览)
2. [完整 DevOps 流程](#完整-devops-流程)
3. [快速开始](#快速开始)
4. [详细步骤说明](#详细步骤说明)
5. [GitOps 工作流](#gitops-工作流)
6. [常见问题](#常见问题)

---

## 🏗️ 平台架构概览

### 核心组件

```
┌─────────────────────────────────────────────────────────────┐
│                    Juanie DevOps 平台                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  项目管理 │  │  代码仓库 │  │  环境管理 │  │  流水线   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  GitOps  │  │  Flux CD │  │  K3s集群 │  │  监控告警 │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
         ↓                    ↓                    ↓
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  GitHub/     │    │  K3s         │    │  Prometheus  │
│  GitLab      │    │  Kubernetes  │    │  Grafana     │
└──────────────┘    └──────────────┘    └──────────────┘
```

### 技术栈

- **代码管理**: GitHub / GitLab
- **容器编排**: K3s (轻量级 Kubernetes)
- **GitOps**: Flux CD (自动化部署)
- **CI/CD**: GitLab CI / GitHub Actions
- **监控**: Prometheus + Grafana
- **存储**: MinIO (对象存储)

---

## 🔄 完整 DevOps 流程

### 流程图

```
1. 创建项目
   ↓
2. 连接代码仓库 (GitHub/GitLab)
   ↓
3. 创建环境 (Dev/Staging/Prod)
   ↓
4. 配置 GitOps (Flux CD)
   ↓
5. 推送代码到仓库
   ↓
6. CI 构建镜像
   ↓
7. 更新 GitOps 配置
   ↓
8. Flux 自动部署到 K3s
   ↓
9. 监控和告警
   ↓
10. 持续迭代
```

### 详细流程说明

#### 阶段 1: 项目初始化 ✅ (你已完成)

```
用户操作: 创建项目
  ↓
系统自动:
  1. 创建项目记录
  2. 初始化代码仓库 (可选)
  3. 应用项目模板 (可选)
  4. 配置基础设置
  ↓
结果: 项目创建成功
```

#### 阶段 2: 查看代码仓库

项目创建时已自动关联 Git 仓库，无需额外配置。

```bash
1. 进入项目详情页
2. 点击"仓库"标签
3. 查看仓库信息
   - 仓库 URL
   - 同步状态
   - GitOps 配置
4. 可以点击"同步"按钮手动同步仓库元数据
5. 输入仓库名称
6. 选择可见性 (public/private)
7. 系统自动创建并初始化仓库
```

#### 阶段 3: 环境配置 (必需)

```bash
1. 进入项目详情页
2. 点击"环境"标签
3. 创建环境:
   
   开发环境 (Development):
   - 名称: dev
   - 类型: development
   - 命名空间: project-name-dev
   - 自动部署: 开启
   
   预发布环境 (Staging):
   - 名称: staging
   - 类型: staging
   - 命名空间: project-name-staging
   - 需要审批: 可选
   
   生产环境 (Production):
   - 名称: prod
   - 类型: production
   - 命名空间: project-name-prod
   - 需要审批: 必需
```

#### 阶段 4: GitOps 配置 (关键步骤)

**4.1 安装 Flux CD (首次使用)**

```bash
# 方式 1: 通过平台 UI
1. 进入"GitOps 设置"页面
2. 点击"安装 Flux CD"
3. 等待安装完成

# 方式 2: 手动安装 (如果 UI 未实现)
flux install --namespace=flux-system
```

**4.2 创建 GitOps 仓库**

```bash
1. 创建一个专门的 GitOps 配置仓库
   例如: your-org/project-name-gitops

2. 仓库结构:
   project-name-gitops/
   ├── base/                    # 基础配置
   │   ├── deployment.yaml
   │   ├── service.yaml
   │   └── kustomization.yaml
   ├── overlays/                # 环境覆盖
   │   ├── dev/
   │   │   ├── kustomization.yaml
   │   │   └── patches.yaml
   │   ├── staging/
   │   │   ├── kustomization.yaml
   │   │   └── patches.yaml
   │   └── prod/
   │       ├── kustomization.yaml
   │       └── patches.yaml
   └── README.md
```

**4.3 配置 Flux GitRepository**

```yaml
# gitrepository.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: project-name
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/your-org/project-name-gitops
  ref:
    branch: main
  secretRef:
    name: git-credentials
```

**4.4 配置 Flux Kustomization**

```yaml
# kustomization.yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: project-name-dev
  namespace: flux-system
spec:
  interval: 5m
  path: ./overlays/dev
  prune: true
  sourceRef:
    kind: GitRepository
    name: project-name
  targetNamespace: project-name-dev
```

#### 阶段 5: 应用部署配置

**5.1 基础 Deployment**

```yaml
# base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 2
  selector:
    matchLabels:
      app: your-app
  template:
    metadata:
      labels:
        app: your-app
    spec:
      containers:
      - name: app
        image: your-registry/your-app:latest
        ports:
        - containerPort: 8080
        env:
        - name: NODE_ENV
          value: production
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
```

**5.2 Service 配置**

```yaml
# base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: your-app
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

**5.3 环境特定配置**

```yaml
# overlays/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
patches:
- patch: |-
    - op: replace
      path: /spec/replicas
      value: 1
  target:
    kind: Deployment
    name: app
- patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/image
      value: your-registry/your-app:dev-latest
  target:
    kind: Deployment
    name: app
```

#### 阶段 6: CI/CD 流水线

**6.1 GitHub Actions 示例**

```yaml
# .github/workflows/deploy.yml
name: Build and Deploy

on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: |
          docker build -t your-registry/your-app:${{ github.sha }} .
          docker tag your-registry/your-app:${{ github.sha }} your-registry/your-app:latest
      
      - name: Push to registry
        run: |
          echo ${{ secrets.REGISTRY_PASSWORD }} | docker login -u ${{ secrets.REGISTRY_USERNAME }} --password-stdin
          docker push your-registry/your-app:${{ github.sha }}
          docker push your-registry/your-app:latest
      
      - name: Update GitOps repo
        run: |
          git clone https://github.com/your-org/project-name-gitops
          cd project-name-gitops
          sed -i "s|image: .*|image: your-registry/your-app:${{ github.sha }}|" overlays/dev/kustomization.yaml
          git add .
          git commit -m "Update image to ${{ github.sha }}"
          git push
```

**6.2 GitLab CI 示例**

```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

build:
  stage: build
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy:
  stage: deploy
  script:
    - git clone https://gitlab.com/your-org/project-name-gitops
    - cd project-name-gitops
    - sed -i "s|image: .*|image: $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA|" overlays/dev/kustomization.yaml
    - git add .
    - git commit -m "Update image to $CI_COMMIT_SHA"
    - git push
```

---

## 🚀 快速开始

### 前置条件

- ✅ 项目已创建
- ⬜ K3s 集群已安装并运行
- ⬜ Flux CD 已安装
- ⬜ GitHub/GitLab 账户
- ⬜ Docker Registry (可选，可用 Docker Hub)

### 5 分钟快速部署

```bash
# 1. 创建 GitOps 仓库
git init project-name-gitops
cd project-name-gitops

# 2. 创建基础配置
mkdir -p base overlays/dev

# 3. 创建 Deployment
cat > base/deployment.yaml <<EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
EOF

# 4. 创建 Service
cat > base/service.yaml <<EOF
apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: myapp
  ports:
  - port: 80
    targetPort: 80
  type: ClusterIP
EOF

# 5. 创建 Kustomization
cat > base/kustomization.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml
EOF

# 6. 创建环境覆盖
cat > overlays/dev/kustomization.yaml <<EOF
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
EOF

# 7. 推送到 Git
git add .
git commit -m "Initial GitOps configuration"
git remote add origin https://github.com/your-org/project-name-gitops
git push -u origin main

# 8. 在平台中配置 GitOps
# 进入项目 → GitOps 标签 → 添加 GitRepository
```

---

## 📖 详细步骤说明

### 步骤 1: 连接代码仓库

#### 使用 OAuth (推荐)

```bash
1. 进入"设置 > 账户连接"
2. 点击"连接 GitHub" 或 "连接 GitLab"
3. 授权访问
4. 返回项目页面
5. 选择仓库
```

#### 使用访问令牌

```bash
# GitHub Personal Access Token
1. GitHub → Settings → Developer settings → Personal access tokens
2. Generate new token (classic)
3. 勾选权限: repo, workflow, write:packages
4. 复制 token
5. 在平台中粘贴

# GitLab Personal Access Token
1. GitLab → Preferences → Access Tokens
2. 创建 token
3. 勾选权限: api, read_repository, write_repository
4. 复制 token
5. 在平台中粘贴
```

### 步骤 2: 创建环境

```bash
# 开发环境
名称: dev
类型: development
命名空间: myproject-dev
副本数: 1
资源限制: 
  CPU: 100m-200m
  内存: 128Mi-256Mi

# 生产环境
名称: prod
类型: production
命名空间: myproject-prod
副本数: 3
资源限制:
  CPU: 500m-1000m
  内存: 512Mi-1Gi
需要审批: 是
```

### 步骤 3: 配置 GitOps

#### 方式 1: 通过平台 UI (推荐)

```bash
1. 项目详情 → GitOps 标签
2. 点击"配置 GitOps"
3. 填写信息:
   - GitOps 仓库 URL
   - 分支: main
   - 路径: overlays/dev
   - 同步间隔: 1m
4. 保存
5. 系统自动创建 Flux 资源
```

#### 方式 2: 手动配置

```bash
# 创建 Git 凭证
kubectl create secret generic git-credentials \
  --from-literal=username=your-username \
  --from-literal=password=your-token \
  -n flux-system

# 应用 GitRepository
kubectl apply -f gitrepository.yaml

# 应用 Kustomization
kubectl apply -f kustomization.yaml

# 检查状态
flux get sources git
flux get kustomizations
```

### 步骤 4: 部署应用

```bash
# 1. 构建镜像
docker build -t your-registry/your-app:v1.0.0 .
docker push your-registry/your-app:v1.0.0

# 2. 更新 GitOps 配置
cd project-name-gitops
vim overlays/dev/kustomization.yaml
# 修改 image 为新版本

# 3. 提交并推送
git add .
git commit -m "Deploy v1.0.0 to dev"
git push

# 4. Flux 自动检测并部署 (1分钟内)

# 5. 查看部署状态
kubectl get pods -n myproject-dev
kubectl get deployments -n myproject-dev
```

---

## 🔄 GitOps 工作流

### 日常开发流程

```
开发者推送代码
  ↓
CI 自动构建镜像
  ↓
CI 更新 GitOps 仓库
  ↓
Flux 检测到变更 (1分钟内)
  ↓
Flux 应用到 K3s 集群
  ↓
健康检查
  ↓
部署完成 / 自动回滚
```

### 手动部署流程

```bash
# 1. 在平台 UI 中
项目详情 → 部署标签 → 创建部署
选择环境: dev
选择版本: v1.0.0
点击"部署"

# 2. 系统自动:
- 更新 GitOps 配置
- 提交到 Git
- Flux 自动同步
- 监控部署状态
- 发送通知
```

### 回滚流程

```bash
# 方式 1: 通过平台
项目详情 → 部署标签 → 选择历史版本 → 回滚

# 方式 2: 通过 Git
cd project-name-gitops
git revert HEAD
git push

# 方式 3: 通过 Flux
flux reconcile kustomization project-name-dev --with-source
```

---

## 🎯 最佳实践

### 1. 仓库结构

```
推荐使用 Monorepo 或分离仓库:

选项 A: Monorepo
your-app/
├── src/              # 应用代码
├── .github/          # CI/CD
└── k8s/              # K8s 配置
    ├── base/
    └── overlays/

选项 B: 分离仓库 (推荐)
your-app/             # 应用代码
your-app-gitops/      # GitOps 配置
```

### 2. 环境策略

```
开发环境 (dev):
- 自动部署
- 无需审批
- 资源限制较小

预发布环境 (staging):
- 自动部署
- 可选审批
- 接近生产配置

生产环境 (prod):
- 手动触发
- 必需审批
- 完整资源配置
- 多副本 + 高可用
```

### 3. 镜像标签策略

```bash
# 不推荐
image: myapp:latest  # 无法追踪版本

# 推荐
image: myapp:v1.0.0           # 语义化版本
image: myapp:20240120-abc123  # 日期 + commit
image: myapp:pr-123           # PR 编号
```

### 4. 配置管理

```bash
# 使用 ConfigMap
kubectl create configmap app-config \
  --from-file=config.json \
  -n myproject-dev

# 使用 Secret
kubectl create secret generic app-secrets \
  --from-literal=db-password=secret \
  -n myproject-dev

# 在 Deployment 中引用
env:
- name: DB_PASSWORD
  valueFrom:
    secretKeyRef:
      name: app-secrets
      key: db-password
```

---

## ❓ 常见问题

### Q1: 项目创建成功了，但不知道下一步做什么？

**A**: 按以下顺序操作：
1. 连接或创建代码仓库
2. 创建至少一个环境 (dev)
3. 配置 GitOps (创建 GitOps 仓库)
4. 推送应用代码
5. 配置 CI/CD 构建镜像
6. 部署应用

### Q2: GitOps 还没创建好，怎么办？

**A**: GitOps 配置步骤：
1. 创建一个新的 Git 仓库 (例如: myproject-gitops)
2. 按照上面的结构创建 K8s 配置文件
3. 在平台中配置 GitRepository 和 Kustomization
4. Flux 会自动同步并部署

### Q3: 如何验证 Flux 是否正常工作？

```bash
# 检查 Flux 组件
kubectl get pods -n flux-system

# 检查 GitRepository
flux get sources git

# 检查 Kustomization
flux get kustomizations

# 查看同步日志
flux logs --follow
```

### Q4: 部署失败了怎么办？

```bash
# 1. 查看 Flux 日志
flux logs --kind=Kustomization --name=myproject-dev

# 2. 查看 Pod 状态
kubectl get pods -n myproject-dev
kubectl describe pod <pod-name> -n myproject-dev

# 3. 查看事件
kubectl get events -n myproject-dev --sort-by='.lastTimestamp'

# 4. 回滚到上一个版本
flux suspend kustomization myproject-dev
# 修复配置
flux resume kustomization myproject-dev
```

### Q5: 如何更新应用配置？

```bash
# 1. 修改 GitOps 仓库中的配置
cd project-name-gitops
vim overlays/dev/patches.yaml

# 2. 提交并推送
git add .
git commit -m "Update configuration"
git push

# 3. Flux 自动应用 (或手动触发)
flux reconcile kustomization myproject-dev
```

### Q6: 如何查看部署历史？

```bash
# 在平台 UI 中
项目详情 → 部署标签 → 查看历史

# 通过 kubectl
kubectl rollout history deployment/app -n myproject-dev

# 通过 Git
cd project-name-gitops
git log --oneline
```

---

## 📊 监控和告警

### 查看应用状态

```bash
# 在平台 UI 中
项目详情 → 概览 → 查看健康度

# 通过 kubectl
kubectl get all -n myproject-dev
kubectl top pods -n myproject-dev
```

### 配置告警

```bash
1. 项目详情 → 监控告警
2. 创建告警规则:
   - CPU 使用率 > 80%
   - 内存使用率 > 80%
   - Pod 重启次数 > 5
   - 部署失败
3. 配置通知渠道 (邮件/钉钉/企业微信)
```

---

## 🎓 学习资源

### 官方文档
- [Flux CD 文档](https://fluxcd.io/docs/)
- [Kubernetes 文档](https://kubernetes.io/docs/)
- [K3s 文档](https://docs.k3s.io/)

### 推荐教程
- [GitOps 最佳实践](https://www.gitops.tech/)
- [Kustomize 教程](https://kubectl.docs.kubernetes.io/guides/introduction/kustomize/)

---

## 📞 获取帮助

- **文档**: 查看本文档和其他文档
- **日志**: 查看平台日志和 Flux 日志
- **社区**: 加入 Slack/Discord 社区

---

**最后更新**: 2024-01-20  
**维护者**: Juanie Team

**下一步**: 开始创建你的第一个环境和 GitOps 配置！
