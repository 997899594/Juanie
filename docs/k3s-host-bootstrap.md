# K3s 宿主机初始化

Juanie 的生产运行分两层初始化：

1. `deploy/k8s/scripts/install-k3s.sh` 负责宿主机层：安装 K3s、固定节点 IP、禁用内置入口、配置国内系统镜像源和 pause 镜像。
2. `deploy/k8s/scripts/init-server.sh` 负责集群基础设施层：安装 cert-manager、Argo CD、Argo Rollouts、CloudNativePG、External Secrets 和 Gateway 资源。

不要把两层混在一个脚本里。K3s 安装会修改 systemd、containerd 和 `/etc/rancher/k3s`；平台 bootstrap 只应该操作一个已经健康的 Kubernetes 集群。

## 适用场景

- 新裸机或云主机要承载 Juanie 控制面。
- 宿主机在国内网络环境，无法稳定访问 Docker Hub。
- 需要避免 K3s 内置 Traefik / ServiceLB 占用宿主机 `80/443`。
- Rocky Linux 8 / RHEL 8 / CentOS 8 这类仍使用 cgroup v1 的机器，需要固定兼容的 K3s 版本。

## 默认行为

脚本默认：

- 使用 `K3S_NETWORK_PROFILE=flannel-nodeport`，适合只需要先跑控制面、并由宿主机 Nginx 反代 NodePort 的机器。
- 安装 `v1.30.6+k3s1`。
- 使用 Rancher 国内安装镜像。
- 禁用 `traefik` 和 `servicelb`。
- 自动检测 `node-ip`，也可通过 `K3S_NODE_IP` 显式指定。
- 写入 `system-default-registry: registry.cn-hangzhou.aliyuncs.com`。
- 写入 `pause-image: registry.cn-hangzhou.aliyuncs.com/rancher/mirrored-pause:3.6`。
- 等待 node 和 `kube-system` Pod Ready。
- 默认不卸载已有 K3s；如需重装，必须显式设置 `K3S_REINSTALL=true`。

## 网络 Profile

### flannel-nodeport

默认 profile。K3s 使用内置 flannel，Juanie 控制面可以通过 NodePort 暴露给宿主机 Nginx：

```bash
K3S_NODE_IP=10.0.6.122 \
bash deploy/k8s/scripts/install-k3s.sh
```

### cilium-gateway

Juanie 完整平台能力需要 Gateway API / HTTPRoute。这个 profile 会：

- 在 K3s 配置中写入 `flannel-backend: none`。
- 禁用 K3s 内置 network policy。
- 禁用 kube-proxy。
- 安装 Gateway API CRDs。
- 用 Helm 安装 Cilium，并开启 `kubeProxyReplacement=true`、`gatewayAPI.enabled=true`、`gatewayAPI.hostNetwork.enabled=true`、`l7Proxy=true`。

已安装 flannel K3s 的机器要切到这个 profile，必须重装 K3s：

```bash
K3S_REINSTALL=true \
K3S_NETWORK_PROFILE=cilium-gateway \
K3S_NODE_IP=10.0.6.122 \
bash deploy/k8s/scripts/install-k3s.sh
```

这个 profile 仍然禁用 K3s 内置 Traefik / ServiceLB，不会让 K3s 内置入口接管宿主机 `80/443`。
宿主机 Nginx 是否继续做公网入口，由后续 Nginx 和 Juanie Helm 部署层决定。

## 首次安装

```bash
K3S_NODE_IP=10.0.6.122 \
bash deploy/k8s/scripts/install-k3s.sh
```

安装完成后确认：

```bash
kubectl get nodes -o wide
kubectl get pods -A -o wide
ss -tulpen | grep -E ':80|:443|:6443|:10250|:8472|:31080' || true
```

期望：

- `node` 是 `Ready`。
- `coredns`、`local-path-provisioner`、`metrics-server` 是 `Running`。
- `80/443` 仍由宿主机 Nginx 监听。
- `6443/10250/8472` 由 K3s 使用。
- `31080` 在 Juanie NodePort Service 部署前不会出现。

## 重装已有 K3s

只有确认当前 K3s 集群没有需要保留的业务 workload 时才运行：

```bash
K3S_REINSTALL=true \
K3S_NODE_IP=10.0.6.122 \
bash deploy/k8s/scripts/install-k3s.sh
```

这个命令会调用 `/usr/local/bin/k3s-uninstall.sh`，再按当前仓库脚本重新安装。

## 可选 Docker Hub 镜像代理

`system-default-registry` 只解决 K3s 系统镜像。若业务 workload 仍需要拉 Docker Hub 镜像，可以额外写入 containerd mirror：

```bash
K3S_REGISTRY_MIRROR_ENDPOINTS=https://your-registry-mirror.example.com \
bash deploy/k8s/scripts/install-k3s.sh
```

多个 mirror 用逗号分隔。不要在仓库里硬编码不稳定的公共加速器地址。

## 可选 Cilium 镜像与离线源

默认 Cilium chart 来自官方 Helm repo，镜像来自官方默认仓库。国内或离线环境如果拉取失败，不要手工补镜像；应切到你们自己的镜像仓库或本地 chart 包：

```bash
CILIUM_CHART_REF=/opt/charts/cilium-1.19.3.tgz \
CILIUM_IMAGE_REPOSITORY=registry.example.com/cilium/cilium \
CILIUM_OPERATOR_IMAGE_REPOSITORY=registry.example.com/cilium/operator-generic \
CILIUM_ENVOY_IMAGE_REPOSITORY=registry.example.com/cilium/cilium-envoy \
K3S_NETWORK_PROFILE=cilium-gateway \
bash deploy/k8s/scripts/install-k3s.sh
```

## 后续操作

宿主机层健康后，再运行集群基础设施 bootstrap：

```bash
bash deploy/k8s/scripts/init-server.sh
```

`init-server.sh` 不负责安装 K3s；它的前提是 `kubectl` 已经能访问一个健康集群。

## 客户已有公网入口

如果客户已有宿主机 Nginx / SLB / F5 接管公网 `80/443`，不要让 Cilium Gateway 直接绑定公网端口。使用 `externalEdge` 交付 profile：

```bash
PLATFORM_DOMAIN=juanie.draftingee.com \
GATEWAY_EDGE_MODE=externalEdge \
GATEWAY_HTTPS_ENABLED=false \
GATEWAY_CLASS_NAME=cilium \
GATEWAY_LOADBALANCER_IP='' \
bash deploy/k8s/scripts/init-server.sh
```

这个 profile 会生成：

- `shared-gateway` 的 `http-apex` listener 监听 `31080`。
- `shared-gateway` 的 `http-wildcard` listener 监听 `31080`。
- 不生成 Gateway HTTPS listener。
- 不安装 DNSPod webhook / ClusterIssuer。
- 不生成平台 wildcard Certificate。
- 不写 Cilium LB IP annotation。

国内客户机如果无法稳定访问 Helm repo 或 GitHub release，可以让 bootstrap 先下载 chart 包再安装，并关闭本机暂时不需要的 External Secrets Operator：

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

PLATFORM_DOMAIN=juanie.draftingee.com \
GATEWAY_EDGE_MODE=externalEdge \
GATEWAY_HTTPS_ENABLED=false \
EXTERNAL_SECRETS_ENABLED=false \
GATEWAY_CLASS_NAME=cilium \
GATEWAY_LOADBALANCER_IP='' \
BOOTSTRAP_CHART_SOURCE=download \
BOOTSTRAP_CHART_DOWNLOAD_PROXY='https://gh-proxy.com/' \
bash deploy/k8s/scripts/init-server.sh
```

`BOOTSTRAP_CHART_SOURCE=download` 只改变 chart 获取方式，不改变 Helm release 的最终状态。`BOOTSTRAP_CHART_DOWNLOAD_PROXY` 是网络兜底；客户有私有制品库时，优先改成私有 chart 地址或提前缓存到 `.charts/`，不要把公共代理当长期依赖。

Juanie 控制面 chart 使用同一交付 profile：

```bash
helm upgrade --install juanie deploy/k8s/charts/juanie \
  -n juanie \
  --create-namespace \
  -f deploy/k8s/charts/juanie/values.yaml \
  -f deploy/k8s/charts/juanie/values-external-edge.yaml \
  --set hostname=juanie.draftingee.com \
  --set env.JUANIE_BASE_DOMAIN=juanie.draftingee.com
```

国内或离线客户机还应显式覆盖运行时镜像源，避免内置 Postgres / Redis / initContainer 继续访问 Docker Hub。不要把未经验证的公共 mirror 写进 values；应使用客户可访问的私有镜像仓库或已验证的企业镜像缓存：

```bash
APP_SHA="$(git rev-parse HEAD)"

cp deploy/k8s/charts/juanie/values-external-edge-cn.example.yaml /root/juanie/customer-values.yaml
sed -i "s/REPLACE_WITH_COMMIT_SHA/${APP_SHA}/g" /root/juanie/customer-values.yaml

helm upgrade --install juanie deploy/k8s/charts/juanie \
  -n juanie \
  --create-namespace \
  -f deploy/k8s/charts/juanie/values-external-edge.yaml \
  -f /root/juanie/customer-values.yaml \
  --wait \
  --timeout 20m
```

发布前先预拉镜像，确认当前客户网络确实能访问这些仓库：

```bash
APP_SHA="$(git rev-parse HEAD)"

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

如果某个公共 mirror 返回 `403`、`not found` 或拉 layer 失败，不要继续等 Helm。换成客户私有镜像仓库或另一个已验证缓存，然后同步更新 `customer-values.yaml`。

公网入口仍由客户 Nginx / SLB 负责 TLS 终止，然后转发到 `127.0.0.1:31080`。

`externalEdge` 模式下 `kubectl get gateway` 可能长期显示 `PROGRAMMED=False` / `AddressNotAssigned`，这是因为没有 LoadBalancer 地址可分配。只要宿主机上 `cilium-envoy` 已监听 `31080`，且 HTTPRoute `Accepted=True`、`ResolvedRefs=True`，就以 Host header 健康检查为准：

```bash
ss -tulpen | grep ':31080'
kubectl describe httproute juanie-route -n juanie
curl -i -H 'Host: juanie.draftingee.com' http://127.0.0.1:31080/api/health/ready
```
