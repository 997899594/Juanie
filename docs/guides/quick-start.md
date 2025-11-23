# 快速开始

## 本地开发（5 分钟）

```bash
# 1. 安装依赖
bun install

# 2. 启动数据库和 Redis
docker compose up -d postgres dragonfly

# 3. 运行数据库迁移
bun run db:push

# 4. 启动开发服务器
bun run dev
```

访问 http://localhost:5173

## 环境变量

复制 `.env.example` 到 `.env`，配置：

```env
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_secret
```

## 常用命令

```bash
bun run dev          # 启动所有服务
bun run build        # 构建生产版本
bun run db:studio    # 打开数据库管理界面
bun test             # 运行测试
```

详细文档见 [开发指南](./development.md)
