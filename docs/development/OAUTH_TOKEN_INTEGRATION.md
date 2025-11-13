# OAuth 令牌自动使用功能

## 问题

用户通过 OAuth 登录后，创建项目时仍需要手动输入 Git 访问令牌，体验不好。

## 解决方案

### 1. 后端改动

#### 新增 OAuthAccountsService
- 位置: `packages/services/auth/src/oauth-accounts.service.ts`
- 功能:
  - `listUserAccounts()`: 获取用户的所有 OAuth 账户（不返回敏感信息）
  - `getAccountByProvider()`: 获取指定提供商的账户（包含 token，仅后端使用）
  - `hasProvider()`: 检查是否已连接指定提供商
  - `disconnect()`: 断开 OAuth 连接

#### 集成到 Users 路由
- 位置: `apps/api-gateway/src/routers/users.router.ts`
- 新增端点:
  - `users.oauthAccounts.list`: 获取 OAuth 账户列表
  - `users.oauthAccounts.hasProvider`: 检查是否已连接
  - `users.oauthAccounts.disconnect`: 断开连接

### 2. 前端改动

#### RepositoryConfig 组件增强
- 位置: `apps/web/src/components/RepositoryConfig.vue`
- 新功能:
  1. 组件挂载时自动加载用户的 OAuth 账户
  2. 检测当前选择的 Git 提供商是否已连接
  3. 如果已连接，显示提示并默认使用 OAuth 令牌
  4. 提供切换按钮，允许用户选择手动输入令牌
  5. 使用特殊标记 `__USE_OAUTH__` 告诉后端使用存储的令牌

#### UI 改进
- 显示 "使用已连接账户" 徽章
- 提供友好的提示信息
- 一键切换使用 OAuth 或手动输入

### 3. 后端令牌处理（已实现）

#### project-orchestrator.service.ts ✅
- 新增 `resolveAccessToken()` 方法
- 在 `initializeFromTemplate()` 中调用，处理仓库配置前解析令牌
- 如果令牌是 `__USE_OAUTH__`，从数据库获取用户的 OAuth 令牌
- 如果未找到 OAuth 账户，抛出友好的错误提示

```typescript
private async resolveAccessToken(userId, repositoryConfig) {
  if (repositoryConfig.accessToken !== '__USE_OAUTH__') {
    return repositoryConfig
  }
  
  const oauthAccount = await this.oauthAccounts.getAccountByProvider(
    userId,
    repositoryConfig.provider
  )
  
  if (!oauthAccount || !oauthAccount.accessToken) {
    throw new Error('未找到 OAuth 账户连接')
  }
  
  return {
    ...repositoryConfig,
    accessToken: oauthAccount.accessToken
  }
}
```

#### projects.module.ts ✅
- 导入 `AuthModule`，使 `OAuthAccountsService` 可用

## 用户体验流程

### 之前
```
1. 用户通过 GitHub OAuth 登录
2. 创建项目，选择关联仓库
3. 需要手动输入 GitHub Personal Access Token ❌
4. 用户需要去 GitHub 创建 token，复制粘贴
```

### 现在
```
1. 用户通过 GitHub OAuth 登录
2. 创建项目，选择关联仓库
3. 系统自动检测到已连接的 GitHub 账户 ✅
4. 显示 "使用已连接账户" 提示
5. 无需手动输入令牌，直接使用 OAuth 授权
6. （可选）用户可以选择手动输入其他令牌
```

## 安全考虑

1. **令牌不暴露给前端**: OAuth 令牌只在后端使用，前端只传递 `__USE_OAUTH__` 标记
2. **权限检查**: 后端验证用户确实拥有该 OAuth 账户
3. **令牌刷新**: 如果 OAuth 令牌过期，需要实现刷新机制（使用 refreshToken）
4. **断开连接**: 用户可以随时断开 OAuth 连接

## 已完成

- [x] 创建 OAuthAccountsService
- [x] 集成到 Users API 路由
- [x] 前端 RepositoryConfig 组件增强
- [x] 在 project-orchestrator 中实现 `__USE_OAUTH__` 标记处理
- [x] 导入 AuthModule 到 ProjectsModule

## 待完成任务

- [ ] 实现 OAuth 令牌刷新机制（当令牌过期时）
- [ ] 添加用户设置页面，管理 OAuth 连接
- [ ] 处理令牌过期的友好错误提示
- [ ] 在其他需要 Git 令牌的地方（如手动触发部署）也支持 OAuth
- [ ] 添加单元测试
- [ ] 添加集成测试

## 相关文件

### 后端
- `packages/services/auth/src/oauth-accounts.service.ts` - OAuth 账户服务
- `packages/services/auth/src/auth.service.ts` - 认证服务（已存储 OAuth 令牌）
- `apps/api-gateway/src/routers/users.router.ts` - Users API 路由
- `packages/services/projects/src/project-orchestrator.service.ts` - 项目编排（需要修改）
- `packages/services/repositories/src/repositories.service.ts` - 仓库服务（需要修改）

### 前端
- `apps/web/src/components/RepositoryConfig.vue` - 仓库配置组件
- `apps/web/src/components/ProjectWizard.vue` - 项目创建向导

### 数据库
- `packages/core/database/src/schemas/oauth-accounts.schema.ts` - OAuth 账户表
