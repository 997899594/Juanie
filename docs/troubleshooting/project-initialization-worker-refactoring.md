# 项目初始化 Worker 重构 - 使用公共凭证解析方法

**日期**: 2024-12-23  
**状态**: ✅ 已完成  
**影响范围**: `packages/services/business/src/queue/project-initialization.worker.ts`

## 问题背景

项目初始化 Worker 中存在重复的凭证解析逻辑：
- Worker 中有自己的 `resolveAccessToken()` 方法
- `GitConnectionsService` 中已有公共的 `resolveCredentials()` 和 `resolveRepositoryConfig()` 方法
- 代码重复，维护成本高

## 解决方案

### 1. 使用公共方法替换私有方法

**替换前**:
```typescript
// Worker 中的私有方法
private async resolveAccessToken(userId: string, repository: any): Promise<any> {
  if (repository.accessToken !== '__USE_OAUTH__') {
    return repository
  }
  
  const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
    userId,
    repository.provider,
  )
  
  // ... 验证和返回逻辑
}
```

**替换后**:
```typescript
// 使用 GitConnectionsService 的公共方法
const resolvedRepository = await this.gitConnections.resolveRepositoryConfig(
  userId,
  repository,
)
this.logger.info(`✅ Resolved repository config, username: ${resolvedRepository.username}`)
```

### 2. 统一 GitOps 资源创建中的凭证解析

**替换前**:
```typescript
const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
  userId,
  repository.provider as 'github' | 'gitlab',
)

if (gitConnection?.accessToken && gitConnection.status === 'active') {
  accessToken = gitConnection.accessToken
}
```

**替换后**:
```typescript
const credentials = await this.gitConnections.resolveCredentials(
  userId,
  repository.provider as 'github' | 'gitlab',
)

if (credentials?.accessToken) {
  accessToken = credentials.accessToken
}
```

### 3. 删除重复的私有方法

完全删除了 Worker 中的 `resolveAccessToken()` 方法（约 40 行代码）。

## 优势

1. **代码复用**: 使用统一的凭证解析逻辑
2. **维护性**: 只需在一个地方维护凭证解析逻辑
3. **一致性**: 所有服务使用相同的错误消息和验证逻辑
4. **类型安全**: 公共方法有明确的返回类型定义

## 公共方法说明

### `resolveCredentials(userId, provider)`

**用途**: 解析用户的 Git 凭证  
**返回**: `{ accessToken, username, email? }`  
**适用场景**: 需要获取用户凭证的任何场景

### `resolveRepositoryConfig(userId, repository)`

**用途**: 解析仓库配置（自动处理 `__USE_OAUTH__` 标记）  
**返回**: 完整的仓库配置对象（包含解析后的 accessToken 和 username）  
**适用场景**: 项目初始化、仓库操作等需要完整仓库配置的场景

## 测试验证

```bash
# 编译验证
cd packages/services/business
bun run build
# ✅ 编译成功

# 运行测试（创建新项目）
bun run dev
# 前端创建项目 -> 验证进度条更新 -> 验证项目初始化成功
```

## 相关文件

- `packages/services/business/src/queue/project-initialization.worker.ts` - Worker 主文件
- `packages/services/foundation/src/git-connections/git-connections.service.ts` - 公共凭证服务
- `packages/services/business/src/projects/initialization/progress-manager.service.ts` - 进度管理器

## 后续建议

1. 检查其他服务是否也有类似的重复凭证解析逻辑
2. 考虑在文档中明确说明应该使用公共方法而不是自己实现
3. 添加单元测试覆盖凭证解析的各种场景

## 相关问题

- 之前的重构错误删除了 `ProgressManagerService` 的使用
- 本次重构同时修复了凭证解析的代码重复问题
