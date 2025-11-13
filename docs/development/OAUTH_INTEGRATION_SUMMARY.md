# OAuth 令牌自动使用功能 - 实现总结

## 问题背景

用户通过 GitHub/GitLab OAuth 登录后，创建项目时仍需要手动输入 Git 访问令牌，体验不佳。

## 解决方案

实现了自动使用已授权的 OAuth 令牌功能，用户无需重复输入。

## 实现细节

### 1. 后端服务层

#### OAuthAccountsService (新增)
**位置**: `packages/services/auth/src/oauth-accounts.service.ts`

**功能**:
- `listUserAccounts()` - 获取用户的 OAuth 账户列表（不含敏感信息）
- `getAccountByProvider()` - 获取指定提供商的账户（含 token，仅后端使用）
- `hasProvider()` - 检查是否已连接指定提供商
- `disconnect()` - 断开 OAuth 连接

#### ProjectOrchestrator 增强
**位置**: `packages/services/projects/src/project-orchestrator.service.ts`

**新增方法**:
```typescript
private async resolveAccessToken(
  userId: string,
  repositoryConfig: RepositoryConfig
): Promise<RepositoryConfig>
```

**功能**:
- 检测 `accessToken` 是否为 `__USE_OAUTH__` 特殊标记
- 如果是，从数据库获取用户的 OAuth 令牌
- 替换为实际的访问令牌
- 如果未找到 OAuth 账户，抛出友好错误

**集成点**:
- 在 `initializeFromTemplate()` 方法中，处理仓库配置前调用
- 确保后续流程使用的是实际的访问令牌

### 2. API 路由层

#### Users Router 扩展
**位置**: `apps/api-gateway/src/routers/users.router.ts`

**新增端点**:
- `users.oauthAccounts.list` - 获取 OAuth 账户列表
- `users.oauthAccounts.hasProvider` - 检查是否已连接
- `users.oauthAccounts.disconnect` - 断开连接

### 3. 前端组件层

#### RepositoryConfig 组件增强
**位置**: `apps/web/src/components/RepositoryConfig.vue`

**新增功能**:
1. 组件挂载时自动加载用户的 OAuth 账户
2. 实时检测当前选择的 Git 提供商是否已连接
3. 如果已连接，显示友好提示并默认使用 OAuth 令牌
4. 提供切换按钮，允许用户选择手动输入令牌
5. 使用 `__USE_OAUTH__` 特殊标记传递给后端

**UI 改进**:
- 显示 "使用已连接账户" 徽章
- 提供清晰的提示信息
- 一键切换使用 OAuth 或手动输入
- 隐藏令牌输入框（当使用 OAuth 时）

## 数据流

```
前端 RepositoryConfig
    ↓ (检测 OAuth 连接)
调用 users.oauthAccounts.list
    ↓ (已连接)
显示 "使用已连接账户" 提示
    ↓ (用户确认)
传递 accessToken: "__USE_OAUTH__"
    ↓
后端 ProjectOrchestrator.initializeFromTemplate()
    ↓
调用 resolveAccessToken()
    ↓
OAuthAccountsService.getAccountByProvider()
    ↓ (从数据库获取)
返回实际的 OAuth accessToken
    ↓
继续项目初始化流程
```

## 用户体验对比

### 之前 ❌
1. 用户通过 GitHub OAuth 登录
2. 创建项目，选择关联仓库
3. **需要手动输入 GitHub Personal Access Token**
4. 用户需要去 GitHub 创建 token，复制粘贴
5. 容易出错，体验差

### 现在 ✅
1. 用户通过 GitHub OAuth 登录
2. 创建项目，选择关联仓库
3. **系统自动检测到已连接的 GitHub 账户**
4. **显示 "使用已连接账户" 提示**
5. **无需手动输入令牌，直接使用 OAuth 授权**
6. （可选）用户可以选择手动输入其他令牌

## 安全考虑

1. **令牌不暴露给前端**: OAuth 令牌只在后端使用，前端只传递 `__USE_OAUTH__` 标记
2. **权限检查**: 后端验证用户确实拥有该 OAuth 账户
3. **错误处理**: 如果未找到 OAuth 账户，提供友好的错误提示
4. **断开连接**: 用户可以随时断开 OAuth 连接

## 测试建议

### 单元测试
- [ ] OAuthAccountsService 的所有方法
- [ ] ProjectOrchestrator.resolveAccessToken() 方法
- [ ] 各种边界情况（令牌不存在、提供商不匹配等）

### 集成测试
- [ ] 完整的项目创建流程（使用 OAuth 令牌）
- [ ] 切换使用 OAuth 和手动输入令牌
- [ ] 断开 OAuth 连接后的行为

### E2E 测试
- [ ] 用户通过 OAuth 登录
- [ ] 创建项目并自动使用 OAuth 令牌
- [ ] 验证项目初始化成功

## 未来改进

1. **令牌刷新**: 实现 OAuth 令牌自动刷新机制（使用 refreshToken）
2. **用户设置页面**: 添加管理 OAuth 连接的界面
3. **多账户支持**: 允许用户连接多个 GitHub/GitLab 账户
4. **令牌过期提示**: 更友好的令牌过期错误处理
5. **其他场景**: 在其他需要 Git 令牌的地方也支持 OAuth（如手动触发部署）

## 相关文件

### 后端
- `packages/services/auth/src/oauth-accounts.service.ts` ✅
- `packages/services/auth/src/auth.service.ts` (已存储 OAuth 令牌)
- `packages/services/auth/src/auth.module.ts` ✅
- `apps/api-gateway/src/routers/users.router.ts` ✅
- `packages/services/projects/src/project-orchestrator.service.ts` ✅
- `packages/services/projects/src/projects.module.ts` ✅

### 前端
- `apps/web/src/components/RepositoryConfig.vue` ✅
- `apps/web/src/components/ProjectWizard.vue`

### 数据库
- `packages/core/database/src/schemas/oauth-accounts.schema.ts` (已存在)

### 文档
- `docs/development/OAUTH_TOKEN_INTEGRATION.md` - 详细实现文档
- `docs/development/OAUTH_INTEGRATION_SUMMARY.md` - 本文档

## 状态

✅ **已完成并可用**

所有核心功能已实现，无编译错误，可以投入使用。
