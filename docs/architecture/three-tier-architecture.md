# 三层服务架构深度解析

## 为什么需要分层？

### 传统单体架构的问题

```typescript
// 所有代码混在一起
class ProjectService {
  async createProject() {
    // 认证逻辑
    // 用户管理
    // 项目创建
    // Git 操作
    // K8s 部署
    // AI 分析
    // 通知发送
    // ... 一个类几千行
  }
}
```

**问题**：
- ❌ 职责不清
- ❌ 难以测试
- ❌ 难以复用
- ❌ 难以维护
- ❌ 团队协作困难

### 三层架构的解决方案

```
┌─────────────────────────────────────┐
│     Extensions Layer (扩展层)        │
│  AI, Monitoring, Notifications       │
│         可选功能，增强体验             │
└──────────────┬──────────────────────┘
               │ 依赖
┌──────────────▼──────────────────────┐
│     Business Layer (业务层)          │
│  Projects, Deployments, GitOps       │
│         核心业务逻辑                  │
└──────────────┬──────────────────────┘
               │ 依赖
┌──────────────▼──────────────────────┐
│    Foundation Layer (基础层)         │
│  Auth, Users, Organizations          │
│         基础设施服务                  │
└──────────────┬──────────────────────┘
               │ 依赖
┌──────────────▼──────────────────────┐
│         Core (核心包)                │
│  Database, Types, Queue, Utils       │
│         共享基础设施                  │
└─────────────────────────────────────┘
```

---

## 第一层：Core（核心包）

### 职责

提供**技术基础设施**，不包含业务逻辑。

### 包结构

```
packages/core/
├── database/        # 数据库 Schema 和连接
├── types/           # 共享类型定义
├── queue/           # BullMQ 队列配置
├── tokens/          # DI Token 定义
├── utils/           # 工具函数
└── observability/   # 监控和追踪
```

### 设计原则

1. **无业务逻辑** - 只提供技术能力
2. **高度可复用** - 所有层都可以使用
3. **稳定接口** - 很少变化

### 示例：Database

```typescript
// packages/core/database/src/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schemas'

export function createDatabase(url: string) {
  const client = postgres(url)
  return drizzle(client, { schema })
}

export * from './schemas'
```

**特点**：
- 纯技术实现
- 不知道"项目"、"用户"等业务概念
- 只提供数据库连接和 Schema

---

## 第二层：Foundation（基础层）

### 职责

提供**基础业务能力**，是所有业务的基石。

### 包结构

```
packages/services/foundation/
├── auth/            # 认证授权
├── users/           # 用户管理
├── organizations/   # 组织管理
├── teams/           # 团队管理
└── storage/         # 文件存储
```

### 设计原则

1. **通用性** - 任何业务都需要
2. **独立性** - 不依赖具体业务
3. **稳定性** - 很少变化

### 示例：Auth Service

```typescript
// packages/services/foundation/src/auth/auth.service.ts
@Injectable()
export class AuthService {
  // 登录
  async login(email: string, password: string) {
    const user = await this.users.findByEmail(email)
    if (!user) throw new Error('用户不存在')
    
    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) throw new Error('密码错误')
    
    return this.generateToken(user)
  }
  
  // OAuth 登录
  async oauthLogin(provider: 'github' | 'gitlab', code: string) {
    const profile = await this.getOAuthProfile(provider, code)
    let user = await this.users.findByEmail(profile.email)
    
    if (!user) {
      user = await this.users.create({
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      })
    }
    
    return this.generateToken(user)
  }
}
```

**特点**：
- 提供认证能力
- 不关心"项目"、"部署"等业务
- 可以被任何业务层使用

---

## 第三层：Business（业务层）

### 职责

实现**核心业务逻辑**，是平台的价值所在。

### 包结构

```
packages/services/business/
├── projects/        # 项目管理
├── environments/    # 环境管理
├── deployments/     # 部署管理
├── repositories/    # 仓库管理
├── pipelines/       # CI/CD 管道
└── gitops/          # GitOps 集成
    ├── flux/        # Flux CD
    ├── k3s/         # Kubernetes
    └── git-ops/     # Git 操作
```

### 设计原则

1. **业务聚焦** - 实现核心价值
2. **依赖基础层** - 复用基础能力
3. **可扩展** - 易于添加新功能

### 示例：Projects Service

```typescript
// packages/services/business/src/projects/projects.service.ts
@Injectable()
export class ProjectsService {
  constructor(
    // 依赖基础层
    private auth: AuthService,
    private users: UsersService,
    private orgs: OrganizationsService,
    // 依赖核心包
    @Inject(DATABASE) private db: Database,
    @Inject(PROJECT_QUEUE) private queue: Queue,
  ) {}
  
  async create(userId: string, data: CreateProjectInput) {
    // 1. 权限检查（使用基础层）
    await this.auth.requirePermission(userId, 'project:create')
    
    // 2. 创建项目（业务逻辑）
    const project = await this.db.insert(projects).values({
      ...data,
      organizationId: data.organizationId,
      createdBy: userId,
    }).returning()
    
    // 3. 异步初始化（使用核心包）
    await this.queue.add('initialize', {
      projectId: project.id,
      userId,
      templateId: data.templateId,
    })
    
    return project
  }
}
```

**特点**：
- 实现项目管理业务
- 依赖基础层的认证、用户服务
- 依赖核心包的数据库、队列

---

## 第四层：Extensions（扩展层）

### 职责

提供**增强功能**，可选但能提升体验。

### 包结构

```
packages/services/extensions/
├── ai/              # AI 功能
│   ├── ai/          # AI 服务
│   ├── ollama/      # Ollama 集成
│   └── assistants/  # AI 助手
├── monitoring/      # 监控功能
│   ├── audit-logs/  # 审计日志
│   └── cost-tracking/ # 成本追踪
├── notifications/   # 通知服务
└── security/        # 安全策略
```

### 设计原则

1. **可选性** - 不影响核心功能
2. **增强性** - 提升用户体验
3. **独立性** - 可以单独开关

### 示例：AI Service

```typescript
// packages/services/extensions/src/ai/ai.service.ts
@Injectable()
export class AIService {
  constructor(
    // 依赖业务层
    private projects: ProjectsService,
    private deployments: DeploymentsService,
    // 依赖基础层
    private users: UsersService,
  ) {}
  
  async analyzeProject(projectId: string) {
    // 1. 获取项目信息（使用业务层）
    const project = await this.projects.get(projectId)
    const deployments = await this.deployments.list(projectId)
    
    // 2. AI 分析
    const analysis = await this.ollama.analyze({
      project,
      deployments,
      prompt: '分析项目健康度和优化建议',
    })
    
    return analysis
  }
}
```

**特点**：
- 提供 AI 增强功能
- 依赖业务层获取数据
- 可以禁用而不影响核心功能

---

## 依赖关系详解

### 依赖方向

```
Extensions → Business → Foundation → Core
```

**规则**：
- ✅ 上层可以依赖下层
- ❌ 下层不能依赖上层
- ❌ 同层之间尽量不依赖

### 为什么这样设计？

**1. 清晰的职责边界**

```typescript
// ❌ 错误：Foundation 依赖 Business
@Injectable()
export class UsersService {
  constructor(
    private projects: ProjectsService  // 基础层不应该知道项目
  ) {}
}

// ✅ 正确：Business 依赖 Foundation
@Injectable()
export class ProjectsService {
  constructor(
    private users: UsersService  // 业务层可以使用用户服务
  ) {}
}
```

**2. 易于测试**

```typescript
// 测试 Foundation 层
describe('UsersService', () => {
  it('should create user', async () => {
    // 不需要 mock 业务层，因为没有依赖
    const service = new UsersService(mockDb)
    const user = await service.create({ email: 'test@example.com' })
    expect(user).toBeDefined()
  })
})

// 测试 Business 层
describe('ProjectsService', () => {
  it('should create project', async () => {
    // 只需要 mock 基础层
    const service = new ProjectsService(
      mockAuth,
      mockUsers,
      mockDb,
    )
    const project = await service.create(userId, data)
    expect(project).toBeDefined()
  })
})
```

**3. 易于复用**

```typescript
// Foundation 层可以被任何业务复用
import { AuthService, UsersService } from '@juanie/service-foundation'

// 新业务：博客系统
@Injectable()
export class BlogService {
  constructor(
    private auth: AuthService,      // 复用认证
    private users: UsersService,    // 复用用户管理
  ) {}
}

// 新业务：电商系统
@Injectable()
export class ShopService {
  constructor(
    private auth: AuthService,      // 复用认证
    private users: UsersService,    // 复用用户管理
  ) {}
}
```

---

## 模块注册

### App Module

```typescript
// apps/api-gateway/src/app.module.ts
@Module({
  imports: [
    // Core modules
    DatabaseModule,
    QueueModule,
    
    // Three-tier service architecture
    FoundationModule,    // 基础层
    BusinessModule,      // 业务层
    ExtensionsModule,    // 扩展层
    
    // API module
    TrpcModule,
  ],
})
export class AppModule {}
```

### Foundation Module

```typescript
// packages/services/foundation/src/foundation.module.ts
@Global()
@Module({
  imports: [
    DatabaseModule,  // 依赖 Core
  ],
  providers: [
    AuthService,
    UsersService,
    OrganizationsService,
    TeamsService,
    StorageService,
  ],
  exports: [
    AuthService,
    UsersService,
    OrganizationsService,
    TeamsService,
    StorageService,
  ],
})
export class FoundationModule {}
```

### Business Module

```typescript
// packages/services/business/src/business.module.ts
@Module({
  imports: [
    FoundationModule,  // 依赖基础层
    QueueModule,       // 依赖 Core
  ],
  providers: [
    ProjectsService,
    DeploymentsService,
    GitOpsService,
    // ...
  ],
  exports: [
    ProjectsService,
    DeploymentsService,
    GitOpsService,
    // ...
  ],
})
export class BusinessModule {}
```

### Extensions Module

```typescript
// packages/services/extensions/src/extensions.module.ts
@Module({
  imports: [
    FoundationModule,  // 依赖基础层
    BusinessModule,    // 依赖业务层
  ],
  providers: [
    AIService,
    MonitoringService,
    NotificationsService,
    SecurityService,
  ],
  exports: [
    AIService,
    MonitoringService,
    NotificationsService,
    SecurityService,
  ],
})
export class ExtensionsModule {}
```

---

## 实战案例：添加新功能

### 场景：添加"成本追踪"功能

**1. 分析依赖**

```
成本追踪需要：
- 项目信息（Business 层）
- 部署信息（Business 层）
- 用户信息（Foundation 层）

结论：应该放在 Extensions 层
```

**2. 创建服务**

```typescript
// packages/services/extensions/src/monitoring/cost-tracking.service.ts
@Injectable()
export class CostTrackingService {
  constructor(
    // 依赖业务层
    private projects: ProjectsService,
    private deployments: DeploymentsService,
    // 依赖基础层
    private users: UsersService,
    // 依赖核心包
    @Inject(DATABASE) private db: Database,
  ) {}
  
  async calculateCost(projectId: string) {
    const project = await this.projects.get(projectId)
    const deployments = await this.deployments.list(projectId)
    
    // 计算成本
    const cost = this.calculateResourceCost(deployments)
    
    // 保存记录
    await this.db.insert(costRecords).values({
      projectId,
      cost,
      timestamp: new Date(),
    })
    
    return cost
  }
}
```

**3. 注册到 Extensions Module**

```typescript
@Module({
  imports: [FoundationModule, BusinessModule],
  providers: [
    // ... 其他服务
    CostTrackingService,  // 新增
  ],
  exports: [
    // ... 其他服务
    CostTrackingService,  // 新增
  ],
})
export class ExtensionsModule {}
```

**4. 创建 tRPC 路由**

```typescript
// apps/api-gateway/src/routers/cost-tracking.router.ts
@Injectable()
export class CostTrackingRouter {
  constructor(
    private trpc: TrpcService,
    private costTracking: CostTrackingService,
  ) {}
  
  router = this.trpc.router({
    calculate: this.trpc.protectedProcedure
      .input(z.object({ projectId: z.string() }))
      .query(({ input }) => {
        return this.costTracking.calculateCost(input.projectId)
      }),
  })
}
```

**完成！** 新功能完全遵循三层架构，清晰、可维护。

---

## 最佳实践

### 1. 保持依赖方向

```typescript
// ❌ 错误
class FoundationService {
  constructor(private business: BusinessService) {}
}

// ✅ 正确
class BusinessService {
  constructor(private foundation: FoundationService) {}
}
```

### 2. 避免循环依赖

```typescript
// ❌ 错误
// A 依赖 B
class ServiceA {
  constructor(private b: ServiceB) {}
}
// B 依赖 A
class ServiceB {
  constructor(private a: ServiceA) {}
}

// ✅ 正确：提取共享逻辑到下层
class SharedService {}
class ServiceA {
  constructor(private shared: SharedService) {}
}
class ServiceB {
  constructor(private shared: SharedService) {}
}
```

### 3. 合理使用事件

```typescript
// 当需要跨层通信时，使用事件
@Injectable()
export class ProjectsService {
  async create(data: CreateProjectInput) {
    const project = await this.db.insert(projects).values(data)
    
    // 发布事件，而不是直接调用扩展层
    this.events.emit('project.created', { project })
    
    return project
  }
}

// 扩展层监听事件
@Injectable()
export class AIService {
  @OnEvent('project.created')
  async handleProjectCreated(event: { project: Project }) {
    await this.analyzeProject(event.project.id)
  }
}
```

---

## 总结

### 三层架构的价值

1. **清晰的职责** - 每层都有明确的职责
2. **易于维护** - 修改一层不影响其他层
3. **易于测试** - 可以独立测试每一层
4. **易于扩展** - 添加新功能很简单
5. **团队协作** - 不同团队可以负责不同层

### 记住这个图

```
Extensions (可选增强)
    ↓
Business (核心业务)
    ↓
Foundation (基础能力)
    ↓
Core (技术基础)
```

**依赖只能向下，不能向上！**
