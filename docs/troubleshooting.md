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

### 4. GitHub 登录后跳到 `/api/auth/error?error=Configuration`

**症状：** 浏览器能跳转到 GitHub 授权页，授权完成后回到 Juanie，但显示
`/api/auth/error?error=Configuration`。

**高概率原因：** Juanie 服务端在 OAuth callback 阶段需要访问
`https://github.com/login/oauth/access_token` 换取 token。用户浏览器能访问 GitHub
不代表 Kubernetes Pod 也能访问该地址。受限网络下常见日志如下：

```text
[auth][error] CallbackRouteError
[auth][cause]: TypeError: fetch failed
[auth][details]: { "name": "ConnectTimeoutError", "provider": "github" }
```

**检查步骤：**

```bash
kubectl -n juanie logs deploy/juanie-web --tail=200 | grep -Ei 'auth|github|callback|timeout|configuration'

kubectl -n juanie exec deploy/juanie-web -- sh -lc '
  env | grep -E "^(HTTP_PROXY|HTTPS_PROXY|ALL_PROXY|NO_PROXY|NODE_USE_ENV_PROXY)=" || true
  timeout 12s node -e "const t=Date.now(); fetch(\"https://github.com/login/oauth/access_token\", { method: \"POST\", headers: { accept: \"application/json\" } }).then(r => console.log(r.status, Date.now() - t)).catch(e => console.error(e.name, e.cause?.constructor?.name || e.message, Date.now() - t))"
'
```

**解决方案：** 给 Helm values 配置可用的 HTTP/HTTPS 出网代理。Node 24 的 `fetch`
只有在 `NODE_USE_ENV_PROXY=1` 时才会读取代理环境变量。

```yaml
env:
  NODE_USE_ENV_PROXY: "1"
  HTTPS_PROXY: "http://proxy.example:7890"
  HTTP_PROXY: "http://proxy.example:7890"
  NO_PROXY: "localhost,127.0.0.1,.svc,.cluster.local,postgres,redis,kubernetes.default.svc"
```

然后重新发布：

```bash
helm upgrade --install juanie deploy/k8s/charts/juanie \
  -n juanie \
  -f deploy/k8s/charts/juanie/values-prod.yaml \
  -f /path/to/customer-values.yaml \
  --wait \
  --timeout 20m
```

### 5. 应用健康检查失败 (503)

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

### 6. Argo CD 同步失败

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

### 7. kube-system Pod 卡在 ContainerCreating

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

### 8. DNS 解析问题

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

### 9. Helm 卡在 pending-install 或提示 another operation is in progress

**症状：** `helm upgrade --install` 被镜像拉取或网络超时卡住，中断后再次运行提示：

```text
UPGRADE FAILED: another operation (install/upgrade/rollback) is in progress
```

**原因：** Helm release 还停在 `pending-install` / `pending-upgrade` 状态。常见触发点是 operator Pod 一直 `ContainerCreating`，例如 CloudNativePG、External Secrets 或 DNSPod webhook 正在拉 `ghcr.io` / Docker Hub 镜像。

**检查：**

```bash
helm list -A -a
helm -n cnpg-system history cloudnative-pg
kubectl -n cnpg-system get pods -o wide
kubectl -n cnpg-system describe pod
kubectl get events -n cnpg-system --sort-by=.lastTimestamp | tail -80
```

**处理：**

1. 先确认没有另一个 Helm 进程仍在运行。
2. 如果只是镜像拉取卡住，先换 values 里的 image repository 或预拉镜像。
3. 如果 release 一直是 `pending-install`，可以卸载这个未完成 release 后重试：

```bash
helm -n cnpg-system uninstall cloudnative-pg || true

helm upgrade --install cloudnative-pg /root/juanie/.charts/cloudnative-pg-0.28.0.tgz \
  --namespace cnpg-system \
  --create-namespace \
  -f /root/juanie/deploy/k8s/infrastructure/cloudnative-pg/values.yaml \
  --set image.repository=ghcr.io/cloudnative-pg/cloudnative-pg \
  --set image.tag=1.29.0 \
  --wait \
  --timeout 15m
```

不要盲目删 namespace；CloudNativePG、Argo CD、cert-manager 这类基础设施 namespace 里可能已经有可用对象。

### 10. externalEdge Gateway 显示 AddressNotAssigned

**症状：**

```text
Gateway waiting for address
Reason: AddressNotAssigned
PROGRAMMED=False
```

**原因：** `externalEdge` 是宿主机 Nginx / SLB 先接公网 `80/443`，再转发到 Cilium Envoy 的 `31080`。这个模式没有 LoadBalancer IP 可分配，所以 Gateway 顶层 `Programmed=False` 不等于不可用。

**正确验收：**

```bash
ss -tulpen | grep ':31080'
kubectl describe httproute juanie-route -n juanie
curl -i -H 'Host: juanie.draftingee.com' http://127.0.0.1:31080/api/health/ready
```

满足以下条件即可继续配置宿主机 Nginx：

- `cilium-envoy` 正在监听 `0.0.0.0:31080`
- HTTPRoute parent 条件里 `Accepted=True`
- HTTPRoute parent 条件里 `ResolvedRefs=True`
- Host header curl 返回 `200 OK`

### 11. Helm 安装 Juanie 时 namespace 不能被导入

**症状：**

```text
Namespace "juanie" exists and cannot be imported into the current release:
invalid ownership metadata
```

**原因：** bootstrap 已经提前创建了 `juanie` namespace，但 Helm chart 也会渲染 Namespace。Helm 要求已有对象带上 release ownership metadata。

**处理：**

```bash
kubectl label namespace juanie app.kubernetes.io/managed-by=Helm --overwrite
kubectl annotate namespace juanie \
  meta.helm.sh/release-name=juanie \
  meta.helm.sh/release-namespace=juanie \
  --overwrite
```

然后重新执行 `helm upgrade --install juanie ...`。

### 12. Juanie chart 镜像 tag 不存在或 Docker Hub 拉取超时

**症状：**

```text
ghcr.io/997899594/juanie:web-sha-xxxx: not found
failed to do request: Head "https://registry-1.docker.io/..."
```

**原因：** 平台镜像 tag 来自完整 commit SHA，格式是 `web-${SHA}` 和 `runtime-${SHA}`。`values.yaml` 里的默认 tag 只能作为 chart 结构占位，客户部署必须显式覆盖为当前已构建的 tag。内置 `busybox`、`redis`、`pgvector` 也需要按客户网络覆盖镜像源。

**处理：**

```bash
cd /root/juanie
APP_SHA="$(git rev-parse HEAD)"

cp deploy/k8s/charts/juanie/values-external-edge-cn.example.yaml /root/juanie/customer-values.yaml
sed -i "s/REPLACE_WITH_COMMIT_SHA/${APP_SHA}/g" /root/juanie/customer-values.yaml

for img in \
  "ghcr.1ms.run/997899594/juanie:web-${APP_SHA}" \
  "ghcr.1ms.run/997899594/juanie:runtime-${APP_SHA}" \
  "docker.1ms.run/library/busybox:1.36" \
  "docker.m.daocloud.io/library/redis:7-alpine" \
  "docker.1ms.run/pgvector/pgvector:pg16"
do
  echo "== ${img}"
  timeout 180s crictl pull "${img}"
done
```

如果某个 mirror 不可用，先换 `customer-values.yaml`，再 Helm 发布。不要在 Deployment 上手工 patch 镜像；下次 Helm 发布会覆盖。

### 13. chart 默认使用已有 Secret 但集群里没有

**症状：** Juanie Pod 启动失败，事件里出现 secret 找不到，或者环境变量为空。

**原因：** chart 默认 `secret.existingSecret=juanie-secret`，生产环境应由已有 Secret 或 External Secrets Operator 提供敏感配置。手动 Helm 交付时需要先创建这个 Secret，或在 values 里关闭 `secret.existingSecret` 并提供内置 Secret 字段。

**处理：**

```bash
kubectl -n juanie create secret generic juanie-secret \
  --from-literal=DATABASE_PASSWORD='REPLACE_ME' \
  --from-literal=NEXTAUTH_SECRET='REPLACE_ME' \
  --from-literal=NEXTAUTH_URL='https://juanie.draftingee.com' \
  --from-literal=GITHUB_CLIENT_ID='' \
  --from-literal=GITHUB_CLIENT_SECRET='' \
  --from-literal=GITLAB_CLIENT_ID='' \
  --from-literal=GITLAB_CLIENT_SECRET='' \
  --from-literal=FEISHU_CLIENT_ID='' \
  --from-literal=FEISHU_CLIENT_SECRET='' \
  --from-literal=AI_302_API_KEY='' \
  --from-literal=ARTIFACT_STORAGE_ACCESS_KEY_ID='' \
  --from-literal=ARTIFACT_STORAGE_SECRET_ACCESS_KEY='' \
  --from-literal=ATLAS_DEV_URL='' \
  --from-literal=ATLAS_DEV_URL_POSTGRESQL='' \
  --from-literal=ATLAS_DEV_URL_MYSQL='' \
  --dry-run=client -o yaml | kubectl apply -f -
```

真实密钥不要提交到 Git；客户环境用密钥系统或现场 Secret 注入。

### 14. 发布卡在 `migration_pre_failed` 且报自签证书

**症状：** 子应用 CI 成功触发 Juanie release，但 release 很快变成
`migration_pre_failed`，CI 或 release 日志显示：

```text
self signed certificate in certificate chain
```

同时 worker 日志可能反复出现：

```text
Failed to remediate environment namespace
Environment route reconciliation skipped environment
```

**原因：** Juanie worker / scheduler / web 需要调用集群内 Kubernetes API。Node
运行时默认不一定信任 ServiceAccount 挂载的集群 CA，导致
`@kubernetes/client-node` 校验证书失败。

**正确处理：** 不要用 `NODE_TLS_REJECT_UNAUTHORIZED=0` 关闭 TLS 校验。chart 默认应注入
ServiceAccount CA：

```yaml
env:
  NODE_EXTRA_CA_CERTS: /var/run/secrets/kubernetes.io/serviceaccount/ca.crt
```

**临时线上修复：**

```bash
kubectl -n juanie set env deployment/juanie-worker \
  NODE_EXTRA_CA_CERTS=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

kubectl -n juanie set env deployment/juanie-web \
  NODE_EXTRA_CA_CERTS=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt

kubectl -n juanie rollout status deployment/juanie-worker --timeout=5m
kubectl -n juanie rollout status deployment/juanie-web --timeout=5m
```

如果 `scheduler` 单独运行，也同步设置：

```bash
kubectl -n juanie set env deployment/juanie-scheduler \
  NODE_EXTRA_CA_CERTS=/var/run/secrets/kubernetes.io/serviceaccount/ca.crt
```

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
