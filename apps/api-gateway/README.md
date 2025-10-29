# API Gateway

API Gateway 聚合所有服务的 tRPC 路由，提供统一的 API 入口。

## 功能

- 🔌 tRPC 路由聚合
- 🔐 统一的认证和授权
- 📊 健康检查端点
- 🚀 基于 Fastify 的高性能

## 开发

```bash
# 安装依赖
bun install

# 开发模式
bun run dev

# 构建
bun run build

# 生产模式
bun run start
```

## 端点

- `GET /health` - 健康检查
- `POST /trpc/*` - tRPC 端点

## 环境变量

API Gateway 使用**根目录**的环境变量文件，通过 Turborepo 的 `globalEnv` 自动传递。

### 设置环境变量

在**项目根目录**创建 `.env.local` 文件：

```bash
# 在项目根目录
cp .env.example .env.local
```

编辑 `.env.local` 设置你的配置。

### 为什么在根目录？

- ✅ 所有应用共享相同的配置（API Gateway、Web）
- ✅ 只需要维护一个 .env 文件
- ✅ Turborepo 自动传递给所有任务
- ✅ 服务包（`packages/services/*`）自动继承配置

### 环境变量列表

参考根目录的 `.env.example` 文件查看所有可用的环境变量。

## 添加新服务

1. 在 `packages/services/` 创建服务包
2. 在服务包中导出 tRPC router
3. 在 `src/trpc/trpc.router.ts` 中导入并添加到 `appRouter`

示例：

```typescript
import { authRouter } from '@juanie/service-auth'

export class TrpcRouter {
  get appRouter() {
    return this.trpc.router({
      health: this.trpc.procedure.query(() => ({ status: 'ok' })),
      auth: authRouter,  // 添加服务路由
    })
  }
}
```
