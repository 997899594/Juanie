# 环境变量配置文档

本文档列出了 AI DevOps 平台的所有环境变量及其说明。

## 目录

- [核心配置](#核心配置)
- [数据库配置](#数据库配置)
- [GitOps 配置](#gitops-配置)
- [Git 集成配置](#git-集成配置)
- [认证配置](#认证配置)
- [日志配置](#日志配置)
- [性能配置](#性能配置)

---

## 核心配置

### `NODE_ENV`

**描述:** 运行环境

**类型:** String

**可选值:** `development` | `production` | `test`

**默认值:** `production`

**示例:**

```bash
NODE_ENV=production
```

---

### `PORT`

**描述:** API 服务监听端口

**类型:** Number

**默认值:** `4000`

**示例:**

```bash
PORT=4000
```

---

### `LOG_LEVEL`

**描述:** 日志级别

**类型:** String

**可选值:** `error` | `warn` | `info` | `debug` | `trace`

**默认值:** `info`

**示例:**

```bash
LOG_LEVEL=info
```

---

## 数据库配置

### `DATABASE_URL`

**描述:** PostgreSQL 数据库连接字符串

**类型:** String

**必填:** ✅ 是

**格式:** `postgresql://[user]:[password]@[host]:[port]/[database]`

**示例:**

```bash
DATABASE_URL=postgresql://postgres:password@localhost:5432/devops
```

---

### `DATABASE_POOL_MIN`

**描述:** 数据库连接池最小连接数

**类型:** Number

**默认值:** `2`

**示例:**

```bash
DATABASE_POOL_MIN=2
```

---

### `DATABASE_POOL_MAX`

**描述:** 数据库连接池最大连接数

**类型:** Number

**默认值:** `10`

**示例:**

```bash
DATABASE_POOL_MAX=10
```

---

### `REDIS_URL`

**描述:** Redis 连接字符串

**类型:** String

**默认值:** `redis://localhost:6379`

**示例:**

```bash
REDIS_URL=redis://localhost:6379
REDIS_URL=redis://:password@localhost:6379
```

---

## GitOps 配置

### `ENABLE_GITOPS`

**描述:** 启用 GitOps 功能

**类型:** Boolean

**默认值:** `true`

**示例:**

```bash
ENABLE_GITOPS=true
```

---

### `KUBECONFIG_PATH`

**描述:** Kubernetes 配置文件路径

**类型:** String

**默认值:** `~/.kube/config`

**示例:**

```bash
KUBECONFIG_PATH=/kubeconfig/config
```

---

### `FLUX_VERSION`

**描述:** Flux CD 版本

**类型:** String

**默认值:** `v2.2.0`

**示例:**

```bash
FLUX_VERSION=v2.2.0
```

---

### `FLUX_NAMESPACE`

**描述:** Flux 安装的命名空间

**类型:** String

**默认值:** `flux-system`

**示例:**

```bash
FLUX_NAMESPACE=flux-system
```

---

### `FLUX_SYNC_INTERVAL`

**描述:** Flux 默认同步间隔

**类型:** String (Duration)

**默认值:** `5m`

**格式:** `<number><unit>` (s=秒, m=分钟, h=小时)

**示例:**

```bash
FLUX_SYNC_INTERVAL=5m
```

---

### `FLUX_TIMEOUT`

**描述:** Flux 操作超时时间

**类型:** String (Duration)

**默认值:** `3m`

**示例:**

```bash
FLUX_TIMEOUT=3m
```

---

### `K3S_KUBECONFIG_OUTPUT`

**描述:** K3s 生成的 kubeconfig 输出路径

**类型:** String

**默认值:** `/output/kubeconfig.yaml`

**示例:**

```bash
K3S_KUBECONFIG_OUTPUT=/output/kubeconfig.yaml
```

---

### `K3S_TOKEN`

**描述:** K3s 集群 token

**类型:** String

**必填:** ✅ 是（使用 K3s 时）

**示例:**

```bash
K3S_TOKEN=your-secure-token-change-this
```

---

## Git 集成配置

### `GIT_SSH_KEY_PATH`

**描述:** Git SSH 私钥文件路径

**类型:** String

**默认值:** `~/.ssh/id_rsa`

**示例:**

```bash
GIT_SSH_KEY_PATH=/secrets/git-ssh-key
```

---

### `GIT_KNOWN_HOSTS_PATH`

**描述:** SSH known_hosts 文件路径

**类型:** String

**默认值:** `~/.ssh/known_hosts`

**示例:**

```bash
GIT_KNOWN_HOSTS_PATH=/secrets/known_hosts
```

---

### `GIT_DEFAULT_BRANCH`

**描述:** Git 默认分支名称

**类型:** String

**默认值:** `main`

**示例:**

```bash
GIT_DEFAULT_BRANCH=main
```

---

### `GIT_COMMIT_AUTHOR_NAME`

**描述:** Git commit 作者名称

**类型:** String

**默认值:** `AI DevOps Platform`

**示例:**

```bash
GIT_COMMIT_AUTHOR_NAME=AI DevOps Platform
```

---

### `GIT_COMMIT_AUTHOR_EMAIL`

**描述:** Git commit 作者邮箱

**类型:** String

**默认值:** `gitops@devops-platform.local`

**示例:**

```bash
GIT_COMMIT_AUTHOR_EMAIL=gitops@devops-platform.local
```

---

### `GITHUB_TOKEN`

**描述:** GitHub Personal Access Token

**类型:** String

**必填:** ❌ 否（使用 GitHub 时需要）

**权限要求:** `repo`, `read:org`

**示例:**

```bash
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx
```

---

### `GITLAB_TOKEN`

**描述:** GitLab Personal Access Token

**类型:** String

**必填:** ❌ 否（使用 GitLab 时需要）

**权限要求:** `api`, `read_repository`, `write_repository`

**示例:**

```bash
GITLAB_TOKEN=glpat-xxxxxxxxxxxxxxxxxxxx
```

---

### `GITEA_TOKEN`

**描述:** Gitea Access Token

**类型:** String

**必填:** ❌ 否（使用 Gitea 时需要）

**示例:**

```bash
GITEA_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 认证配置

### `JWT_SECRET`

**描述:** JWT 签名密钥

**类型:** String

**必填:** ✅ 是

**建议:** 使用至少 32 字符的随机字符串

**示例:**

```bash
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

生成随机密钥：

```bash
openssl rand -base64 32
```

---

### `JWT_EXPIRES_IN`

**描述:** JWT 过期时间

**类型:** String (Duration)

**默认值:** `7d`

**格式:** `<number><unit>` (s=秒, m=分钟, h=小时, d=天)

**示例:**

```bash
JWT_EXPIRES_IN=7d
```

---

### `ADMIN_EMAIL`

**描述:** 初始管理员邮箱

**类型:** String

**必填:** ✅ 是

**示例:**

```bash
ADMIN_EMAIL=admin@example.com
```

---

### `ADMIN_PASSWORD`

**描述:** 初始管理员密码

**类型:** String

**必填:** ✅ 是

**建议:** 使用强密码

**示例:**

```bash
ADMIN_PASSWORD=SecurePassword123!
```

---

### `SESSION_SECRET`

**描述:** Session 加密密钥

**类型:** String

**默认值:** 自动生成

**示例:**

```bash
SESSION_SECRET=your-session-secret-key
```

---

## 日志配置

### `LOG_FORMAT`

**描述:** 日志输出格式

**类型:** String

**可选值:** `json` | `pretty`

**默认值:** `json` (生产环境), `pretty` (开发环境)

**示例:**

```bash
LOG_FORMAT=json
```

---

### `LOG_FILE_PATH`

**描述:** 日志文件路径

**类型:** String

**默认值:** `./logs/app.log`

**示例:**

```bash
LOG_FILE_PATH=/var/log/devops/app.log
```

---

### `LOG_MAX_FILES`

**描述:** 日志文件最大保留数量

**类型:** Number

**默认值:** `7`

**示例:**

```bash
LOG_MAX_FILES=7
```

---

### `LOG_MAX_SIZE`

**描述:** 单个日志文件最大大小

**类型:** String

**默认值:** `10m`

**格式:** `<number><unit>` (k=KB, m=MB, g=GB)

**示例:**

```bash
LOG_MAX_SIZE=10m
```

---

## 性能配置

### `CACHE_TTL`

**描述:** 缓存默认过期时间（秒）

**类型:** Number

**默认值:** `300` (5 分钟)

**示例:**

```bash
CACHE_TTL=300
```

---

### `RATE_LIMIT_WINDOW`

**描述:** 速率限制时间窗口（毫秒）

**类型:** Number

**默认值:** `60000` (1 分钟)

**示例:**

```bash
RATE_LIMIT_WINDOW=60000
```

---

### `RATE_LIMIT_MAX`

**描述:** 速率限制最大请求数

**类型:** Number

**默认值:** `100`

**示例:**

```bash
RATE_LIMIT_MAX=100
```

---

### `MAX_UPLOAD_SIZE`

**描述:** 文件上传最大大小（字节）

**类型:** Number

**默认值:** `10485760` (10 MB)

**示例:**

```bash
MAX_UPLOAD_SIZE=10485760
```

---

### `WORKER_THREADS`

**描述:** Worker 线程数量

**类型:** Number

**默认值:** CPU 核心数

**示例:**

```bash
WORKER_THREADS=4
```

---

## 监控配置

### `ENABLE_METRICS`

**描述:** 启用 Prometheus 指标

**类型:** Boolean

**默认值:** `true`

**示例:**

```bash
ENABLE_METRICS=true
```

---

### `METRICS_PORT`

**描述:** Prometheus 指标端口

**类型:** Number

**默认值:** `9090`

**示例:**

```bash
METRICS_PORT=9090
```

---

### `ENABLE_TRACING`

**描述:** 启用分布式追踪

**类型:** Boolean

**默认值:** `false`

**示例:**

```bash
ENABLE_TRACING=true
```

---

### `JAEGER_ENDPOINT`

**描述:** Jaeger 追踪端点

**类型:** String

**默认值:** `http://localhost:14268/api/traces`

**示例:**

```bash
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
```

---

## 通知配置

### `SMTP_HOST`

**描述:** SMTP 服务器地址

**类型:** String

**示例:**

```bash
SMTP_HOST=smtp.gmail.com
```

---

### `SMTP_PORT`

**描述:** SMTP 服务器端口

**类型:** Number

**默认值:** `587`

**示例:**

```bash
SMTP_PORT=587
```

---

### `SMTP_USER`

**描述:** SMTP 用户名

**类型:** String

**示例:**

```bash
SMTP_USER=your-email@gmail.com
```

---

### `SMTP_PASSWORD`

**描述:** SMTP 密码

**类型:** String

**示例:**

```bash
SMTP_PASSWORD=your-app-password
```

---

### `SMTP_FROM`

**描述:** 邮件发件人地址

**类型:** String

**默认值:** `noreply@devops-platform.local`

**示例:**

```bash
SMTP_FROM=noreply@example.com
```

---

### `SLACK_WEBHOOK_URL`

**描述:** Slack Webhook URL

**类型:** String

**示例:**

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
```

---

## 配置示例

### 开发环境 (.env.development)

```bash
# 核心配置
NODE_ENV=development
PORT=4000
LOG_LEVEL=debug

# 数据库
DATABASE_URL=postgresql://postgres:password@localhost:5432/devops_dev
REDIS_URL=redis://localhost:6379

# 认证
JWT_SECRET=dev-secret-key-not-for-production
ADMIN_EMAIL=admin@localhost
ADMIN_PASSWORD=admin123

# GitOps
ENABLE_GITOPS=true
KUBECONFIG_PATH=~/.kube/config
FLUX_VERSION=v2.2.0

# Git
GIT_SSH_KEY_PATH=~/.ssh/id_rsa
GIT_COMMIT_AUTHOR_NAME=Dev Platform
GIT_COMMIT_AUTHOR_EMAIL=dev@localhost
```

---

### 生产环境 (.env.production)

```bash
# 核心配置
NODE_ENV=production
PORT=4000
LOG_LEVEL=info

# 数据库
DATABASE_URL=postgresql://user:secure-password@db.example.com:5432/devops
DATABASE_POOL_MIN=5
DATABASE_POOL_MAX=20
REDIS_URL=redis://:redis-password@redis.example.com:6379

# 认证
JWT_SECRET=<使用 openssl rand -base64 32 生成>
JWT_EXPIRES_IN=7d
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=<强密码>

# GitOps
ENABLE_GITOPS=true
KUBECONFIG_PATH=/etc/kubernetes/config
FLUX_VERSION=v2.2.0
FLUX_NAMESPACE=flux-system
FLUX_SYNC_INTERVAL=5m

# Git
GIT_SSH_KEY_PATH=/secrets/git-ssh-key
GIT_COMMIT_AUTHOR_NAME=AI DevOps Platform
GIT_COMMIT_AUTHOR_EMAIL=gitops@example.com
GITHUB_TOKEN=<your-github-token>

# 日志
LOG_FORMAT=json
LOG_FILE_PATH=/var/log/devops/app.log
LOG_MAX_FILES=30
LOG_MAX_SIZE=50m

# 性能
CACHE_TTL=600
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=100
WORKER_THREADS=8

# 监控
ENABLE_METRICS=true
METRICS_PORT=9090
ENABLE_TRACING=true
JAEGER_ENDPOINT=http://jaeger:14268/api/traces

# 通知
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=notifications@example.com
SMTP_PASSWORD=<app-password>
SMTP_FROM=noreply@example.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/xxx/yyy/zzz
```

---

## 安全建议

### 1. 敏感信息保护

**不要** 将敏感信息提交到版本控制：

```bash
# .gitignore
.env
.env.local
.env.production
secrets/
```

### 2. 使用环境变量管理工具

推荐使用：

- **Docker Secrets** (Docker Swarm)
- **Kubernetes Secrets** (K8s)
- **HashiCorp Vault**
- **AWS Secrets Manager**
- **Azure Key Vault**

### 3. 定期轮换密钥

- JWT Secret: 每 90 天
- Git Token: 每 180 天
- 数据库密码: 每 90 天

### 4. 最小权限原则

为每个服务配置最小必要权限：

- Git Token: 只授予必要的仓库访问权限
- 数据库用户: 只授予必要的表权限

---

## 验证配置

使用以下脚本验证配置：

```bash
#!/bin/bash

# 检查必填变量
required_vars=(
  "DATABASE_URL"
  "JWT_SECRET"
  "ADMIN_EMAIL"
  "ADMIN_PASSWORD"
)

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    echo "❌ 缺少必填变量: $var"
    exit 1
  fi
done

echo "✅ 所有必填变量已配置"

# 检查数据库连接
if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "✅ 数据库连接成功"
else
  echo "❌ 数据库连接失败"
  exit 1
fi

# 检查 Redis 连接
if redis-cli -u "$REDIS_URL" ping > /dev/null 2>&1; then
  echo "✅ Redis 连接成功"
else
  echo "❌ Redis 连接失败"
  exit 1
fi

echo "✅ 配置验证通过"
```

---

## 相关文档

- [Docker Compose 部署指南](./DOCKER_COMPOSE.md)
- [Flux 安装指南](./FLUX_INSTALLATION.md)
- [GitOps 快速入门](../gitops/QUICK_START.md)
