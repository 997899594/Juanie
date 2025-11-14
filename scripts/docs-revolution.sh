#!/bin/bash

# 文档革命执行脚本
# 自动清理和重组文档结构

set -e

echo "🚀 开始文档革命..."
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. 替换核心文档
echo "📝 Step 1: 替换核心文档..."
mv README.md README.old.md
mv README.new.md README.md
echo -e "${GREEN}✓${NC} 核心文档已更新"

# 2. 删除过时目录
echo ""
echo "🗑️  Step 2: 删除过时目录..."
rm -rf docs/archive/
rm -rf docs/implementation/
rm -rf docs/analysis/
rm -rf docs/examples/
rm -rf docs/getting-started/
echo -e "${GREEN}✓${NC} 过时目录已删除"

# 3. 删除重复文档
echo ""
echo "🗑️  Step 3: 删除重复文档..."
rm -f docs/CLEANUP_PLAN.md
rm -f docs/COMPLETE_USER_FLOW.md
rm -f docs/CONFIG_SUMMARY.md
rm -f docs/CONFIGURATION.md
rm -f docs/DOCKER_ENV_SHARING.md
rm -f docs/ENVIRONMENT_VARIABLES.md
rm -f docs/FLOW_EVALUATION.md
rm -f docs/NEXT_STEPS.md
rm -f docs/ONBOARDING_IMPLEMENTATION.md
rm -f docs/PACKAGE_DEVELOPMENT.md
rm -f docs/REAL_WORLD_TEST_CASE.md
rm -f docs/SHADCN_BEST_PRACTICE.md
echo -e "${GREEN}✓${NC} 重复文档已删除"

# 4. 删除临时修复文档
echo ""
echo "🗑️  Step 4: 删除临时文档..."
rm -f REPOSITORY_SYNC_FIXED.md
rm -f FIX_CREATE_REPOSITORY.md
rm -f docs/troubleshooting/REPOSITORY_SYNC_FIX.md
echo -e "${GREEN}✓${NC} 临时文档已删除"

# 5. 创建新的 docs 结构
echo ""
echo "📁 Step 5: 创建新文档结构..."
mkdir -p docs/api

# 创建 docs/README.md
cat > docs/README.md << 'EOF'
# Documentation

## 快速导航

- **[系统架构](./architecture.md)** - 架构设计和技术决策
- **[开发指南](./development.md)** - 开发工作流和最佳实践
- **[API 参考](./api/)** - API 文档（自动生成）

## 其他资源

- **[贡献指南](../CONTRIBUTING.md)** - 如何贡献代码
- **[部署指南](../DEPLOYMENT.md)** - 生产环境部署
- **[项目 README](../README.md)** - 项目概览和快速开始

## 包文档

每个服务包都有自己的 README：

- [projects](../packages/services/projects/README.md) - 项目管理服务
- [git-providers](../packages/services/git-providers/README.md) - Git 提供商服务
- [flux](../packages/services/flux/README.md) - Flux CD 集成
- [repositories](../packages/services/repositories/README.md) - 仓库管理
- [environments](../packages/services/environments/README.md) - 环境管理

## 文档维护

- 代码变更时同步更新文档
- 使用 JSDoc/TSDoc 注释
- 保持文档简洁和最新
- 每个信息只在一处维护

详见 [CONTRIBUTING.md](../CONTRIBUTING.md#文档)
EOF

# 创建 docs/architecture.md
cat > docs/architecture.md << 'EOF'
# System Architecture

## 概览

AI DevOps Platform 采用微服务架构，基于 NestJS + tRPC 构建。

```
┌─────────────┐
│   Web App   │ (Vue 3)
└──────┬──────┘
       │ tRPC
┌──────▼──────────┐
│  API Gateway    │ (NestJS + tRPC)
└──────┬──────────┘
       │
   ┌───┴────┬────────┬────────┐
   │        │        │        │
┌──▼──┐ ┌──▼──┐ ┌──▼──┐ ┌──▼──┐
│Proj │ │Env  │ │Repo │ │Flux │ (Services)
└──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘
   │       │       │       │
   └───────┴───────┴───────┘
           │
      ┌────▼────┐
      │Database │ (PostgreSQL)
      └─────────┘
```

## 技术栈

### 后端
- **框架**: NestJS 11
- **API**: tRPC (类型安全的 RPC)
- **数据库**: PostgreSQL 15 + Drizzle ORM
- **缓存**: Redis 7
- **队列**: BullMQ
- **容器**: Docker + K3s

### 前端
- **框架**: Vue 3 + Vite
- **状态**: Pinia
- **UI**: shadcn-vue
- **路由**: Vue Router
- **类型**: TypeScript + tRPC Client

## 服务划分

### Core Services
- **projects** - 项目管理和编排
- **environments** - 环境管理
- **repositories** - 仓库管理
- **deployments** - 部署管理

### Integration Services
- **flux** - Flux CD 集成
- **git-providers** - GitHub/GitLab API
- **k3s** - Kubernetes 集成

### Support Services
- **auth** - 认证和授权
- **audit-logs** - 审计日志
- **notifications** - 通知服务
- **cost-tracking** - 成本追踪

## 数据流

### 项目创建流程

```
User → Web → API Gateway → ProjectsService
                              ↓
                         ProjectOrchestrator
                              ↓
        ┌─────────────────────┼─────────────────────┐
        ↓                     ↓                     ↓
  Environments          Repositories            Flux
        ↓                     ↓                     ↓
    Database              Database              K8s
```

### 部署流程

```
User → Trigger Deploy → DeploymentsService
                              ↓
                         FluxService
                              ↓
                    Create/Update GitOps Resources
                              ↓
                         Flux CD (K8s)
                              ↓
                         Apply Manifests
```

## 技术决策

### 为什么选择 tRPC？
- 端到端类型安全
- 无需手写 API 文档
- 自动生成客户端
- 优秀的开发体验

### 为什么选择 Drizzle ORM？
- TypeScript 原生
- 类型安全的查询
- 零运行时开销
- 简单的迁移管理

### 为什么选择 BullMQ？
- Redis 支持
- 可靠的任务队列
- 支持延迟和重试
- 良好的监控

## 扩展性

### 水平扩展
- API Gateway 可以多实例部署
- 服务间通过 Redis 共享状态
- 数据库使用连接池

### 垂直扩展
- 增加服务器资源
- 优化数据库查询
- 使用缓存减少负载

## 安全性

- JWT 认证
- RBAC 权限控制
- OAuth 集成
- 审计日志
- 数据加密

详见 [DEPLOYMENT.md](../DEPLOYMENT.md#安全配置)
EOF

# 创建 docs/development.md
cat > docs/development.md << 'EOF'
# Development Guide

## 开发环境

详见 [CONTRIBUTING.md](../CONTRIBUTING.md#开发环境设置)

## 项目结构

```
apps/
  api-gateway/          # API 网关
    src/
      routers/          # tRPC 路由
      middleware/       # 中间件
  web/                  # Web 前端
    src/
      views/            # 页面
      components/       # 组件
      composables/      # 组合式函数

packages/
  core/                 # 核心包
    database/           # 数据库 Schema
    types/              # 类型定义
    queue/              # 消息队列
  services/             # 业务服务
    projects/           # 项目服务
    environments/       # 环境服务
    ...
```

## 开发工作流

### 1. 创建功能分支

```bash
git checkout -b feature/my-feature
```

### 2. 开发

```bash
# 启动开发服务器
bun run dev

# 运行测试
bun test --watch
```

### 3. 提交

```bash
git add .
git commit -m "feat: add my feature"
```

详见 [CONTRIBUTING.md](../CONTRIBUTING.md#提交流程)

## 常见任务

### 添加新服务

1. 创建服务目录
2. 添加 package.json 和 tsconfig.json
3. 实现服务逻辑
4. 添加测试
5. 创建 README.md

详见 [CONTRIBUTING.md](../CONTRIBUTING.md#包开发)

### 数据库变更

```bash
# 1. 修改 schema
vim packages/core/database/src/schemas/my-table.schema.ts

# 2. 生成迁移
bun run db:generate

# 3. 应用迁移
bun run db:push
```

### 添加 API 端点

```typescript
// apps/api-gateway/src/routers/my.router.ts
export const myRouter = router({
  list: publicProcedure
    .query(async () => {
      return await myService.list()
    }),
})
```

## 调试

### 后端调试

```bash
# 启动调试模式
bun run dev:debug

# 或使用 VS Code
# 按 F5 启动调试
```

### 前端调试

```bash
# 使用 Vue DevTools
# Chrome 扩展: Vue.js devtools
```

### 数据库调试

```bash
# 打开 Drizzle Studio
bun run db:studio

# 或直接连接
psql postgresql://user:password@localhost:5432/devops
```

## 测试

### 单元测试

```typescript
import { describe, it, expect } from 'vitest'

describe('MyService', () => {
  it('should work', () => {
    expect(true).toBe(true)
  })
})
```

### 集成测试

```typescript
import { createTestContext } from '@juanie/test-utils'

describe('API Integration', () => {
  const ctx = createTestContext()
  
  it('should create project', async () => {
    const project = await ctx.client.projects.create.mutate({
      name: 'Test'
    })
    expect(project.id).toBeDefined()
  })
})
```

## 故障排查

### 常见问题

**1. 端口被占用**
```bash
# 查找占用端口的进程
lsof -i :3000
kill -9 <PID>
```

**2. 数据库连接失败**
```bash
# 检查数据库状态
docker-compose ps postgres

# 重启数据库
docker-compose restart postgres
```

**3. 类型错误**
```bash
# 重新构建类型
bun run build

# 清理缓存
rm -rf node_modules/.cache
```

**4. 依赖问题**
```bash
# 重新安装
rm -rf node_modules
bun install
```

## 最佳实践

### 代码组织
- 单一职责原则
- 依赖注入
- 接口隔离

### 错误处理
- 使用自定义错误类
- 提供有意义的错误信息
- 记录错误日志

### 性能优化
- 使用缓存
- 数据库索引
- 懒加载

### 安全
- 输入验证
- SQL 注入防护
- XSS 防护

详见 [CONTRIBUTING.md](../CONTRIBUTING.md#代码规范)

## 工具

### 推荐 VS Code 扩展
- Vue Language Features (Volar)
- TypeScript Vue Plugin (Volar)
- Biome
- Drizzle ORM

### 推荐 Chrome 扩展
- Vue.js devtools
- React Developer Tools (for tRPC DevTools)

## 资源

- [NestJS 文档](https://docs.nestjs.com/)
- [tRPC 文档](https://trpc.io/)
- [Vue 3 文档](https://vuejs.org/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)
EOF

echo -e "${GREEN}✓${NC} 新文档结构已创建"

# 6. 统计
echo ""
echo "📊 文档革命完成！"
echo ""
echo "统计："
echo "  - 删除目录: 5 个"
echo "  - 删除文件: 15+ 个"
echo "  - 创建文件: 5 个"
echo ""
echo "新结构："
echo "  /"
echo "  ├── README.md           (项目入口)"
echo "  ├── CONTRIBUTING.md     (开发指南)"
echo "  ├── DEPLOYMENT.md       (部署指南)"
echo "  └── docs/"
echo "      ├── README.md       (文档索引)"
echo "      ├── architecture.md (系统架构)"
echo "      ├── development.md  (开发文档)"
echo "      └── api/            (API 参考)"
echo ""
echo -e "${GREEN}✅ 文档革命成功！${NC}"
echo ""
echo "下一步："
echo "  1. 查看新的 README.md"
echo "  2. 为主要服务创建 README"
echo "  3. 设置文档自动化"
echo ""
