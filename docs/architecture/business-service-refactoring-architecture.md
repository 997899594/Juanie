# Business Service 重构架构设计

> 生成时间: 2024-12-24
> 目标: 从过度设计回归到简单实用的架构
> 原则: **简单优先，实用至上**

## 🎯 核心设计理念

### 当前问题的本质

```
❌ 当前架构: 过度设计
- 状态机管理线性流程
- Handler 模式处理简单步骤
- 三层抽象做同一件事
- Factory/Strategy 模式滥用

✅ 目标架构: 简单实用
- 线性流程用顺序函数
- 简单步骤用私有方法
- 单一职责，一层抽象
- 只在真正需要多态时用模式
```

### 设计原则

1. **KISS (Keep It Simple, Stupid)** - 能用函数就不用类
2. **YAGNI (You Aren't Gonna Need It)** - 不要提前设计
3. **单一职责** - 一个服务只做一件事
4. **组合优于继承** - 用依赖注入组合功能
5. **显式优于隐式** - 代码流程一目了然

---

## 📐 整体架构设计

### 分层架构（简化版）

```
┌─────────────────────────────────────────────────────────┐
│                    API Layer (tRPC)                      │
│                  apps/api-gateway/routers                │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Application Services                    │
│              packages/services/business                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Projects   │  │ Deployments  │  │   GitOps     │ │
│  │   Service    │  │   Service    │  │   Service    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│         ↓                  ↓                  ↓         │
│  ┌──────────────────────────────────────────────────┐  │
│  │           Domain Logic (纯函数/工具类)            │  │
│  │  - 模板渲染  - 权限检查  - 状态计算              │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────┐
│                  Infrastructure Layer                    │
│                   packages/core                          │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │   Database   │  │    Queue     │  │  External    │ │
│  │   (Drizzle)  │  │  (BullMQ)    │  │    APIs      │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 关键设计决策

#### 1. 不引入 Repository 层（暂时）

**原因**:
- Drizzle ORM 的 Relational Query 已经足够简洁
- 增加 Repository 层会增加一层抽象，违反 KISS 原则
- 当前数据访问逻辑不复杂，不需要额外抽象

**示例**:
```typescript
// ❌ 过度设计: 增加 Repository 层
class ProjectRepository {
  async findById(id: string) {
    return this.db.query.projects.findFirst({ where: eq(...) })
  }
}

// ✅ 简单直接: 直接使用 Drizzle
class ProjectsService {
  async get(projectId: string) {
    return this.db.query.projects.findFirst({ 
      where: eq(schema.projects.id, projectId) 
    })
  }
}
```

**何时引入**: 当出现以下情况时再考虑
- 同一个查询在 5+ 个地方重复
- 需要复杂的事务管理
- 需要切换数据库实现

#### 2. 服务层采用"胖服务"模式

**原因**:
- 业务逻辑集中在服务层，易于理解和维护
- 避免逻辑分散在多个小类中
- 减少类之间的依赖关系

**示例**:
```typescript
// ✅ 胖服务: 所有项目相关逻辑在一个服务
@Injectable()
export class ProjectsService {
  // CRUD 操作
  async create() { /* ... */ }
  async get() { /* ... */ }
  async update() { /* ... */ }
  async delete() { /* ... */ }
  
  // 辅助方法（私有）
  private async checkAccess() { /* ... */ }
  private async validateData() { /* ... */ }
}

// ❌ 过度拆分: 逻辑分散，难以追踪
class ProjectsService { /* 只有 CRUD */ }
class ProjectAccessService { /* 权限检查 */ }
class ProjectValidationService { /* 数据验证 */ }
class ProjectEventsService { /* 事件发布 */ }
```

**边界**: 单个服务不超过 500 行，超过则按功能拆分

#### 3. 用纯函数处理领域逻辑

**原因**:
- 纯函数易于测试（不需要 mock）
- 纯函数易于复用
- 纯函数没有副作用，易于理解

**示例**:
```typescript
// ✅ 纯函数: 领域逻辑
export function calculateProjectHealth(
  deployments: Deployment[]
): HealthScore {
  const total = deployments.length
  const successful = deployments.filter(d => d.status === 'success').length
  
  return {
    score: total > 0 ? Math.round((successful / total) * 100) : 0,
    status: successful / total > 0.8 ? 'healthy' : 'unhealthy'
  }
}

// 在服务中使用
class ProjectsService {
  async getHealth(projectId: string) {
    const deployments = await this.getDeployments(projectId)
    return calculateProjectHealth(deployments) // 纯函数
  }
}
```

**位置**: `packages/services/business/src/utils/` 或 `domain/`

---

## 🏗️ 模块重构设计

### 1. Projects 模块

#### 目标架构

```
packages/services/business/src/projects/
├── projects.service.ts (400 行)           # 核心 CRUD
├── project-members.service.ts (已存在)    # 成员管理
├── project-access.service.ts (100 行)     # 权限检查（新建）
├── initialization/
│   ├── initialization.service.ts (300 行) # 初始化服务
│   └── steps.ts (100 行)                  # 步骤函数
├── template/
│   └── template.service.ts (300 行)       # 模板服务
└── utils/
    ├── health-calculator.ts               # 健康度计算（纯函数）
    └── status-mapper.ts                   # 状态映射（纯函数）
```

#### 核心设计

**ProjectsService** - 只负责 CRUD
```typescript
@Injectable()
export class ProjectsService {
  // ✅ 保留: 核心 CRUD
  async create(userId, data) { /* ... */ }
  async get(userId, projectId) { /* ... */ }
  async list(userId, organizationId) { /* ... */ }
  async update(userId, projectId, data) { /* ... */ }
  async delete(userId, projectId) { /* ... */ }
  
  // ✅ 保留: 状态查询
  async getStatus(userId, projectId) { /* ... */ }
  
  // ❌ 移除: 成员管理 → project-members.service.ts
  // addMember(), removeMember(), listMembers()
  
  // ❌ 移除: 权限检查 → project-access.service.ts
  // checkAccess(), assertCan()
}
```

**ProjectAccessService** - 统一权限检查
```typescript
@Injectable()
export class ProjectAccessService {
  async checkAccess(
    userId: string, 
    projectId: string, 
    action: string
  ): Promise<boolean> {
    // 统一的权限检查逻辑
    // 1. 检查 visibility
    // 2. 检查组织成员
    // 3. 检查项目成员
    // 4. 检查团队成员
  }
  
  async assertAccess(userId, projectId, action): Promise<void> {
    if (!await this.checkAccess(userId, projectId, action)) {
      throw new PermissionDeniedError()
    }
  }
}
```

**InitializationService** - 简化初始化流程
```typescript
@Injectable()
export class ProjectInitializationService {
  async initialize(context: InitContext): Promise<InitResult> {
    // ✅ 线性流程，清晰明了
    try {
      // 1. 创建项目记录
      const project = await this.createProject(context)
      
      // 2. 加载并渲染模板（如果有）
      if (context.templateId) {
        await this.setupTemplate(context, project)
      }
      
      // 3. 创建环境
      await this.createEnvironments(context, project)
      
      // 4. 设置仓库（如果有）
      if (context.repository) {
        await this.setupRepository(context, project)
      }
      
      // 5. 完成初始化
      await this.finalize(context, project)
      
      return { success: true, project }
    } catch (error) {
      await this.handleError(context, error)
      throw error
    }
  }
  
  // ✅ 私有方法，不需要单独的 Handler 类
  private async createProject(ctx: InitContext) { /* ... */ }
  private async setupTemplate(ctx: InitContext, project: Project) { /* ... */ }
  private async createEnvironments(ctx: InitContext, project: Project) { /* ... */ }
  private async setupRepository(ctx: InitContext, project: Project) { /* ... */ }
  private async finalize(ctx: InitContext, project: Project) { /* ... */ }
}
```

**关键改进**:
- ❌ 移除状态机（线性流程不需要）
- ❌ 移除 Handler 模式（用私有方法）
- ❌ 移除三层抽象（steps.ts + steps.service.ts + state-machine.ts）
- ✅ 保留步骤记录（用于进度展示）

### 2. GitOps 模块

#### 目标架构

```
packages/services/business/src/gitops/
├── gitops.service.ts (200 行)             # 统一入口（Facade）
├── providers/
│   ├── github/
│   │   ├── github-repository.service.ts (200 行)
│   │   ├── github-organization.service.ts (150 行)
│   │   └── github-webhook.service.ts (100 行)
│   ├── gitlab/
│   │   ├── gitlab-repository.service.ts (200 行)
│   │   ├── gitlab-organization.service.ts (150 行)
│   │   └── gitlab-webhook.service.ts (100 行)
│   └── provider.factory.ts (50 行)
├── sync/
│   ├── sync.service.ts (300 行)           # 核心同步服务
│   └── conflict-resolver.service.ts (200 行)
├── flux/
│   ├── flux.service.ts (200 行)           # 统一入口
│   └── resources/
│       ├── kustomization.service.ts (150 行)
│       └── git-repository.service.ts (150 行)
└── k3s/
    └── k3s.service.ts (已存在)
```

#### 核心设计

**GitOpsService** - Facade 模式统一入口
```typescript
@Injectable()
export class GitOpsService {
  constructor(
    private providerFactory: GitProviderFactory,
    private syncService: SyncService,
    private fluxService: FluxService,
    private k3sService: K3sService,
  ) {}
  
  // ✅ 高层编排，隐藏复杂度
  async setupGitOps(projectId: string, config: GitOpsConfig) {
    // 1. 创建 Git 仓库
    const provider = this.providerFactory.create(config.provider)
    const repo = await provider.createRepository(config)
    
    // 2. 设置 Flux 资源
    await this.fluxService.setupResources(projectId, repo)
    
    // 3. 同步到 K8s
    await this.k3sService.applyResources(projectId)
    
    return { success: true }
  }
}
```

**GitProviderFactory** - 简单工厂模式
```typescript
@Injectable()
export class GitProviderFactory {
  constructor(
    private githubRepo: GitHubRepositoryService,
    private gitlabRepo: GitLabRepositoryService,
  ) {}
  
  create(provider: 'github' | 'gitlab'): GitProvider {
    return provider === 'github' ? this.githubRepo : this.gitlabRepo
  }
}
```

**关键改进**:
- ✅ 按平台拆分（GitHub/GitLab）
- ✅ 按功能拆分（Repository/Organization/Webhook）
- ✅ 用 Facade 模式提供统一入口
- ❌ 移除过度的 Strategy 模式

### 3. Template 模块

#### 目标架构

```
packages/services/business/src/projects/template/
├── template.service.ts (300 行)           # 统一服务
└── utils/
    ├── ejs-renderer.ts (100 行)           # EJS 渲染（纯函数）
    └── variable-validator.ts (50 行)      # 变量验证（纯函数）
```

#### 核心设计

**TemplateService** - 合并 loader 和 renderer
```typescript
@Injectable()
export class TemplateService {
  // ✅ 加载模板
  async loadTemplate(slug: string): Promise<Template> {
    // 从数据库或文件系统加载
  }
  
  // ✅ 渲染模板
  async renderTemplate(
    template: Template, 
    variables: Record<string, any>
  ): Promise<RenderedFiles> {
    // 使用 EJS 渲染
    return renderEJS(template.files, variables)
  }
  
  // ✅ 同步模板（从文件系统到数据库）
  async syncFromFileSystem(): Promise<void> {
    // 扫描 templates/ 目录
    // 解析 template.yaml
    // 更新数据库
  }
}
```

**关键改进**:
- ✅ 合并 loader 和 renderer（职责相关）
- ✅ 渲染逻辑提取为纯函数
- ❌ 移除文件监听（不需要实时同步）

---

## 🔧 技术决策

### 1. 何时使用设计模式

| 模式 | 使用场景 | 不使用场景 |
|------|---------|-----------|
| **Factory** | 需要根据参数创建不同实现（如 GitHub/GitLab） | 只有一种实现 |
| **Strategy** | 算法需要运行时切换 | 算法固定不变 |
| **Facade** | 需要简化复杂子系统的接口 | 子系统本身就简单 |
| **Repository** | 数据访问逻辑复杂，需要抽象 | ORM 已经足够简洁 |
| **State Machine** | 复杂的状态转换（如订单状态） | 简单的线性流程 |

### 2. 服务拆分原则

**何时拆分服务**:
- ✅ 单个服务超过 500 行
- ✅ 职责明确不同（如 CRUD vs 权限检查）
- ✅ 可以独立测试和部署

**何时不拆分**:
- ❌ 只是为了"看起来更模块化"
- ❌ 拆分后增加了理解成本
- ❌ 拆分后需要频繁跨服务调用

### 3. 错误处理策略

**统一错误类型**:
```typescript
// ✅ 使用现有的错误类型
import {
  ProjectNotFoundError,
  PermissionDeniedError,
  ValidationError,
} from '@juanie/core/errors'

// ❌ 不要创建新的错误类型（除非真的需要）
class ProjectInitializationStepFailedError extends Error {}
```

**错误处理位置**:
- **服务层**: 捕获并转换为业务错误
- **Router 层**: 捕获并转换为 HTTP 错误
- **不要**: 在每个私有方法中都 try-catch

### 4. 测试策略

**测试金字塔**:
```
        /\
       /  \  E2E Tests (少量)
      /────\
     /      \  Integration Tests (适量)
    /────────\
   /          \  Unit Tests (大量)
  /────────────\
```

**测试重点**:
- **纯函数**: 100% 单元测试覆盖
- **服务层**: 集成测试（使用真实数据库）
- **API 层**: E2E 测试（关键流程）

---

## 📊 架构对比

### 重构前 vs 重构后

| 维度 | 重构前 | 重构后 | 改进 |
|------|--------|--------|------|
| **代码行数** | 22,732 | ~13,600 | -40% |
| **文件数** | 100+ | ~60 | -40% |
| **最大文件** | 2,131 行 | <500 行 | -76% |
| **抽象层次** | 3-4 层 | 1-2 层 | -50% |
| **设计模式** | 10+ | 3-4 | -60% |
| **理解时间** | 2-3 天 | 半天 | -75% |

### 复杂度对比

**Initialization 模块**:
```
❌ 重构前 (1,500 行):
StateMachine (262 行)
  → InitializationSteps (97 行)
    → InitializationStepsService (167 行)
      → ProgressManager (186 行)
        → 6 个 Handler (697 行)
          → ProjectOrchestrator (98 行)

✅ 重构后 (400 行):
InitializationService (300 行)
  → 6 个私有方法
  → Steps 记录（用于进度展示）
```

**Projects 模块**:
```
❌ 重构前 (1,181 行):
ProjectsService (1,181 行)
  - CRUD
  - 成员管理
  - 团队管理
  - 权限检查
  - 订阅功能
  - 状态计算

✅ 重构后 (600 行):
ProjectsService (400 行) - 只负责 CRUD
ProjectAccessService (100 行) - 权限检查
ProjectMembersService (已存在) - 成员管理
```

---

## 🎯 设计验证

### 如何判断设计是否合理

**好的设计特征**:
- ✅ 新人能在 1 小时内理解核心流程
- ✅ 修改一个功能不影响其他功能
- ✅ 测试覆盖率 > 80%
- ✅ 单个文件 < 500 行
- ✅ 依赖关系清晰（不超过 3 层）

**坏的设计特征**:
- ❌ 需要画图才能理解
- ❌ 修改一个地方需要改多个文件
- ❌ 测试需要 mock 大量依赖
- ❌ 单个文件 > 1000 行
- ❌ 循环依赖或全局模块滥用

### 设计评审清单

**代码评审时问自己**:
1. 这个抽象真的需要吗？能用函数解决吗？
2. 这个设计模式真的合适吗？会不会过度设计？
3. 新人能快速理解这段代码吗？
4. 这个服务的职责是否单一？
5. 依赖关系是否清晰？

---

## 📝 总结

### 核心架构原则

1. **简单优先** - 能用函数就不用类，能用私有方法就不用 Handler
2. **实用至上** - 不要为了"架构美"而过度设计
3. **渐进式** - 先简单实现，有需要再重构
4. **可读性** - 代码是写给人看的，不是写给机器看的

### 重构方向

```
过度设计 → 简单实用
├── 状态机 → 顺序函数
├── Handler 模式 → 私有方法
├── 三层抽象 → 单层服务
├── Factory/Strategy 滥用 → 按需使用
└── 全局模块 → 显式依赖
```

### 预期效果

- **代码量**: 减少 40% (22,732 → 13,600 行)
- **复杂度**: 降低 60% (抽象层次从 3-4 层 → 1-2 层)
- **可维护性**: 提升 75% (理解时间从 2-3 天 → 半天)
- **开发效率**: 提升 50% (修改功能更快，测试更容易)

---

**下一步**: 基于这个架构设计，开始具体的重构实施

