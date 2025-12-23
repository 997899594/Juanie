# Flux Kustomization 卡在 Reconciling 状态

## 问题描述

Flux Kustomization 资源一直处于 `Reconciling` 状态，无法完成同步。GitRepository 已经成功拉取代码，但 Kustomization 无法应用配置。

## 症状

### 1. Kustomization 状态显示 Reconciling

```bash
$ kubectl get kustomization -A
NAMESPACE     NAME                    AGE   READY     STATUS
flux-system   project-xxx-dev         10m   Unknown   Reconciling
```

### 2. 详细状态显示 health check 超时

```bash
$ kubectl describe kustomization project-xxx-dev -n flux-system

Status:
  Conditions:
    - Type: Ready
      Status: Unknown
      Reason: Progressing
      Message: "running health checks with a timeout of 9m30s"
```

### 3. source-controller 日志显示连接被拒绝

```bash
$ kubectl logs -n flux-system deployment/source-controller --tail=50

level=error msg="failed to get artifact" 
error="Get \"http://source-controller.flux-system.svc.cluster.local:9090/...\": 
dial tcp 10.43.x.x:9090: connect: connection refused"
```

## 根本原因

### NetworkPolicy 阻止了 9090 端口

Flux 的 kustomize-controller 需要从 source-controller 的 9090 端口获取 artifact（Git 仓库的压缩包）。如果 NetworkPolicy 没有允许这个端口，kustomize-controller 就无法获取代码来应用。

**Flux 内部通信流程：**

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   GitRepository     │────▶│  source-controller  │────▶│ kustomize-controller│
│   (定义 Git 源)     │     │  (拉取代码到 :9090) │     │  (从 :9090 获取并   │
│                     │     │                     │     │   应用 Kustomization)│
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
                                    ▲
                                    │ HTTP :9090
                                    │
                            ❌ NetworkPolicy 阻止
```

**问题的网络策略：**

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress
  namespace: flux-system
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  - ports:
    - port: 443      # ✅ HTTPS
      protocol: TCP
    - port: 22       # ✅ SSH
      protocol: TCP
    - port: 6443     # ✅ Kubernetes API
      protocol: TCP
    # ❌ 缺少 9090 端口 (source-controller artifact 服务)
```

## 诊断过程

### 步骤 1：检查 Kustomization 状态

```bash
# 查看所有 Kustomization
kubectl get kustomization -A

# 查看详细状态
kubectl describe kustomization <name> -n flux-system
```

**关键信息：**
- `Ready: Unknown` + `Reconciling` = 正在处理中但无法完成
- `running health checks with a timeout` = 等待某些资源就绪

### 步骤 2：检查 source-controller 日志

```bash
kubectl logs -n flux-system deployment/source-controller --tail=100
```

**关键错误信息：**
```
dial tcp 10.43.x.x:9090: connect: connection refused
```

这表明有组件无法连接到 source-controller 的 9090 端口。

### 步骤 3：检查 kustomize-controller 日志

```bash
kubectl logs -n flux-system deployment/kustomize-controller --tail=100
```

**可能看到的错误：**
```
failed to get artifact: connection refused
```

### 步骤 4：检查 NetworkPolicy

```bash
# 列出所有网络策略
kubectl get networkpolicy -n flux-system

# 查看详细配置
kubectl get networkpolicy allow-egress -n flux-system -o yaml
```

**检查点：**
- 是否有 egress 规则？
- 9090 端口是否在允许列表中？
- 是否允许 flux-system 命名空间内部通信？

### 步骤 5：测试内部连接

```bash
# 从 kustomize-controller 测试连接 source-controller
kubectl exec -it -n flux-system deployment/kustomize-controller -- \
  wget -q -O- http://source-controller.flux-system.svc.cluster.local:9090/

# 或者使用 curl（如果可用）
kubectl exec -it -n flux-system deployment/kustomize-controller -- \
  curl -s http://source-controller.flux-system.svc.cluster.local:9090/
```

**预期结果：**
- 如果 NetworkPolicy 阻止：`connection refused` 或超时
- 如果正常：返回 404 或其他 HTTP 响应

## 解决方案

### 方案 1：更新 NetworkPolicy 添加 9090 端口

```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-egress
  namespace: flux-system
spec:
  podSelector: {}
  policyTypes:
  - Egress
  egress:
  # 允许集群内部通信（包括 source-controller 的 9090 端口）
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 6443
    - protocol: TCP
      port: 9090    # ← 添加这个！source-controller artifact 服务
  
  # 允许 DNS 查询
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
  
  # 允许外部 HTTPS 和 SSH
  - ports:
    - protocol: TCP
      port: 443   # HTTPS
    - protocol: TCP
      port: 22    # SSH
EOF
```

### 方案 2：允许 flux-system 内部所有通信

如果你希望 flux-system 内部的 pod 可以自由通信：

```bash
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-flux-internal
  namespace: flux-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # 允许来自 flux-system 的所有入站流量
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: flux-system
  egress:
  # 允许到 flux-system 的所有出站流量
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: flux-system
EOF
```

### 方案 3：临时删除 NetworkPolicy（仅用于测试）

```bash
# 备份当前策略
kubectl get networkpolicy allow-egress -n flux-system -o yaml > networkpolicy-backup.yaml

# 删除策略
kubectl delete networkpolicy allow-egress -n flux-system

# 测试是否解决问题
kubectl get kustomization -A

# 如果解决了，重新应用修复后的策略
```

## 验证修复

### 1. 检查 Kustomization 状态

```bash
# 等待几秒钟让策略生效
sleep 10

# 检查状态
kubectl get kustomization -A

# 应该看到：
# NAMESPACE     NAME                    AGE   READY   STATUS
# flux-system   project-xxx-dev         15m   True    Applied revision: main@sha1:xxx
```

### 2. 强制重新同步

如果状态没有自动更新，可以强制重新同步：

```bash
# 方法 1：使用 flux CLI
flux reconcile kustomization project-xxx-dev -n flux-system

# 方法 2：添加注解触发同步
kubectl annotate kustomization project-xxx-dev -n flux-system \
  reconcile.fluxcd.io/requestedAt="$(date +%s)" --overwrite
```

### 3. 检查日志确认无错误

```bash
# source-controller 日志
kubectl logs -n flux-system deployment/source-controller --tail=20

# kustomize-controller 日志
kubectl logs -n flux-system deployment/kustomize-controller --tail=20
```

## Flux 组件端口说明

| 组件 | 端口 | 用途 |
|------|------|------|
| source-controller | 9090 | HTTP artifact 服务，提供 Git/Helm 仓库内容 |
| source-controller | 8080 | 健康检查和 metrics |
| kustomize-controller | 8080 | 健康检查和 metrics |
| helm-controller | 8080 | 健康检查和 metrics |
| notification-controller | 9090 | Webhook 接收器 |
| notification-controller | 8080 | 健康检查和 metrics |

## 完整的 NetworkPolicy 示例

以下是一个完整的、经过验证的 NetworkPolicy 配置：

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: flux-system-network-policy
  namespace: flux-system
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
  
  ingress:
  # 允许来自 flux-system 命名空间的入站流量
  - from:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: flux-system
  
  # 允许来自其他命名空间的 webhook 请求
  - from:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 9090
  
  egress:
  # 1. 允许 flux-system 内部通信
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: flux-system
  
  # 2. 允许访问 Kubernetes API
  - to:
    - namespaceSelector: {}
    ports:
    - protocol: TCP
      port: 443
    - protocol: TCP
      port: 6443
  
  # 3. 允许 DNS 查询
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53
  
  # 4. 允许外部 Git 访问
  - ports:
    - protocol: TCP
      port: 443   # HTTPS (GitHub, GitLab, Helm repos)
    - protocol: TCP
      port: 22    # SSH (Git over SSH)
```

## 故障排查清单

- [ ] 检查 Kustomization 状态是否为 Reconciling
- [ ] 查看 source-controller 日志是否有 9090 端口连接错误
- [ ] 检查 NetworkPolicy 是否存在
- [ ] 确认 9090 端口在 egress 规则中
- [ ] 测试 flux-system 内部 pod 间通信
- [ ] 验证修复后 Kustomization 变为 Ready

## 经验教训

1. **Flux 组件间通信需要 9090 端口**：source-controller 通过 9090 端口提供 artifact 服务，其他控制器需要访问这个端口获取代码/配置。

2. **NetworkPolicy 需要考虑内部通信**：不仅要考虑外部访问（22, 443），还要考虑集群内部组件间的通信。

3. **日志是关键**：`connection refused` 错误通常指向网络策略问题。

4. **分层诊断**：
   - 先检查资源状态
   - 再查看控制器日志
   - 最后检查网络策略

## 相关问题

- [SSH 认证问题](./ssh-authentication.md)
- [网络策略阻止 SSH 连接](./network-policy.md)

## 参考资料

- [Flux 架构文档](https://fluxcd.io/flux/components/)
- [Kubernetes NetworkPolicy](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [Flux 网络要求](https://fluxcd.io/flux/installation/#network-requirements)
