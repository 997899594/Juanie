# 环境变量管理

本文档说明 Juanie Monorepo 中的环境变量管理策略。

## 架构

我们使用 **Turborepo 的 globalEnv** 功能来管理环境变量：

```
Juanie/
├── .env.local              # 统一的环境变量文件（根目录）
├── .env.example            # 环境变量模板
├── turbo.json              # 配置 globalEnv
├── apps/
│   ├── api-gateway/        # 不需要单独的 .env
│   └── web/                # 不需要单独的 .env
└── packages/
    └── services/           # 不需要 .env（它们是库）
```

## 设置环境变量

### 1. 创建 .env.local

在**项目根目录**创建 `.env.local` 文件：

```bash
cp .env.example .env.local
```

### 2. 编辑配置

```env
# 环境
NODE_ENV=development

# 服务器
PORT=3001

# 数据库
DATABASE_URL=postgresql://user:password@localhost:5432/juanie

# Redis
REDIS_URL=redis://localhost:6379

# CORS
CORS_ORIGIN=http://localhost:5173

# OAuth
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
```

### 3. 运行应用

环境变量会自动传递给所有 Turborepo 任务：

```bash
turbo dev
# 或
turbo dev --filter="@juanie/api-gateway"
```

## 工作原理

### Turborepo globalEnv

在 `turbo.json` 中配置：

```json
{
  "globalEnv": [
    "NODE_ENV",
    "PORT",
    "DATABASE_URL",
    "REDIS_URL",
    "CORS_ORIGIN",
    "VITE_*"
  ]
}
```

Turborepo 会：
1. 从根目录的 `.env.local` 读取这些变量
2. 自动传递给所有任务（dev、build、test 等）
3. 在缓存键中包含这些变量（环境变化会触发重新构建）

### 应用访问

在应用代码中正常访问：

```typescript
// apps/api-gateway/src/main.ts
const port = process.env.PORT || 3001
const dbUrl = process.env.DATABASE_URL
```

## 环境变量列表

### 通用

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `NODE_ENV` | 运行环境 | `development` | ✅ |
| `PORT` | API 端口 | `3001` | ❌ |

### 数据库

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `DATABASE_URL` | PostgreSQL 连接字符串 | - | ✅ |
| `REDIS_URL` | Redis 连接字符串 | - | ❌ |

### 安全

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `CORS_ORIGIN` | CORS 允许的源 | `http://localhost:5173` | ❌ |

### OAuth

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID | - | ❌ |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Secret | - | ❌ |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | - | ❌ |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | - | ❌ |

### 前端（VITE_* 前缀）

| 变量 | 说明 | 默认值 | 必需 |
|------|------|--------|------|
| `VITE_API_URL` | API 地址 | `http://localhost:3001` | ❌ |

## 不同环境

### 开发环境

使用 `.env.local`（已在 .gitignore 中）：

```bash
NODE_ENV=development
DATABASE_URL=postgresql://localhost:5432/juanie_dev
```

### 测试环境

创建 `.env.test.local`：

```bash
NODE_ENV=test
DATABASE_URL=postgresql://localhost:5432/juanie_test
```

运行测试时指定：

```bash
NODE_ENV=test turbo test
```

### 生产环境

在部署平台（如 Vercel、Railway）设置环境变量，不要提交 `.env.production`。

## 最佳实践

### ✅ 推荐

- 在根目录维护一个 `.env.local` 文件
- 使用 `.env.example` 作为模板
- 敏感信息不要提交到 Git
- 在 `turbo.json` 的 `globalEnv` 中声明所有环境变量

### ❌ 避免

- 不要在每个应用/包中创建单独的 .env 文件
- 不要在代码中硬编码配置
- 不要提交 `.env.local` 到 Git
- 不要在 `globalEnv` 中遗漏环境变量（会导致缓存问题）

## 服务包不需要 .env

服务包（`packages/services/*`）是库，不是独立应用：

```
packages/services/auth/     # 不需要 .env
packages/services/projects/ # 不需要 .env
```

它们：
- 被 API Gateway 导入
- 在 API Gateway 的进程中运行
- 使用 API Gateway 的环境变量
- 通过依赖注入获取配置

## 故障排查

### 环境变量未生效

1. 确认 `.env.local` 在**根目录**
2. 确认变量在 `turbo.json` 的 `globalEnv` 中声明
3. 重启开发服务器
4. 清除 Turborepo 缓存：`rm -rf .turbo`

### 缓存问题

如果修改环境变量后缓存未失效：

```bash
# 清除缓存
rm -rf .turbo

# 重新构建
turbo build --force
```

### 变量未传递给子进程

确保在 `turbo.json` 中声明：

```json
{
  "globalEnv": ["YOUR_VAR"]
}
```

## 相关文档

- [Turborepo Environment Variables](https://turbo.build/repo/docs/core-concepts/caching#environment-variables)
- [开发环境设置](../apps/api/docs/development/SETUP.md)
