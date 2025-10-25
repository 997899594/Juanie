# 后端技术架构与开发规范

基于 NestJS + tRPC + Drizzle ORM 的现代化后端架构，实现端到端类型安全的企业级应用开发。

## 技术栈（2025年底现代化版本）

### 核心框架
- **Node.js**: `>=22.0.0` (LTS)
- **Bun**: `1.1.38` (运行时 + 包管理器)
- **TypeScript**: `^5.7.2`
- **NestJS**: `^11.1.7`
- **tRPC**: `^11.6.0`

### 数据层
- **PostgreSQL**: `16+`
- **Drizzle ORM**: `^0.44.7`
- **Drizzle Kit**: `^0.21.0`
- **数据库客户端**: 支持多种客户端
  - `postgres.js`: `^3.4.7` (推荐，现代化高性能)
  <!-- - `@neondatabase/serverless`: `^1.0.2` (Serverless环境)
  - 传统 `pg` 客户端也兼容 -->

### 验证与类型
- **Zod**: `^4.1.12`
- **class-validator**: `^0.14.2`
- **class-transformer**: `^0.5.1`

### 现代化工具
- **Effect**: `^3.18.4` (函数式编程)
- **Arctic**: `^3.7.0` (OAuth认证)
- **Oslo**: `^1.2.1` (加密工具)
- **Nanoid**: `^5.1.6` (ID生成)
- **Radash**: `^12.1.1` (工具函数)

## 项目结构

```
apps/api-ai/
├── src/
│   ├── app.module.ts              # 根模块
│   ├── main.ts                    # 应用入口
│   ├── trpc/                      # tRPC配置
│   │   ├── trpc.module.ts
│   │   ├── trpc.router.ts
│   │   └── trpc.service.ts
│   ├── database/                  # 数据库层
│   │   ├── schemas/               # Drizzle schemas (33个业务模块)
│   │   ├── migrations/            # 数据库迁移
│   │   └── client.ts              # 数据库连接
│   ├── modules/                   # 业务模块
│   │   ├── users/
│   │   ├── organizations/
│   │   ├── projects/
│   │   └── ...
│   ├── common/                    # 公共组件
│   │   ├── decorators/
│   │   ├── guards/
│   │   ├── interceptors/
│   │   └── pipes/
│   └── types/                     # 类型定义
├── docs/                          # 文档
├── drizzle.config.ts             # Drizzle配置
├── nest-cli.json                 # NestJS CLI配置
└── package.json
```

## 架构设计原则

### 1. 端到端类型安全
```typescript
// Schema定义 (Drizzle + Zod)
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
});

export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export type User = z.infer<typeof selectUserSchema>;

// tRPC Router
export const userRouter = router({
  create: publicProcedure
    .input(insertUserSchema)
    .output(selectUserSchema)
    .mutation(async ({ input }) => {
      return await db.insert(users).values(input).returning();
    }),
});

// 前端类型自动推导
const user = await trpc.user.create.mutate({
  email: "user@example.com", // 类型安全
  username: "username"
});
```

### 2. 模块化设计
每个业务模块包含：
- `*.module.ts` - NestJS模块定义
- `*.service.ts` - 业务逻辑层
- `*.router.ts` - tRPC路由定义
- `*.schema.ts` - 数据库Schema
- `*.dto.ts` - 数据传输对象

### 3. 依赖注入与服务层
```typescript
@Injectable()
export class UserService {
  constructor(
    @Inject(PG_CONNECTION) private db: Database,
  ) {}

  async createUser(data: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(data)
      .returning();
    return user;
  }
}
```

### 4. 错误处理规范
```typescript
import { TRPCError } from '@trpc/server';

// 统一错误处理
if (!user) {
  throw new TRPCError({
    code: 'NOT_FOUND',
    message: 'User not found',
  });
}
```

## 数据库集成

### Schema设计规范
- 使用 `pgEnum` 定义枚举类型
- 外键关系使用 `onDelete: 'cascade'`
- 时间戳字段统一使用 `timestamp`
- UUID作为主键，使用 `defaultRandom()`

### 迁移管理
```bash
# 生成迁移
bun run db:generate

# 执行迁移
bun run db:migrate

# 重置数据库
bun run db:reset
```

## 认证授权

### OAuth集成 (Arctic)
```typescript
import { Arctic, GitHub, Google } from 'arctic';

@Injectable()
export class AuthService {
  private github = new GitHub(
    process.env.GITHUB_CLIENT_ID!,
    process.env.GITHUB_CLIENT_SECRET!,
    process.env.GITHUB_REDIRECT_URI
  );

  async getAuthorizationUrl(): Promise<URL> {
    return await this.github.createAuthorizationURL(state, {
      scopes: ['user:email']
    });
  }
}
```

### RBAC权限控制
基于 `roles`、`role-assignments` 表实现细粒度权限控制。

## 开发规范

### 1. 代码风格
- 使用 Biome 进行代码格式化和检查
- 遵循 TypeScript strict 模式
- 函数命名使用动词开头
- 类型定义使用 PascalCase

### 2. 提交规范
```bash
feat: 新功能
fix: 修复bug
docs: 文档更新
style: 代码格式调整
refactor: 代码重构
test: 测试相关
chore: 构建工具或辅助工具的变动
```

### 3. 测试策略
- 单元测试覆盖率 > 80%
- 使用 Vitest 进行测试
- Mock 外部依赖
- 集成测试覆盖关键业务流程

### 4. 性能优化
- 使用 Bun 作为运行时提升性能
- 数据库查询优化和索引设计
- 适当使用缓存 (Redis)
- API响应时间监控

## 部署运维

### 环境配置
```bash
# 开发环境
NODE_ENV=development
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# 生产环境
NODE_ENV=production
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
```

### Docker部署
```dockerfile
FROM oven/bun:1.1.38-alpine

WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

EXPOSE 3000
CMD ["bun", "run", "start:prod"]
```

### 监控告警
- 使用 Pino 进行结构化日志
- 集成 Prometheus + Grafana 监控
- 设置关键指标告警

## 最佳实践

### 1. 类型安全
- 所有API输入输出都要有Zod验证
- 避免使用 `any` 类型
- 利用 TypeScript 的类型推导

### 2. 错误处理
- 使用 Result 模式处理可能失败的操作
- 统一错误码和错误信息
- 记录详细的错误日志

### 3. 数据库操作
- 使用事务处理复杂操作
- 避免 N+1 查询问题
- 合理使用数据库索引

### 4. 安全性
- 输入验证和输出编码
- SQL注入防护
- 敏感信息加密存储
- 定期安全审计

这个架构文档涵盖了所有核心技术要点，为团队提供统一的开发标准和最佳实践指导。