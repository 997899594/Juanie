# Flux SSH 认证问题

## 问题 1: SSH URL 格式错误

### 症状

```
GitRepository.source.toolkit.fluxcd.io "xxx-repo" is invalid: 
spec.url: Invalid value: "git@github.com:owner/repo.git": 
spec.url in body should match '^(http|https|ssh)://.*$'
```

### 根本原因

Flux 要求 SSH URL 必须使用标准格式，以 `ssh://` 开头，使用 `/` 分隔路径。

**错误格式：**
```
git@github.com:owner/repo.git
```

**正确格式：**
```
ssh://git@github.com/owner/repo.git
```

### 解决方案

在 `GitOpsEventHandlerService` 中转换 URL 格式：

```typescript
// 转换 HTTPS URL 为 SSH URL (Flux 格式)
if (credential.type === 'github_deploy_key') {
  gitUrl = payload.repositoryUrl
    .replace('https://github.com/', 'ssh://git@github.com/')
    .replace(/\.git$/, '.git')
}
```

### 相关代码

- `packages/services/business/src/gitops/gitops-event-handler.service.ts`

---

## 问题 2: known_hosts 字段缺失

### 症状

```
failed to configure authentication options: 
invalid 'ssh' auth option: 'known_hosts' is required
```

GitRepository 一直处于 `Reconciling` 状态。

### 根本原因

Flux 的 GitRepository 使用 SSH 认证时，必须在 Secret 中提供 `known_hosts` 字段，用于验证 Git 服务器的身份，防止中间人攻击。

### 什么是 known_hosts？

`known_hosts` 是 SSH 客户端用来验证服务器身份的文件，包含已知服务器的公钥指纹。

**格式：**
```
hostname algorithm public-key
```

**示例：**
```
github.com ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIOMqqnkVzrm0SdG6UOoqKLsabgH5C9okWi0dh2l9GKJl
```

### 解决方案

#### 方案 1: 使用 KnownHostsService（推荐）

创建专门的服务动态获取 known_hosts：

```typescript
@Injectable()
export class KnownHostsService {
  async getKnownHosts(provider: 'github' | 'gitlab'): Promise<string> {
    // 1. 尝试使用 ssh-keyscan 动态获取
    try {
      const result = execSync(`ssh-keyscan -t rsa,ecdsa,ed25519 ${host}`)
      return result.trim()
    } catch (error) {
      // 2. 失败时使用官方提供的备用密钥
      return this.getFallbackKnownHosts(provider)
    }
  }
}
```

**优点：**
- 始终获取最新密钥
- 支持密钥轮换
- 有备用方案

#### 方案 2: 手动获取

```bash
# 获取 GitHub 的 known_hosts
ssh-keyscan -t rsa,ecdsa,ed25519 github.com

# 获取 GitLab 的 known_hosts
ssh-keyscan -t rsa,ecdsa,ed25519 gitlab.com
```

### 在 Secret 中使用

```typescript
await k3s.createSecret(
  namespace,
  secretName,
  {
    'ssh-privatekey': privateKey,
    identity: privateKey,
    known_hosts: knownHostsContent, // 必需！
  },
  'kubernetes.io/ssh-auth',
)
```

### 预防措施

1. 使用 `KnownHostsService` 自动管理
2. 定期更新备用密钥（从官方文档）
3. 监控 Flux 日志，及时发现认证问题

### 相关问题

- [Secret 配置问题](./secret-configuration.md)

### 参考资料

- [GitHub SSH 密钥指纹](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/githubs-ssh-key-fingerprints)
- [GitLab SSH 主机密钥](https://docs.gitlab.com/ee/user/gitlab_com/index.html#ssh-host-keys-fingerprints)
- [Flux SSH 认证文档](https://fluxcd.io/flux/components/source/gitrepositories/#ssh-authentication)

---

## 问题 3: identity 字段缺失

### 症状

```
failed to configure authentication options: 
invalid 'ssh' auth option: 'identity' is required
```

### 根本原因

Flux 的 GitRepository 期望 Secret 中有 `identity` 字段（SSH 私钥），但 Kubernetes 的 `kubernetes.io/ssh-auth` Secret 类型使用的是 `ssh-privatekey` 字段。

**字段名不匹配：**
- Kubernetes 标准：`ssh-privatekey`
- Flux 期望：`identity`

### 解决方案

在 Secret 中**同时提供两个字段**：

```typescript
await k3s.createSecret(
  namespace,
  secretName,
  {
    'ssh-privatekey': privateKey, // Kubernetes 标准
    identity: privateKey,          // Flux 需要（内容相同）
    known_hosts: knownHosts,
  },
  'kubernetes.io/ssh-auth',
)
```

### 为什么需要两个字段？

- `ssh-privatekey`：Kubernetes Secret 类型规范要求
- `identity`：Flux 的 SSH 客户端实现要求

两个字段的内容完全相同，只是字段名不同。

### 预防措施

在创建 SSH Secret 时，始终同时提供两个字段。

### 相关代码

- `packages/services/business/src/gitops/flux/flux-resources.service.ts`

---

## 诊断工具

### 检查 GitRepository 状态

```bash
# 查看 GitRepository
kubectl get gitrepository -n <namespace>

# 查看详细信息
kubectl describe gitrepository <name> -n <namespace>

# 查看 Secret
kubectl get secret <secret-name> -n <namespace> -o yaml
```

### 查看 Flux 日志

```bash
# source-controller 负责 GitRepository
kubectl logs -n flux-system deployment/source-controller --tail=100

# 实时跟踪
kubectl logs -n flux-system deployment/source-controller -f
```

### 测试 SSH 连接

```bash
# 进入 Flux pod
kubectl exec -it -n flux-system deployment/source-controller -- sh

# 安装 SSH 客户端
apk add openssh-client

# 测试连接
ssh -T git@github.com
```

## 完整的 Secret 示例

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: git-auth
  namespace: project-xxx-development
type: kubernetes.io/ssh-auth
data:
  # SSH 私钥（base64 编码）
  ssh-privatekey: LS0tLS1CRUdJTi...
  # Flux 需要的字段（与 ssh-privatekey 相同）
  identity: LS0tLS1CRUdJTi...
  # GitHub 的 SSH 主机密钥（base64 编码）
  known_hosts: Z2l0aHViLmNvbSBzc2...
```

## 总结

SSH 认证需要三个关键要素：

1. **正确的 URL 格式**：`ssh://git@github.com/owner/repo.git`
2. **完整的 Secret 字段**：`ssh-privatekey` + `identity` + `known_hosts`
3. **有效的网络连接**：确保能访问 Git 服务器的 22 端口

三者缺一不可！
