# Next.js Standalone 模式网络监听问题修复

## ⚠️ 重要更新：监听 Pod IP 不是问题！

经过深入测试，发现 **Next.js 监听 Pod IP 完全正常**，Service 可以正常转发流量。

**测试结果**:
```bash
# 应用监听在 Pod IP
netstat -tlnp | grep 3000
tcp  0  0  10.42.0.190:3000  0.0.0.0:*  LISTEN

# Service 正常工作
wget -O- http://10.43.19.100  # ✅ 返回 HTML
wget -O- http://10.42.0.190:3000  # ✅ 返回 HTML
```

**结论**: K8s Service 会自动处理 Pod IP 的流量转发，监听 Pod IP 或 0.0.0.0 都可以。

## 真正的问题：Ingress 配置错误

**症状**:
- Pod 状态显示 Running
- 应用日志显示 "Ready in XXXms"
- Service 内部访问正常
- 但外部无法通过 Ingress 访问

## 根本原因

Ingress 配置使用了错误的 IngressClass：

```yaml
spec:
  ingressClassName: nginx  # ❌ 错误
  annotations:
    nginx.ingress.kubernetes.io/ssl-redirect: "true"  # ❌ 错误
```

但集群只安装了 Traefik，没有 Nginx Ingress Controller。

## 解决方案

### ✅ 正确方案：修复 Ingress 配置

修改 `k8s/base/ingress.yaml`：

```yaml
spec:
  ingressClassName: traefik  # ✅ 改为 traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/redirect-entry-point: https  # ✅ 使用 traefik 注解
```

**为什么有效**：
- 集群安装的是 Traefik Ingress Controller
- Traefik 会读取 `ingressClassName: traefik` 的 Ingress 资源
- 使用正确的注解语法

### ❌ 错误理解：认为必须监听 0.0.0.0

之前错误地认为应用必须监听 `0.0.0.0:3000`，实际上：
- K8s Service 会自动处理 Pod IP 的流量转发
- 监听 Pod IP 或 0.0.0.0 都可以正常工作
- 这不是问题的根源

## 修复步骤（rrr 项目）

### 1. 更新 GitHub 仓库配置

在 `https://github.com/997899594/rrr` 仓库中：

修改 `k8s/base/ingress.yaml`：

```yaml
spec:
  ingressClassName: traefik  # 改为 traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/redirect-entry-point: https  # 使用 traefik 注解
```

删除 nginx 相关注解：
```yaml
# 删除这行
nginx.ingress.kubernetes.io/ssl-redirect: "true"
```

### 2. 提交并推送

```bash
git add k8s/base/ingress.yaml
git commit -m "fix: change ingress class from nginx to traefik"
git push origin main
```

### 3. 等待 Flux 同步

Flux 会在 1 分钟内自动同步并更新 Ingress。

### 4. 验证修复

```bash
# 检查 Ingress 配置
kubectl get ingress -n <namespace> -o yaml | grep ingressClassName
# 应该显示: ingressClassName: traefik

# 测试访问（需要配置 hosts 或 DNS）
curl -H "Host: rrr.example.com" http://<K3S_NODE_IP>
```

## 为什么 Patch 不持久

手动 `kubectl patch` 的修改会被 Flux 覆盖，因为：
1. Flux 每分钟同步一次 Git 仓库
2. Flux 会将 K8s 资源恢复到 Git 中定义的状态
3. 必须修改 Git 仓库才能持久化配置

## 模板修复

已更新 `templates/nextjs-15-app/k8s/base/ingress.yaml`：

```yaml
spec:
  ingressClassName: traefik  # 使用 traefik
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    traefik.ingress.kubernetes.io/redirect-entry-point: https  # traefik 注解
```

未来创建的新项目将自动使用正确的配置。

## 其他问题

### 云安全组端口未开放

即使应用正确监听 0.0.0.0，外部访问仍然需要：

1. **开放 NodePort 端口**（测试环境）：
   - 31611 (HTTP)
   - 32427 (HTTPS)

2. **或使用 LoadBalancer**（生产环境）

3. **或配置真实域名 + 标准端口**（推荐）

## 总结

**核心问题**：Ingress 使用了错误的 IngressClass (`nginx`)，但集群只有 `traefik`。

**解决方法**：修改 Git 仓库中的 `k8s/base/ingress.yaml`，改为 `ingressClassName: traefik`。

**关键点**：
- 监听 Pod IP 不是问题，K8s Service 会自动处理流量转发
- 必须修改 Git 仓库，手动 patch 会被 Flux 覆盖
- 使用正确的 IngressClass 和对应的注解语法
