# 配置 GitHub Container Registry 指南

## 概述

本指南帮助你配置 GitHub Container Registry (ghcr.io) 作为项目镜像仓库。

## 为什么选择 GHCR？

- ✅ **完全免费** - 公开和私有镜像无限存储
- ✅ **无拉取限制** - 不像 Docker Hub 有速率限制
- ✅ **与 GitHub 集成** - 使用同一个 token
- ✅ **全球 CDN** - 拉取速度快

## 步骤 1: 创建 GitHub Token

1. 访问 https://github.com/settings/tokens
2. 点击 "Generate new token" → "Generate new token (classic)"
3. 设置 Token 名称：`Juanie DevOps - Container Registry`
4. 勾选权限：
   - ✅ `read:packages` - 拉取镜像
   - ✅ `write:packages` - 推送镜像
   - ✅ `delete:packages` - 删除镜像（可选）
5. 点击 "Generate token"
6. **立即复制 token**（只显示一次）

## 步骤 2: 配置环境变量

编辑 `.env` 文件：

```bash
# 添加镜像仓库配置
REGISTRY_URL=ghcr.io/997899594
```

重启后端服务：
```bash
bun run dev:api
```

## 步骤 3: 配置 K8s ImagePullSecret

为每个项目 namespace 配置 secret：

```bash
# 获取项目 ID（从数据库或前端）
PROJECT_ID="<your-project-id>"

# 为三个环境配置 secret
./scripts/setup-image-pull-secret.sh <github-token> project-${PROJECT_ID}-production
./scripts/setup-image-pull-secret.sh <github-token> project-${PROJECT_ID}-staging
./scripts/setup-image-pull-secret.sh <github-token> project-${PROJECT_ID}-development
```

**批量配置**（所有项目）:
```bash
# 获取所有项目 namespace
kubectl get ns | grep "^project-" | awk '{print $1}' | while read ns; do
  echo "配置 $ns..."
  ./scripts/setup-image-pull-secret.sh <github-token> $ns
done
```

## 步骤 4: 构建项目镜像

### 方式 1: 使用 GitHub Actions（推荐）

1. 进入 GitHub 仓库
2. 点击 "Actions" 标签
3. 选择 "Build Project Image" workflow
4. 点击 "Run workflow"
5. 输入参数：
   - `project_slug`: 项目 slug（如 `011`）
   - `tag`: 镜像标签（默认 `latest`）
6. 等待构建完成（约 2-5 分钟）

### 方式 2: 本地构建（测试用）

```bash
# 登录 GHCR
echo <github-token> | docker login ghcr.io -u 997899594 --password-stdin

# 构建镜像
docker build -t ghcr.io/997899594/011:latest .

# 推送镜像
docker push ghcr.io/997899594/011:latest
```

## 步骤 5: 验证配置

### 检查 Secret
```bash
kubectl get secret ghcr-secret -n project-<project-id>-production
```

### 检查镜像
```bash
# 在 GitHub 查看
# https://github.com/997899594?tab=packages

# 或使用 API
curl -H "Authorization: Bearer <github-token>" \
  https://api.github.com/user/packages/container/011/versions
```

### 测试拉取
```bash
# 在 K8s 节点上测试
docker pull ghcr.io/997899594/011:latest
```

## 步骤 6: 部署项目

创建新项目时，系统会自动：
1. 使用 `REGISTRY_URL` 配置镜像地址
2. 在 Deployment 中引用 `ghcr-secret`
3. Flux CD 自动拉取镜像并部署

**手动触发部署**:
```bash
# 重新部署项目
flux reconcile kustomization <project-name>-production -n flux-system
```

## 常见问题

### Q1: 镜像拉取失败 "unauthorized"

**原因**: ImagePullSecret 未配置或 token 过期

**解决**:
```bash
# 重新配置 secret
./scripts/setup-image-pull-secret.sh <new-token> <namespace>

# 重启 Pod
kubectl rollout restart deployment <deployment-name> -n <namespace>
```

### Q2: 镜像不存在 "not found"

**原因**: 镜像未构建或名称不匹配

**解决**:
1. 检查镜像是否存在：https://github.com/997899594?tab=packages
2. 运行 GitHub Actions 构建镜像
3. 确认 Deployment 中的镜像名称正确

### Q3: GitHub Actions 构建失败

**原因**: 权限不足或 Dockerfile 错误

**解决**:
1. 检查仓库 Settings → Actions → General → Workflow permissions
2. 确保选择 "Read and write permissions"
3. 检查 Dockerfile 语法

### Q4: 如何删除旧镜像？

```bash
# 使用 GitHub CLI
gh api -X DELETE /user/packages/container/011/versions/<version-id>

# 或在 GitHub 网页上删除
# https://github.com/997899594?tab=packages → 选择包 → Settings → Delete
```

## 最佳实践

### 1. 使用语义化版本

```bash
# 构建时指定版本
docker build -t ghcr.io/997899594/011:v1.0.0 .
docker build -t ghcr.io/997899594/011:latest .
```

### 2. 定期清理旧镜像

```bash
# 保留最近 10 个版本，删除其他
gh api /user/packages/container/011/versions \
  | jq -r '.[10:] | .[].id' \
  | xargs -I {} gh api -X DELETE /user/packages/container/011/versions/{}
```

### 3. 使用多阶段构建

```dockerfile
# 构建阶段
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install
COPY . .
RUN bun run build

# 运行阶段
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./
RUN bun install --production
CMD ["bun", "start"]
```

### 4. 启用镜像缓存

GitHub Actions 已配置缓存：
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

## 成本

- **存储**: 免费（无限）
- **拉取**: 免费（无限）
- **推送**: 免费（无限）
- **总成本**: $0/月 ✅

## 下一步

- [ ] 配置自动构建（Push 时触发）
- [ ] 添加镜像扫描（安全检查）
- [ ] 配置镜像签名（供应链安全）
- [ ] 设置镜像保留策略（自动清理）

## 参考资料

- [GitHub Container Registry 文档](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [Kubernetes ImagePullSecrets](https://kubernetes.io/docs/tasks/configure-pod-container/pull-image-private-registry/)
