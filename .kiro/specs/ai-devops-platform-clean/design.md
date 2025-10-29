# AI DevOps 平台 - 设计文档

## 概述

本文档描述了基于现有 **NestJS 11 + tRPC 11 + Drizzle + Bun** 技术栈的全新 AI DevOps 平台设计。

### 设计原则

1. **保持现有架构模式**: Module + Router + Service
2. **精简表结构**: 只保留 20 个核心表
3. **JSONB 优先**: 配置、权限、元数据用 JSONB
4. **软删除**: 所有关键表添加 deletedAt
5. **类型安全**: 端到端 TypeScript + Zod 验证

### 技术栈

**后端框架**:
- NestJS 11 (企业级框架)
- Fastify (高性能 HTTP 服务器)
- tRPC 11 (类型安全 API)
- Bun (极速运行时)

**数据层**:
- Drizzle ORM (类型安全 ORM)
- PostgreSQL 16
- Redis 7 (会话 + 缓存)

**认证**:
- Arctic (OAuth 库)
- JWT + Redis Session

**AI**:
- Vercel AI SDK
- OpenAI / Anthropic / Google

## 数据库架构

### 核心表（20 个）

**用户与权限 (5 表)**
1. users
2. oauth_accounts
3. organizations
4. organization_members
5. teams
6. team_members

**项目与资源 (5 表)**
7. projects
8. project_members
9. team_projects
10. repositories
11. environments

**CI/CD (4 表)**
12. pipelines
13. pipeline_runs
14. deployments
15. deployment_approvals

**监控与成本 (3 表)**
16. cost_tracking
17. security_policies
18. incidents

**系统 (3 表)**
19. audit_logs
20. notifications
21. ai_assistants

## 表设计详情


### 1. users (用户表)

```typescript
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  username: text('username').unique(),
  displayName: text('display_name'),
  avatarUrl: text('avatar_url'),
  
  // 偏好设置（JSONB）
  preferences: jsonb('preferences').$type<{
    language: 'en' | 'zh';
    theme: 'light' | 'dark' | 'system';
    notifications: {
      email: boolean;
      inApp: boolean;
    };
  }>().default({ language: 'en', theme: 'system', notifications: { email: true, inApp: true } }),
  
  lastLoginAt: timestamp('last_login_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('users_email_idx').on(table.email),
  index('users_deleted_idx').on(table.deletedAt),
]);
```

### 2. oauth_accounts (OAuth 账号表)

```typescript
export const oauthAccounts = pgTable('oauth_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'github', 'gitlab'
  providerAccountId: text('provider_account_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('oauth_provider_account_unique').on(table.provider, table.providerAccountId),
  index('oauth_user_idx').on(table.userId),
]);
```

### 3. organizations (组织表)

```typescript
export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  displayName: text('display_name'),
  logoUrl: text('logo_url'),
  
  // 配额限制（JSONB）
  quotas: jsonb('quotas').$type<{
    maxProjects: number;
    maxUsers: number;
    maxStorageGb: number;
  }>().default({ maxProjects: 10, maxUsers: 50, maxStorageGb: 100 }),
  
  // 计费信息（JSONB）
  billing: jsonb('billing').$type<{
    plan: 'free' | 'pro' | 'enterprise';
    billingEmail?: string;
  }>(),
  
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  index('orgs_slug_idx').on(table.slug),
  index('orgs_deleted_idx').on(table.deletedAt),
]);
```

### 4-21. 其他表结构

由于篇幅限制，其他表的完整定义请参考 tasks.md 中的实施步骤。所有表都遵循以下原则：

**通用字段**:
- `id`: UUID 主键
- `createdAt`: 创建时间
- `updatedAt`: 更新时间（关键表）
- `deletedAt`: 软删除时间（关键表）

**JSONB 使用场景**:
- 配置信息（config）
- 权限列表（permissions）
- 元数据（metadata）
- 成本分类（costs）
- 模型配置（modelConfig）

## 模块架构

### 模块结构模式

每个模块遵循统一的结构：

```
src/modules/{module-name}/
├── {module-name}.module.ts      # NestJS 模块定义
├── {module-name}.service.ts     # 业务逻辑层
└── {module-name}.router.ts      # tRPC 路由定义
```

### 示例：Organizations 模块

```typescript
// organizations.module.ts
import { Module } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { OrganizationsRouter } from './organizations.router';

@Module({
  providers: [OrganizationsService, OrganizationsRouter],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
```

```typescript
// organizations.service.ts
import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/database/database.service';
import { organizations, organizationMembers } from '@/database/schemas';
import { eq, and, isNull } from 'drizzle-orm';

@Injectable()
export class OrganizationsService {
  constructor(private db: DatabaseService) {}

  async create(userId: string, data: CreateOrgInput) {
    return await this.db.transaction(async (tx) => {
      // 创建组织
      const [org] = await tx.insert(organizations).values(data).returning();
      
      // 添加创建者为 owner
      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId,
        role: 'owner',
      });
      
      return org;
    });
  }

  async list(userId: string) {
    return await this.db
      .select()
      .from(organizations)
      .innerJoin(organizationMembers, eq(organizations.id, organizationMembers.organizationId))
      .where(and(
        eq(organizationMembers.userId, userId),
        isNull(organizations.deletedAt)
      ));
  }

  async softDelete(id: string) {
    await this.db
      .update(organizations)
      .set({ deletedAt: new Date() })
      .where(eq(organizations.id, id));
  }
}
```

```typescript
// organizations.router.ts
import { Injectable } from '@nestjs/common';
import { TrpcService } from '@/trpc/trpc.service';
import { OrganizationsService } from './organizations.service';
import { z } from 'zod';

@Injectable()
export class OrganizationsRouter {
  constructor(
    private trpc: TrpcService,
    private orgsService: OrganizationsService,
  ) {}

  router = this.trpc.router({
    create: this.trpc.protectedProcedure
      .input(z.object({
        name: z.string(),
        slug: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        return await this.orgsService.create(ctx.user.id, input);
      }),

    list: this.trpc.protectedProcedure
      .query(async ({ ctx }) => {
        return await this.orgsService.list(ctx.user.id);
      }),

    delete: this.trpc.protectedProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ input }) => {
        return await this.orgsService.softDelete(input.id);
      }),
  });
}
```

## 权限系统设计

### 权限层级

```
Organization (组织级)
  ├── owner: 完全控制
  ├── admin: 管理权限
  └── member: 基本权限

Team (团队级)
  ├── owner: 团队负责人
  ├── maintainer: 维护者
  └── member: 成员

Project (项目级)
  ├── owner: 项目所有者
  ├── maintainer: 维护者
  ├── developer: 开发者
  └── viewer: 只读
```

### 权限检查函数

```typescript
async function checkPermission(
  userId: string,
  resourceType: 'organization' | 'project' | 'environment',
  resourceId: string,
  requiredPermission: string
): Promise<boolean> {
  // 1. 检查直接权限
  const directPerm = await checkDirectPermission(userId, resourceType, resourceId);
  if (directPerm >= requiredPermission) return true;
  
  // 2. 检查团队继承权限
  const teamPerm = await checkTeamPermission(userId, resourceType, resourceId);
  if (teamPerm >= requiredPermission) return true;
  
  // 3. 检查组织级权限
  const orgPerm = await checkOrgPermission(userId, resourceType, resourceId);
  if (orgPerm >= requiredPermission) return true;
  
  return false;
}
```

## 数据库视图

### organization_stats (组织统计视图)

```sql
CREATE VIEW organization_stats AS
SELECT 
  o.id,
  o.name,
  COUNT(DISTINCT p.id) FILTER (WHERE p.deleted_at IS NULL) as project_count,
  COUNT(DISTINCT om.user_id) FILTER (WHERE om.status = 'active') as member_count,
  COALESCE(SUM(ct.costs->>'total')::numeric, 0) as monthly_cost
FROM organizations o
LEFT JOIN projects p ON o.id = p.organization_id
LEFT JOIN organization_members om ON o.id = om.organization_id
LEFT JOIN cost_tracking ct ON o.id = ct.organization_id 
  AND ct.date >= date_trunc('month', CURRENT_DATE)::text
WHERE o.deleted_at IS NULL
GROUP BY o.id;
```

## API 设计

### tRPC 路由结构

```typescript
export const appRouter = router({
  auth: authRouter,
  users: usersRouter,
  organizations: organizationsRouter,
  teams: teamsRouter,
  projects: projectsRouter,
  repositories: repositoriesRouter,
  environments: environmentsRouter,
  pipelines: pipelinesRouter,
  deployments: deploymentsRouter,
  costTracking: costTrackingRouter,
  securityPolicies: securityPoliciesRouter,
  auditLogs: auditLogsRouter,
  notifications: notificationsRouter,
  aiAssistants: aiAssistantsRouter,
});

export type AppRouter = typeof appRouter;
```

### 认证流程

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant API
    participant GitHub
    participant Redis
    participant DB

    User->>Frontend: 点击 GitHub 登录
    Frontend->>API: GET /auth/github
    API->>GitHub: 重定向到 OAuth
    GitHub->>User: 授权页面
    User->>GitHub: 授权
    GitHub->>API: Callback with code
    API->>GitHub: 交换 access_token
    GitHub->>API: 返回 token + user info
    API->>DB: 创建/更新 user + oauth_account
    API->>Redis: 存储 session
    API->>Frontend: 返回 JWT
    Frontend->>User: 登录成功
```

## 部署架构

### Docker Compose

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/devops
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=devops
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## 性能优化

### 数据库优化

1. **索引策略**:
   - 所有外键添加索引
   - deletedAt 字段添加索引
   - 常用查询字段添加复合索引

2. **查询优化**:
   - 使用 Drizzle 的 select 指定字段
   - 避免 N+1 查询，使用 join
   - 大数据量使用分页

3. **缓存策略**:
   - Redis 缓存用户会话
   - Redis 缓存热点数据
   - 使用 TTL 自动过期

### 应用优化

1. **连接池**: Drizzle 配置连接池
2. **异步处理**: 使用 BullMQ 处理耗时任务
3. **压缩**: Fastify 启用 gzip 压缩
4. **限流**: 使用 @nestjs/throttler

## 监控和日志

### 日志配置

```typescript
// main.ts
import { Logger } from 'nestjs-pino';

app.useLogger(app.get(Logger));
app.flushLogs();
```

### 监控指标

- API 响应时间
- 数据库查询时间
- 错误率
- 活跃用户数
- 资源使用率

## 安全措施

1. **认证**: JWT + Redis Session
2. **授权**: 基于角色的权限控制
3. **输入验证**: Zod schema 验证
4. **SQL 注入防护**: Drizzle ORM 参数化查询
5. **XSS 防护**: 输出转义
6. **CSRF 防护**: SameSite Cookie
7. **限流**: Rate limiting
8. **审计日志**: 记录所有关键操作

## 测试策略

### 单元测试

```typescript
describe('OrganizationsService', () => {
  it('should create organization and add creator as owner', async () => {
    const org = await service.create(userId, { name: 'Test Org', slug: 'test-org' });
    expect(org.name).toBe('Test Org');
    
    const members = await service.listMembers(org.id);
    expect(members).toHaveLength(1);
    expect(members[0].role).toBe('owner');
  });
});
```

### 集成测试

```typescript
describe('Organizations API', () => {
  it('should create and list organizations', async () => {
    const caller = appRouter.createCaller({ user: testUser });
    
    const org = await caller.organizations.create({
      name: 'Test Org',
      slug: 'test-org',
    });
    
    const orgs = await caller.organizations.list();
    expect(orgs).toContainEqual(expect.objectContaining({ id: org.id }));
  });
});
```

## 总结

这个设计提供了：

✅ **精简架构**: 20 个核心表，避免过度设计
✅ **类型安全**: 端到端 TypeScript + Zod
✅ **高性能**: Bun + Fastify + Drizzle
✅ **可维护**: 清晰的模块化架构
✅ **可扩展**: JSONB 灵活配置
✅ **现代化**: 2025 年最前沿技术栈

准备好开始开发了！🚀


## OpenTelemetry 可观测性设计

### 追踪架构

```typescript
// src/observability/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export function setupObservability() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: 'ai-devops-platform',
      [SEMRESATTRS_SERVICE_VERSION]: '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces',
    }),
    metricReader: new PrometheusExporter({
      port: 9464,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': { enabled: true },
        '@opentelemetry/instrumentation-fastify': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
      }),
    ],
  });

  sdk.start();
  
  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0));
  });

  return sdk;
}
```

### 自定义追踪装饰器

```typescript
// src/observability/trace.decorator.ts
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

export function Trace(spanName?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const tracer = trace.getTracer('app');

    descriptor.value = async function (...args: any[]) {
      const name = spanName || `${target.constructor.name}.${propertyKey}`;
      
      return await tracer.startActiveSpan(name, async (span) => {
        try {
          const result = await originalMethod.apply(this, args);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error);
          span.setStatus({ 
            code: SpanStatusCode.ERROR,
            message: error.message 
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}
```

### 指标收集

```typescript
// src/observability/metrics.ts
import { MeterProvider } from '@opentelemetry/sdk-metrics';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const meterProvider = new MeterProvider();
const meter = meterProvider.getMeter('app');

// HTTP 请求计数器
export const httpRequestCounter = meter.createCounter('http_requests_total', {
  description: 'Total number of HTTP requests',
});

// 响应时间直方图
export const httpDurationHistogram = meter.createHistogram('http_request_duration_seconds', {
  description: 'HTTP request duration in seconds',
});

// 数据库查询计数器
export const dbQueryCounter = meter.createCounter('db_queries_total', {
  description: 'Total number of database queries',
});

// 业务指标
export const deploymentCounter = meter.createCounter('deployments_total', {
  description: 'Total number of deployments',
});

export const pipelineRunCounter = meter.createCounter('pipeline_runs_total', {
  description: 'Total number of pipeline runs',
});
```

### 追踪上下文传播

```typescript
// src/trpc/trpc.middleware.ts
import { context, propagation } from '@opentelemetry/api';

export const tracingMiddleware = t.middleware(async ({ ctx, next }) => {
  // 从请求头提取追踪上下文
  const carrier = ctx.req.headers;
  const extractedContext = propagation.extract(context.active(), carrier);
  
  // 在提取的上下文中执行
  return context.with(extractedContext, async () => {
    const result = await next();
    
    // 注入追踪上下文到响应
    propagation.inject(context.active(), ctx.res.headers);
    
    return result;
  });
});
```

## Vitest 测试框架设计

### 测试配置

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'test/',
        '**/*.spec.ts',
        '**/*.test.ts',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

### 测试工具函数

```typescript
// test/utils/factories.ts
import { faker } from '@faker-js/faker';

export const userFactory = {
  build: (overrides = {}) => ({
    id: faker.string.uuid(),
    email: faker.internet.email(),
    username: faker.internet.userName(),
    displayName: faker.person.fullName(),
    avatarUrl: faker.image.avatar(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};

export const organizationFactory = {
  build: (overrides = {}) => ({
    id: faker.string.uuid(),
    name: faker.company.name(),
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    quotas: {
      maxProjects: 10,
      maxUsers: 50,
      maxStorageGb: 100,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
```

```typescript
// test/utils/db-helpers.ts
import { db } from '@/database/database.service';
import { sql } from 'drizzle-orm';

export async function clearDatabase() {
  const tables = [
    'users',
    'organizations',
    'teams',
    'projects',
    'deployments',
    'pipeline_runs',
  ];
  
  for (const table of tables) {
    await db.execute(sql`TRUNCATE TABLE ${sql.identifier(table)} CASCADE`);
  }
}

export async function createTestUser(overrides = {}) {
  const user = userFactory.build(overrides);
  const [created] = await db.insert(users).values(user).returning();
  return created;
}
```

### 单元测试示例

```typescript
// src/modules/organizations/organizations.service.spec.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrganizationsService } from './organizations.service';
import { DatabaseService } from '@/database/database.service';

describe('OrganizationsService', () => {
  let service: OrganizationsService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      transaction: vi.fn(),
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
    };
    service = new OrganizationsService(mockDb);
  });

  describe('create', () => {
    it('should create organization and add creator as owner', async () => {
      const userId = 'user-123';
      const orgData = { name: 'Test Org', slug: 'test-org' };
      
      mockDb.transaction.mockImplementation(async (cb) => {
        return cb({
          insert: vi.fn().mockReturnValue({
            values: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'org-123', ...orgData }]),
            }),
          }),
        });
      });

      const result = await service.create(userId, orgData);

      expect(result.name).toBe('Test Org');
      expect(mockDb.transaction).toHaveBeenCalled();
    });
  });
});
```

### 集成测试示例

```typescript
// test/integration/organizations.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appRouter } from '@/trpc/trpc.router';
import { createTestUser, clearDatabase } from '../utils/db-helpers';

describe('Organizations API', () => {
  let testUser: any;
  let caller: any;

  beforeEach(async () => {
    await clearDatabase();
    testUser = await createTestUser();
    caller = appRouter.createCaller({ user: testUser });
  });

  afterEach(async () => {
    await clearDatabase();
  });

  it('should create and list organizations', async () => {
    const org = await caller.organizations.create({
      name: 'Test Org',
      slug: 'test-org',
    });

    expect(org.name).toBe('Test Org');

    const orgs = await caller.organizations.list();
    expect(orgs).toHaveLength(1);
    expect(orgs[0].id).toBe(org.id);
  });
});
```

## GitLab CI/CD 集成设计

### GitLab API 客户端

```typescript
// src/integrations/gitlab/gitlab.client.ts
import { Gitlab } from '@gitbeaker/rest';

export class GitLabClient {
  private client: InstanceType<typeof Gitlab>;

  constructor(token: string, host?: string) {
    this.client = new Gitlab({
      token,
      host: host || 'https://gitlab.com',
    });
  }

  async triggerPipeline(projectId: number, ref: string, variables?: Record<string, string>) {
    return await this.client.Pipelines.create(projectId, ref, { variables });
  }

  async getPipeline(projectId: number, pipelineId: number) {
    return await this.client.Pipelines.show(projectId, pipelineId);
  }

  async getPipelineJobs(projectId: number, pipelineId: number) {
    return await this.client.Jobs.showPipelineJobs(projectId, pipelineId);
  }

  async getJobLog(projectId: number, jobId: number) {
    return await this.client.Jobs.showLog(projectId, jobId);
  }

  async createEnvironment(projectId: number, name: string, externalUrl?: string) {
    return await this.client.Environments.create(projectId, name, { external_url: externalUrl });
  }

  async createDeployment(projectId: number, data: {
    environment: string;
    ref: string;
    sha: string;
    tag?: boolean;
    status?: string;
  }) {
    return await this.client.Deployments.create(projectId, data);
  }
}
```

### GitLab Webhook 处理

```typescript
// src/modules/webhooks/gitlab-webhook.handler.ts
import { Injectable } from '@nestjs/common';
import { PipelinesService } from '../pipelines/pipelines.service';

@Injectable()
export class GitLabWebhookHandler {
  constructor(private pipelinesService: PipelinesService) {}

  async handlePushEvent(payload: any) {
    const { project, ref, commits } = payload;
    
    // 触发 pipeline
    await this.pipelinesService.trigger({
      repositoryId: project.id,
      ref,
      commit: commits[0]?.id,
      trigger: 'push',
    });
  }

  async handleMergeRequestEvent(payload: any) {
    const { project, object_attributes } = payload;
    
    if (object_attributes.action === 'open' || object_attributes.action === 'update') {
      await this.pipelinesService.trigger({
        repositoryId: project.id,
        ref: object_attributes.source_branch,
        commit: object_attributes.last_commit.id,
        trigger: 'merge_request',
      });
    }
  }

  async handlePipelineEvent(payload: any) {
    const { project, object_attributes } = payload;
    
    // 更新 pipeline 状态
    await this.pipelinesService.updateStatus({
      externalId: object_attributes.id,
      status: object_attributes.status,
      duration: object_attributes.duration,
    });
  }
}
```

### GitLab CI 配置模板

```yaml
# .gitlab-ci.yml
stages:
  - test
  - build
  - deploy

variables:
  NODE_VERSION: "20"

test:
  stage: test
  image: node:${NODE_VERSION}
  script:
    - bun install
    - bun run test
    - bun run test:coverage
  coverage: '/Lines\s*:\s*(\d+\.\d+)%/'
  artifacts:
    reports:
      coverage_report:
        coverage_format: cobertura
        path: coverage/cobertura-coverage.xml

build:
  stage: build
  image: docker:latest
  services:
    - docker:dind
  script:
    - docker build -t $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA .
    - docker push $CI_REGISTRY_IMAGE:$CI_COMMIT_SHA

deploy:staging:
  stage: deploy
  image: node:${NODE_VERSION}
  script:
    - bun run deploy:staging
  environment:
    name: staging
    url: https://staging.example.com
  only:
    - develop

deploy:production:
  stage: deploy
  image: node:${NODE_VERSION}
  script:
    - bun run deploy:production
  environment:
    name: production
    url: https://example.com
  when: manual
  only:
    - main
```

## CI/CD 配置对比

### GitHub Actions vs GitLab CI

| 特性 | GitHub Actions | GitLab CI |
|------|---------------|-----------|
| 配置文件 | `.github/workflows/*.yml` | `.gitlab-ci.yml` |
| 触发方式 | `on: push/pull_request` | `only/except` 或 `rules` |
| 环境变量 | `env:` | `variables:` |
| 缓存 | `actions/cache` | `cache:` |
| 制品 | `actions/upload-artifact` | `artifacts:` |
| 环境 | `environment:` | `environment:` |
| 手动触发 | `workflow_dispatch` | `when: manual` |

### 统一的 Pipeline 配置

```typescript
// src/modules/pipelines/pipeline.config.ts
export interface PipelineConfig {
  stages: PipelineStage[];
  variables?: Record<string, string>;
  cache?: CacheConfig;
  artifacts?: ArtifactConfig;
}

export interface PipelineStage {
  name: string;
  jobs: PipelineJob[];
}

export interface PipelineJob {
  name: string;
  image?: string;
  script: string[];
  environment?: string;
  when?: 'always' | 'on_success' | 'on_failure' | 'manual';
}

// 转换为 GitLab CI 格式
export function toGitLabCI(config: PipelineConfig): string {
  // 实现转换逻辑
}

// 转换为 GitHub Actions 格式
export function toGitHubActions(config: PipelineConfig): string {
  // 实现转换逻辑
}
```

## 监控和告警配置

### Prometheus 告警规则

```yaml
# prometheus/alerts.yml
groups:
  - name: api_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} (threshold: 0.05)"

      - alert: HighLatency
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High latency detected"
          description: "P95 latency is {{ $value }}s (threshold: 1s)"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 512
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}MB (threshold: 512MB)"
```

### Grafana 仪表板

```json
{
  "dashboard": {
    "title": "AI DevOps Platform",
    "panels": [
      {
        "title": "Request Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total[5m])"
          }
        ]
      },
      {
        "title": "Error Rate",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])"
          }
        ]
      },
      {
        "title": "Latency (P95)",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))"
          }
        ]
      },
      {
        "title": "Database Queries",
        "targets": [
          {
            "expr": "rate(db_queries_total[5m])"
          }
        ]
      }
    ]
  }
}
```

## 部署架构更新

### Docker Compose (含监控栈)

```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3001:3001"
      - "9464:9464"  # Prometheus metrics
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/devops
      - REDIS_URL=redis://redis:6379
      - OTEL_EXPORTER_OTLP_ENDPOINT=http://jaeger:4318/v1/traces
    depends_on:
      - postgres
      - redis
      - jaeger

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_DB=devops
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"  # Jaeger UI
      - "4318:4318"    # OTLP HTTP receiver
    environment:
      - COLLECTOR_OTLP_ENABLED=true

  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./prometheus/alerts.yml:/etc/prometheus/alerts.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana_data:/var/lib/grafana
      - ./grafana/dashboards:/etc/grafana/provisioning/dashboards
    depends_on:
      - prometheus

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:
```

## 总结

新增的可观测性和测试功能提供了：

✅ **完整的分布式追踪**: OpenTelemetry + Jaeger
✅ **业务指标收集**: Prometheus + Grafana
✅ **现代化测试**: Vitest + 高覆盖率
✅ **GitLab CI/CD 支持**: 完整的 GitLab 集成
✅ **自动化告警**: Prometheus Alertmanager
✅ **可视化监控**: Grafana 仪表板

这些功能确保了系统的可观测性、可测试性和可维护性！🚀
