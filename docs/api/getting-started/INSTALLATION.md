# 🚀 快速开始指南

## 📋 前置要求

- **Bun** >= 1.2.0
- **Docker** >= 24.0
- **Docker Compose** >= 2.20
- **Git**

---

## 🎯 5 分钟快速启动

### 1. 克隆项目
```bash
git clone <your-repo>
cd apps/api-clean
```

### 2. 安装依赖
```bash
bun install
```

### 3. 配置环境变量
```bash
cp .env.example .env
```

编辑 `.env` 文件，配置必要的环境变量：

```env
# 应用配置
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# 数据库
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/devops

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# MinIO
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_USE_SSL=false
MINIO_BUCKET=devops-storage

# Ollama
OLLAMA_HOST=http://localhost:11434

# GitHub OAuth (可选)
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret

# GitLab OAuth (可选)
GITLAB_CLIENT_ID=your_gitlab_client_id
GITLAB_CLIENT_SECRET=your_gitlab_client_secret
```

### 4. 启动基础设施
```bash
docker-compose up -d
```

这将启动：
- ✅ PostgreSQL 17 (端口 5432)
- ✅ Dragonfly Redis (端口 6379)
- ✅ MinIO (端口 9000, 9001)
- ✅ Prometheus (端口 9090)
- ✅ Grafana (端口 3300)
- ✅ Loki (端口 3100)
- ✅ Tempo (端口 3200)
- ✅ Ollama (端口 11434)

### 5. 运行数据库迁移
```bash
# 生成迁移文件
bun run db:generate

# 执行迁移
bun run db:migrate
```

### 6. 启动开发服务器
```bash
bun run dev
```

服务器将在 http://localhost:3000 启动

---

## ✅ 验证安装

### 1. 检查 API 健康状态
```bash
curl http://localhost:3000/health
```

应该返回：
```json
{
  "status": "ok",
  "timestamp": "2025-01-XX..."
}
```

### 2. 检查 tRPC
访问 http://localhost:3000/trpc-playground

### 3. 检查数据库
```bash
bun run db:studio
```

访问 https://local.drizzle.studio

### 4. 检查 MinIO
访问 http://localhost:9001
- 用户名: minioadmin
- 密码: minioadmin

### 5. 检查 Grafana
访问 http://localhost:3300
- 用户名: admin
- 密码: admin

### 6. 检查 Ollama
```bash
curl http://localhost:11434/api/tags
```

---

## 🤖 配置 Ollama AI

### 1. 下载推荐模型
```bash
# 进入 Ollama 容器
docker-compose exec ollama bash

# 下载轻量级模型（推荐）
ollama pull llama3.2:3b    # 2GB，适合对话
ollama pull codellama:7b   # 4GB，专门用于代码
ollama pull mistral:7b     # 7GB，高质量通用模型

# 验证模型
ollama list

# 测试对话
ollama run llama3.2:3b "你好"
```

### 2. 测试 AI 助手
```bash
# 使用 tRPC 客户端测试
curl -X POST http://localhost:3000/trpc/aiAssistants.getAvailableModels
```

---

## 🔐 配置 OAuth 登录

### GitHub OAuth

1. 访问 https://github.com/settings/developers
2. 创建新的 OAuth App
3. 配置回调 URL: `http://localhost:3000/auth/github/callback`
4. 复制 Client ID 和 Client Secret 到 `.env`

### GitLab OAuth

1. 访问 https://gitlab.com/-/profile/applications
2. 创建新的 Application
3. 配置回调 URL: `http://localhost:3000/auth/gitlab/callback`
4. 选择 scopes: `read_user`
5. 复制 Application ID 和 Secret 到 `.env`

> 使用私有 GitLab 实例时：将 `.env` 中的 `GITLAB_BASE_URL` 设置为你的实例地址（例如 `http://127.0.0.1:8080`），并在该实例上创建 OAuth 应用，保持回调地址与 `GITLAB_REDIRECT_URI` 一致。

---

## 📚 常用命令

### 开发
```bash
# 启动开发服务器
bun run dev

# 类型检查
bun run type-check

# 代码格式化
bun run format

# 代码检查
bun run lint
```

### 数据库
```bash
# 生成迁移
bun run db:generate

# 执行迁移
bun run db:migrate

# 打开 Drizzle Studio
bun run db:studio

# 重置数据库（危险！）
bun run db:reset
```

### Docker
```bash
# 启动所有服务
docker-compose up -d

# 停止所有服务
docker-compose down

# 查看日志
docker-compose logs -f

# 查看特定服务日志
docker-compose logs -f postgres
docker-compose logs -f ollama

# 重启服务
docker-compose restart

# 清理所有数据（危险！）
docker-compose down -v
```

---

## 🧪 测试 API

### 使用 curl

#### 1. 获取 GitHub 登录 URL
```bash
curl http://localhost:3000/trpc/auth.githubAuthUrl
```

#### 2. 创建组织
```bash
curl -X POST http://localhost:3000/trpc/organizations.create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{
    "name": "My Organization",
    "slug": "my-org",
    "description": "My first organization"
  }'
```

#### 3. 创建 AI 助手
```bash
curl -X POST http://localhost:3000/trpc/aiAssistants.create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SESSION_ID" \
  -d '{
    "organizationId": "org-uuid",
    "name": "代码审查助手",
    "type": "code-reviewer",
    "modelConfig": {
      "provider": "ollama",
      "model": "codellama:7b",
      "temperature": 0.3
    }
  }'
```

### 使用 tRPC 客户端

```typescript
import { createTRPCClient, httpBatchLink } from '@trpc/client'
import type { AppRouter } from './src/trpc/trpc.router'

const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: 'http://localhost:3000/trpc',
    }),
  ],
})

// 获取健康状态
const health = await client.health.query()
console.log(health)

// 获取 GitHub 登录 URL
const { url } = await client.auth.githubAuthUrl.query()
console.log('登录 URL:', url)

// 创建组织
const org = await client.organizations.create.mutate({
  name: 'My Organization',
  slug: 'my-org',
  description: 'My first organization',
})
console.log('组织已创建:', org)
```

---

## 🐛 故障排查

### 数据库连接失败
```bash
# 检查 PostgreSQL 状态
docker-compose ps postgres

# 查看日志
docker-compose logs postgres

# 重启数据库
docker-compose restart postgres
```

### Redis 连接失败
```bash
# 检查 Dragonfly 状态
docker-compose ps dragonfly

# 测试连接
docker-compose exec dragonfly redis-cli ping
```

### MinIO 连接失败
```bash
# 检查 MinIO 状态
docker-compose ps minio

# 访问控制台
open http://localhost:9001
```

### Ollama 不可用
```bash
# 检查 Ollama 状态
docker-compose ps ollama

# 查看日志
docker-compose logs ollama

# 测试连接
curl http://localhost:11434/api/tags

# 重启 Ollama
docker-compose restart ollama
```

### 端口被占用
```bash
# 查看端口占用
lsof -i :3000
lsof -i :5432
lsof -i :6379

# 修改 docker-compose.yml 中的端口映射
```

---

## 📖 学习资源

### 官方文档
- [NestJS](https://docs.nestjs.com/)
- [tRPC](https://trpc.io/)
- [Drizzle ORM](https://orm.drizzle.team/)
- [Bun](https://bun.sh/)
- [Ollama](https://ollama.com/)

### 项目文档
- [项目状态](./PROJECT_STATUS.md)
- [架构升级](./ARCHITECTURE_UPGRADE.md)
- [技术路线图](./TECH_ROADMAP.md)
- [Ollama 指南](./OLLAMA_GUIDE.md)
- [Logo 上传指南](./LOGO_UPLOAD_GUIDE.md)

---

## 🎯 下一步

1. ✅ 完成快速启动
2. 📖 阅读 [PROJECT_STATUS.md](./PROJECT_STATUS.md) 了解项目全貌
3. 🤖 阅读 [OLLAMA_GUIDE.md](./OLLAMA_GUIDE.md) 配置 AI 助手
4. 🔐 配置 OAuth 登录
5. 🚀 开始开发你的功能

---

## 💡 提示

- 使用 `bun run dev` 启动开发服务器，支持热重载
- 使用 `bun run db:studio` 可视化管理数据库
- 使用 Docker Compose 管理所有基础设施
- 查看 `docker-compose logs -f` 实时监控日志
- Ollama 首次启动需要下载模型，可能需要几分钟

---

## 🆘 需要帮助？

- 查看 [故障排查](#-故障排查) 部分
- 查看项目文档
- 查看 Docker 日志
- 检查环境变量配置

---

**祝你开发愉快！** 🎉
