# 快速启动指南

**更新日期**: 2025-12-25  
**状态**: ✅ 可用

## 🚀 快速启动

### 1. 安装依赖

```bash
bun install
```

### 2. 配置环境变量

复制 `.env.example` 到 `.env`：

```bash
cp .env.example .env
```

**必需的环境变量**:

```bash
# Redis（必需）
REDIS_URL=redis://localhost:6379

# 数据库（可选，默认使用 PostgreSQL 本地连接）
# DATABASE_URL=postgresql://user:password@localhost:5432/juanie

# CORS（开发环境）
CORS_ORIGIN=http://localhost:5173

# MinIO（对象存储）
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=admin123456
```

### 3. 启动依赖服务

**使用 Docker Compose**:

```bash
docker-compose up -d
```

这将启动：
- PostgreSQL（端口 5432）
- Redis（端口 6379）
- MinIO（端口 9000, 9001）

### 4. 应用数据库迁移

```bash
bun run db:push
```

### 5. 启动开发服务器

**启动完整开发环境**:

```bash
bun run dev
```

这将启动：
- API Gateway（端口 3000）
- Web 前端（端口 5173）

**或者分别启动**:

```bash
# 只启动后端
bun run dev:api

# 只启动前端
bun run dev:web
```

## 📋 验证安装

### 1. 检查 API Gateway

```bash
curl http://localhost:3000/health
```

**预期响应**:
```json
{
  "status": "ok",
  "timestamp": "2025-12-25T..."
}
```

### 2. 检查前端

打开浏览器访问：
```
http://localhost:5173
```

### 3. 检查 MinIO

打开浏览器访问：
```
http://localhost:9001
```

**登录凭据**:
- Username: `admin`
- Password: `admin123456`

## 🔧 常见问题

### 1. 端口被占用

**错误**: `Error: listen EADDRINUSE: address already in use :::3000`

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3000

# 杀死进程
kill -9 <PID>
```

### 2. Redis 连接失败

**错误**: `Error: connect ECONNREFUSED 127.0.0.1:6379`

**解决方案**:
```bash
# 启动 Redis
docker-compose up -d redis

# 或者使用 Homebrew（macOS）
brew services start redis
```

### 3. PostgreSQL 连接失败

**错误**: `Error: connect ECONNREFUSED 127.0.0.1:5432`

**解决方案**:
```bash
# 启动 PostgreSQL
docker-compose up -d postgres

# 或者使用 Homebrew（macOS）
brew services start postgresql@14
```

### 4. MinIO 连接失败

**错误**: `Error: connect ECONNREFUSED 127.0.0.1:9000`

**解决方案**:
```bash
# 启动 MinIO
docker-compose up -d minio
```

### 5. 依赖安装失败

**错误**: `error: script "install" exited with code 1`

**解决方案**:
```bash
# 清理并重新安装
rm -rf node_modules bun.lock
bun install
```

### 6. TypeScript 编译错误

**错误**: `error TS2307: Cannot find module '@juanie/...'`

**解决方案**:
```bash
# 清理 TypeScript 缓存
find . -name "tsconfig.tsbuildinfo" -delete

# 重新安装依赖
bun install
```

## 📚 下一步

### 1. 创建第一个项目

使用 API 或前端界面创建项目：

```bash
curl -X POST http://localhost:3000/trpc/projects.create \
  -H "Content-Type: application/json" \
  -d '{
    "organizationId": "...",
    "name": "My First Project",
    "slug": "my-first-project",
    "visibility": "private"
  }'
```

### 2. 上传项目 Logo

```bash
curl -X POST http://localhost:3000/trpc/projects.uploadLogo \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "...",
    "file": "base64-encoded-image",
    "contentType": "image/png"
  }'
```

### 3. 列出项目

```bash
curl http://localhost:3000/trpc/projects.list?organizationId=...
```

## 🎯 开发工作流

### 1. 代码格式化

```bash
# 格式化所有代码
biome check --write

# 只检查不修改
biome check
```

### 2. 类型检查

```bash
# 检查所有包
bun run tsc --noEmit

# 检查特定包
bun run tsc --noEmit --project packages/services/business/tsconfig.json
```

### 3. 运行测试

```bash
# 运行所有测试
bun test

# 运行特定测试
bun test packages/services/business/src/projects
```

### 4. 数据库操作

```bash
# 应用迁移
bun run db:push

# 生成迁移文件
bun run db:generate

# 查看数据库状态
bun run db:studio
```

## 🔐 安全注意事项

### 1. 生产环境

**不要在生产环境使用默认凭据**:

```bash
# 生成强密码
openssl rand -base64 32

# 更新环境变量
MINIO_ACCESS_KEY=<strong-access-key>
MINIO_SECRET_KEY=<strong-secret-key>
```

### 2. CORS 配置

生产环境需要配置正确的 CORS：

```bash
CORS_ORIGIN=https://your-domain.com
```

### 3. 数据库连接

使用 SSL 连接：

```bash
DATABASE_URL=postgresql://user:password@host:5432/db?sslmode=require
```

## 📖 相关文档

- `docs/guides/monorepo-best-practices.md` - Monorepo 最佳实践
- `docs/architecture/PROJECT-STATUS-2025-12-25.md` - 项目状态报告
- `docs/architecture/PROJECTS-SERVICE-FINAL-PERFECT.md` - ProjectsService 文档
- `.kiro/steering/project-guide.md` - 项目指南

## ✅ 检查清单

启动前确保：

- [ ] 依赖已安装（`bun install`）
- [ ] 环境变量已配置（`.env`）
- [ ] Redis 已启动
- [ ] PostgreSQL 已启动
- [ ] MinIO 已启动
- [ ] 数据库迁移已应用（`bun run db:push`）
- [ ] TypeScript 编译无错误（`bun run tsc --noEmit`）

启动后验证：

- [ ] API Gateway 响应正常（`curl http://localhost:3000/health`）
- [ ] 前端可访问（`http://localhost:5173`）
- [ ] MinIO 可访问（`http://localhost:9001`）
- [ ] 可以创建项目
- [ ] 可以上传 Logo

🎉 **准备就绪，开始开发！**
