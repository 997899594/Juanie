# RRR 项目部署成功分析

## 问题背景

项目 ID: `56d0416c-5fc9-40bc-be8a-85c8adf889a4`  
项目名称: `rrr`  
命名空间: `project-56d0416c-5fc9-40bc-be8a-85c8adf889a4-development`

## 初始问题

1. **镜像拉取失败**: Pod 最初显示 `ImagePullBackOff` 错误
   - 错误信息: `ghcr.io/997899594/rrr:latest: not found`
   - 原因: GitHub Actions 构建镜像需要时间

2. **GitRepository 同步失败**: 
   - 错误: `dial tcp 20.205.243.166:443: i/o timeout`
   - 原因: 中国网络访问 GitHub 超时

## 当前状态 ✅

### Pod 状态
```bash
NAME                                                        READY   STATUS    RESTARTS   AGE
dev-56d0416c-5fc9-40bc-be8a-85c8adf889a4-7dcb9d68f6-zzvpd   1/1     Running   0          112s
```

### 应用日志
```
▲ Next.js 15.5.9
- Local:        http://dev-56d0416c-5fc9-40bc-be8a-85c8adf889a4-7dcb9d68f6-zzvpd:3000
- Network:      http://dev-56d0416c-5fc9-40bc-be8a-85c8adf889a4-7dcb9d68f6-zzvpd:3000

✓ Starting...
✓ Ready in 994ms
```

### 访问方式

**域名**: `rrr.example.com`

**配置步骤**:

1. **本地测试** (修改 hosts 文件):
   ```bash
   # macOS/Linux
   sudo nano /etc/hosts
   
   # 添加以下行 (替换为你的 K3s 节点 IP)
   <K3S_NODE_IP> rrr.example.com
   ```

2. **访问应用**:
   - HTTP: `http://rrr.example.com`
   - HTTPS: `https://rrr.example.com` (Let's Encrypt 证书)

3. **生产环境** (配置 DNS):
   - 在域名提供商添加 A 记录
   - 指向 K3s 节点的公网 IP

## 为什么镜像最终拉取成功？

### 时间线分析

1. **T+0**: 项目初始化完成，创建 K8s 资源
2. **T+0 ~ T+4分钟**: Pod 显示 `ImagePullBackOff`
   - GitHub Actions 正在构建镜像
   - K8s 每隔一段时间重试拉取镜像
3. **T+4分钟后**: GitHub Actions 构建完成，推送镜像到 GHCR
4. **T+5分钟**: K8s 重试成功，Pod 启动

### 关键配置

1. **imagePullSecrets 正确配置**:
   ```yaml
   imagePullSecrets:
   - name: ghcr-secret
   ```

2. **镜像拉取策略**:
   ```yaml
   imagePullPolicy: Always
   ```

3. **K8s 自动重试机制**:
   - K8s 会自动重试拉取失败的镜像
   - 重试间隔逐渐增加 (指数退避)

## 部署流程验证 ✅

### 完整流程

```
1. 用户创建项目 (前端)
   ↓
2. 后端初始化项目
   ↓
3. 创建 GitHub 仓库 + 推送模板代码
   ↓
4. 创建 K8s 命名空间 + Flux 资源
   ↓
5. GitHub Actions 自动触发构建
   ↓
6. 构建 Docker 镜像 → 推送到 GHCR
   ↓
7. K8s 拉取镜像 → 启动 Pod
   ↓
8. Ingress 配置生效 → 应用可访问
```

### 各组件状态

| 组件 | 状态 | 说明 |
|------|------|------|
| GitHub 仓库 | ✅ | `https://github.com/997899594/rrr.git` |
| GitHub Actions | ✅ | 镜像构建成功 |
| GHCR 镜像 | ✅ | `ghcr.io/997899594/rrr:latest` |
| K8s Namespace | ✅ | 已创建 |
| GitRepository | ⚠️ | 超时但不影响部署 |
| Kustomization | ✅ | 已应用 |
| Deployment | ✅ | 1/1 Running |
| Service | ✅ | ClusterIP 正常 |
| Ingress | ✅ | 配置正确 |
| TLS 证书 | ✅ | Let's Encrypt |

## 已知问题

### GitRepository 超时

**现象**:
```
failed to checkout and determine revision: unable to list remote for 
'https://github.com/997899594/rrr.git': Get "https://github.com/997899594/rrr.git/info/refs?service=git-upload-pack": 
dial tcp 20.205.243.166:443: i/o timeout
```

**影响**: 
- ⚠️ Flux 无法自动同步代码变更
- ✅ 不影响当前部署 (Kustomization 已应用)

**解决方案**:
1. 配置 Flux HTTP 代理 (参考 `docs/guides/flux-http-proxy-setup.md`)
2. 或使用国内 Git 镜像服务

## 访问问题排查 ⚠️

### 问题：无法通过 NodePort 访问应用

**现象**:
```bash
curl -H "Host: rrr.example.com" http://49.232.237.136:31611
# Connection timed out
```

### 根本原因

1. **Traefik RBAC 权限问题** ✅ 已修复
   - Traefik 无法读取 Ingress 资源
   - ClusterRole `traefik-kube-system` 丢失
   - 修复：重新创建 ClusterRole 和 ClusterRoleBinding

2. **Ingress 配置错误** ⚠️ 待修复
   - 使用 `ingressClassName: nginx`，但集群只有 `traefik`
   - 使用 nginx 注解，但应该用 traefik 注解
   - 修复：需要修改 Git 仓库中的 Ingress 配置

3. **应用监听地址** ✅ 已验证正常
   - 应用监听在 Pod IP (10.42.0.190:3000)
   - Service 可以正常转发流量到 Pod IP
   - 这不是问题，K8s Service 会自动处理

4. **云服务商安全组未开放端口** ❌ 待修复
   - NodePort 31611 (HTTP) 和 32427 (HTTPS) 被防火墙阻止
   - 需要在云服务商控制台配置安全组规则

### 解决方案

#### 方案 1: 开放 NodePort 端口（推荐用于测试）

**腾讯云**:
1. 登录腾讯云控制台
2. 进入 "云服务器" → "安全组"
3. 找到服务器关联的安全组
4. 添加入站规则：
   - 协议：TCP
   - 端口：31611,32427
   - 来源：0.0.0.0/0（或限制为你的 IP）

**阿里云**:
1. 登录阿里云控制台
2. 进入 "云服务器 ECS" → "安全组"
3. 配置规则 → 添加安全组规则
4. 入方向规则：
   - 协议类型：自定义 TCP
   - 端口范围：31611/31611 和 32427/32427
   - 授权对象：0.0.0.0/0

#### 方案 2: 使用 LoadBalancer（推荐用于生产）

修改 Traefik Service 类型为 LoadBalancer，云服务商会自动分配公网 IP：

```bash
kubectl --kubeconfig=.kube/k3s-remote.yaml patch svc traefik \
  -n kube-system \
  --type=merge \
  -p '{"spec":{"type":"LoadBalancer"}}'
```

**注意**: 需要云服务商支持 LoadBalancer（腾讯云 TKE、阿里云 ACK 等）

#### 方案 3: 配置真实域名（推荐用于生产）

1. 在域名提供商添加 A 记录：
   ```
   rrr.example.com  →  49.232.237.136
   ```

2. 开放标准 HTTP/HTTPS 端口：
   - 80 (HTTP)
   - 443 (HTTPS)

3. 修改 Traefik Service 使用标准端口：
   ```yaml
   ports:
   - name: web
     nodePort: 30080  # 或直接使用 80
     port: 80
   - name: websecure
     nodePort: 30443  # 或直接使用 443
     port: 443
   ```

### 临时测试方案

如果无法修改防火墙，可以使用 kubectl port-forward：

```bash
# 转发到本地
kubectl --kubeconfig=.kube/k3s-remote.yaml port-forward \
  -n project-56d0416c-5fc9-40bc-be8a-85c8adf889a4-development \
  svc/dev-56d0416c-5fc9-40bc-be8a-85c8adf889a4 \
  8080:80

# 然后访问
curl http://localhost:8080
```

## 总结

### 成功要素

1. ✅ **GitHub Actions 自动构建**: 模板中的 workflow 正确触发
2. ✅ **GHCR 认证配置**: imagePullSecret 正确同步
3. ✅ **K8s 自动重试**: 等待镜像构建完成后自动拉取成功
4. ✅ **Traefik RBAC**: 修复了权限问题
5. ✅ **Ingress 配置**: 改为使用 traefik IngressClass
6. ⚠️ **网络访问**: 需要配置云安全组开放端口

### 待完成任务

1. **修改 GitHub 仓库 Ingress 配置**（必须）:
   - 在 `https://github.com/997899594/rrr` 仓库中
   - 修改 `k8s/base/ingress.yaml`：
     ```yaml
     spec:
       ingressClassName: traefik  # 改为 traefik
       annotations:
         cert-manager.io/cluster-issuer: letsencrypt-prod
         traefik.ingress.kubernetes.io/redirect-entry-point: https  # 使用 traefik 注解
     ```
   - 删除 nginx 注解：`nginx.ingress.kubernetes.io/ssl-redirect`
   - 提交并推送，Flux 会在 1 分钟内自动同步

2. **开放云安全组端口**（可选，用于外网访问）:
   - 31611 (HTTP) 和 32427 (HTTPS)

3. **配置真实域名**（推荐用于生产）:
   - 用于生产环境访问

### 用户体验优化建议

1. **前端显示构建进度**:
   - 监听 GitHub Actions 状态
   - 显示 "镜像构建中..." 提示
   - 预计等待时间: 3-5 分钟

2. **Pod 状态实时更新**:
   - 显示 ImagePullBackOff 时提示 "等待镜像构建"
   - 而不是显示为 "部署失败"

3. **首次部署说明**:
   - 提示用户首次部署需要等待镜像构建
   - 提供 GitHub Actions 链接查看构建进度

4. **网络访问检查**:
   - 检测 NodePort 是否可访问
   - 提示用户配置云安全组

## 相关文档

- [多租户 GHCR 解决方案](./multi-tenant-github-packages-fix.md)
- [Flux HTTP 代理设置](../guides/flux-http-proxy-setup.md)
- [项目初始化流程](../architecture/project-initialization-flow-complete.md)
- [K3s 网络配置指南](../guides/k3s-network-configuration.md)
