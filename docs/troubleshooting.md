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
# 由 Helm/Argo CD 重新同步，或在排障窗口内手动应用当前 chart
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
kubectl run test-db --rm -it --restart=Never --image=pgvector/pgvector:pg16 -n juanie -- \
  psql "postgres://postgres:postgres@postgres:5432/juanie" -c 'SELECT 1'
```

**常见原因：**

- 控制面数据库组件配置不完整
- 数据库密码不匹配
- AUTH_TRUST_HOST 未设置

### 5. Argo CD 同步失败

**症状：** Application 或 ApplicationSet 处于失败状态

**检查步骤：**

```bash
# 检查 Application / ApplicationSet 状态
kubectl get applications,argocdapplicationsets -A 2>/dev/null || \
  kubectl get applications,applicationsets -n argocd

# 检查详细错误
kubectl describe application -n argocd

# 如已安装 argocd CLI，可重新同步目标应用
argocd app sync <app-name>
```

平台自身发布不再依赖 `juanie-platform` Argo CD Application。CI 会上传 Helm chart 到服务器，
执行 `helm upgrade --install juanie`，并等待迁移、rollout 和 ready 健康检查。

```bash
helm -n juanie status juanie
kubectl -n juanie get jobs,pods,deploy
kubectl -n juanie rollout status deployment/juanie-web
kubectl -n juanie rollout status deployment/juanie-worker
```

如果线上没有更新，优先看 GitHub Actions 的 `deploy-platform` job。不要手工改
`juanie-web` / `juanie-worker` Deployment；正确入口是重新跑 CI 或手动执行同一条 Helm 发布命令。

### 6. kube-system Pod 卡在 ContainerCreating

**症状：** `coredns`、`local-path-provisioner`、`metrics-server` 长时间是 `ContainerCreating`。

**典型事件：**

```text
Failed to create pod sandbox: failed to get sandbox image "rancher/mirrored-pause:3.6"
failed to resolve reference "docker.io/rancher/mirrored-pause:3.6": i/o timeout
```

**原因：** kubelet 创建任何 Pod 前都要先拉 pause 沙箱镜像。宿主机访问 Docker Hub 超时后，所有 Pod 都无法创建 sandbox。

**正确处理：** 不要手工补单个镜像。重新按宿主机层脚本安装 K3s，让 containerd 从固定国内系统镜像源拉 K3s 系统镜像：

```bash
K3S_REINSTALL=true \
K3S_NETWORK_PROFILE=flannel-nodeport \
K3S_NODE_IP=10.0.6.122 \
bash deploy/k8s/scripts/install-k3s.sh
```

如果这台机器要承载完整 Juanie Gateway API / HTTPRoute 能力，使用 Cilium profile 重装：

```bash
K3S_REINSTALL=true \
K3S_NETWORK_PROFILE=cilium-gateway \
K3S_NODE_IP=10.0.6.122 \
bash deploy/k8s/scripts/install-k3s.sh
```

安装完成后确认：

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide
```

### 7. DNS 解析问题

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
4. **正确的数据库组件配置** - host/name/user/password/sslmode 必须一致
5. **平台自身发布只走 CI Helm** - 排障从 GitHub Actions `deploy-platform`、Helm release 和 schema-sync Job 开始
