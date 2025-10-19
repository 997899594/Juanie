# Modern API with Hono + tRPC + Drizzle + Valibot

一个使用最新技术栈构建的现代化 API 服务。

## 🚀 技术栈

- **[Hono](https://hono.dev/)** - 快速、轻量的 Web 框架
- **[tRPC](https://trpc.io/)** - 端到端类型安全的 API
- **[Drizzle ORM](https://orm.drizzle.team/)** - 现代化的 TypeScript ORM
- **[Valibot](https://valibot.dev/)** - 轻量级的模式验证库
- **[Bun](https://bun.sh/)** - 快速的 JavaScript 运行时

## 📦 特性

- ✅ 完全的类型安全（从数据库到前端）
- ✅ 自动生成的 API 模式
- ✅ 热重载开发体验
- ✅ 现代化的中间件（安全、压缩、CORS）
- ✅ 结构化日志
- ✅ 数据库迁移和种子
- ✅ 开发工具脚本

## 🛠️ 开发设置

### 1. 安装依赖

```bash
bun install
```

### 2. 环境配置

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，设置数据库连接等配置
```

### 3. 数据库设置

```bash
# 设置数据库（生成迁移并运行）
bun run db:setup

# 或者设置数据库并添加种子数据
bun run db:setup:seed
```

### 4. 启动开发服务器

```bash
bun run dev
```

服务器将在 `http://localhost:3001` 启动。

## 📚 API 端点

### 健康检查
- `GET /health` - 服务器健康状态

### tRPC API
- `POST /trpc/users.list` - 获取用户列表
- `POST /trpc/users.byId` - 根据 ID 获取用户
- `POST /trpc/users.create` - 创建新用户
- `POST /trpc/users.update` - 更新用户
- `POST /trpc/users.delete` - 删除用户

## 🗄️ 数据库操作

```bash
# 生成迁移文件
bun run db:generate

# 运行迁移
bun run db:migrate

# 推送模式到数据库（开发环境）
bun run db:push

# 打开 Drizzle Studio
bun run db:studio

# 运行种子数据
bun run db:seed
```

## 🏗️ 项目结构