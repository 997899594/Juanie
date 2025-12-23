# 认证系统部署指南

本文档提供认证系统的生产环境部署步骤和注意事项。

## 部署前准备

### 1. 环境变量配置

创建生产环境配置文件 `.env.prod`：

```bash
# 加密密钥（必须）
ENCRYPTION_KEY=<生成的强随机密钥>

# 数据库配置
DATABASE_URL=postgresql://user:password@db-host:5432/production_db?sslmode=require

# Redis 配置
REDIS_URL=redis://:password@redis-host:6379/0
REDIS_TLS=true

# OAuth 配置
GITHUB_CLIENT_ID=<生产环境 GitHub Client ID>
GITHUB_CLIENT_SECRET=<生产环境 GitHub Client Secret>
GITLAB_CLIENT_ID=<生产环境 GitLab Client ID>
GITLAB_CLIENT_SECRET=<生产环境 GitLab Client Secret>

# CORS 配置
CORS_ORIGIN=https://your-domain.com

# 其他配置
NODE_ENV=production
PORT=3000
```

### 2. 生成加密密钥

```bash
# 生成 32 字节随机密钥
openssl rand -base64 32

# 保存到环境变量
export ENCRYPTION_KEY=<生成的密钥>
```

**重要**: 
- 密钥必须至少 32 个字符
- 生产环境密钥不能与开发环境相同
- 密钥丢失将导致所有加密数据无法解密

### 3. 数据库准备

```bash
# 应用数据库迁移
bun run db:push

# 验证表结构
psql $DATABASE_URL -c "\dt"
```

确保以下表存在：
- `users`
- `git_connections`
- `sessions`
- `audit_logs`

## 部署步骤

### Step 1: 备份现有数据

```bash
# 备份数据库
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# 备份 Redis（如果有数据）
redis-cli --rdb backup_$(date +%Y%m%d_%H%M%S).rdb
```

### Step 2: 加密现有 Token

如果你有现有的明文 Token，运行迁移脚本：

```bash
# 设置加密密钥
export ENCRYPTION_KEY=<你的加密密钥>

# 运行迁移脚本
bun run scripts/migrate-encrypt-tokens.ts
```

迁移脚本会：
1. 创建数据备份（JSON 格式）
2. 加密所有 `git_connections` 表中的 Token
3. 验证加密结果
4. 输出迁移报告

**输出示例**:
```
✅ Backup created: git_connections_backup_1234567890.json
🔄 Encrypting tokens...
✅ Encrypted 10 connections
✅ Verification passed: All tokens can be decrypted
✅ Migration completed successfully
```

### Step 3: 部署应用

```bash
# 构建应用
bun run build

# 启动应用（使用 PM2 或其他进程管理器）
pm2 start dist/main.js --name api-gateway

# 或使用 Docker
docker-compose -f docker-compose.prod.yml up -d
```

### Step 4: 验证部署

```bash
# 检查健康状态
curl https://your-domain.com/trpc/health

# 预期输出
{"status":"ok","timestamp":"2025-12-22T..."}
```

### Step 5: 测试认证功能

1. **测试登录**
   ```bash
   curl -X POST https://your-domain.com/trpc/auth.login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password"}'
   ```

2. **测试 Rate Limiting**
   ```bash
   # 快速发送 6 次请求，第 6 次应该被限流
   for i in {1..6}; do
     curl https://your-domain.com/trpc/auth.login
   done
   ```

3. **测试 Session 管理**
   ```bash
   # 列出 Session
   curl https://your-domain.com/trpc/sessions.listSessions \
     -H "Cookie: sessionId=<your-session-id>"
   ```

4. **测试审计日志**
   ```bash
   # 查询审计日志
   curl https://your-domain.com/trpc/auditLogs.list \
     -H "Cookie: sessionId=<your-session-id>"
   ```

## 监控配置

### 1. 日志监控

配置日志收集（使用 ELK、Loki 等）：

```typescript
// 关键日志事件
- "Created session for user"
- "Revoked session"
- "Rate limit exceeded"
- "Failed to decrypt tokens"
- "Refreshed access token"
```

### 2. 指标监控

配置 Prometheus 指标：

```yaml
# 关键指标
- rate_limit_exceeded_total
- session_created_total
- session_revoked_total
- token_refresh_success_total
- token_refresh_failure_total
- audit_log_created_total
```

### 3. 告警规则

配置告警（使用 Alertmanager 等）：

```yaml
# 示例告警规则
- alert: HighRateLimitExceeded
  expr: rate(rate_limit_exceeded_total[5m]) > 10
  annotations:
    summary: "Rate limit exceeded too frequently"

- alert: TokenRefreshFailure
  expr: rate(token_refresh_failure_total[5m]) > 5
  annotations:
    summary: "Token refresh failing frequently"

- alert: SuspiciousLogin
  expr: count(audit_logs{action="auth.login",success="false"}[5m]) > 10
  annotations:
    summary: "Multiple failed login attempts"
```

## 回滚步骤

如果部署出现问题，按以下步骤回滚：

### 1. 停止新版本

```bash
pm2 stop api-gateway
# 或
docker-compose down
```

### 2. 恢复数据库

```bash
# 恢复数据库备份
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

### 3. 恢复 Token 加密

如果 Token 加密迁移失败，使用备份恢复：

```bash
# 迁移脚本会创建 JSON 备份文件
# 使用备份文件恢复数据
bun run scripts/restore-from-backup.ts git_connections_backup_1234567890.json
```

### 4. 启动旧版本

```bash
# 切换到旧版本代码
git checkout <previous-version>

# 重新部署
bun run build
pm2 start dist/main.js
```

## 性能优化

### 1. Redis 优化

```bash
# Redis 配置优化
maxmemory 2gb
maxmemory-policy allkeys-lru
save ""  # 禁用 RDB 持久化（Session 数据可以丢失）
```

### 2. 数据库优化

```sql
-- 为 sessions 表添加索引
CREATE INDEX idx_sessions_user_status ON sessions(user_id, status);
CREATE INDEX idx_sessions_session_id ON sessions(session_id);

-- 为 audit_logs 表添加索引
CREATE INDEX idx_audit_logs_user_action ON audit_logs(user_id, action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 定期清理过期 Session
DELETE FROM sessions 
WHERE status = 'expired' 
AND created_at < NOW() - INTERVAL '30 days';
```

### 3. Rate Limiting 优化

```typescript
// 调整限流规则以适应生产负载
{
  prefix: 'api',
  limit: 200,  // 增加到 200 次/分钟
  window: 60,
  useUserId: true,
}
```

## 安全加固

### 1. 网络安全

```bash
# 配置防火墙规则
ufw allow 443/tcp  # HTTPS
ufw allow 22/tcp   # SSH
ufw deny 3000/tcp  # 禁止直接访问应用端口

# 使用反向代理（Nginx）
upstream api {
  server localhost:3000;
}

server {
  listen 443 ssl http2;
  server_name your-domain.com;
  
  ssl_certificate /path/to/cert.pem;
  ssl_certificate_key /path/to/key.pem;
  
  location /trpc {
    proxy_pass http://api;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```

### 2. 数据库安全

```sql
-- 创建只读用户（用于监控）
CREATE USER readonly WITH PASSWORD 'password';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO readonly;

-- 限制应用用户权限
REVOKE ALL ON SCHEMA public FROM app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
```

### 3. 密钥管理

使用密钥管理服务（AWS Secrets Manager、HashiCorp Vault 等）：

```typescript
// 从密钥管理服务读取密钥
const encryptionKey = await secretsManager.getSecret('ENCRYPTION_KEY')
process.env.ENCRYPTION_KEY = encryptionKey
```

## 故障排查

### 问题 1: Token 解密失败

**症状**: 日志中出现 "Failed to decrypt tokens"

**原因**: 
- `ENCRYPTION_KEY` 不正确
- Token 使用不同的密钥加密

**解决**:
```bash
# 验证加密密钥
echo $ENCRYPTION_KEY

# 检查数据库中的 Token 格式
psql $DATABASE_URL -c "SELECT id, LEFT(access_token, 20) FROM git_connections LIMIT 5;"
```

### 问题 2: Rate Limiting 不工作

**症状**: 请求没有被限流

**原因**:
- Redis 连接失败
- 中间件未正确应用

**解决**:
```bash
# 检查 Redis 连接
redis-cli -u $REDIS_URL ping

# 检查日志
pm2 logs api-gateway | grep "rate limit"
```

### 问题 3: Session 丢失

**症状**: 用户频繁需要重新登录

**原因**:
- Redis 数据丢失
- Session TTL 配置错误

**解决**:
```bash
# 检查 Redis 持久化配置
redis-cli CONFIG GET save

# 检查 Session 数量
redis-cli KEYS "session:*" | wc -l
```

## 维护计划

### 每日

- 检查应用日志
- 监控 Rate Limiting 触发频率
- 检查 Token 刷新成功率

### 每周

- 审查审计日志
- 检查异常登录
- 清理过期 Session

### 每月

- 备份数据库
- 审查 Rate Limiting 规则
- 更新依赖包
- 性能优化

### 每季度

- 安全审计
- 密钥轮换（可选）
- 容量规划

## 相关文档

- [安全最佳实践](./authentication-security-best-practices.md)
- [认证架构文档](../architecture/authentication-architecture.md)
- [故障排查指南](../troubleshooting/authentication-issues.md)
