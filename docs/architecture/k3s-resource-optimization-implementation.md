# K3s 资源优化实施完成

## 优化目标

解决 3.6GB K3s 集群资源耗尽问题，支持更多项目部署。

## 实施方案

### 1. 降低资源请求 ✅

**Base 配置** (`templates/nextjs-15-app/k8s/base/deployment.yaml`):
```yaml
resources:
  requests:
    cpu: 50m      # 从 100m 降低 50%
    memory: 64Mi  # 从 256Mi 降低 75%
  limits:
    cpu: 200m     # 从 500m 降低 60%
    memory: 256Mi # 从 512Mi 降低 50%
```

**环境差异化配置**:

- **Development**: 64Mi requests, 128Mi limits, 0 副本（按需启动）
- **Staging**: 96Mi requests, 192Mi limits, 0 副本（按需启动）
- **Production**: 128Mi requests, 256Mi limits, 1 副本（始终运行）

### 2. 按需启动策略 ✅

**Development/Staging 环境**:
```yaml
spec:
  replicas: 0  # 默认不运行
```

**手动启动命令**:
```bash
# 启动开发环境
kubectl scale deployment dev-project-xxx --replicas=1 -n project-xxx-development

# 停止开发环境
kubectl scale deployment dev-project-xxx --replicas=0 -n project-xxx-development
```

### 3. 镜像仓库配置 ✅

**选择方案**: GitHub Container Registry (ghcr.io)

**优势**:
- 完全免费
- 与 GitHub 深度集成
- 无拉取限制
- 全球 CDN

**配置**:

1. **环境变量** (`.env.example`):
```bash
REGISTRY_URL=ghcr.io/997899594
```

2. **GitHub Actions** (`.github/workflows/build-project-image.yml`):
   - 手动触发构建
   - 自动推送到 ghcr.io
   - 支持自定义 tag

3. **K8s ImagePullSecret** (`scripts/setup-image-pull-secret.sh`):
```bash
./scripts/setup-image-pull-secret.sh <github-token> <namespace>
```

## 资源计算

### 优化前（256Mi，全部运行）
```
10 个项目 × 3 环境 = 30 个 Pod
30 × 256Mi = 7.68GB
状态: 无法运行 ❌
```

### 优化后（差异化配置 + 按需启动）
```
10 个项目:
- Production: 10 × 128Mi = 1.28GB
- Dev: 2 × 64Mi = 128Mi (按需)
- Staging: 1 × 96Mi = 96Mi (按需)
总计: 1.5GB
状态: 可以运行 ✅
```

### 扩展能力
```
3.6GB 集群（可用 3.2GB）:
- Production only: 3200Mi ÷ 128Mi = 25 个项目
- 混合模式: 20 个项目 + 5-10 个活跃 dev/staging
```

## 实施步骤

### 立即执行

1. **更新 .env 配置**:
```bash
# 添加到 .env
REGISTRY_URL=ghcr.io/997899594
```

2. **获取 GitHub Token**:
   - 访问 https://github.com/settings/tokens
   - 创建 Personal Access Token (Classic)
   - 勾选 `read:packages` 和 `write:packages` 权限

3. **配置 ImagePullSecret**（为每个项目 namespace）:
```bash
# 示例：为 011 项目配置
./scripts/setup-image-pull-secret.sh <token> project-<project-id>-production
./scripts/setup-image-pull-secret.sh <token> project-<project-id>-staging
./scripts/setup-image-pull-secret.sh <token> project-<project-id>-development
```

4. **构建项目镜像**:
   - 进入 GitHub Actions
   - 运行 "Build Project Image" workflow
   - 输入项目 slug（如 `011`）

5. **重新部署项目**:
```bash
# Flux 会自动检测配置变更并重新部署
# 或手动触发
flux reconcile kustomization <project-name> -n flux-system
```

### 验证

1. **检查 Pod 资源**:
```bash
kubectl top pods -A
```

2. **检查 Pod 状态**:
```bash
kubectl get pods -A | grep project-
```

3. **检查镜像拉取**:
```bash
kubectl describe pod <pod-name> -n <namespace>
```

## 成本对比

| 方案 | 10个项目 | 25个项目 | 100个项目 |
|------|---------|---------|----------|
| 优化前 | 7.68GB ❌ | 19.2GB ❌ | 76.8GB ❌ |
| 优化后 | 1.5GB ✅ | 3.5GB ✅ | 13GB (需扩容) |

## 下一步优化（可选）

### 1. HPA 自动缩容（1-2周）

为 dev/staging 添加自动缩容：
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
spec:
  minReplicas: 0
  maxReplicas: 3
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # 5分钟无流量后缩容
```

### 2. K3s 内置 Registry（可选）

如果 GitHub Actions 构建慢，可以部署本地 Registry：
```bash
kubectl apply -f infra/registry/registry.yaml
```

### 3. 集群扩容（长期）

当项目超过 20 个时：
- 升级到 8GB 内存服务器（支持 50+ 项目）
- 或添加 Worker 节点（水平扩展）

## 文件变更清单

### 修改的文件
- `templates/nextjs-15-app/k8s/base/deployment.yaml` - 降低基础资源
- `.env.example` - 添加 REGISTRY_URL 配置

### 新增的文件
- `templates/nextjs-15-app/k8s/overlays/development/deployment-patch.yaml` - Dev 环境配置
- `templates/nextjs-15-app/k8s/overlays/staging/deployment-patch.yaml` - Staging 环境配置
- `templates/nextjs-15-app/k8s/overlays/production/deployment-patch.yaml` - Production 环境配置
- `.github/workflows/build-project-image.yml` - 镜像构建流程
- `scripts/setup-image-pull-secret.sh` - ImagePullSecret 配置脚本

### 更新的文件
- `templates/nextjs-15-app/k8s/overlays/development/kustomization.yaml` - 引用 patch
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml` - 引用 patch
- `templates/nextjs-15-app/k8s/overlays/production/kustomization.yaml` - 引用 patch

## 总结

通过降低资源请求（75%）+ 按需启动策略，3.6GB 集群从无法运行变为可支持 20-25 个项目。配置 GitHub Container Registry 解决了镜像仓库问题，整体方案零成本、配置简单、效果显著。
