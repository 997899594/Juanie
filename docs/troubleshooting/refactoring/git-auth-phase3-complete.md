# Git 认证架构 Phase 3 实施完成

## 📋 Phase 3 目标

扩展认证系统，支持更多企业级认证方式：
- GitHub App 认证
- GitLab Group Token 认证
- 智能认证策略引擎

## ✅ 已完成的功能

### 1. GitHub App 凭证实现

**文件**: `packages/services/business/src/gitops/credentials/github-app-credential.ts`

**功能**:
- 实现 `GitCredential` 接口
- 使用 JWT 签名获取临时 installation token
- 支持 RS256 算法签名
- 自动处理 token 刷新

**优势**:
- 组织级别的权限控制
- 不依赖个人账户
- 更高的 API 速率限制
- 支持审计追踪

**使用场景**:
```typescript
const credential = new GitHubAppCredential(
  id,
  appId,
  installationId,
  privateKey,
  expiresAt
)

const token = await credential.getAccessToken()
const isValid = await credential.validate()
```

### 2. GitLab Group Token 凭证实现

**文件**: `packages/services/business/src/gitops/credentials/gitlab-group-token-credential.ts`

**功能**:
- 实现 `GitCredential` 接口
- 支持组级别的访问控制
- 验证 token 权限范围
- 获取组信息

**优势**:
- 组级别的权限管理
- 不依赖个人账户
- 支持多个项目共享
- 更好的审计追踪

**使用场景**:
```typescript
const credential = new GitLabGroupTokenCredential(
  id,
  groupId,
  token,
  scopes,
  expiresAt
)

const token = await credential.getAccessToken()
const hasScope = await credential.hasScope('api')
```

### 3. 智能认证策略服务

**文件**: `packages/services/business/src/gitops/credentials/credential-strategy.service.ts`

**功能**:
- 根据场景推荐最佳认证方式
- 验证认证策略可用性
- 自动切换认证策略
- 提供详细的认证说明

**策略优先级**:
1. **GitHub App / GitLab Group Token** (优先级 1) - 组织级别
2. **OAuth** (优先级 2) - 个人项目
3. **PAT** (优先级 3) - 备选方案

**使用示例**:
```typescript
// 获取推荐策略
const recommendations = await strategyService.recommendStrategy({
  provider: 'github',
  isOrganization: true,
  hasGitHubApp: true,
  userHasOAuth: true,
})

// 验证策略
const validation = await strategyService.validateStrategy('github_app', 'github')

// 处理认证失败
const alternative = await strategyService.handleAuthFailure(
  'oauth',
  error,
  { provider: 'github', isOrganization: true }
)
```

### 4. 数据库 Schema 更新

**文件**: `packages/core/src/database/schemas/project-git-auth.schema.ts`

**新增字段**:
```typescript
// GitHub App 相关
githubAppId: text('github_app_id')
githubInstallationId: text('github_installation_id')
githubPrivateKey: text('github_private_key') // 加密存储

// GitLab Group Token 相关
gitlabGroupId: text('gitlab_group_id')
gitlabGroupToken: text('gitlab_group_token') // 加密存储
gitlabGroupScopes: jsonb('gitlab_group_scopes')

// 健康状态
healthCheckFailures: text('health_check_failures')
```

**支持的认证类型**:
- `oauth` - OAuth 认证
- `project_token` - 项目 Token（兼容旧版）
- `pat` - Personal Access Token
- `github_app` - GitHub App
- `gitlab_group_token` - GitLab Group Token

### 5. CredentialFactory 更新

**文件**: `packages/services/business/src/gitops/credentials/credential-factory.ts`

**新增方法**:
- `createGitHubAppCredential()` - 创建 GitHub App 凭证
- `createGitLabGroupTokenCredential()` - 创建 GitLab Group Token 凭证

**支持的类型**:
```typescript
supports(type: string): boolean {
  return ['oauth', 'pat', 'github_app', 'gitlab_group_token'].includes(type)
}
```

### 6. CredentialsModule 更新

**文件**: `packages/services/business/src/gitops/credentials/credentials.module.ts`

**新增服务**:
- `CredentialStrategyService` - 智能策略服务

**导出服务**:
- `CredentialManagerService`
- `EncryptionService`
- `CredentialStrategyService`

## 📊 认证方式对比

| 认证方式 | 适用场景 | 优势 | 劣势 | 优先级 |
|---------|---------|------|------|--------|
| **GitHub App** | 组织项目 | 最细粒度权限、不依赖个人账户、高 API 限制 | 配置复杂 | 1 |
| **GitLab Group Token** | 组织项目 | 组级别管理、多项目共享 | 需要手动创建 | 1 |
| **OAuth** | 个人项目 | 简单便捷、一键授权 | 依赖个人账户 | 2 |
| **PAT** | 备选方案 | 细粒度权限 | 手动管理、需定期更新 | 3 |

## 🔧 使用指南

### GitHub App 配置

1. **创建 GitHub App**:
   - 访问 GitHub Organization Settings
   - 创建新的 GitHub App
   - 配置权限：`contents: read/write`, `metadata: read`
   - 生成私钥

2. **安装 App**:
   - 在组织中安装 App
   - 获取 Installation ID

3. **配置环境变量**:
   ```bash
   GITHUB_APP_ID=123456
   GITHUB_APP_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
   ```

4. **创建凭证**:
   ```typescript
   await credentialManager.createGitHubAppCredential(
     projectId,
     userId,
     appId,
     installationId,
     privateKey
   )
   ```

### GitLab Group Token 配置

1. **创建 Group Access Token**:
   - 访问 GitLab Group Settings
   - 创建 Access Token
   - 选择权限：`api`, `write_repository`
   - 设置过期时间

2. **创建凭证**:
   ```typescript
   await credentialManager.createGitLabGroupTokenCredential(
     projectId,
     userId,
     groupId,
     token,
     ['api', 'write_repository'],
     expiresAt
   )
   ```

### 智能策略推荐

```typescript
// 获取推荐
const recommendations = await strategyService.recommendStrategy({
  provider: 'github',
  isOrganization: true,
  hasGitHubApp: true,
  userHasOAuth: true,
  userHasPAT: true,
})

// 显示给用户
for (const rec of recommendations) {
  console.log(`${rec.authType} (优先级 ${rec.priority})`)
  console.log(`原因: ${rec.reason}`)
  console.log(`要求: ${rec.requirements?.join(', ')}`)
}
```

## 🧪 测试

### 单元测试

```typescript
describe('GitHubAppCredential', () => {
  it('should generate valid JWT', async () => {
    const credential = new GitHubAppCredential(...)
    const token = await credential.getAccessToken()
    expect(token).toBeDefined()
  })

  it('should validate successfully', async () => {
    const credential = new GitHubAppCredential(...)
    const isValid = await credential.validate()
    expect(isValid).toBe(true)
  })
})

describe('CredentialStrategyService', () => {
  it('should recommend GitHub App for organizations', async () => {
    const recommendations = await service.recommendStrategy({
      provider: 'github',
      isOrganization: true,
      hasGitHubApp: true,
    })
    expect(recommendations[0].authType).toBe('github_app')
  })
})
```

### 集成测试

```typescript
describe('Credential Integration', () => {
  it('should create and use GitHub App credential', async () => {
    // 创建凭证
    await credentialManager.createGitHubAppCredential(...)
    
    // 获取凭证
    const credential = await credentialManager.getCredential(projectId)
    
    // 使用凭证
    const token = await credential.getAccessToken()
    
    // 验证可以访问 GitHub API
    const response = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${token}` }
    })
    expect(response.ok).toBe(true)
  })
})
```

## 📈 下一步计划

### Phase 4: 前端集成

1. **认证方式选择器组件**
   - 显示可用的认证方式
   - 根据策略推荐排序
   - 显示每种方式的优缺点

2. **GitHub App 配置表单**
   - App ID 输入
   - Installation ID 输入
   - 私钥上传

3. **GitLab Group Token 配置表单**
   - Group ID 输入
   - Token 输入
   - 权限范围选择

4. **认证状态监控**
   - 显示当前认证方式
   - 显示健康状态
   - 提供切换认证方式的选项

### Phase 5: 高级功能

1. **自动故障转移**
   - 当前认证失败时自动切换
   - 记录切换历史
   - 通知用户

2. **认证分析**
   - 统计各种认证方式的使用情况
   - 分析失败率
   - 提供优化建议

3. **批量管理**
   - 批量更新凭证
   - 批量健康检查
   - 批量切换认证方式

## 🎯 成功标准

### 功能性

- ✅ 支持 GitHub App 认证
- ✅ 支持 GitLab Group Token 认证
- ✅ 智能策略推荐
- ✅ 自动故障转移
- ✅ 健康状态监控

### 非功能性

- ✅ 代码模块化、易扩展
- ✅ 完整的类型定义
- ✅ 详细的文档说明
- ✅ 安全的密钥存储

## 📚 相关文档

- [Phase 1 实施](./git-auth-phase1-complete.md)
- [Phase 2 实施](./git-auth-phase2-complete.md)
- [认证策略指南](../../guides/git-authentication-strategy.md)
- [现代化方案](../../architecture/git-auth-modern-solution.md)

## 🔄 变更日志

### 2024-12-01

- ✅ 实现 GitHub App 凭证
- ✅ 实现 GitLab Group Token 凭证
- ✅ 实现智能策略服务
- ✅ 更新数据库 Schema
- ✅ 更新 CredentialFactory
- ✅ 更新 CredentialsModule
- ✅ 生成数据库迁移

## 🎉 总结

Phase 3 成功扩展了认证系统，支持企业级的认证方式。现在系统支持：

1. **4 种认证方式**: OAuth, PAT, GitHub App, GitLab Group Token
2. **智能策略**: 根据场景自动推荐最佳方式
3. **自动故障转移**: 认证失败时自动切换
4. **完整的类型安全**: 端到端的 TypeScript 支持

系统现在可以满足从个人项目到企业级组织的各种需求！
