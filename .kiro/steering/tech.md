# 技术栈

## 构建系统

- **包管理器**: Bun (>=1.0.0)
- **Monorepo 工具**: Turborepo
- **Node 版本**: >=22.0.0

## 后端技术栈

- **框架**: NestJS 11 + Fastify
- **API 层**: tRPC (类型安全的 RPC)
- **数据库**: PostgreSQL 15 + Drizzle ORM
- **缓存**: Redis 7 (通过 ioredis)
- **队列**: BullMQ
- **运行时**: Bun (开发和生产环境)
- **可观测性**: OpenTelemetry (Prometheus + Jaeger/Tempo)

## 前端技术栈

- **框架**: Vue 3 + Composition API
- **构建工具**: Vite 7
- **状态管理**: Pinia (带持久化)
- **UI 组件**: shadcn-vue
- **路由**: Vue Router
- **样式**: Tailwind CSS 4
- **类型安全**: TypeScript + tRPC Client

## 基础设施

- **容器**: Docker
- **编排**: K3s (轻量级 Kubernetes)
- **GitOps**: Flux CD v2.7.3
  - GitHub: Deploy Keys (SSH 认证)
  - GitLab: Project Access Tokens (HTTPS 认证)
  - 动态 SSH known_hosts 管理
- **监控**: Prometheus + Grafana
- **追踪**: Tempo/Jaeger
- **对象存储**: MinIO (S3 兼容)

## 代码质量

- **Linter/格式化**: Biome
- **测试**: Vitest
- **类型检查**: TypeScript 严格模式
- **Git Hooks**: Husky + lint-staged

## 常用命令

### 开发
```bash
bun install                    # 安装依赖
bun run dev                    # 启动所有服务
bun run dev:web                # 只启动 Web 应用
bun run dev:api                # 只启动 API 网关
```

### 数据库
```bash
bun run db:generate            # 生成迁移文件
bun run db:push                # 应用迁移
bun run db:studio              # 打开 Drizzle Studio
```

### 测试和质量检查
```bash
bun test                       # 运行测试
bun test --watch               # 监听模式
bun run type-check             # TypeScript 类型检查
biome check --write            # 代码检查和格式化
```

### 构建
```bash
bun run build                  # 构建所有包
turbo build --filter='@juanie/web'  # 构建特定包
```

### Docker
```bash
bun run docker:up              # 启动核心服务 (postgres, redis 等)
bun run docker:down            # 停止服务
bun run docker:logs            # 查看日志
```

## 环境变量

必需的环境变量:
- `DATABASE_URL`: PostgreSQL 连接字符串
- `REDIS_URL`: Redis 连接字符串（或 Dragonfly）
- `CORS_ORIGIN`: 允许的 CORS 来源
- `VITE_*`: 前端环境变量（带前缀）

K3s 配置:
- `K3S_HOST`: K3s API 服务器地址
- `K3S_TOKEN`: K3s 访问令牌
- `K3S_CA_CERT`: K3s CA 证书（可选）

Git 提供商 (用于自动创建认证):
- `GITHUB_TOKEN`: GitHub Personal Access Token
- `GITLAB_TOKEN`: GitLab Personal Access Token

OAuth (可选):
- `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`

对象存储:
- `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`
