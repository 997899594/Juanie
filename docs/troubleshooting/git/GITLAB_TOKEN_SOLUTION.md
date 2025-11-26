# GitLab Token 过期问题 - 完整解决方案

## 问题描述

**核心问题：** Flux 使用 K8s Secret 访问 Git 仓库，但 GitLab token 会过期（默认 2 小时），导致 Flux 无法同步代码。

## 解决方案总览

我们实现了三层防护机制：

1. ✅ **项目创建时自动刷新** - 确保创建时使用有效 token
2. ✅ **定期自动刷新 Secret** - 每小时更新所有 GitLab 项目的 K8s Secret
3. ✅ **手动刷新 API** - 用户可以随时手动触发刷新

## 实现细节

### 1. 项目创建时自动刷新

**位置：** `packages/services/business/src/gitops/gitops-event-handler.service.ts`

**流程：**
```typescript
// 1. 检测 Git 提供商
const provider = this.detectGitProvider(payload.repositoryUrl)

// 2. 如果是 GitLab，获取最新 token（自动刷新）
if (provider === 'gitlab' && payload.userId) {
  const account = await this.oauthAccounts.getAccountByProvider(
    payload.userId,
    'gitlab'
  )
  if (account?.accessToken) {
    accessToken = account.accessToken // 已自动刷新
  }
}

// 3. 使用最新 token 创建 Secret
await this.fluxResources.setupProjectGitOps({
  ...payload,
  accessToken, // 最新的 token
})
```

**关键点：**
- `OAuthAccountsService.getAccountByProvider()` 会自动检查 token 是否过期
- 如果过期，自动调用 GitLab API 刷新
- 更新数据库中的 token 和过期时间

### 2. 定期自动刷新 Secret

**位置：** `packages/services/business/src/gitops/git-secret-refresher.service.ts`

**特性：**
- 每小时执行一次（`@Cron(CronExpression.EVERY_HOUR)`）
- 查询所有 GitLab 仓库
- 获取 organization owner 的 OAuth token
- 自动刷新过期的 token
- 更新所有环境的 K8s Secret

**代码结构：**
```typescript
@Injectable()
export class GitSecretRefresherService {
  @Cron(CronExpression.EVERY_HOUR)
  async refreshGitLabSecrets() {
    // 1. 查询所有 GitLab 项目
    const repositories = await this.db
      .select()
      .from(schema.repositories)
      .innerJoin(schema.projects, ...)
      .innerJoin(schema.organizationMembers, ...) // 获取 owner
      .where(eq(schema.repositories.provider, 'gitlab'))
    
    // 2. 遍历每个项目
    for (const repo of repositories) {
      // 3. 获取最新 token（自动刷新）
      const account = await this.oauthAccounts.getAccountByProvider(
        repo.owner.userId,
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

**为什么每小时刷新？**
- GitLab token 默认 2 小时过期
- 每小时刷新确保 token 始终有效
- 即使刷新失败，还有 1 小时缓冲时间

### 3. 手动刷新 API

**位置：** `apps/api-gateway/src/routers/gitops.router.ts`

**API 端点：**
```typescript
// POST /api/trpc/gitops.refreshGitSecret
refreshGitSecret: this.trpc.protectedProcedure
  .input(z.object({ projectId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const result = await this.gitSecretRefresher.refreshProjectSecret(
      input.projectId
    )
    
    if (!result.success) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: result.message,
      })
    }
    
    return { success: true, message: result.message }
  })
```

**使用场景：**
- 用户发现 GitRepository 状态为 `failed`
- 手动触发刷新，无需等待定时任务
- 可以集成到前端 UI（"刷新凭证"按钮）

## 配置要求

### 1. 环境变量

```bash
# GitLab 配置（支持私服）
GITLAB_BASE_URL=https://gitlab.your-company.com
GITLAB_CLIENT_ID=your_client_id
GITLAB_CLIENT_SECRET=your_client_secret

# K3s 配置
K3S_KUBECONFIG_PATH=~/.kube/config
```

### 2. GitLab OAuth 应用

**必需的 Scopes：**
- `api` - 完整 API 访问
- `read_repository` - 读取仓库
- `write_repository` - 写入仓库

**重要设置：**
- ✅ 启用 Refresh Token
- ✅ 设置合理的过期时间（建议 2-8 小时）

### 3. NestJS 模块配置

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

## 工作流程图

```
项目创建
    ↓
Worker 获取 OAuth token
    ↓
发布 GitOps 事件（含 userId）
    ↓
GitOpsEventHandlerService
    ├─ 检测 GitLab 仓库
    ├─ 获取最新 token（自动刷新）
    ├─ 创建 K8s Secret
    ↓
Flux 使用 Secret 访问仓库 ✓
    ↓
    ↓ (1 小时后)
    ↓
定时任务触发
    ├─ 查询所有 GitLab 项目
    ├─ 获取 owner 的 OAuth token
    ├─ 自动刷新过期的 token
    ├─ 更新所有环境的 Secret
    ↓
Flux 继续使用有效 token ✓
    ↓
    ↓ (如果需要)
    ↓
用户手动刷新
    ├─ 调用 API: refreshGitSecret
    ├─ 立即刷新指定项目的 Secret
    ↓
问题解决 ✓
```

## 监控和日志

### 成功日志

```
[GitSecretRefresherService] Starting GitLab secret refresh...
[GitSecretRefresherService] Found 5 GitLab repositories
[GitSecretRefresherService] Refreshed secret xxx-git-auth in project-xxx-development
[GitSecretRefresherService] Secret refresh completed: 5 refreshed, 0 failed
```

### 失败日志

```
[GitSecretRefresherService] Failed to refresh secret for project xxx: No valid GitLab token
[OAuthAccountsService] GitLab token 刷新失败
```

### 监控指标建议

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

### 问题 1：Secret 未更新

```bash
# 检查定时任务日志
# 应该看到：Starting GitLab secret refresh...

# 检查 Secret 内容
kubectl get secret xxx-git-auth -n project-xxx-development -o jsonpath='{.data.password}' | base64 -d

# 手动触发刷新
curl -X POST /api/trpc/gitops.refreshGitSecret \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId": "xxx"}'
```

### 问题 2：Token 刷新失败

```bash
# 检查 OAuth 账户状态
SELECT 
  provider, 
  status, 
  expires_at,
  refresh_token IS NOT NULL as has_refresh_token
FROM oauth_accounts 
WHERE user_id = 'xxx' AND provider = 'gitlab';

# 检查 GitLab 配置
echo $GITLAB_CLIENT_ID
echo $GITLAB_CLIENT_SECRET
echo $GITLAB_BASE_URL

# 测试 GitLab API
curl -X POST $GITLAB_BASE_URL/oauth/token \
  -d "grant_type=refresh_token" \
  -d "refresh_token=$REFRESH_TOKEN" \
  -d "client_id=$CLIENT_ID" \
  -d "client_secret=$CLIENT_SECRET"
```

### 问题 3：Flux 无法访问仓库

```bash
# 检查 GitRepository 状态
kubectl get gitrepository -A

# 查看详细错误
kubectl describe gitrepository xxx-repo -n project-xxx-development

# 常见错误：
# - "authentication required" → Secret 中的 token 过期
# - "repository not found" → URL 或权限问题
# - "invalid credentials" → token 无效

# 手动刷新 Secret
# 通过 API 或等待定时任务
```

## 测试验证

### 1. 测试自动刷新

```sql
-- 手动设置 token 为过期
UPDATE oauth_accounts 
SET expires_at = NOW() - INTERVAL '1 hour'
WHERE provider = 'gitlab' AND user_id = 'xxx';

-- 创建新项目，验证 token 是否自动刷新
-- 检查日志：Using refreshed GitLab token
```

### 2. 测试定时任务

```bash
# 等待定时任务执行（每小时）
# 或修改 cron 表达式为每分钟测试：
# @Cron('*/1 * * * *')

# 检查日志
# 应该看到：Starting GitLab secret refresh...
```

### 3. 测试手动刷新

```bash
# 调用 API
curl -X POST http://localhost:3000/api/trpc/gitops.refreshGitSecret \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"projectId": "xxx"}'

# 验证 Secret 是否更新
kubectl get secret xxx-git-auth -n project-xxx-development -o yaml
```

## 最佳实践

1. **Token 过期时间**
   - 建议设置 2-8 小时
   - 定时任务频率应小于过期时间

2. **错误处理**
   - 刷新失败时标记账户为 `expired`
   - 通知用户重新连接账户
   - 不影响其他项目的刷新

3. **安全性**
   - Token 仅在后端传递
   - Secret 使用 K8s 原生加密
   - 定期轮换 OAuth 应用密钥

4. **监控告警**
   - 监控刷新成功率
   - 告警 token 刷新失败
   - 跟踪 Flux 同步状态

## 代码变更总结

### 新增文件

1. `packages/services/business/src/gitops/git-secret-refresher.service.ts`
   - 定时刷新服务
   - 每小时自动更新 Secret

### 修改文件

1. `packages/services/business/src/gitops/flux/flux.module.ts`
   - 导入 `ScheduleModule` 和 `FoundationModule`
   - 注册 `GitSecretRefresherService`

2. `packages/services/business/src/gitops/gitops-event-handler.service.ts`
   - 注入 `OAuthAccountsService`
   - 添加 GitLab token 自动刷新逻辑

3. `packages/services/business/src/index.ts`
   - 导出 `GitSecretRefresherService`

4. `apps/api-gateway/src/routers/gitops.router.ts`
   - 添加 `refreshGitSecret` API 端点

### 文档

1. `docs/guides/gitlab-token-refresh.md` - 详细技术文档
2. `docs/guides/GITLAB_TOKEN_SOLUTION.md` - 本文档

## 相关文档

- [GitOps 认证详细说明](./gitops-authentication.md)
- [GitOps 认证改进总结](./gitops-auth-improvements.md)
- [GitLab Token 刷新详细说明](./gitlab-token-refresh.md)
- [K3s 远程访问配置](./k3s-remote-access.md)
