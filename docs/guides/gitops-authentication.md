# GitOps 认证和 Token 管理

## 概述

本文档说明 GitOps 资源创建过程中的认证机制，包括 K3s 集群认证和 Git 提供商（GitHub/GitLab）的 OAuth token 管理。

## K3s 集群认证

### 认证方式

K3s 集群通过 kubeconfig 文件进行认证，包含：
- 集群 CA 证书
- 客户端证书
- 客户端密钥
- 或 Service Account Token

### 配置

```bash
# 环境变量配置
K3S_KUBECONFIG_PATH=~/.kube/config
# 或
KUBECONFIG_PATH=~/.kube/config

# 开发环境跳过 TLS 验证（仅用于本地开发）
K3S_SKIP_TLS_VERIFY=true
NODE_ENV=development
```

### 认证验证

系统在创建 GitOps 资源前会验证 K3s 认证：

```typescript
// 1. 检查连接状态
if (!this.k3s.isK3sConnected()) {
  throw new Error('K3s cluster not connected')
}

// 2. 验证认证（尝试列出 namespaces）
try {
  await this.k3s.listNamespaces()
  this.logger.debug('K3s authentication verified')
} catch (error) {
  throw new Error(`K3s authentication failed: ${error.message}`)
}
```

## Git 提供商认证

### OAuth Token 管理

系统支持 GitHub 和 GitLab OAuth 认证，token 存储在数据库中。

#### Token 字段

```typescript
interface OAuthAccount {
  accessToken: string      // 访问令牌
  refreshToken?: string    // 刷新令牌（GitLab）
  expiresAt?: Date        // 过期时间（GitLab）
  status: 'active' | 'expired'
}
```

### GitLab 私服支持

#### 配置 GitLab 私服 URL

```bash
# .env
GITLAB_BASE_URL=https://gitlab.your-company.com
GITLAB_CLIENT_ID=your_client_id
GITLAB_CLIENT_SECRET=your_client_secret
```

#### GitLab Token 自动刷新

GitLab access token 有过期时间（默认 2 小时），系统会自动刷新：

```typescript
// OAuthAccountsService.getAccountByProvider()
if (
  provider === 'gitlab' &&
  account.refreshToken &&
  account.expiresAt &&
  new Date(account.expiresAt) < new Date()
) {
  // 自动刷新 token
  return await this.refreshGitLabToken(account)
}
```

刷新流程：
1. 检测 token 是否过期
2. 使用 refresh_token 请求新的 access_token
3. 更新数据库中的 token 和过期时间
4. 如果刷新失败，标记账户为 `expired` 状态

### GitHub Token

GitHub Personal Access Token 或 OAuth token 通常不会过期（除非手动撤销），无需刷新机制。

## GitOps 资源创建流程

### 完整认证流程

```
1. Worker 接收项目初始化任务
   ├─ 包含 userId 和 repository 信息
   │
2. 解析 OAuth Token
   ├─ 从数据库获取用户的 OAuth 账户
   ├─ 自动刷新过期的 GitLab token
   │
3. 创建 Git 仓库
   ├─ 使用 access_token 调用 Git API
   │
4. 发布 GitOps 设置请求事件
   ├─ 包含 userId（用于后续 token 刷新）
   ├─ 包含 accessToken
   │
5. GitOpsEventHandlerService 处理事件
   ├─ 验证 K3s 认证
   ├─ 检测 Git 提供商（GitHub/GitLab）
   ├─ 如果是 GitLab，再次获取最新 token（自动刷新）
   ├─ 创建 Git Secret（包含 access_token）
   │
6. Flux 使用 Secret 访问 Git 仓库
   ├─ GitRepository 资源引用 Secret
   ├─ Flux 定期同步代码
```

### 代码示例

#### Worker 发布事件

```typescript
const success = await this.initService.requestGitOpsSetup({
  projectId,
  repositoryId,
  repositoryUrl: repository.cloneUrl,
  repositoryBranch: repository.defaultBranch || 'main',
  accessToken,
  userId, // 用于自动刷新 OAuth token
  environments: [...],
  jobId: job.id,
})
```

#### 事件处理器刷新 Token

```typescript
// GitOpsEventHandlerService
async handleSetupRequest(payload: GitOpsSetupRequestedEvent) {
  // 获取最新的 access token（自动刷新如果过期）
  let accessToken = payload.accessToken
  const provider = this.detectGitProvider(payload.repositoryUrl)

  if (provider === 'gitlab' && payload.userId) {
    try {
      const account = await this.oauthAccounts.getAccountByProvider(
        payload.userId,
        'gitlab'
      )
      if (account?.accessToken) {
        accessToken = account.accessToken
        this.logger.debug('Using refreshed GitLab token')
      }
    } catch (error) {
      this.logger.warn('Failed to refresh GitLab token:', error.message)
      // 继续使用原 token
    }
  }

  // 创建 GitOps 资源
  await this.fluxResources.setupProjectGitOps({
    ...payload,
    accessToken, // 使用刷新后的 token
  })
}
```

#### 创建 Git Secret

```typescript
// FluxResourcesService
private async createGitSecret(
  namespace: string,
  secretName: string,
  repositoryUrl: string,
  accessToken: string,
): Promise<void> {
  const secretYaml = this.yamlGenerator.generateGitSecretYAML({
    name: secretName,
    namespace,
    username: 'git',
    password: accessToken, // 使用刷新后的 token
  })

  await this.k3s.createSecret(namespace, secretName, data, 'Opaque')
}
```

## 安全考虑

### Token 存储

- ✅ Token 存储在数据库中，加密传输
- ✅ API 响应不返回 token（仅返回状态）
- ✅ Token 仅在后端服务间传递

### Token 刷新

- ✅ GitLab token 自动刷新，无需用户干预
- ✅ 刷新失败时标记账户为 `expired`，提示用户重新连接
- ✅ 刷新过程中使用原 token 作为后备

### K3s 认证

- ✅ Kubeconfig 文件权限应设置为 600
- ✅ 生产环境不应跳过 TLS 验证
- ✅ 使用 Service Account 时应限制权限（RBAC）

## 故障排查

### K3s 认证失败

```bash
# 检查 kubeconfig 文件
cat ~/.kube/config

# 测试连接
kubectl get namespaces

# 检查证书有效期
openssl x509 -in ~/.kube/k3s.crt -noout -dates
```

### GitLab Token 过期

```bash
# 检查 OAuth 账户状态
SELECT provider, status, expires_at 
FROM oauth_accounts 
WHERE user_id = 'xxx';

# 手动刷新（通过 API）
POST /api/auth/oauth/refresh
{
  "provider": "gitlab"
}
```

### Git Secret 创建失败

```bash
# 检查 namespace 是否存在
kubectl get namespace project-xxx-development

# 检查 secret 是否创建
kubectl get secret -n project-xxx-development

# 查看 secret 内容
kubectl get secret xxx-git-auth -n project-xxx-development -o yaml
```

## 最佳实践

1. **GitLab 私服**
   - 配置 `GITLAB_BASE_URL` 环境变量
   - 确保 OAuth 应用配置正确
   - 设置合理的 token 过期时间（建议 2-8 小时）

2. **K3s 集群**
   - 生产环境使用 TLS 证书
   - 定期轮换 Service Account Token
   - 使用 RBAC 限制权限

3. **Token 管理**
   - 监控 token 刷新失败率
   - 提示用户重新连接过期账户
   - 记录 token 使用日志（不记录 token 本身）

4. **错误处理**
   - GitOps 资源创建失败不应阻塞项目创建
   - 提供清晰的错误信息
   - 支持手动重试

## 相关文档

- [K3s 远程访问配置](./k3s-remote-access.md)
- [GitOps 初始化流程](./gitops-initialization-summary.md)
- [OAuth 集成指南](../api/oauth.md)
