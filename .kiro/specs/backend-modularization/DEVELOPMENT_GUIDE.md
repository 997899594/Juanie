# 开发指南

> **最后更新**: 2024-10-31  
> **适用范围**: Juanie 模块化 Monorepo

## 快速开始

### 环境要求

- **Bun**: >= 1.0.0
- **Node.js**: >= 22.0.0
- **PostgreSQL**: 17+
- **Redis**: 7+ (或 Dragonfly)

### 安装依赖

```bash
# 克隆仓库
git clone <repository-url>
cd Juanie

# 安装依赖
bun install

# 构建所有包
turbo build
```

### 启动开发环境

```bash
# 启动数据库（Docker Compose）
docker-compose up -d postgres redis

# 运行数据库迁移
cd apps/api-gateway
bun run db:push

# 启动 API Gateway
bun run dev

# 在另一个终端启动前端
cd apps/web
bun run dev
```

---

## 项目结构

```
Juanie/
├── apps/
│   ├── api-gateway/      # API 网关
│   └── web/              # 前端应用
├── packages/
│   ├── core/             # 核心包
│   ├── services/         # 服务包（18个）
│   ├── config/           # 配置包
│   ├── shared/           # 共享代码
│   └── ui/               # UI 组件
```

---

## 开发工作流

### 创建新的服务包

1. **创建包结构**


```bash
mkdir -p packages/services/my-service/src
mkdir -p packages/services/my-service/test
```

2. **创建 package.json**

```json
{
  "name": "@juanie/service-my-service",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "@juanie/core-database": "workspace:*",
    "@juanie/core-types": "workspace:*",
    "@juanie/core-utils": "workspace:*",
    "@juanie/core-tokens": "workspace:*",
    "@nestjs/common": "^11.1.7"
  },
  "devDependencies": {
    "@juanie/config-typescript": "workspace:*",
    "@juanie/config-vitest": "workspace:*",
    "typescript": "^5.9.3",
    "vitest": "^4.0.4"
  }
}
```

3. **创建 tsconfig.json**

```json
{
  "extends": "@juanie/config-typescript/node.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "test"]
}
```

4. **创建 Service**

```typescript
// src/my-service.service.ts
import { Inject, Injectable } from '@nestjs/common'
import { DATABASE } from '@juanie/core-tokens'
import { Trace } from '@juanie/core-observability'
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js'
import * as schema from '@juanie/core-database/schemas'

@Injectable()
export class MyService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  ) {}

  @Trace('my-service.findAll')
  async findAll() {
    return await this.db.query.myTable.findMany()
  }
}
```

5. **创建 Module**

```typescript
// src/my-service.module.ts
import { Module } from '@nestjs/common'
import { MyService } from './my-service.service'

@Module({
  providers: [MyService],
  exports: [MyService],
})
export class MyServiceModule {}
```

6. **创建 index.ts**

```typescript
// src/index.ts
export * from './my-service.service'
export * from './my-service.module'
```

7. **在 API Gateway 中集成**

```typescript
// apps/api-gateway/src/routers/my-service.router.ts
import { Injectable } from '@nestjs/common'
import { MyService } from '@juanie/service-my-service'
import { TrpcService } from '../trpc/trpc.service'
import { z } from 'zod'

@Injectable()
export class MyServiceRouter {
  constructor(
    private readonly trpc: TrpcService,
    private readonly myService: MyService,
  ) {}

  get router() {
    return this.trpc.router({
      findAll: this.trpc.procedure.query(async () => {
        return await this.myService.findAll()
      }),
    })
  }
}
```

8. **注册到 AppModule**

```typescript
// apps/api-gateway/src/app.module.ts
import { MyServiceModule } from '@juanie/service-my-service'

@Module({
  imports: [
    // ...
    MyServiceModule,
  ],
})
export class AppModule {}
```

9. **添加到路由聚合器**

```typescript
// apps/api-gateway/src/trpc/trpc.router.ts
import { MyServiceRouter } from '../routers/my-service.router'

@Injectable()
export class TrpcRouter {
  constructor(
    // ...
    private readonly myServiceRouter: MyServiceRouter,
  ) {}

  get appRouter() {
    return this.trpc.router({
      // ...
      myService: this.myServiceRouter.router,
    })
  }
}
```

### 运行测试

```bash
# 运行所有测试
turbo test

# 运行特定包的测试
turbo test --filter=@juanie/service-auth

# 运行测试并生成覆盖率
turbo test -- --coverage

# 监听模式
turbo test:watch --filter=@juanie/service-auth
```

### 构建

```bash
# 构建所有包
turbo build

# 构建特定包
turbo build --filter=@juanie/service-auth

# 增量构建（只构建变更的包）
turbo build --filter='[HEAD^1]'
```

### 类型检查

```bash
# 检查所有包
turbo type-check

# 检查特定包
turbo type-check --filter=@juanie/service-auth
```

### Lint 和格式化

```bash
# Lint
turbo lint

# 修复 lint 问题
turbo lint:fix

# 格式化代码（Biome）
bun run format
```

---

## 常用命令

### Turborepo 命令

```bash
# 查看任务依赖图
turbo run build --graph

# 清理缓存
turbo run clean

# 查看缓存统计
turbo run build --summarize

# 并行运行任务
turbo run build test --parallel
```

### 数据库命令

```bash
# 生成迁移
cd apps/api-gateway
bun run db:generate

# 运行迁移
bun run db:migrate

# 推送 schema（开发环境）
bun run db:push

# 打开 Drizzle Studio
bun run db:studio
```

### Docker 命令

```bash
# 启动所有服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止所有服务
docker-compose down

# 重建镜像
docker-compose build --no-cache
```

---

## 调试

### VS Code 调试配置

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug API Gateway",
      "runtimeExecutable": "bun",
      "runtimeArgs": ["--inspect-wait", "run", "dev"],
      "cwd": "${workspaceFolder}/apps/api-gateway",
      "console": "integratedTerminal"
    }
  ]
}
```

### 日志

```typescript
// 使用 NestJS Logger
import { Logger } from '@nestjs/common'

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name)

  async someMethod() {
    this.logger.log('Processing...')
    this.logger.debug('Debug info')
    this.logger.error('Error occurred', error.stack)
  }
}
```

### OpenTelemetry 追踪

```bash
# 查看追踪数据
# 访问 Jaeger UI: http://localhost:16686
```

---

## 最佳实践

### 1. 代码组织

- 每个服务包只包含业务逻辑
- 路由定义在 API Gateway 中
- 类型定义在 core/types 中
- 工具函数在 core/utils 中

### 2. 命名规范

- 包名：`@juanie/service-{name}`
- 文件名：`{name}.service.ts`, `{name}.module.ts`
- 类名：`{Name}Service`, `{Name}Module`
- Trace span：`{service}.{method}`

### 3. 依赖管理

- 使用 `workspace:*` 管理内部依赖
- 避免循环依赖
- 明确声明所有依赖

### 4. 测试

- 单元测试覆盖率 > 80%
- 为所有公共方法编写测试
- 使用 Mock 隔离外部依赖

### 5. 类型安全

- 启用 TypeScript strict mode
- 避免使用 `any`
- 使用 Zod 进行运行时验证

### 6. 性能

- 使用 @Trace 装饰器追踪关键方法
- 避免 N+1 查询
- 使用 Redis 缓存热数据

---

## 故障排查

### 问题 1: 模块找不到

**症状**:
```
Cannot find module '@juanie/core-types'
```

**解决方案**:
1. 确保包已构建：`turbo build --filter=@juanie/core-types`
2. 检查 package.json 中是否声明依赖
3. 运行 `bun install`

### 问题 2: 装饰器不工作

**症状**:
```
Unable to resolve signature of class decorator
```

**解决方案**:
在 tsconfig.json 中添加：
```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  }
}
```

### 问题 3: 类型错误

**症状**:
```
Type 'X' is not assignable to type 'Y'
```

**解决方案**:
1. 运行 `turbo type-check` 查看详细错误
2. 确保所有依赖包已构建
3. 检查类型定义是否正确

### 问题 4: 测试失败

**症状**:
测试运行失败或超时

**解决方案**:
1. 检查测试环境变量
2. 确保测试数据库可访问
3. 增加测试超时时间
4. 检查 Mock 配置

### 问题 5: 构建缓存问题

**症状**:
构建结果不正确或过时

**解决方案**:
```bash
# 清理缓存
turbo run clean
rm -rf .turbo

# 重新构建
turbo build --force
```

### 问题 6: 数据库连接失败

**症状**:
```
Error: connect ECONNREFUSED
```

**解决方案**:
1. 检查 Docker 容器是否运行：`docker-compose ps`
2. 检查环境变量：`DATABASE_URL`
3. 检查数据库日志：`docker-compose logs postgres`

### 问题 7: 端口被占用

**症状**:
```
Error: listen EADDRINUSE: address already in use
```

**解决方案**:
```bash
# 查找占用端口的进程
lsof -i :3001

# 杀死进程
kill -9 <PID>

# 或者更改端口
PORT=3002 bun run dev
```

### 问题 8: 内存不足

**症状**:
```
JavaScript heap out of memory
```

**解决方案**:
```bash
# 增加 Node.js 内存限制
NODE_OPTIONS="--max-old-space-size=4096" turbo build
```

---

## 性能优化

### 1. 构建优化

- 使用 Turborepo 缓存
- 增量构建：`--filter='[HEAD^1]'`
- 并行构建：`--parallel`

### 2. 测试优化

- 并行运行测试
- 使用测试数据库
- Mock 外部服务

### 3. 数据库优化

- 添加索引
- 使用连接池
- 避免 N+1 查询
- 使用 Redis 缓存

### 4. API 优化

- 使用 DataLoader 批量查询
- 实现分页
- 压缩响应
- 使用 CDN

---

## 安全

### 1. 环境变量

- 不要提交 `.env` 文件
- 使用 `.env.example` 作为模板
- 在生产环境使用密钥管理服务

### 2. 依赖安全

```bash
# 检查依赖漏洞
bun audit

# 更新依赖
bun update
```

### 3. 代码安全

- 使用参数化查询（Drizzle 自动处理）
- 验证所有输入（使用 Zod）
- 实现速率限制
- 使用 HTTPS

---

## 部署

### 开发环境

```bash
# 使用 Docker Compose
docker-compose up -d
```

### 生产环境

```bash
# 构建生产镜像
docker build -t juanie-api-gateway -f apps/api-gateway/Dockerfile .

# 运行容器
docker run -p 3001:3001 \
  -e DATABASE_URL=$DATABASE_URL \
  -e REDIS_URL=$REDIS_URL \
  juanie-api-gateway
```

### CI/CD

- GitHub Actions 自动部署到生产环境
- GitLab CI 支持多环境部署
- 使用 Turborepo 缓存加速构建

---

## 监控

### 1. 日志

- 使用 NestJS Logger
- 集成 Loki 收集日志
- 在 Grafana 中查看日志

### 2. 追踪

- OpenTelemetry 自动追踪
- 使用 @Trace 装饰器
- 在 Jaeger 中查看追踪

### 3. 指标

- Prometheus 收集指标
- Grafana 可视化
- 设置告警规则

---

## 资源

### 文档

- [架构文档](../../ARCHITECTURE_ANALYSIS.md)
- [迁移指南](./MIGRATION_GUIDE.md)
- [需求文档](./requirements.md)
- [设计文档](./design.md)

### 工具

- [Turborepo](https://turbo.build/repo)
- [Bun](https://bun.sh)
- [NestJS](https://nestjs.com)
- [tRPC](https://trpc.io)
- [Drizzle ORM](https://orm.drizzle.team)

### 社区

- GitHub Issues
- 团队 Slack 频道
- 技术分享会

---

**维护者**: Backend Team  
**最后更新**: 2024-10-31
