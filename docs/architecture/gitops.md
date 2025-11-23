# GitOps 配置指南

## Flux 工作原理

```
代码推送到 Git → Flux 检测变化 → 自动部署到 K8s
```

## 创建 GitRepository

```yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: my-app
  namespace: default
spec:
  url: https://github.com/user/repo.git
  interval: 1m
  ref:
    branch: main
  secretRef:
    name: git-auth
```

## 创建 Kustomization

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
  path: ./k8s
  prune: true
  interval: 5m
```

## 配置 Git 认证

```bash
# 创建 Secret
kubectl create secret generic git-auth \
  --from-literal=username=your-username \
  --from-literal=password=your-token
```

## 支持的 Git 服务

- GitHub
- GitLab（公有云和私服）
- Gitea
- Bitbucket

详见 [架构文档](./architecture.md)
