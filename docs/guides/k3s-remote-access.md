# K3s 远程访问配置指南

## 问题说明

开发环境在本地，K3s 集群在远程服务器，需要配置远程访问才能让本地的 API Gateway 操作 K3s 集群。

## 方案选择

### 方案 1: 配置远程 K3s 访问（开发环境推荐）

#### 步骤 1: 在服务器上获取 kubeconfig

```bash
# SSH 到服务器
ssh root@your-server-ip

# 复制 kubeconfig 内容
sudo cat /etc/rancher/k3s/k3s.yaml
```

#### 步骤 2: 修改 kubeconfig

将输出的内容保存到本地文件 `~/.kube/k3s-remote.yaml`，然后修改：

```yaml
apiVersion: v1
clusters:
- cluster:
    # 修改这里：将 127.0.0.1 改为服务器的公网 IP
    server: https://YOUR_SERVER_IP:6443
    # 开发环境可以跳过 TLS 验证
    insecure-skip-tls-verify: true
  name: default
contexts:
- context:
    cluster: default
    user: default
  name: default
current-context: default
kind: Config
preferences: {}
users:
- name: default
  user:
    # 保持原有的 token 不变
    token: K10...（原有的 token）
```

#### 步骤 3: 配置防火墙（重要！）

在服务器上开放 K3s API 端口：

```bash
# 如果使用 ufw
sudo ufw allow 6443/tcp

# 如果使用 firewalld
sudo firewall-cmd --permanent --add-port=6443/tcp
sudo firewall-cmd --reload

# 如果使用云服务器（如阿里云、腾讯云）
# 需要在安全组中添加规则：允许 6443 端口
```

⚠️ **安全警告**: 生产环境不要直接暴露 6443 端口，应该使用 VPN 或堡垒机。

#### 步骤 4: 配置本地环境变量

在项目根目录的 `.env` 文件中添加：

```bash
# K3s 远程访问配置
K3S_KUBECONFIG_PATH=~/.kube/k3s-remote.yaml
K3S_SKIP_TLS_VERIFY=true
```

#### 步骤 5: 测试连接

```bash
# 使用 kubectl 测试
export KUBECONFIG=~/.kube/k3s-remote.yaml
kubectl get nodes
kubectl get pods -n flux-system

# 应该能看到服务器上的节点和 Flux pods
```

#### 步骤 6: 重启开发服务器

```bash
bun run dev
```

现在本地的 API Gateway 应该可以连接到远程 K3s 集群了。

---

### 方案 2: 使用 SSH 隧道（更安全）

如果不想暴露 6443 端口，可以使用 SSH 隧道：

```bash
# 在本地创建 SSH 隧道
ssh -L 6443:127.0.0.1:6443 root@your-server-ip -N

# 保持这个终端运行
```

然后 kubeconfig 中使用：
```yaml
server: https://127.0.0.1:6443
```

---

### 方案 3: 开发模式跳过 GitOps（快速开发）

如果暂时不需要测试 GitOps 功能，可以让开发环境跳过 GitOps 步骤。

#### 修改 CreateGitOpsHandler

编辑 `packages/services/business/src/projects/initialization/handlers/create-gitops.handler.ts`:

```typescript
canHandle(context: InitializationContext): boolean {
  // 开发环境跳过 GitOps
  if (process.env.NODE_ENV === 'development' && process.env.SKIP_GITOPS === 'true') {
    return false
  }
  
  // 只有有仓库且 Flux 已安装时才创建 GitOps 资源
  return !!context.repositoryId && this.flux.isInstalled()
}
```

然后在 `.env` 中添加：
```bash
SKIP_GITOPS=true
```

这样项目创建流程会跳过 GitOps 步骤，直接完成。

---

## 推荐配置（根据场景）

### 场景 1: 本地开发 + 快速迭代
```bash
# .env
NODE_ENV=development
SKIP_GITOPS=true
```
- 不需要配置 K3s 访问
- 项目创建快速完成
- 适合开发前端和业务逻辑

### 场景 2: 本地开发 + 测试 GitOps
```bash
# .env
NODE_ENV=development
K3S_KUBECONFIG_PATH=~/.kube/k3s-remote.yaml
K3S_SKIP_TLS_VERIFY=true
```
- 需要配置远程 K3s 访问
- 可以测试完整的 GitOps 流程
- 适合开发和调试 GitOps 功能

### 场景 3: 生产部署
```bash
# .env (在服务器上)
NODE_ENV=production
K3S_KUBECONFIG_PATH=/etc/rancher/k3s/k3s.yaml
```
- 应用和 K3s 在同一服务器
- 使用本地 kubeconfig
- 不需要暴露 6443 端口

---

## 验证配置

### 检查 K3s 连接状态

在应用启动时，查看日志：

```bash
# 成功连接
✅ K3s 已连接: https://your-server-ip:6443
✅ Flux is already installed

# 连接失败
⚠️ K3s 连接失败: connect ETIMEDOUT
提示: 确保 K3s 集群正在运行，并且 kubeconfig 配置正确
```

### 测试 GitOps 资源创建

创建一个测试项目，观察日志：

```bash
# 应该看到类似的日志
[ProjectInitializationStateMachine] Starting initialization for project: test-project
[CreateProjectHandler] Creating project record
[LoadTemplateHandler] Loading template: nextjs-15-app
[RenderTemplateHandler] Rendering template
[CreateEnvironmentsHandler] Creating environments
[SetupRepositoryHandler] Setting up repository
[CreateGitOpsHandler] Creating GitOps resources for project: xxx
[CreateGitOpsHandler] GitOps resource created: xxx
[FinalizeHandler] Finalizing initialization
[ProjectInitializationStateMachine] Initialization completed
```

---

## 故障排查

### 问题 1: 连接超时

```
Error: connect ETIMEDOUT
```

**解决方案**:
1. 检查服务器防火墙是否开放 6443 端口
2. 检查云服务器安全组规则
3. 尝试使用 SSH 隧道

### 问题 2: 证书验证失败

```
Error: unable to verify the first certificate
```

**解决方案**:
在 `.env` 中添加：
```bash
K3S_SKIP_TLS_VERIFY=true
```

### 问题 3: Flux 未安装

```
⚠️ Flux is not installed
```

**解决方案**:
在服务器上安装 Flux：
```bash
flux install
```

### 问题 4: 权限不足

```
Error: Forbidden: User "system:anonymous" cannot get resource
```

**解决方案**:
检查 kubeconfig 中的 token 是否正确。

---

## 安全建议

### 开发环境
- ✅ 可以使用 `insecure-skip-tls-verify: true`
- ✅ 可以暴露 6443 端口（限制 IP）
- ✅ 使用 SSH 隧道更安全

### 生产环境
- ❌ 不要暴露 6443 端口到公网
- ❌ 不要跳过 TLS 验证
- ✅ 使用 VPN 或内网访问
- ✅ 应用和 K3s 部署在同一网络

---

## 下一步

配置完成后，可以：
1. 创建测试项目验证流程
2. 查看 GitOps 资源状态
3. 监控 Flux 同步日志

参考 [PROJECT_CREATION_CHECKLIST.md](../../PROJECT_CREATION_CHECKLIST.md) 进行完整测试。
