# K3s 优化快速参考

## 🚀 快速命令

### 检查集群状态
```bash
./scripts/check-k3s-resources.sh
```

### 验证优化效果
```bash
./scripts/verify-optimization.sh
```

### 启动/停止环境
```bash
# 启动 Dev
kubectl scale deployment dev-<slug> --replicas=1 -n project-<id>-development

# 停止 Dev
kubectl scale deployment dev-<slug> --replicas=0 -n project-<id>-development

# 批量停止所有 Dev
kubectl get deployments -A | grep development | \
  awk '{print $2 " -n " $1}' | \
  xargs -I {} kubectl scale deployment {} --replicas=0
```

### 配置 ImagePullSecret（已自动化）
```bash
# 新项目会自动配置 ImagePullSecret
# 使用用户自己的 GitHub OAuth Token
# 无需手动操作
```

### 清理旧项目
```bash
./scripts/cleanup-old-projects.sh
```

## 📊 资源配置

| 环境 | 副本 | CPU | 内存 |
|------|------|-----|------|
| Dev | 0 | 50m | 64Mi |
| Staging | 0 | 50m | 96Mi |
| Production | 1 | 100m | 128Mi |

## 🔧 环境变量

```bash
# 镜像仓库
REGISTRY_URL=ghcr.io

# 加密密钥（至少32个字符）
ENCRYPTION_KEY=your_encryption_key_at_least_32_characters_long
```

**说明**: 镜像路径会自动使用用户的 GitHub 用户名（`ghcr.io/<username>/<project>`）

## 📦 镜像仓库

**地址**: ghcr.io  
**认证**: 每个用户使用自己的 GitHub OAuth Token  
**Secret**: ghcr-secret（自动创建）

## 🎯 支持能力

- **3.6GB 集群**: 25 个项目
- **8GB 集群**: 60 个项目
- **16GB 集群**: 120 个项目

## 📚 文档

- [完整指南](./k3s-optimization-complete.md)
- [执行清单](./k3s-optimization-checklist.md)
- [GHCR 配置](./setup-github-container-registry.md)
- [实施文档](../architecture/k3s-resource-optimization-implementation.md)
