# 故障排除指南

## 常见问题及解决方案

### 1. 网站无法访问 (ERR_CONNECTION_CLOSED)

**症状：** 浏览器显示 "连接被重置" 或 "ERR_CONNECTION_CLOSED"

**检查步骤：**

```bash
# 1. 检查 Gateway 状态
kubectl get gateway -n juanie

# 2. 检查端口监听
ss -tlnp | grep -E ':80|:443'

# 3. 检查 Envoy 日志
kubectl logs -n kube-system -l k8s-app=cilium-envoy --tail=50

# 4. 检查 iptables 规则
iptables -L -n | grep -E '80|443'
```

**常见原因及解决：**

- **端口冲突：** 删除旧 Gateway
  ```bash
  kubectl delete gateway juanie-gateway -n juanie --ignore-not-found=true
  ```

- **Envoy 配置缓存：** 重启 Cilium
  ```bash
  kubectl delete pod -n kube-system -l k8s-app=cilium
  kubectl delete pod -n kube-system -l k8s-app=cilium-envoy
  ```

### 2. 证书错误 (ERR_CERT_COMMON_NAME_INVALID)

**症状：** 浏览器显示证书不匹配

**检查步骤：**

```bash
# 检查证书内容
kubectl get secret juanie-wildcard-tls -n juanie -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -text | grep -E '(Subject:|DNS:)'
```

**解决方案：**

证书必须同时包含 apex 域名和通配符域名：

```yaml
dnsNames:
  - "*.juanie.art"
  - "juanie.art"
```

重新签发证书：

```bash
kubectl delete certificate juanie-wildcard-tls -n juanie
# 等待 Flux 或手动重新创建
```

### 3. 重定向循环 (ERR_TOO_MANY_REDIRECTS)

**症状：** 页面不断重定向

**原因：** NextAuth `AUTH_TRUST_HOST` 未设置

**解决方案：**

```bash
# 检查 ConfigMap
kubectl get configmap juanie-config -n juanie -o yaml | grep AUTH_TRUST_HOST

# 如果没有，添加它
kubectl patch configmap juanie-config -n juanie --type='json' -p='[{"op": "add", "path": "/data/AUTH_TRUST_HOST", "value": "true"}]'

# 重启应用
kubectl rollout restart deployment/juanie-web -n juanie
```

### 4. 应用健康检查失败 (503)

**症状：** Pod 重启，健康检查返回 503

**检查步骤：**

```bash
# 检查应用日志
kubectl logs deployment/juanie-web -n juanie --tail=50

# 检查数据库连接
kubectl run test-db --rm -it --restart=Never --image=postgres:16-alpine -n juanie -- \
  psql "postgres://postgres:postgres@postgres:5432/juanie" -c 'SELECT 1'
```

**常见原因：**

- DATABASE_URL 配置错误
- 数据库密码不匹配
- AUTH_TRUST_HOST 未设置

### 5. Flux 同步失败

**症状：** HelmRelease 处于失败状态

**检查步骤：**

```bash
# 检查 HelmRelease 状态
flux get helmreleases -A

# 检查详细错误
kubectl describe helmrelease juanie -n flux-system

# 强制重新同步
flux reconcile helmrelease juanie -n flux-system --force
```

### 6. DNS 解析问题

**症状：** 域名无法解析或解析到错误 IP

**检查步骤：**

```bash
# 本地检查
nslookup juanie.art

# 应该返回: 49.232.237.136
```

**解决方案：**

- 清除本地 DNS 缓存
- 检查 DNS 服务商配置

## 快速修复脚本

```bash
#!/bin/bash
# 快速修复脚本

echo "1. 清理旧 Gateway..."
kubectl delete gateway juanie-gateway -n juanie --ignore-not-found=true

echo "2. 重启 Cilium..."
kubectl delete pod -n kube-system -l k8s-app=cilium --ignore-not-found=true
kubectl delete pod -n kube-system -l k8s-app=cilium-envoy --ignore-not-found=true

echo "3. 等待 Cilium 就绪..."
sleep 30

echo "4. 检查状态..."
kubectl get gateway -n juanie
kubectl get pods -n juanie
ss -tlnp | grep -E ':80|:443'

echo "完成！"
```

## 预防措施

1. **使用 shared-gateway** - 不要创建新的 Gateway
2. **证书包含两个域名** - `*.juanie.art` 和 `juanie.art`
3. **设置 AUTH_TRUST_HOST=true** - NextAuth v5 必需
4. **正确的 DATABASE_URL** - 包含完整连接信息
