# GitOps 资源详解

## 🤔 为什么需要这么多资源？

创建一个项目需要 4 类 GitOps 资源，每个都有特定的职责。这是 **GitOps 模式**的标准实践。

---

## 📦 资源清单

每个项目的每个环境需要：

```
1. Namespace          - 隔离空间
2. GitRepository      - Git 仓库连接
3. Kustomization      - 部署配置
4. ImagePullSecret    - 镜像拉取凭证
```

**示例**（项目 012，3 个环境）:
```
project-012-development/
  ├── Namespace: project-012-development
  ├── GitRepository: 012-repo
  ├── Kustomization: 012-kustomization
  └── Secret: ghcr-secret

project-012-staging/
  ├── Namespace: project-012-staging
  ├── GitRepository: 012-repo
  ├── Kustomization: 012-kustomization
  └── Secret: ghcr-secret

project-012-production/
  ├── Namespace: project-012-production
  ├── GitRepository: 012-repo
  ├── Kustomization: 012-kustomization
  └── Secret: ghcr-secret
```

**总计**: 3 个环境 × 4 个资源 = **12 个 K8s 资源**

---

## 1️⃣ Namespace - 隔离空间

### 作用
为每个环境创建独立的命名空间，实现资源隔离。

### 为什么需要？
- ✅ **资源隔离**: Development、Staging、Production 互不干扰
- ✅ **权限控制**: 可以为不同环境设置不同的访问权限
- ✅ **资源配额**: 可以限制每个环境的资源使用
- ✅ **清理方便**: 删除 Namespace 会自动删除其中的所有资源

### 示例
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: project-012-development
  labels:
    project-id: "012"
    environment: "development"
```

### 如果不创建？
- ❌ 所有项目混在一起，无法区分
- ❌ 删除项目时需要逐个删除资源
- ❌ 无法设置环境级别的权限和配额

---

## 2️⃣ GitRepository - Git 仓库连接

### 作用
告诉 Flux CD 从哪里拉取 K8s 配置文件。

### 为什么需要？
这是 **GitOps 的核心**：
- ✅ **声明式配置**: K8s 配置存储在 Git 仓库中
- ✅ **版本控制**: 所有变更都有历史记录
- ✅ **自动同步**: Git 有变更，Flux 自动应用到集群
- ✅ **回滚简单**: Git revert 即可回滚

### 示例
```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: 012-repo
  namespace: project-012-development
spec:
  url: https://github.com/997899594/012.git
  ref:
    branch: main
  interval: 1m  # 每分钟检查一次更新
  secretRef:
    name: git-credentials  # Git 访问凭证
```

### 工作流程
```
1. Flux 每 1 分钟检查 Git 仓库
   ↓
2. 发现新的 commit
   ↓
3. 拉取最新的 K8s 配置
   ↓
4. 触发 Kustomization 更新
```

### 如果不创建？
- ❌ Flux 不知道从哪里获取配置
- ❌ 无法实现 GitOps 自动同步
- ❌ 需要手动 kubectl apply

---

## 3️⃣ Kustomization - 部署配置

### 作用
告诉 Flux CD 如何部署应用（从 GitRepository 的哪个路径读取配置）。

### 为什么需要？
- ✅ **指定路径**: 告诉 Flux 读取 `k8s/overlays/development/`
- ✅ **自动应用**: Git 有变更，自动 apply 到集群
- ✅ **健康检查**: 监控部署状态，失败自动回滚
- ✅ **依赖管理**: 可以设置资源创建顺序

### 示例
```yaml
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: 012-kustomization
  namespace: project-012-development
spec:
  sourceRef:
    kind: GitRepository
    name: 012-repo  # 引用 GitRepository
  path: ./k8s/overlays/development  # 配置路径
  interval: 5m  # 每 5 分钟同步一次
  prune: true   # 自动删除不再需要的资源
  timeout: 2m   # 超时时间
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: dev-project-012
      namespace: project-012-development
```

### 工作流程
```
1. GitRepository 拉取到新代码
   ↓
2. Kustomization 读取 k8s/overlays/development/
   ↓
3. 应用 Deployment、Service、Ingress
   ↓
4. 健康检查（Pod 是否 Running）
   ↓
5. 完成 ✅
```

### 如果不创建？
- ❌ Flux 不知道如何部署
- ❌ Git 有变更也不会自动应用
- ❌ 需要手动 kubectl apply

---

## 4️⃣ ImagePullSecret - 镜像拉取凭证

### 作用
提供 GitHub Container Registry (ghcr.io) 的访问凭证，让 K8s 能拉取私有镜像。

### 为什么需要？
- ✅ **私有镜像**: ghcr.io 的镜像默认是私有的
- ✅ **安全**: 不需要公开镜像
- ✅ **权限控制**: 只有有凭证的才能拉取

### 示例
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: project-012-development
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: <base64-encoded-credentials>
```

### 凭证内容
```json
{
  "auths": {
    "ghcr.io": {
      "username": "997899594",
      "password": "ghp_xxx",  # GitHub Token
      "auth": "<base64(username:password)>"
    }
  }
}
```

### Deployment 中引用
```yaml
apiVersion: apps/v1
kind: Deployment
spec:
  template:
    spec:
      imagePullSecrets:
        - name: ghcr-secret  # 引用 Secret
      containers:
        - name: app
          image: ghcr.io/997899594/project-012:latest
```

### 如果不创建？
- ❌ Pod 无法拉取镜像
- ❌ 状态: ImagePullBackOff
- ❌ 错误: "unauthorized: authentication required"

---

## 🔄 完整工作流程

### 1. 初始部署
```
创建项目
  ↓
创建 Namespace（隔离空间）
  ↓
创建 ImagePullSecret（镜像凭证）
  ↓
创建 GitRepository（连接 Git）
  ↓
创建 Kustomization（部署配置）
  ↓
Flux 拉取 Git 配置
  ↓
Flux 应用 Deployment、Service、Ingress
  ↓
K8s 拉取镜像（使用 ImagePullSecret）
  ↓
Pod 启动 ✅
```

### 2. 代码更新
```
开发者 push 代码到 Git
  ↓
GitHub Actions 构建新镜像
  ↓
推送到 ghcr.io/997899594/project-012:latest
  ↓
GitRepository 检测到 Git 变更（1 分钟内）
  ↓
Kustomization 应用新配置（5 分钟内）
  ↓
Deployment 检测到新镜像
  ↓
K8s 滚动更新 Pod
  ↓
完成 ✅
```

### 3. 配置更新
```
开发者修改 k8s/overlays/development/deployment-patch.yaml
  ↓
push 到 Git
  ↓
GitRepository 检测到变更
  ↓
Kustomization 应用新配置
  ↓
Deployment 更新（副本数、资源限制等）
  ↓
完成 ✅
```

---

## 🎯 为什么是 GitOps？

### 传统方式 ❌
```
开发者 → kubectl apply → K8s 集群
```

**问题**:
- ❌ 没有版本控制
- ❌ 不知道谁改了什么
- ❌ 无法回滚
- ❌ 配置分散在各处

### GitOps 方式 ✅
```
开发者 → Git push → Flux CD → K8s 集群
```

**优势**:
- ✅ Git 是唯一的真实来源
- ✅ 所有变更都有历史记录
- ✅ 回滚 = Git revert
- ✅ 自动同步，无需手动操作
- ✅ 声明式配置，易于理解

---

## 📊 资源对比

### 方案 A: 手动管理（不推荐）
```
每次部署:
1. kubectl create namespace
2. kubectl create secret
3. kubectl apply -f deployment.yaml
4. kubectl apply -f service.yaml
5. kubectl apply -f ingress.yaml

更新:
1. 修改本地 YAML
2. kubectl apply -f ...
3. 重复 N 次

问题:
- ❌ 手动操作，容易出错
- ❌ 没有历史记录
- ❌ 多环境管理复杂
```

### 方案 B: GitOps（推荐）✅
```
初始化:
1. 创建 Namespace
2. 创建 ImagePullSecret
3. 创建 GitRepository
4. 创建 Kustomization

之后:
- Git push → 自动部署 ✅
- 无需手动操作 ✅
- 所有变更可追溯 ✅
```

---

## 🔢 资源数量分析

### 每个项目
- 3 个环境（Development、Staging、Production）
- 每个环境 4 个资源
- **总计**: 12 个 K8s 资源

### 集群总计（26 个项目）
- Namespaces: 26 × 3 = **78 个**
- GitRepositories: 26 × 3 = **78 个**
- Kustomizations: 26 × 3 = **78 个**
- Secrets: 26 × 3 = **78 个**
- **总计**: **312 个 GitOps 资源**

### 这多吗？
**不多！** 这是标准的 GitOps 实践：
- ✅ 每个资源都有明确的职责
- ✅ 资源占用很小（几 KB）
- ✅ 自动化管理，无需人工维护
- ✅ 符合 Kubernetes 最佳实践

---

## 💡 类比理解

### 传统部署 = 手动搬家
```
你: 手动搬运每件家具
问题: 累、慢、容易出错、无法追溯
```

### GitOps = 自动化搬家公司
```
你: 写一份清单（Git）
搬家公司（Flux）: 自动搬运、摆放、维护
优势: 快、准、可追溯、可回滚
```

### 4 个资源 = 搬家公司的 4 个部门
```
1. Namespace = 新房子（隔离空间）
2. GitRepository = 清单（配置来源）
3. Kustomization = 搬运工（执行部署）
4. ImagePullSecret = 钥匙（访问权限）
```

---

## 🎓 学习资源

### Flux CD 官方文档
- [GitOps Toolkit](https://fluxcd.io/flux/components/)
- [GitRepository](https://fluxcd.io/flux/components/source/gitrepositories/)
- [Kustomization](https://fluxcd.io/flux/components/kustomize/kustomization/)

### 相关文档
- [K8s 模板设计](./k8s-template-design.md)
- [Flux 性能优化](../troubleshooting/flux-performance-optimization.md)
- [GitOps 最佳实践](../guides/production-readiness-checklist.md)

---

## ✅ 总结

### 为什么需要这些资源？

1. **Namespace**: 隔离环境，方便管理
2. **GitRepository**: 连接 Git，实现 GitOps
3. **Kustomization**: 自动部署，持续同步
4. **ImagePullSecret**: 拉取私有镜像

### 核心价值

- ✅ **自动化**: Git push → 自动部署
- ✅ **可追溯**: 所有变更都在 Git 中
- ✅ **可回滚**: Git revert 即可
- ✅ **声明式**: 描述期望状态，Flux 负责实现

### 一句话总结

**这些资源是 GitOps 的基础设施，让你的部署流程自动化、可追溯、可回滚。** 🚀
