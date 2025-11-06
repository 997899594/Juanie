# 环境变量配置指南

本文档详细说明了 AI DevOps 平台所需的所有环境变量。

## 📋 目录

- [必需变量](#必需变量)
- [数据库配置](#数据库配置)
- [认证配置](#认证配置)
- [AI 服务配置](#ai-服务配置)
- [存储配置](#存储配置)
- [监控配置](#监控配置)
- [邮件配置](#邮件配置)
- [其他配置](#其他配置)

## 必需变量

这些变量是应用运行的最低要求。

### NODE_ENV

- **说明**: 运行环境
- **类型**: `string`
- **可选值**: `development` | `test` | `production`
- **默认值**: `development`
- **示例**: `NODE_ENV=production`

### PORT

- **说明**: API 服务器监听端口
- **类型**: `number`
- **默认值**: `3001`
- **示例**: `PORT=3001`

### DATABASE_URL

- **说明**: PostgreSQL 数据库连接字符串
- **类型**: `string`
- **格式**: `postgresql://[user]:[password]@[host]:[port]/[database]`
- **示例**: `DATABASE_URL=postgresql://postgres:password@localhost:5432/devops`
- **注意**: 
  - 生产环境必须使用强密码
  - 建议使用连接池参数: `?pool_timeout=30&connection_limit=10`

### REDIS_URL

- **说明**: Redis 连接字符串
- **类型**: `string`
- **格式**: `redis://[password]@[host]:[port]/[db]`
- **示例**: `REDIS_URL=redis://localhost:6379`
- **注意**: 
  - 如果 Redis 有密码: `redis://:password@localhost:6379`
  - 可以指定数据库: `redis://localhost:6379/0`

### JWT_SECRET

- **说明**: JWT 令牌签名密钥
- **类型**: `string`
- **要求**: 至少 32 字符的随机字符串
- **示例**: `JWT_SECRET=your-super-secret-jwt-key-change-this-in-production`
- **生成方法**:
  ```bash
  # 使用 openssl 生成
  openssl rand -base64 32
  
  # 使用 Node.js 生成
  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  ```
- **安全建议**:
  - 每个环境使用不同的密钥
  - 定期轮换密钥
  - 不要提交到版本控制

### JWT_EXPIRES_IN

- **说明**: JWT 令牌过期时间
- **类型**: `string`
- **格式**: 时间字符串 (如 `7d`, `24h`, `30m`)
- **默认值**: `7d`
- **示例**: `JWT_EXPIRES_IN=7d`

## 数据库配置

### POSTGRES_PASSWORD

- **说明**: PostgreSQL 数据库密码（Docker Compose 使用）
- **类型**: `string`
- **示例**: `POSTGRES_PASSWORD=strong-password-here`
- **要求**: 
  - 至少 16 字符
  - 包含大小写字母、数字和特殊字符

### REDIS_PASSWORD

- **说明**: Redis 密码（Docker Compose 使用）
- **类型**: `string`
- **示例**: `REDIS_PASSWORD=redis-password-here`
- **注意**: 如果设置了密码，需要在 `REDIS_URL` 中包含

## 认证配置

### GitHub OAuth

#### GITHUB_CLIENT_ID

- **说明**: GitHub OAuth 应用的 Client ID
- **类型**: `string`
- **获取方式**: https://github.com/settings/developers
- **示例**: `GITHUB_CLIENT_ID=Iv1.1234567890abcdef`

#### GITHUB_CLIENT_SECRET

- **说明**: GitHub OAuth 应用的 Client Secret
- **类型**: `string`
- **示例**: `GITHUB_CLIENT_SECRET=1234567890abcdef1234567890abcdef12345678`

#### GITHUB_CALLBACK_URL

- **说明**: GitHub OAuth 回调 URL
- **类型**: `string`
- **格式**: `https://[domain]/auth/github/callback`
- **示例**: `GITHUB_CALLBACK_URL=http://localhost:3001/auth/github/callback`
- **注意**: 必须与 GitHub OAuth 应用配置中的回调 URL 一致

### GitLab OAuth

#### GITLAB_CLIENT_ID

- **说明**: GitLab OAuth 应用的 Application ID
- **类型**: `string`
- **获取方式**: https://gitlab.com/-/profile/applications
- **示例**: `GITLAB_CLIENT_ID=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

#### GITLAB_CLIENT_SECRET

- **说明**: GitLab OAuth 应用的 Secret
- **类型**: `string`
- **示例**: `GITLAB_CLIENT_SECRET=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

#### GITLAB_CALLBACK_URL

- **说明**: GitLab OAuth 回调 URL
- **类型**: `string`
- **格式**: `https://[domain]/auth/gitlab/callback`
- **示例**: `GITLAB_CALLBACK_URL=http://localhost:3001/auth/gitlab/callback`

## AI 服务配置

### OpenAI

#### OPENAI_API_KEY

- **说明**: OpenAI API 密钥
- **类型**: `string`
- **获取方式**: https://platform.openai.com/api-keys
- **示例**: `OPENAI_API_KEY=sk-1234567890abcdef1234567890abcdef1234567890abcdef`
- **注意**: 
  - 保护好 API 密钥，不要泄露
  - 设置使用限额避免超支

### Anthropic

#### ANTHROPIC_API_KEY

- **说明**: Anthropic (Claude) API 密钥
- **类型**: `string`
- **获取方式**: https://console.anthropic.com/
- **示例**: `ANTHROPIC_API_KEY=sk-ant-1234567890abcdef1234567890abcdef`

### Google AI

#### GOOGLE_AI_API_KEY

- **说明**: Google AI (Gemini) API 密钥
- **类型**: `string`
- **获取方式**: https://makersuite.google.com/app/apikey
- **示例**: `GOOGLE_AI_API_KEY=AIzaSy1234567890abcdef1234567890abcdef`

### Ollama (本地)

#### OLLAMA_HOST

- **说明**: Ollama 服务地址
- **类型**: `string`
- **默认值**: `http://localhost:11434`
- **示例**: `OLLAMA_HOST=http://localhost:11434`
- **注意**: 
  - 需要先安装 Ollama: https://ollama.ai/
  - 可以使用远程 Ollama 服务

## 存储配置

### MinIO / S3

#### MINIO_ENDPOINT

- **说明**: MinIO 服务器地址
- **类型**: `string`
- **示例**: `MINIO_ENDPOINT=localhost`

#### MINIO_PORT

- **说明**: MinIO 服务器端口
- **类型**: `number`
- **默认值**: `9000`
- **示例**: `MINIO_PORT=9000`

#### MINIO_ACCESS_KEY

- **说明**: MinIO 访问密钥
- **类型**: `string`
- **示例**: `MINIO_ACCESS_KEY=minioadmin`

#### MINIO_SECRET_KEY

- **说明**: MinIO 密钥
- **类型**: `string`
- **示例**: `MINIO_SECRET_KEY=minioadmin`

#### MINIO_USE_SSL

- **说明**: 是否使用 SSL
- **类型**: `boolean`
- **默认值**: `false`
- **示例**: `MINIO_USE_SSL=true`

## 监控配置

### OTEL_EXPORTER_OTLP_ENDPOINT

- **说明**: OpenTelemetry OTLP 导出器端点
- **类型**: `string`
- **默认值**: `http://localhost:4318/v1/traces`
- **示例**: `OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces`

### OTEL_SERVICE_NAME

- **说明**: OpenTelemetry 服务名称
- **类型**: `string`
- **默认值**: `api-gateway`
- **示例**: `OTEL_SERVICE_NAME=api-gateway`

### OTEL_SERVICE_VERSION

- **说明**: OpenTelemetry 服务版本
- **类型**: `string`
- **默认值**: `1.0.0`
- **示例**: `OTEL_SERVICE_VERSION=1.0.0`

### PROMETHEUS_PORT

- **说明**: Prometheus 指标导出端口
- **类型**: `number`
- **默认值**: `9465`
- **示例**: `PROMETHEUS_PORT=9465`

### METRICS_ENABLED

- **说明**: 是否启用指标收集
- **类型**: `boolean`
- **默认值**: `true`
- **示例**: `METRICS_ENABLED=true`

## 邮件配置

### SMTP_HOST

- **说明**: SMTP 服务器地址
- **类型**: `string`
- **示例**: `SMTP_HOST=smtp.gmail.com`

### SMTP_PORT

- **说明**: SMTP 服务器端口
- **类型**: `number`
- **常用值**: 
  - `25` (不加密)
  - `587` (STARTTLS)
  - `465` (SSL/TLS)
- **示例**: `SMTP_PORT=587`

### SMTP_USER

- **说明**: SMTP 用户名
- **类型**: `string`
- **示例**: `SMTP_USER=your-email@gmail.com`

### SMTP_PASSWORD

- **说明**: SMTP 密码
- **类型**: `string`
- **示例**: `SMTP_PASSWORD=your-app-password`
- **注意**: 
  - Gmail 需要使用应用专用密码
  - 不要使用账户密码

### SMTP_FROM

- **说明**: 发件人地址
- **类型**: `string`
- **示例**: `SMTP_FROM=noreply@yourdomain.com`

## 其他配置

### CORS_ORIGIN

- **说明**: CORS 允许的源
- **类型**: `string`
- **默认值**: `http://localhost:3000`
- **示例**: `CORS_ORIGIN=https://yourdomain.com`
- **注意**: 
  - 多个源用逗号分隔: `http://localhost:3000,https://yourdomain.com`
  - 生产环境不要使用 `*`

### LOG_LEVEL

- **说明**: 日志级别
- **类型**: `string`
- **可选值**: `error` | `warn` | `info` | `debug` | `trace`
- **默认值**: `info`
- **示例**: `LOG_LEVEL=info`

### LOG_PRETTY

- **说明**: 是否使用美化的日志输出
- **类型**: `boolean`
- **默认值**: `true` (开发环境), `false` (生产环境)
- **示例**: `LOG_PRETTY=true`

### K3S_KUBECONFIG_PATH

- **说明**: K3s Kubeconfig 文件路径
- **类型**: `string`
- **示例**: `K3S_KUBECONFIG_PATH=/etc/rancher/k3s/k3s.yaml`

## 环境变量优先级

环境变量的加载优先级（从高到低）：

1. 系统环境变量
2. `.env.local` 文件（不应提交到版本控制）
3. `.env.[NODE_ENV]` 文件（如 `.env.production`）
4. `.env` 文件
5. 默认值

## 安全最佳实践

1. **不要提交敏感信息到版本控制**
   - 使用 `.gitignore` 忽略 `.env` 文件
   - 只提交 `.env.example` 模板

2. **使用强密码和密钥**
   - 至少 16 字符
   - 包含大小写字母、数字和特殊字符
   - 使用密码生成器

3. **定期轮换密钥**
   - JWT 密钥每 3-6 个月轮换一次
   - API 密钥定期检查和更新

4. **限制访问权限**
   - 只给必要的人员访问生产环境变量
   - 使用密钥管理服务（如 AWS Secrets Manager, HashiCorp Vault）

5. **监控和审计**
   - 记录环境变量的访问和修改
   - 定期审查配置

## 故障排查

### 环境变量未生效

```bash
# 检查环境变量是否加载
echo $DATABASE_URL

# 在应用中打印环境变量（仅开发环境）
console.log(process.env.DATABASE_URL)

# 检查 .env 文件是否存在
ls -la .env

# 检查文件权限
chmod 600 .env
```

### 数据库连接失败

```bash
# 测试数据库连接
psql $DATABASE_URL

# 检查连接字符串格式
echo $DATABASE_URL | grep -E "postgresql://.*:.*@.*:.*/.*"
```

### OAuth 认证失败

```bash
# 检查回调 URL 是否正确
echo $GITHUB_CALLBACK_URL

# 确认 Client ID 和 Secret 是否正确
echo $GITHUB_CLIENT_ID
echo $GITHUB_CLIENT_SECRET | wc -c  # 应该是 40 字符
```

---

**最后更新**: 2024-10-31
