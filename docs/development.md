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
