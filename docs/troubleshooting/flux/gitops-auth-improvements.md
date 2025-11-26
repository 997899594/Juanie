# GitOps 认证改进总结

## 改进内容

### 1. K3s 集群认证验证

**问题**：之前只检查连接状态，没有验证认证是否有效。

**解决方案**：
- 新增 `K3sService.verifyAuthentication()` 方法
- 在创建 GitOps 资源前验证认证（尝试列出 namespaces）
- 提供清晰的错误信息

```typescript
// K3sService
async verifyAuthentication(): Promise<{ valid: boolean; error?: string }> {
  if (!this.isConnected) {
    return { valid: false, error: 'K3s not connected' }
  }
  
  try {
    await this.k8sApi.listNamespace()
    return { valid: true }
  } catch (error: any) {
    return { valid: false, error: error.message }
  }
}
```

### 2. GitLab 私服支持

**问题**：只支持 gitlab.com，不支持私有部署的 GitLab。

**解决方案**：
- 支持 `GITLAB_BASE_URL` 环境变量
- 自动检测 Git 提供商（GitHub/GitLab）
- 在所有 GitLab API 调用中使用配置的 URL

```bash
# .env
GITLAB_BASE_URL=https://gitlab.your-company.com
GITLAB_CLIENT_ID=xxx
GITLAB_CLIENT_SECRET=xxx
```

### 3. OAuth Token 自动刷新

**问题**：GitLab token 会过期（默认 2 小时），导致 GitOps 资源创建失败。

**解决方案**：
- 在 GitOps 资源创建前自动刷新过期的 token
- 使用 `OAuthAccountsService.getAccountByProvider()` 自动处理刷新
- 刷新失败时使用原 token 作为后备

```typescript
// GitOpsEventHandlerService
let accessToken = payload.accessToken
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

## 代码变更

### 修改的文件

1. **packages/core/core/src/events/event-types.ts**
   - 添加 `userId` 字段到 `GitOpsSetupRequestedEvent`

2. **packages/services/business/src/gitops/gitops-event-handler.service.ts**
   - 注入 `OAuthAccountsService`
   - 添加 K3s 认证验证
   - 添加 GitLab token 自动刷新逻辑
   - 添加 Git 提供商检测方法

3. **packages/services/business/src/gitops/k3s/k3s.service.ts**
   - 添加 `verifyAuthentication()` 方法

4. **packages/services/business/src/projects/project-initialization.service.ts**
   - 添加 `userId` 参数到 `requestGitOpsSetup()`

5. **packages/services/business/src/queue/project-initialization.worker.ts**
   - 传递 `userId` 到 `requestGitOpsSetup()`

## 工作流程

```
用户创建项目
    ↓
Worker 获取 OAuth token
    ↓
创建 Git 仓库（使用 token）
    ↓
发布 GitOps 设置请求事件（包含 userId）
    ↓
GitOpsEventHandlerService 接收事件
    ↓
验证 K3s 认证 ✓
    ↓
检测 Git 提供商（GitHub/GitLab）
    ↓
如果是 GitLab：自动刷新 token ✓
    ↓
创建 Git Secret（使用最新 token）
    ↓
创建 GitRepository 资源
    ↓
Flux 使用 Secret 访问仓库 ✓
```

## 安全性

- ✅ Token 仅在后端传递，不暴露给前端
- ✅ GitLab token 自动刷新，无需用户干预
- ✅ K3s 认证通过 kubeconfig 文件管理
- ✅ 刷新失败时标记账户为 `expired`，提示用户重新连接

## 测试建议

1. **K3s 认证测试**
   ```bash
   # 测试无效的 kubeconfig
   K3S_KUBECONFIG_PATH=/invalid/path bun run dev:api
   
   # 测试过期的证书
   # 应该看到清晰的错误信息
   ```

2. **GitLab 私服测试**
   ```bash
   # 配置私服 URL
   GITLAB_BASE_URL=https://gitlab.company.com
   
   # 创建项目，验证能否正确访问私服
   ```

3. **Token 刷新测试**
   ```sql
   -- 手动设置 token 为过期
   UPDATE oauth_accounts 
   SET expires_at = NOW() - INTERVAL '1 hour'
   WHERE provider = 'gitlab';
   
   -- 创建项目，验证 token 是否自动刷新
   ```

## 相关文档

- [GitOps 认证详细说明](./gitops-authentication.md)
- [K3s 远程访问配置](./k3s-remote-access.md)
