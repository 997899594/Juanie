# 生产就绪检查清单

## 概述

在创建新项目（如 011）之前，确保所有系统组件都已正确配置。

## 检查清单

### 1. 环境变量配置 ✅

**检查**:
```bash
grep -E "REGISTRY_URL|ENCRYPTION_KEY" .env
```

**预期结果**:
```bash
REGISTRY_URL=ghcr.io
ENCRYPTION_KEY=your_encryption_key_at_least_32_characters_long
```

**说明**: 
- `REGISTRY_URL` 只需要配置为 `ghcr.io`，镜像路径会自动使用用户的 GitHub 用户名
- `ENCRYPTION_KEY` 用于加密用户的 GitHub Token

**状态**: ✅ 已配置

---

### 2. K3s 集群连接

**检查**:
```bash
kubectl cluster-info --kubeconfig=.kube/k3s-remote.yaml
```

**预期结果**:
```
Kubernetes control plane is running at https://...
```

**状态**: ✅ 已连接

---

### 3. Flux CD 状态

**检查**:
```bash
kubectl get pods -n flux-system --kubeconfig=.kube/k3s-remote.yaml
```

**预期结果**:
```
NAME                                       READY   STATUS    RESTARTS   AGE
source-controller-xxx                      1/1     Running   0          3d
kustomize-controller-xxx                   1/1     Running   0          3d
helm-controller-xxx                        1/1     Running   0          3d
notification-controller-xxx                1/1     Running   0          3d
```

**检查命令**:
```bash
flux check --kubeconfig=.kube/k3s-remote.yaml
```

---

### 4. 集群资源状态

**检查**:
```bash
./scripts/check-k3s-resources.sh
```

**预期结果**:
```
📊 节点资源使用:
内存使用率: < 70%

📦 Pod 统计:
Pending: 0
Failed: 0
```

**状态**: ✅ 资源充足

---

### 5. GitHub Container Registry 访问

**检查**:
```bash
echo "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" | docker login ghcr.io -u 997899594 --password-stdin
```

**预期结果**:
```
Login Succeeded
```

**清理**:
```bash
docker logout ghcr.io
```

---

### 6. GitHub OAuth 配置

**检查**:
```bash
grep -E "GITHUB_CLIENT_ID|GITHUB_CLIENT_SECRET" .env
```

**预期结果**:
```bash
GITHUB_CLIENT_ID=Ov23li5kloVVHQeOSefR
GITHUB_CLIENT_SECRET=9a25b1ff8bcab87fa9518421614111365db1705b
```

**验证**: 在前端登录 GitHub 账户

---

### 7. 数据库连接

**检查**:
```bash
psql postgresql://findbiao:biao1996.@localhost:5432/juanie_devops -c "SELECT 1"
```

**预期结果**:
```
 ?column? 
----------
        1
```

---

### 8. Redis 连接

**检查**:
```bash
redis-cli -u redis://localhost:6379 ping
```

**预期结果**:
```
PONG
```

---

### 9. 后端服务状态

**检查**:
```bash
curl http://localhost:3000/health
```

**预期结果**:
```json
{"status":"ok"}
```

**启动后端**:
```bash
bun run dev:api
```

---

### 10. 前端服务状态

**检查**:
```bash
curl http://localhost:1997
```

**预期结果**: 返回 HTML 页面

**启动前端**:
```bash
bun run dev:web
```

---

### 11. K8s 模板配置

**检查**:
```bash
# 检查资源配置
grep -A 5 "resources:" templates/nextjs-15-app/k8s/base/deployment.yaml

# 检查 imagePullSecrets
grep -A 2 "imagePullSecrets:" templates/nextjs-15-app/k8s/base/deployment.yaml

# 检查镜像地址
grep "image:" templates/nextjs-15-app/k8s/base/deployment.yaml
```

**预期结果**:
```yaml
resources:
  requests:
    cpu: 50m
    memory: 64Mi
  limits:
    cpu: 200m
    memory: 256Mi

imagePullSecrets:
- name: ghcr-secret

image: {{ registry }}/{{ appName }}:latest
```

**状态**: ✅ 已优化

---

### 12. GitHub Actions Workflow

**检查**:
```bash
cat .github/workflows/build-project-image.yml | grep -A 5 "workflow_dispatch"
```

**预期结果**: 包含 `workflow_dispatch` 触发器

**状态**: ✅ 已创建

---

## 创建新项目流程

### 前置条件

确保以上 12 项检查全部通过 ✅

### 步骤 1: 重启后端（加载新配置）

```bash
# 停止当前后端
# Ctrl+C

# 重启后端
bun run dev:api
```

**验证**: 检查日志中是否加载了 `REGISTRY_URL` 和 `GITHUB_PACKAGES_TOKEN`

### 步骤 2: 在前端创建项目

1. 访问 http://localhost:1997
2. 登录 GitHub 账户
3. 点击 "创建项目"
4. 填写项目信息：
   - 名称: `011`
   - 描述: `测试项目`
   - 仓库: 选择 GitHub
   - 可见性: Private
5. 点击 "创建"

### 步骤 3: 监控初始化进度

**前端**: 查看初始化进度条

**后端日志**:
```bash
# 应该看到以下日志
[ProjectInitializationWorker] Processing project initialization
[ProjectInitializationWorker] Creating Git repository
[ProjectInitializationWorker] Pushing template code
[ProjectInitializationWorker] Creating database records
[ProjectInitializationWorker] Setting up GitOps
[FluxResourcesService] Creating namespace: project-xxx-development
[FluxResourcesService] Creating ImagePullSecret in project-xxx-development
[FluxResourcesService] ✅ ImagePullSecret created in project-xxx-development
[ProjectInitializationWorker] Project initialization completed
```

### 步骤 4: 验证 K8s 资源

**检查 Namespace**:
```bash
kubectl get ns --kubeconfig=.kube/k3s-remote.yaml | grep project-
```

**预期结果**:
```
project-<project-id>-development
project-<project-id>-staging
project-<project-id>-production
```

**检查 ImagePullSecret**:
```bash
kubectl get secret ghcr-secret -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

**预期结果**:
```
NAME          TYPE                             DATA   AGE
ghcr-secret   kubernetes.io/dockerconfigjson   1      1m
```

**检查 GitRepository**:
```bash
kubectl get gitrepositories -A --kubeconfig=.kube/k3s-remote.yaml
```

**预期结果**:
```
NAMESPACE                              NAME              URL                                    READY
project-<project-id>-development       <project-id>-repo https://github.com/997899594/011.git  True
project-<project-id>-staging           <project-id>-repo https://github.com/997899594/011.git  True
project-<project-id>-production        <project-id>-repo https://github.com/997899594/011.git  True
```

**检查 Kustomization**:
```bash
kubectl get kustomizations -A --kubeconfig=.kube/k3s-remote.yaml
```

**预期结果**:
```
NAMESPACE                              NAME                        READY
project-<project-id>-development       <project-id>-development    True
project-<project-id>-staging           <project-id>-staging        True
project-<project-id>-production        <project-id>-production     True
```

### 步骤 5: 构建项目镜像

**方式 1: GitHub Actions（推荐）**

1. 访问 https://github.com/997899594/011/actions
2. 选择 "Build Project Image" workflow
3. 点击 "Run workflow"
4. 输入:
   - `project_slug`: `011`
   - `tag`: `latest`
5. 等待构建完成（约 2-5 分钟）

**方式 2: 本地构建**

```bash
# 克隆仓库
git clone https://github.com/997899594/011.git
cd 011

# 登录 GHCR
echo "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" | docker login ghcr.io -u 997899594 --password-stdin

# 构建镜像
docker build -t ghcr.io/997899594/011:latest .

# 推送镜像
docker push ghcr.io/997899594/011:latest
```

### 步骤 6: 验证部署

**检查 Pod 状态**:
```bash
kubectl get pods -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

**预期结果**:
```
NAME                           READY   STATUS    RESTARTS   AGE
prod-011-xxx                   1/1     Running   0          2m
```

**如果是 ImagePullBackOff**:
```bash
# 检查详细信息
kubectl describe pod prod-011-xxx -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml

# 常见原因：
# 1. 镜像未构建 → 执行步骤 5
# 2. ImagePullSecret 未配置 → 应该自动配置了，检查日志
# 3. Token 无效 → 检查 GITHUB_PACKAGES_TOKEN
```

**检查 Pod 日志**:
```bash
kubectl logs -f prod-011-xxx -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

**检查 Service**:
```bash
kubectl get svc -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

**检查 Ingress**:
```bash
kubectl get ingress -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml
```

### 步骤 7: 访问应用

**获取访问地址**:
```bash
kubectl get ingress -n project-<project-id>-production --kubeconfig=.kube/k3s-remote.yaml -o jsonpath='{.items[0].spec.rules[0].host}'
```

**访问**: http://<host>

---

## 故障排查

### 问题 1: 项目初始化失败

**检查后端日志**:
```bash
# 查看错误信息
tail -f logs/api-gateway.log
```

**常见原因**:
- GitHub OAuth 未配置
- Git 仓库创建失败
- K3s 连接失败

### 问题 2: ImagePullSecret 未自动创建

**检查环境变量**:
```bash
grep GITHUB_PACKAGES_TOKEN .env
```

**手动创建**:
```bash
./scripts/setup-image-pull-secret.sh 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 project-<project-id>-production
```

### 问题 3: GitRepository 失败

**检查详细信息**:
```bash
kubectl describe gitrepository <name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml
```

**常见原因**:
- 仓库不存在
- Git Secret 未配置
- 网络问题

### 问题 4: Kustomization 失败

**检查详细信息**:
```bash
kubectl describe kustomization <name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml
```

**常见原因**:
- GitRepository 未就绪
- K8s 模板语法错误
- 路径不存在

### 问题 5: Pod Pending

**检查原因**:
```bash
kubectl describe pod <pod-name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml
```

**常见原因**:
- 资源不足 → 停止其他环境
- 镜像拉取失败 → 检查 ImagePullSecret
- 调度失败 → 检查节点状态

---

## 当前状态总结

### ✅ 已完成

1. ✅ K3s 资源优化（降低 75%）
2. ✅ GitHub Container Registry 配置
3. ✅ ImagePullSecret 自动化
4. ✅ 环境变量配置
5. ✅ 旧项目清理
6. ✅ 工具脚本创建
7. ✅ 完整文档

### ⏳ 待执行

1. ⏳ 重启后端（加载新配置）
2. ⏳ 创建 011 项目
3. ⏳ 构建项目镜像
4. ⏳ 验证部署

### 🎯 准备就绪

所有基础设施和配置已完成，可以创建新项目了！

**下一步**:
1. 重启后端: `bun run dev:api`
2. 在前端创建 011 项目
3. 监控初始化进度
4. 构建镜像
5. 验证部署

---

## 快速命令参考

```bash
# 检查集群状态
./scripts/check-k3s-resources.sh

# 验证优化效果
./scripts/verify-optimization.sh

# 检查 Flux 状态
flux check --kubeconfig=.kube/k3s-remote.yaml

# 查看所有 GitRepository
kubectl get gitrepositories -A --kubeconfig=.kube/k3s-remote.yaml

# 查看所有 Kustomization
kubectl get kustomizations -A --kubeconfig=.kube/k3s-remote.yaml

# 查看所有 Pod
kubectl get pods -A --kubeconfig=.kube/k3s-remote.yaml

# 查看项目日志
kubectl logs -f <pod-name> -n <namespace> --kubeconfig=.kube/k3s-remote.yaml
```
