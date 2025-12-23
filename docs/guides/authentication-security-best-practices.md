# 认证安全最佳实践

本文档提供认证系统的安全配置和使用指南。

## 环境变量配置

### 必需的安全配置

```bash
# 加密密钥（至少 32 个字符，生产环境必须使用强随机密钥）
ENCRYPTION_KEY=your_encryption_key_at_least_32_characters_long_for_security

# Redis 配置（用于 Session 和 Rate Limiting）
REDIS_URL=redis://localhost:6379

# 数据库配置
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# OAuth 配置
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret
```

### 生成安全的加密密钥

```bash
# 使用 OpenSSL 生成 32 字节随机密钥
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Token 加密

### 自动加密

所有 Git 连接的 Token 都会自动加密存储：

- **Access Token**: AES-256-GCM 加密
- **Refresh Token**: AES-256-GCM 加密
- **加密密钥**: 从环境变量 `ENCRYPTION_KEY` 读取

### 数据迁移

如果你有现有的明文 Token，运行迁移脚本：

```bash
# 确保设置了 ENCRYPTION_KEY
export ENCRYPTION_KEY=your_encryption_key

# 运行迁移脚本
bun run scripts/migrate-encrypt-tokens.ts
```

迁移脚本会：
1. 备份现有数据
2. 加密所有明文 Token
3. 验证加密结果
4. 提供回滚机制

## Session 管理

### Session 生命周期

- **有效期**: 7 天
- **存储**: Redis（快速访问）+ PostgreSQL（持久化）
- **自动过期**: Redis TTL 自动清理过期 Session

### Session 安全建议

1. **定期检查活跃 Session**
   ```typescript
   // 列出所有活跃 Session
   const sessions = await trpc.sessions.listSessions.query()
   ```

2. **撤销可疑 Session**
   ```typescript
   // 撤销指定 Session
   await trpc.sessions.revokeSession.mutate({ sessionId: 'xxx' })
   
   // 撤销所有其他 Session（保留当前）
   await trpc.sessions.revokeAllSessions.mutate()
   ```

3. **监控 Session 活动**
   - 检查 `lastActivityAt` 识别不活跃 Session
   - 检查 `ipAddress` 和 `deviceInfo` 识别异常登录

## Rate Limiting

### 限流规则

系统自动应用以下限流规则：

| 端点类型 | 限制 | 窗口 | 识别方式 |
|---------|------|------|---------|
| 登录端点 | 5 次 | 1 分钟 | IP 地址 |
| 已认证 API | 100 次 | 1 分钟 | 用户 ID |
| 未认证 API | 20 次 | 1 分钟 | IP 地址 |

### 登录端点

包括：
- `auth.login`
- `auth.githubCallback`
- `auth.gitlabCallback`

### 自定义限流规则

修改 `apps/api-gateway/src/trpc/rate-limit.middleware.ts`：

```typescript
// 示例：为特定端点添加更严格的限流
if (path.startsWith('admin.')) {
  return {
    prefix: 'admin',
    limit: 10,
    window: 60,
    useUserId: true,
  }
}
```

### 监控限流

```typescript
// 检查当前请求数
const count = await rateLimitService.getCurrentCount('login:ip:192.168.1.1')

// 重置限流（管理员操作）
await rateLimitService.resetRateLimit('login:ip:192.168.1.1')
```

## 审计日志

### 自动记录的事件

系统自动记录以下认证事件：

- `auth.login` - 用户登录
- `auth.logout` - 用户登出
- `auth.session_created` - Session 创建
- `auth.session_revoked` - Session 撤销
- `auth.oauth_callback` - OAuth 回调
- `git.connection_created` - Git 连接创建
- `git.connection_updated` - Git 连接更新
- `git.connection_deleted` - Git 连接删除
- `git.token_refreshed` - Token 刷新

### 查询审计日志

```typescript
// 查询用户的所有认证事件
const logs = await trpc.auditLogs.list.query({
  userId: 'user-id',
  action: 'auth.login',
  startDate: new Date('2025-01-01'),
  endDate: new Date('2025-12-31'),
  limit: 50,
})
```

### 审计日志字段

- `userId` - 用户 ID
- `action` - 操作类型（如 `auth.login`）
- `ipAddress` - IP 地址
- `userAgent` - User Agent
- `success` - 是否成功
- `errorMessage` - 错误信息（如果失败）
- `metadata` - 额外元数据
- `createdAt` - 创建时间

## Token 自动刷新

### GitLab Token 刷新

GitLab Token 会在过期前 5 分钟自动刷新：

```typescript
// 自动刷新（在 GitConnectionsService 中）
const token = await gitConnectionsService.ensureValidToken(
  userId,
  'gitlab',
  serverUrl
)
```

### 刷新失败处理

如果 Token 刷新失败：
1. 连接状态标记为 `expired`
2. 记录审计日志
3. 通知用户重新授权

## 安全检查清单

### 部署前检查

- [ ] 设置强随机的 `ENCRYPTION_KEY`（至少 32 字符）
- [ ] 配置 Redis 密码和 TLS
- [ ] 配置数据库 SSL 连接
- [ ] 设置 OAuth Client Secret
- [ ] 运行 Token 加密迁移脚本
- [ ] 验证 Rate Limiting 正常工作
- [ ] 测试 Session 创建和撤销
- [ ] 检查审计日志记录

### 运行时监控

- [ ] 监控 Rate Limiting 触发频率
- [ ] 监控 Session 数量和活跃度
- [ ] 监控 Token 刷新成功率
- [ ] 定期审查审计日志
- [ ] 监控异常登录（IP、设备）

### 定期维护

- [ ] 清理过期 Session（自动）
- [ ] 归档旧审计日志（建议 90 天）
- [ ] 审查 Rate Limiting 规则
- [ ] 更新 OAuth 应用配置
- [ ] 轮换加密密钥（可选，需要重新加密）

## 常见问题

### Q: 如何更换加密密钥？

A: 更换加密密钥需要重新加密所有 Token：

1. 备份数据库
2. 设置新的 `ENCRYPTION_KEY`
3. 运行迁移脚本（需要修改以支持密钥轮换）
4. 验证所有 Token 可以正常解密

### Q: Rate Limiting 误伤正常用户怎么办？

A: 可以临时重置限流：

```typescript
await rateLimitService.resetRateLimit('api:user:user-id')
```

或调整限流规则（修改 `rate-limit.middleware.ts`）。

### Q: 如何强制所有用户重新登录？

A: 撤销所有 Session：

```sql
-- 标记所有 Session 为 revoked
UPDATE sessions SET status = 'revoked';

-- 清空 Redis
redis-cli FLUSHDB
```

### Q: 审计日志占用太多空间怎么办？

A: 定期归档旧日志：

```sql
-- 归档 90 天前的日志
INSERT INTO audit_logs_archive 
SELECT * FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';

-- 删除已归档的日志
DELETE FROM audit_logs 
WHERE created_at < NOW() - INTERVAL '90 days';
```

## 相关文档

- [认证架构文档](../architecture/authentication-architecture.md)
- [认证重构总结](../architecture/authentication-refactoring-final-summary.md)
- [Session 管理 API](../api/sessions.md)
- [Rate Limiting 配置](../api/rate-limiting.md)
