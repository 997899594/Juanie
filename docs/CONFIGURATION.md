# 配置管理指南

## 📋 配置文件结构

```
项目根目录/
├── .env                    # 本地开发环境变量 (不提交到 Git)
├── .env.example            # 环境变量模板 (提交到 Git)
├── .env.prod.example       # 生产环境模板
├── docker-compose.yml      # 开发环境 Docker 配置
├── docker-compose.prod.yml # 生产环境 Docker 配置
└── apps/
    └── api-gateway/
        └── .env.example    # API 网关特定配置示例
```

## 🎯 配置原则

### 1. 单一数据源
所有配置值在 `.env` 文件中定义一次,其他文件通过环境变量引用。

### 2. 环境分离
- **开发环境**: `.env` + `docker-compose.yml`
- **生产环境**: `.env.prod` + `docker-compose.prod.yml`
- **CI/CD**: 通过 CI 平台的环境变量管理

### 3. 安全优先
- ❌ 不要提交 `.env` 文件到 Git
- ✅ 提交 `.env.example` 作为模板
- ✅ 使用强密码和密钥
- ✅ 生产环境使用密钥管理服务

## 🚀 快速开始

### 1. 初始化配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑配置文件,填入实际值
vim .env
```

### 2. 配置数据库

`.env` 文件中的数据库配置:

```bash
# Docker 容器配置
POSTGRES_USER=findbiao
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=juanie_ai_devops

# 应用连接字符串 (保持与上面一致)
DATABASE_URL=postgresql://findbiao:your_secure_password@localhost:5432/juanie_ai_devops
```

**重要**: `DATABASE_URL` 必须与 `POSTGRES_*` 变量保持一致!

### 3. 启动服务

```bash
# 启动 Docker 服务
docker-compose up -d postgres dragonfly

# 运行数据库迁移
bun run db:push

# 启动开发服务器
bun dev
```

## 📦 配置分类

### 核心配置

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `NODE_ENV` | 运行环境 | `development` | ✅ |
| `PORT` | API 端口 | `3000` | ✅ |
| `DATABASE_URL` | 数据库连接 | - | ✅ |
| `REDIS_URL` | Redis 连接 | - | ✅ |
| `JWT_SECRET` | JWT 密钥 | - | ✅ |

### 数据库配置

| 变量 | 说明 | 用途 |
|------|------|------|
| `POSTGRES_USER` | 数据库用户 | Docker 容器 |
| `POSTGRES_PASSWORD` | 数据库密码 | Docker 容器 |
| `POSTGRES_DB` | 数据库名称 | Docker 容器 |
| `DATABASE_URL` | 连接字符串 | 应用程序 |

### OAuth 配置

#### GitHub
```bash
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/github/callback
```

#### GitLab
```bash
GITLAB_CLIENT_ID=your_client_id
GITLAB_CLIENT_SECRET=your_client_secret
GITLAB_REDIRECT_URI=http://localhost:3000/auth/gitlab/callback
GITLAB_BASE_URL=https://gitlab.com
```

### 外部服务

| 服务 | 配置变量 | 说明 |
|------|----------|------|
| Ollama | `OLLAMA_HOST` | AI 服务地址 |
| MinIO | `MINIO_*` | 对象存储配置 |
| K3s | `K3S_KUBECONFIG_PATH` | Kubernetes 配置 |
| Jaeger | `JAEGER_ENDPOINT` | 链路追踪 |

## 🔧 Docker Compose 集成

`docker-compose.yml` 自动读取 `.env` 文件:

```yaml
services:
  postgres:
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
```

**工作流程**:
1. Docker Compose 读取 `.env` 文件
2. 使用 `${VAR_NAME}` 语法引用变量
3. 容器启动时注入环境变量

## 🌍 多环境管理

### 开发环境
```bash
# 使用默认 .env
bun dev
```

### 测试环境
```bash
# 使用测试配置
cp .env.test .env
bun dev
```

### 生产环境
```bash
# 使用生产配置
cp .env.prod .env
docker-compose -f docker-compose.prod.yml up -d
bun start
```

## ✅ 配置验证

### 检查必需变量

```bash
# 运行配置检查脚本
bun run check:env
```

### 手动验证

```bash
# 检查数据库连接
docker-compose exec postgres pg_isready -U $POSTGRES_USER

# 检查 Redis 连接
docker-compose exec dragonfly redis-cli ping

# 测试应用启动
bun run dev
```

## 🔒 安全最佳实践

### 1. 密钥管理
- ✅ 使用强随机密钥
- ✅ 定期轮换密钥
- ✅ 生产环境使用密钥管理服务 (AWS Secrets Manager, HashiCorp Vault)

### 2. 访问控制
- ✅ 限制数据库访问 IP
- ✅ 使用最小权限原则
- ✅ 启用 SSL/TLS

### 3. 审计
- ✅ 记录配置变更
- ✅ 监控异常访问
- ✅ 定期安全审计

## 🐛 常见问题

### Q: DATABASE_URL 未设置错误
**A**: 确保 `.env` 文件存在且包含 `DATABASE_URL` 变量。

### Q: Docker 容器无法连接数据库
**A**: 检查 `POSTGRES_*` 变量是否与 `DATABASE_URL` 一致。

### Q: 环境变量不生效
**A**: 
1. 重启应用和 Docker 容器
2. 检查变量名拼写
3. 确认 `.env` 文件在项目根目录

### Q: 如何在 CI/CD 中使用
**A**: 在 CI 平台配置环境变量,不要使用 `.env` 文件。

## 📚 相关文档

- [环境变量列表](./ENVIRONMENT_VARIABLES.md)
- [Docker 部署](./deployment/docker.md)
- [常见问题](./troubleshooting/common-issues.md)
