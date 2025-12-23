# GitHub Token 401 错误排查与修复

## 问题描述

**现象**：项目初始化时 `create_repository` 步骤失败，GitHub API 返回 401 错误

```
ERROR: [InitializationStepsService] Failed step create_repository for project xxx: 
github API error: 401 - Bad credentials
```

**用户反馈**：
- 认证重构前是正常的
- 刚登录后立即创建项目就出错
- 不存在 Token 过期问题（新鲜的 Token）

## 根本原因

**Token 加密后未解密**

在认证重构中，我们实现了 Token AES-256-GCM 加密存储：

1. **保存时加密**：`AuthService.findOrCreateUser()` 调用 `GitConnectionsService.upsertConnection()` 时，Token 被加密存储到 `git_connections` 表
2. **读取时未解密**：多个服务使用 `getConnectionByProvider()` 获取连接，但该方法返回的是**加密的 Token**
3. **直接使用加密 Token**：加密的 Token 被直接传递给 GitHub API，导致 401 错误

**受影响的文件**：
- `packages/services/business/src/queue/project-initialization.worker.ts` - `resolveAccessToken()` 和 `createGitOpsResources()` 方法
- `packages/services/business/src/gitops/credentials/oauth-credential.ts` - `getAccessToken()` 方法
- `packages/services/business/src/repositories/repositories.service.ts` - `resolveOAuthToken()` 方法
- `packages/services/business/src/projects/initialization/handlers/setup-repository.handler.ts` - Token 解析逻辑

## 修复方案

**使用 `getConnectionWithDecryptedTokens()` 替代 `getConnectionByProvider()`**

`GitConnectionsService` 提供了两个方法：

1. **`getConnectionByProvider()`** - 返回加密的 Token（用于检查连接是否存在）
2. **`getConnectionWithDecryptedTokens()`** - 返回解密的 Token（用于实际使用）

### 修复示例

**修复前**：
```typescript
const gitConnection = await this.gitConnections.getConnectionByProvider(
  userId,
  provider,
)

// ❌ 使用加密的 Token
return gitConnection.accessToken
```

**修复后**：
```typescript
const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
  userId,
  provider,
)

// ✅ 使用解密的 Token
return gitConnection.accessToken
```

## 已修复的文件

1. ✅ `packages/services/business/src/queue/project-initialization.worker.ts`
   - `resolveAccessToken()` 方法（第 587 行）
   - `createGitOpsResources()` 方法（第 491 行）

2. ✅ `packages/services/business/src/gitops/credentials/oauth-credential.ts`
   - `getAccessToken()` 方法（第 26 行）

3. ✅ `packages/services/business/src/repositories/repositories.service.ts`
   - `resolveOAuthToken()` 方法（第 554 行）

4. ✅ `packages/services/business/src/projects/initialization/handlers/setup-repository.handler.ts`
   - Token 解析逻辑（第 125 行）

## 验证步骤

1. **重启服务**：
   ```bash
   bun run dev
   ```

2. **清除旧数据**（可选）：
   如果数据库中有旧的未加密 Token，可能需要重新登录以获取加密的 Token

3. **测试流程**：
   - 登录 GitHub
   - 创建新项目
   - 验证 `create_repository` 步骤成功

4. **检查日志**：
   ```bash
   # 应该看到成功的日志
   INFO: [ProjectInitializationWorker] Processing project initialization
   INFO: [InitializationStepsService] Step create_repository completed
   ```

## 诊断工具

使用诊断脚本检查 Token 状态：

```bash
bun run scripts/diagnose-github-token.ts <user_id>
```

**输出示例**：
```
✅ GitHub connection found
✅ Token is encrypted (AES-256-GCM)
✅ Token can be decrypted successfully
✅ Token is valid (GitHub API test passed)
```

## 预防措施

1. **代码审查**：在使用 `getConnectionByProvider()` 时，确认是否需要解密 Token
2. **类型安全**：考虑创建 `EncryptedGitConnection` 和 `DecryptedGitConnection` 类型
3. **文档注释**：在 `getConnectionByProvider()` 方法上添加明确的警告注释

## 相关文件

- `packages/services/foundation/src/git-connections/git-connections.service.ts` - Git 连接服务
- `packages/services/foundation/src/encryption/encryption.service.ts` - 加密服务
- `packages/core/src/database/schemas/git-connections.schema.ts` - 数据库 Schema
- `docs/architecture/authentication-architecture.md` - 认证架构文档
