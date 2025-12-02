# Flux GitOps OAuth Token 优化方案

## 问题背景

当前实现使用了两层认证：
1. 用户通过 OAuth2 登录（GitHub/GitLab）
2. 系统再创建额外的 Deploy Key（GitHub）或 Project Token（GitLab）

这导致：
- **网络问题**：Deploy Key 使用 SSH (22端口)，被防火墙阻止
- **管理复杂**：需要维护两套凭证
- **权限冗余**：OAuth token 已经有足够权限

## 当前架构

```
用户 OAuth 登录
  ↓
存储 OAuth Token (oauthAccounts 表)
  ↓
创建项目时
  ↓
GitAuthService.setupProjectAuth()
  ↓
├─ GitHub: 创建 Deploy Key (SSH)
└─ GitLab: 创建 Project Access Token
  ↓
存储到 gitCredentials 表
  ↓
创建 K8s Secret
  ↓
Flux 使用 SSH/HTTPS 访问仓库
```

## 优化后架构

```
用户 OAuth 登录
  ↓
存储 OAuth Token (oauthAccounts 表)
  ↓
创建项目时
  ↓
直接使用 OAuth Token
  ↓
创建 K8s Secret (HTTPS Basic Auth)
  ↓
Flux 使用 HTTPS 访问仓库
```

## OAuth Token 权限分析

### GitHub OAuth Token

当前请求的权限（`auth.service.ts`）：
```typescript
[
  'user:email',        // 获取用户邮箱
  'repo',              // ✅ 完整的仓库访问权限（读写公开和私有仓库）
  'workflow',          // ✅ 管理 GitHub Actions workflows
  'admin:repo_hook',   // ✅ 管理仓库 webhooks
  'delete_repo',       // ✅ 删除仓库
]
```

**结论**：`repo` 权限已经足够 Flux 使用，无需额外的 Deploy Key。

### GitLab OAuth Token

当前请求的权限：
```typescript
[
  'api',               // ✅ 完整 API 访问（包含所有操作）
  'read_user',         // 读取用户信息
  'read_repository',   // 读取仓库
  'write_repository',  // ✅ 写入仓库（创建、推送等）
]
```

**结论**：`api` 权限已经足够 Flux 使用，无需额外的 Project Token。

## 实现方案

### 1. 简化 GitAuthService

不再创建额外的凭证，直接使用 OAuth token：

```typescript
// packages/services/business/src/gitops/git-auth/git-auth.service.ts

async setupProjectAuth(data: {
  projectId: string
  repositoryId: string
  provider: 'github' | 'gitlab'
  userId: string
}): Promise<{ success: boolean; oauthAccountId: string }> {
  // 直接获取用户的 OAuth 账户
  const oauthAccount = await this.oauthAccounts.getAccountByProvider(
    data.userId,
    data.provider
  )

  if (!oauthAccount?.accessToken) {
    throw new Error(`User not connected to ${data.provider}`)
  }

  // 不需要创建额外的凭证，直接返回 OAuth 账户 ID
  return {
    success: true,
    oauthAccountId: oauthAccount.id,
  }
}
```

### 2. 修改 FluxResourcesService

直接使用 OAuth token 创建 K8s Secret：

```typescript
// packages/services/business/src/gitops/flux/flux-resources.service.ts

async setupProjectGitOps(data: {
  projectId: string
  repositoryUrl: string
  repositoryBranch: string
  oauthAccount: OAuthAccount  // 直接传入 OAuth 账户
  environments: Array<{...}>
}) {
  for (const environment of environments) {
    const namespace = `project-${projectId}-${environment.type}`
    const secretName = `${projectId}-git-auth`

    // 创建 K8s Secret（HTTPS Basic Auth）
    await this.k3s.createSecret(
      namespace,
      secretName,
      {
        // GitHub 使用 x-access-token，GitLab 使用 oauth2
        username: oauthAccount.provider === 'github' ? 'x-access-token' : 'oauth2',
        password: oauthAccount.accessToken,
      },
      'kubernetes.io/basic-auth',
    )

    // 确保使用 HTTPS URL
    const httpsUrl = this.convertToHttpsUrl(repositoryUrl)

    // 创建 GitRepository
    await this.createGitRepository({
      name: `${projectId}-repo`,
      namespace,
      url: httpsUrl,  // HTTPS URL
      branch: repositoryBranch,
      secretRef: secretName,
      interval: '1m',
    })
  }
}
```

### 3. 处理 Token 刷新（GitLab）

GitLab OAuth token 会过期，需要自动刷新：

```typescript
// packages/services/foundation/src/auth/oauth-accounts.service.ts

// 已经实现了自动刷新 ✅
async getAccountByProvider(userId: string, provider: 'github' | 'gitlab') {
  const account = await this.db.select()...

  // GitLab token 过期自动刷新
  if (
    provider === 'gitlab' &&
    account.refreshToken &&
    account.expiresAt &&
    new Date(account.expiresAt) < new Date()
  ) {
    return await this.refreshGitLabToken(account)
  }

  return account
}
```

**需要添加**：定期更新 K8s Secret 中的 token

```typescript
// 新增：Token 刷新后更新 K8s Secret
async refreshProjectSecrets(projectId: string, oauthAccount: OAuthAccount) {
  const environments = await this.db.select()
    .from(schema.environments)
    .where(eq(schema.environments.projectId, projectId))

  for (const environment of environments) {
    const namespace = `project-${projectId}-${environment.type}`
    const secretName = `${projectId}-git-auth`

    // 更新 Secret
    await this.k3s.updateSecret(
      namespace,
      secretName,
      {
        username: oauthAccount.provider === 'github' ? 'x-access-token' : 'oauth2',
        password: oauthAccount.accessToken,  // 新的 token
      }
    )
  }
}
```

## GitHub HTTPS 认证格式

GitHub 支持多种 HTTPS 认证方式：

```bash
# 方式 1: x-access-token（推荐）
https://x-access-token:TOKEN@github.com/user/repo.git

# 方式 2: 直接使用 token
https://TOKEN@github.com/user/repo.git

# 方式 3: Basic Auth（Flux 使用）
username: x-access-token
password: TOKEN
```

## GitLab HTTPS 认证格式

```bash
# 方式 1: oauth2（推荐）
https://oauth2:TOKEN@gitlab.com/user/repo.git

# 方式 2: Basic Auth（Flux 使用）
username: oauth2
password: TOKEN
```

## 优势对比

| 维度 | 当前方案 (Deploy Key) | 优化方案 (OAuth Token) |
|------|----------------------|------------------------|
| 网络要求 | SSH (22) ❌ | HTTPS (443) ✅ |
| 防火墙兼容 | 可能被阻止 ❌ | 几乎不会被阻止 ✅ |
| 凭证管理 | 两套（OAuth + Deploy Key） | 一套（OAuth） ✅ |
| 权限范围 | 单仓库 | 用户授权的所有仓库 ✅ |
| Token 过期 | 永不过期 | GitLab 自动刷新 ✅ |
| 实现复杂度 | 高（需要生成 SSH 密钥） | 低（直接使用） ✅ |
| 安全性 | 高（密钥对） | 高（OAuth token） ✅ |

## 迁移步骤

### 1. 修改 GitAuthService

```bash
# 简化 setupProjectAuth 方法
# 移除 Deploy Key 和 Project Token 创建逻辑
```

### 2. 修改 FluxResourcesService

```bash
# 修改 setupProjectGitOps 方法
# 直接使用 OAuth token 创建 Secret
```

### 3. 添加 Token 刷新机制

```bash
# 创建定时任务，检查 GitLab token 过期
# 自动刷新并更新 K8s Secret
```

### 4. 数据库迁移

```sql
-- gitCredentials 表可以废弃或重构
-- 直接使用 oauthAccounts 表
```

### 5. 测试

```bash
# 1. 测试 GitHub 仓库访问
# 2. 测试 GitLab 仓库访问
# 3. 测试 Token 刷新
# 4. 测试 Flux 同步
```

## 注意事项

### 1. Token 安全

- OAuth token 存储在数据库中，应该加密
- K8s Secret 是 base64 编码，不是加密
- 建议使用 Sealed Secrets 或 External Secrets Operator

### 2. Token 权限

- OAuth token 权限范围更大（所有仓库）
- 如果需要限制到单个仓库，可以：
  - 引导用户创建 Fine-grained PAT
  - 或继续使用 Deploy Key（需要解决网络问题）

### 3. Token 撤销

- 用户断开 OAuth 连接时，需要清理 K8s Secret
- 实现 `revokeProjectAuth` 方法

### 4. 多仓库支持

- 一个 OAuth token 可以访问多个仓库
- 适合用户有多个项目的场景

## 相关文档

- [GitHub OAuth Scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitLab OAuth2 Provider](https://docs.gitlab.com/ee/api/oauth2.html)
- [Flux GitRepository Authentication](https://fluxcd.io/flux/components/source/gitrepositories/#https-authentication)
- [Known Hosts Service](../../guides/KNOWN_HOSTS_SERVICE.md)

## 总结

**推荐使用 OAuth Token 方案**，因为：

1. ✅ 解决了 SSH 端口被阻止的问题
2. ✅ 简化了凭证管理
3. ✅ 更好的用户体验（无需额外配置）
4. ✅ 支持 Token 自动刷新（GitLab）
5. ✅ 符合 DevOps 最佳实践

唯一的权衡是权限范围更大，但对于 DevOps 平台来说，这通常是可接受的。
