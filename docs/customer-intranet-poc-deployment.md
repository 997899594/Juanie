# 客户内网 POC 部署文档

本文档用于客户现场暂时不给 DNS 解析、但愿意先提供一台内网机器试用 Juanie 的场景。

本次约定的试用域名是：

```text
featuremaker.juanie.art
*.featuremaker.juanie.art
```

两条记录都指向客户现场内网机器：

```text
10.0.6.122
```

这个模式的目标是：客户前期不需要提供 DNS 权限、不需要提供证书平台，只需要保证客户内网用户能访问 `10.0.6.122`。

## 架构

```text
客户内网浏览器
  -> featuremaker.juanie.art 解析到 10.0.6.122
  -> 宿主机 Nginx 终止 HTTPS
  -> http://127.0.0.1:31080
  -> Cilium Gateway / HTTPRoute
  -> Juanie 平台或项目环境服务
```

域名分工：

```text
featuremaker.juanie.art
  Juanie 平台入口

*.featuremaker.juanie.art
  项目环境、预览环境、唤醒路由
```

## DNSPod 记录

在腾讯云 DNSPod 的 `juanie.art` 域名下添加两条记录。

平台入口：

```text
主机记录: featuremaker
记录类型: A
线路类型: 默认
记录值: 10.0.6.122
TTL: 600
```

环境泛解析：

```text
主机记录: *.featuremaker
记录类型: A
线路类型: 默认
记录值: 10.0.6.122
TTL: 600
```

客户内网电脑验证：

```bash
nslookup featuremaker.juanie.art
nslookup test.featuremaker.juanie.art
```

都应该返回：

```text
10.0.6.122
```

外网也可能解析到 `10.0.6.122`，这是正常的。`10.0.6.122` 是私网地址，公网无法路由到客户内网。

## 证书从哪里来

证书由我们来签，不需要客户平台提供。

原因是域名属于我们：

```text
featuremaker.juanie.art
*.featuremaker.juanie.art
```

我们控制 `juanie.art` 的 DNSPod，所以可以用 ACME DNS-01 验证向公开 CA 申请证书，例如 Let's Encrypt 或 ZeroSSL。

证书必须覆盖：

```text
featuremaker.juanie.art
*.featuremaker.juanie.art
```

POC 阶段最快做法是手工 DNS-01：

```bash
sudo certbot certonly \
  --manual \
  --preferred-challenges dns \
  --email admin@juanie.art \
  --agree-tos \
  --no-eff-email \
  -d featuremaker.juanie.art \
  -d '*.featuremaker.juanie.art'
```

执行过程中，Certbot 会要求添加一个或多个 TXT 记录：

```text
_acme-challenge.featuremaker.juanie.art
```

把提示的 TXT 值加到 DNSPod 后，等待公共 DNS 可见：

```bash
nslookup -type=TXT _acme-challenge.featuremaker.juanie.art
```

签发成功后会得到：

```text
fullchain.pem
privkey.pem
```

如果在签证书机器上使用 Certbot，常见路径是：

```text
/etc/letsencrypt/live/featuremaker.juanie.art/fullchain.pem
/etc/letsencrypt/live/featuremaker.juanie.art/privkey.pem
```

把证书拷贝到客户机器 `10.0.6.122`：

```bash
sudo install -d -m 700 /etc/juanie/tls
sudo install -m 644 fullchain.pem /etc/juanie/tls/fullchain.pem
sudo install -m 600 privkey.pem /etc/juanie/tls/privkey.pem
```

长期试用时建议把手工 DNS-01 换成 ACME 自动化，使用 DNSPod API 凭证自动续签。只有当客户安全策略禁止公开 CA 证书时，才需要客户提供内网 CA。

## 宿主机 Nginx

如果 `https://featuremaker.juanie.art` 打开的是旧应用，说明 DNS 已经生效，但宿主机 Nginx 还没有把这个域名转给 Juanie。

旧应用可以继续保留，但必须为 `featuremaker.juanie.art` 单独加一个 Nginx server block：

```nginx
map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}

server {
  listen 80;
  server_name featuremaker.juanie.art *.featuremaker.juanie.art;

  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name featuremaker.juanie.art *.featuremaker.juanie.art;

  ssl_certificate /etc/juanie/tls/fullchain.pem;
  ssl_certificate_key /etc/juanie/tls/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:31080;

    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;

    proxy_buffering off;
    proxy_read_timeout 3600s;
  }
}
```

应用配置：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

关键点是必须保留原始 Host：

```nginx
proxy_set_header Host $host;
```

Juanie 和子应用环境都依赖 Host-based routing。

## 集群 Bootstrap

继续使用 `externalEdge` 模式。这个模式不是替代 Cilium，而是让宿主机 Nginx 负责外层 HTTPS，Cilium Gateway 负责集群内 Host 路由。

```bash
export KUBECONFIG=/etc/rancher/k3s/k3s.yaml

PLATFORM_DOMAIN=featuremaker.juanie.art \
GATEWAY_EDGE_MODE=externalEdge \
GATEWAY_HTTPS_ENABLED=false \
GATEWAY_CLASS_NAME=cilium \
GATEWAY_LOADBALANCER_IP='' \
SKIP_CERT_WAIT=true \
bash deploy/k8s/scripts/init-server.sh
```

期望的 Gateway listener：

```text
featuremaker.juanie.art      -> http-apex listener on 31080
*.featuremaker.juanie.art    -> http-wildcard listener on 31080
```

## Juanie Helm 配置

所有平台访问相关配置必须统一使用试用域名：

```text
PLATFORM_DOMAIN=featuremaker.juanie.art
hostname=featuremaker.juanie.art
JUANIE_BASE_DOMAIN=featuremaker.juanie.art
NEXTAUTH_URL=https://featuremaker.juanie.art
```

如果使用 `secret.existingSecret=juanie-secret`，需要先创建或更新 Secret：

```bash
kubectl -n juanie create secret generic juanie-secret \
  --dry-run=client \
  -o yaml \
  --from-literal=DATABASE_PASSWORD="${DATABASE_PASSWORD}" \
  --from-literal=NEXTAUTH_SECRET="${NEXTAUTH_SECRET}" \
  --from-literal=NEXTAUTH_URL='https://featuremaker.juanie.art' \
  --from-literal=GITLAB_CLIENT_ID="${GITLAB_CLIENT_ID}" \
  --from-literal=GITLAB_CLIENT_SECRET="${GITLAB_CLIENT_SECRET}" \
  --from-literal=FEISHU_CLIENT_ID="${FEISHU_CLIENT_ID}" \
  --from-literal=FEISHU_CLIENT_SECRET="${FEISHU_CLIENT_SECRET}" \
  | kubectl apply -f -
```

更新 Juanie：

```bash
helm upgrade --install juanie deploy/k8s/charts/juanie \
  -n juanie \
  --create-namespace \
  -f deploy/k8s/charts/juanie/values.yaml \
  -f deploy/k8s/charts/juanie/values-external-edge.yaml \
  --set hostname=featuremaker.juanie.art \
  --set env.JUANIE_BASE_DOMAIN=featuremaker.juanie.art \
  --set env.AUTH_TRUST_HOST=true \
  --set env.GITLAB_URL="${GITLAB_URL}" \
  --set env.FEISHU_ALLOWED_EMAIL_DOMAINS="${FEISHU_ALLOWED_EMAIL_DOMAINS}" \
  --wait \
  --timeout 20m
```

如果现场访问飞书、Git Provider、AI 或对象存储需要出网代理，再补：

```bash
--set env.NODE_USE_ENV_PROXY=1 \
--set env.HTTPS_PROXY="${HTTPS_PROXY}" \
--set env.NO_PROXY='localhost,127.0.0.1,.svc,.cluster.local,kubernetes.default.svc,.customer.local'
```

客户内网 GitLab 主机应放进 `NO_PROXY`，避免被外网代理带偏。

## GitLab 私服

Juanie 读取 GitLab 私服地址的变量是：

```text
GITLAB_URL
```

示例：

```text
GITLAB_URL=https://gitlab.customer.local
```

GitLab OAuth App 回调地址：

```text
https://featuremaker.juanie.art/api/auth/callback/gitlab
```

建议 scopes：

```text
read_user
read_repository
api
```

注意：登录身份和 Git 执行身份不是一回事。用户用 GitLab 登录只是证明“这个人是谁”；Juanie 操作仓库、CI、MR 仍然应走团队 Integration Binding。

## 飞书登录

飞书 App 回调地址：

```text
https://featuremaker.juanie.art/api/auth/callback/feishu
```

Juanie 需要：

```text
FEISHU_CLIENT_ID=cli_xxx
FEISHU_CLIENT_SECRET=xxx
FEISHU_ALLOWED_EMAIL_DOMAINS=customer.com
```

飞书登录需要两条网络链路：

```text
客户浏览器 -> 飞书登录页
Juanie 服务端 -> accounts.feishu.cn / open.feishu.cn
```

如果客户现场阻断飞书出网，飞书登录无法在该 POC 验证。此时先使用 GitLab 私服登录或 bootstrap admin。

## 验收

在 `10.0.6.122` 上检查：

```bash
ss -tulpen | grep ':31080'
curl -i -H 'Host: featuremaker.juanie.art' http://127.0.0.1:31080/api/health/ready
kubectl -n juanie get gateway,httproute
kubectl -n juanie describe httproute juanie-route
```

在客户内网电脑上检查：

```bash
nslookup featuremaker.juanie.art
nslookup test.featuremaker.juanie.art
curl -Ik https://featuremaker.juanie.art
```

检查证书 SNI：

```bash
echo | openssl s_client \
  -connect featuremaker.juanie.art:443 \
  -servername featuremaker.juanie.art \
  2>/dev/null | openssl x509 -noout -subject -issuer -dates
```

产品验收路径：

```text
1. 打开 https://featuremaker.juanie.art
2. 使用 GitLab 私服或飞书登录
3. 导入 GitLab 项目
4. 创建 staging / preview 环境
5. 打开 *.featuremaker.juanie.art 下的环境地址
6. 创建 release
7. 下载托管交付物
```

## 排障

`featuremaker.juanie.art` 打开旧应用：

```text
DNS 已经正确，但宿主机 Nginx 仍然把该 Host 路由到旧默认站点。
添加专用 server_name 配置并 reload Nginx。
```

浏览器提示证书不匹配：

```text
443 vhost 仍然在使用旧证书，或者请求命中了错误的 server block。
用 openssl 检查 SNI，确认 Nginx 已加载 featuremaker wildcard 证书。
```

externalEdge 模式下 Gateway 显示 `AddressNotAssigned`：

```text
这是预期现象。externalEdge 不需要 LoadBalancer 地址。
以 Host-header curl 到 127.0.0.1:31080，以及 HTTPRoute 的 Accepted / ResolvedRefs 为准。
```

GitLab 跳到 gitlab.com：

```text
Juanie runtime env 缺少 GITLAB_URL。
通过 Helm 设置 env.GITLAB_URL 后重启 web / worker。
```

飞书回调失败：

```text
检查 NEXTAUTH_URL、飞书 App 回调地址、服务端到飞书的出网链路，以及 FEISHU_ALLOWED_EMAIL_DOMAINS。
```
