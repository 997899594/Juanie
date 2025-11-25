# GitLab Token 自动刷新机制

## 问题背景

GitLab OAuth token 默认 2 小时过期，这会导致：

1. **项目创建时**：token 可能在创建过程中过期
2. **Flux 同步时**：K8s Secret 中的 token 过期后，Flux 无法访问 Git 仓库
3. **长期运行**：项目创建后，token 过期导致 GitRepository 资源失败

## 解决方案

### 1. 项目创建时自动刷新（已实现 ✅）

**流程：**
```
Worker 获取 token → 发布 GitOps 事件（含 userId）
    ↓
GitOpsEventHandlerService 接收事件
    ↓
检测到 GitLab 仓库 → 调用 OAuthAccountsService
    ↓
自动刷新过期的 token → 使用最新 token 创建 Secret
```

**代码位置：**
- `packages/services/business/src/gitops/gitops-event-handler.service.ts`
- `packages/services/foundation/src/auth/oauth-accounts.service.ts`

**关键逻辑：**
```typescript
// GitOpsEventHandlerService
const provider = this.detectGitProvider(payload.repositoryUrl)

if (provider === 'gitlab' && payload.userId) {
  const account = await this.oauthAccounts.getAccountByProvider(
    payload.userId,
    'gitlab'
  )
  if (account?.accessToken) {
    accessToken = account.accessToken // 自动刷新后的 token
  }
}
```

### 2. 定期刷新 K8s Secret（已实现 ✅）

**问题：** Secret 创建后固定不变，token 过期后 Flux 无法访问仓库。

**解决：** 定时任务每小时刷新所有 GitLab 项目的 Secret。

**实现：**

#### GitSecretRefresherService

```typescript
@Injectable()
export class GitSecretRefresherService {
  /**
   * 每小时刷新一次 GitLab Secret
   */
  @Cron(CronExpression.EVERY_HOUR)
  async refreshGitLabSecrets() {
    // 1. 查询所有 GitLab 仓库
    const repositories = await this.db
      .select()
      .from(schema.repositories)
      .where(eq(schema.repositories.provider, 'gitlab'))
    
    // 2. 遍历每个仓库
    for (const repo of repositories) {
      // 3. 获取最新 token（自动刷新）
      const account = await this.oauthAccounts.getAccountByProvider(
        repo.project.userId,
        'gitlab'
      )
      
      // 4. 更新所有环境的 Secret
      for (const environment of environments) {
        await this.k3s.createSecret(
          namespace,
          secretName,
          { username: 'git', password: account.accessToken },
          'Opaque'
        )
      }
    }
  }
}
```

**特性：**
- ✅ 每小时自动执行
- ✅ 在 token 过期前更新（token 有效期 2 小时）
- ✅ 自动调用 `OAuthAccountsService.getAccountByProvider()` 刷新过期 token
- ✅ 更新所有环境的 Secret（development/staging/production）
- ✅ 失败不影响其他项目

**配置：**
```typescript
// flux.module.ts
@Module({
  imports: [
    ScheduleModule.forRoot(), // 启用定时任务
    FoundationModule, // 用于 OAuthAccountsService
  ],
  providers: [
    GitSecretRefresherService, // 注册刷新服务
  ],
})
export class FluxModule {}
```

### 3. 手动刷新 API（已实现 ✅）

**用途：** 用户可以手动触发 Secret 刷新，无需等待定时任务。

**API 端点：**
```typescript
// POST /api/trpc/gitops.refreshGitSecret
{
  "projectId": "uuid"
}
```

**响应：**
```json
{
  "success": true,
  "message": "Secret refreshed successfully"
}
```

**前端调用示例：**
```typescript
// composables/useGitOps.ts
const refreshGitSecret = async (projectId: string) => {
  try {
    await trpc.gitops.refreshGitSecret.mutate({ projectId })
    toast.success('Git Secret 已刷新')
  } catch (error) {
    toast.error('刷新失败: ' + error.message)
  }
}
```

## 完整工作流程

### 项目创建流程

```
1. 用户创建项目（选择 GitLab 仓库）
   ↓
2. Worker 从数据库获取 OAuth token
   ↓
3. 创建 Git 仓库（使用 token）
   ↓
4. 发布 GitOps 设置事件（包含 userId）
   ↓
5. GitOpsEventHandlerService 处理事件
   ├─ 检测到 GitLab 仓库
   ├─ 调用 getAccountByProvider(userId, 'gitlab')
   ├─ 自动刷新过期的 token
   ├─ 使用最新 token 创建 K8s Secret
   ↓
6. Flux 使用 Secret 访问仓库 ✓
```

### 长期运行流程

```
项目运行中...
   ↓
每小时执行一次（定时任务）
   ├─ 查询所有 GitLab 项目
   ├─ 遍历每个项目
   │   ├─ 获取用户的 OAuth 账户
   │   ├─ 检查 token 是否过期
   │   ├─ 如果过期：调用 GitLab API 刷新
   │   ├─ 更新数据库中的 token
   │   ├─ 更新所有环境的 K8s Secret
   ↓
Flux 始终使用有效的 token ✓
```

## Token 刷新详细流程

### OAuthAccountsService.getAccountByProvider()

```typescript
async getAccountByProvider(userId: string, provider: 'gitlab') {
  const account = await this.db
    .select()
    .from(schema.oauthAccounts)
    .where(...)
  
  // 检查是否过期
  if (
    account.refreshToken &&
    account.expiresAt &&
    new Date(account.expiresAt) < new Date()
  ) {
    // 自动刷新
    return await this.refreshGitLabToken(account)
  }
  
  return account
}
```

### refreshGitLabToken()

```typescript
private async refreshGitLabToken(account) {
  const gitlabUrl = process.env.GITLAB_BASE_URL || 'https://gitlab.com'
  
  // 调用 GitLab OAuth API
  const response = await fetch(`${gitlabUrl}/oauth/token`, {
    method: 'POST',
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: account.refreshToken,
      client_id: process.env.GITLAB_CLIENT_ID,
      client_secret: process.env.GITLAB_CLIENT_SECRET,
    }),
  })
  
  const data = await response.json()
  
  // 更新数据库
  await this.db
    .update(schema.oauthAccounts)
    .set({
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
      status: 'active',
    })
  
  return updatedAccount
}
```

## 配置要求

### 环境变量

```bash
# GitLab 私服配置
GITLAB_BASE_URL=https://gitlab.your-company.com
GITLAB_CLIENT_ID=your_client_id
GITLAB_CLIENT_SECRET=your_client_secret

# K3s 配置
K3S_KUBECONFIG_PATH=~/.kube/config
```

### GitLab OAuth 应用配置

1. **Scopes（权限）：**
   - `api` - 完整 API 访问
   - `read_repository` - 读取仓库
   - `write_repository` - 写入仓库

2. **Token 设置：**
   - 启用 Refresh Token
   - 设置合理的过期时间（建议 2-8 小时）

## 监控和告警

### 日志

```typescript
// 成功刷新
this.logger.log(`Secret refresh completed: ${refreshed} refreshed, ${failed} failed`)

// 刷新失败
this.logger.error(`Failed to refresh secret for project ${projectId}:`, error.message)

// Token 刷新失败
this.logger.warn(`No valid GitLab token for user ${userId}, skipping`)
```

### 指标建议

1. **刷新成功率**
   - 每小时刷新的项目数
   - 成功/失败比例

2. **Token 状态**
   - 过期的 token 数量
   - 刷新失败的账户数

3. **Flux 同步状态**
   - GitRepository 资源状态
   - 认证失败的次数

## 故障排查

### Secret 未更新

```bash
# 检查定时任务是否运行
# 查看日志：Starting GitLab secret refresh...

# 检查 Secret 内容
kubectl get secret xxx-git-auth -n project-xxx-development -o yaml

# 手动触发刷新
curl -X POST /api/trpc/gitops.refreshGitSecret \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId": "xxx"}'
```

### Token 刷新失败

```bash
# 检查 OAuth 账户状态
SELECT provider, status, expires_at, refresh_token IS NOT NULL as has_refresh
FROM oauth_accounts 
WHERE user_id = 'xxx' AND provider = 'gitlab';

# 检查 GitLab OAuth 配置
echo $GITLAB_CLIENT_ID
echo $GITLAB_BASE_URL

# 测试 GitLab API
curl -X POST https://gitlab.com/oauth/token \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET"
```

### Flux 无法访问仓库

```bash
# 检查 GitRepository 状态
kubectl get gitrepository -A

# 查看错误信息
kubectl describe gitrepository xxx-repo -n project-xxx-development

# 常见错误：
# - "authentication required" → Secret 中的 token 过期
# - "repository not found" → URL 或权限问题
```

## 最佳实践

1. **Token 过期时间**
   - 建议设置 2-8 小时
   - 定时任务频率应小于过期时间（当前 1 小时）

2. **错误处理**
   - 刷新失败时标记账户为 `expired`
   - 通知用户重新连接账户
   - 不影响其他项目的刷新

3. **安全性**
   - Token 仅在后端传递
   - Secret 使用 K8s 原生加密
   - 定期轮换 OAuth 应用密钥

4. **监控**
   - 监控刷新成功率
   - 告警 token 刷新失败
   - 跟踪 Flux 同步状态

## 相关文档

- [GitOps 认证详细说明](./gitops-authentication.md)
- [GitOps 认证改进总结](./gitops-auth-improvements.md)
- [K3s 远程访问配置](./k3s-remote-access.md)
