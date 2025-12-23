# 认证重构 Bug 修复总结

## 问题概述

**Bug**: GitHub Token 401 错误 - 项目初始化失败  
**影响范围**: 所有使用 OAuth Token 的功能（项目创建、Git 同步、GitOps 配置等）  
**严重程度**: 🔴 Critical - 阻塞核心功能  
**修复时间**: 2025-12-22

## 根本原因

在认证重构中实现了 Token AES-256-GCM 加密存储，但在多个地方使用了错误的方法获取 Token：

- **正确方法**: `getConnectionWithDecryptedTokens()` - 返回解密的 Token
- **错误方法**: `getConnectionByProvider()` - 返回加密的 Token

导致加密的 Token 被直接传递给 GitHub API，返回 401 错误。

## 修复内容

### 1. 项目初始化 Worker

**文件**: `packages/services/business/src/queue/project-initialization.worker.ts`

**修复位置**:
- `resolveAccessToken()` 方法（第 587 行）
- `createGitOpsResources()` 方法（第 491 行）

**修改**:
```typescript
// 修复前
const gitConnection = await this.gitConnections.getConnectionByProvider(userId, provider)

// 修复后
const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(userId, provider)
```

### 2. OAuth 凭证服务

**文件**: `packages/services/business/src/gitops/credentials/oauth-credential.ts`

**修复位置**: `getAccessToken()` 方法（第 26 行）

**修改**:
```typescript
// 修复前
const connection = await this.gitConnectionsService.getConnectionByProvider(...)

// 修复后
const connection = await this.gitConnectionsService.getConnectionWithDecryptedTokens(...)
```

### 3. 仓库服务

**文件**: `packages/services/business/src/repositories/repositories.service.ts`

**修复位置**: `resolveOAuthToken()` 方法（第 554 行）

**修改**:
```typescript
// 修复前
const gitConnection = await this.gitConnections.getConnectionByProvider(userId, provider)

// 修复后
const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(userId, provider)
```

### 4. 仓库设置处理器

**文件**: `packages/services/business/src/projects/initialization/handlers/setup-repository.handler.ts`

**修复位置**: Token 解析逻辑（第 125 行）

**修改**:
```typescript
// 修复前
const gitConnection = await this.gitConnections.getConnectionByProvider(context.userId, repository.provider)

// 修复后
const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(context.userId, repository.provider)
```

## 影响分析

### 受影响的功能

1. ✅ **项目创建** - 创建 GitHub/GitLab 仓库失败
2. ✅ **GitOps 配置** - 无法访问 Git 仓库
3. ✅ **代码同步** - Git 操作失败
4. ✅ **Webhook 配置** - 无法设置 Webhook

### 未受影响的功能

- ✅ **用户登录** - OAuth 登录流程正常
- ✅ **Session 管理** - Session 验证正常
- ✅ **Token 加密存储** - 加密逻辑正常

## 测试验证

### 测试场景

1. **新用户注册并创建项目**
   - ✅ GitHub OAuth 登录
   - ✅ 创建新项目
   - ✅ 仓库创建成功
   - ✅ 代码推送成功

2. **现有用户创建项目**
   - ✅ 使用已连接的 GitHub 账户
   - ✅ 项目初始化完成

3. **GitOps 资源创建**
   - ✅ Flux CD 资源创建成功
   - ✅ Kustomization 应用成功

### 验证命令

```bash
# 1. 重启服务
bun run dev

# 2. 运行诊断脚本
bun run scripts/diagnose-github-token.ts <user_id>

# 3. 检查日志
# 应该看到成功的日志，没有 401 错误
```

## 预防措施

### 1. 代码审查清单

在使用 `GitConnectionsService` 时，检查：

- [ ] 是否需要使用 Token？
- [ ] 如果需要，是否使用了 `getConnectionWithDecryptedTokens()`？
- [ ] 如果只是检查连接状态，可以使用 `getConnectionByProvider()`

### 2. 类型安全改进

考虑创建明确的类型区分：

```typescript
// 建议的类型定义
type EncryptedGitConnection = GitConnection & { _encrypted: true }
type DecryptedGitConnection = GitConnection & { _decrypted: true }

// 方法签名
getConnectionByProvider(): Promise<EncryptedGitConnection | null>
getConnectionWithDecryptedTokens(): Promise<DecryptedGitConnection | null>
```

### 3. 文档改进

在 `GitConnectionsService` 中添加明确的注释：

```typescript
/**
 * 获取用户的 Git 连接
 * 
 * ⚠️ 警告：返回的 Token 是加密的！
 * 如果需要使用 Token，请使用 getConnectionWithDecryptedTokens()
 * 
 * 适用场景：
 * - 检查连接是否存在
 * - 获取用户名、邮箱等元数据
 * - 检查连接状态
 */
async getConnectionByProvider(): Promise<GitConnection | null>

/**
 * 获取用户的 Git 连接（解密 Token）
 * 
 * ✅ 使用场景：
 * - 调用 Git API
 * - 创建仓库
 * - 推送代码
 * - 配置 Webhook
 */
async getConnectionWithDecryptedTokens(): Promise<GitConnection | null>
```

## 经验教训

1. **加密功能需要端到端测试** - 不仅要测试加密，还要测试解密和使用
2. **API 设计要明确** - 方法名应该清楚表明返回的数据状态（加密/解密）
3. **重构要全面搜索** - 使用 grep 搜索所有使用旧方法的地方
4. **类型系统可以帮助** - TypeScript 的类型系统可以防止这类错误

## 相关文档

- [认证架构文档](../architecture/authentication-architecture.md)
- [认证重构进度](../architecture/authentication-refactoring-progress.md)
- [GitHub Token 401 错误排查](./github-token-401-error.md)
- [认证安全最佳实践](../guides/authentication-security-best-practices.md)

## 修复确认

- ✅ 所有受影响的文件已修复
- ✅ 测试验证通过
- ✅ 文档已更新
- ✅ 预防措施已制定

**修复状态**: 🟢 已完成
