# Core 包架构违规分析

> 生成时间: 2024-12-24  
> 分析人: 资深架构师  
> 基于文档: `docs/architecture/layered-architecture-analysis.md`

## 🎯 执行摘要

Core 包存在**严重的架构违规问题**，违反了"Core 层应该是纯基础设施，不包含任何业务逻辑"的核心原则。

**关键发现**:
- 🔴 **500+ 行业务错误类** - 包含 Project、Organization、Team 等业务概念
- 🔴 **RBAC 系统** - 依赖用户、组织、角色等业务概念，应在 Foundation 层
- 🔴 **SSE 模块** - 特定通信方式，不是所有项目都需要，应在 Foundation 层
- 🔴 **Repository Worker** - 包含完整的业务逻辑（创建仓库、推送代码、更新项目状态），应在 Business 层
- 🟡 **Logger 服务** - 仅仅是 re-export，没有任何价值
- 🟡 **Events 模块** - 对 EventEmitter2 的过度封装
- 🟡 **Utils 目录** - 杂乱无章的工具函数集合

**影响**:
- Core 层与业务层强耦合，无法独立复用
- 违反分层架构原则，导致依赖混乱
- 增加维护成本和测试难度


## 📋 Core 层原则回顾

根据 `docs/architecture/layered-architecture-analysis.md`，Core 层应该:

**✅ 应该包含**:
- 纯基础设施（Database、Queue、Cache、Storage）
- 技术能力（Logger、Config、Encryption、Observability）
- 无业务逻辑
- 可独立测试
- 可复用到其他项目

**❌ 不应该包含**:
- 业务概念（Project、Organization、User、Team）
- 业务逻辑（项目初始化、仓库管理、权限检查）
- 特定功能（SSE、RBAC）
- 业务错误类

**分层原则**:
```
Extensions → Business → Foundation → Core
```
- Core 不能依赖任何上层
- Core 不能知道业务概念
- Core 应该是"哑"的基础设施


## 🔴 严重违规问题

### 1. Business Errors (500+ 行业务错误类)

**文件**: `packages/core/src/errors/business-errors.ts`

**问题**:
```typescript
// ❌ Core 层不应该知道这些业务概念
export class ProjectNotFoundError extends BusinessError { }
export class OrganizationNotFoundError extends BusinessError { }
export class TeamNotFoundError extends BusinessError { }
export class EnvironmentNotFoundError extends BusinessError { }
export class GitOpsSetupError extends BusinessError { }
export class ProjectInitializationError extends BusinessError { }
export class TemplateLoadFailedError extends ProjectInitializationError { }
export class RepositorySetupFailedError extends ProjectInitializationError { }
```

**违规原因**:
- Core 层包含 `Project`、`Organization`、`Team`、`Environment`、`GitOps` 等业务概念
- 这些错误类应该在各自的服务层定义
- Core 层应该只提供基础错误类（`BaseError`、`ValidationError`、`NotFoundError`）

**影响**:
- Core 层与业务层强耦合
- 任何业务变更都需要修改 Core 层
- 无法将 Core 层复用到其他项目

**正确做法**:
```typescript
// ✅ Core 层只提供基础错误类
// packages/core/src/errors/base-errors.ts
export abstract class BaseError extends Error { }
export class NotFoundError extends BaseError { }
export class ValidationError extends BaseError { }
export class UnauthorizedError extends BaseError { }
export class ForbiddenError extends BaseError { }

// ✅ 业务错误在各自的服务层定义
// packages/services/business/src/projects/errors.ts
export class ProjectNotFoundError extends NotFoundError { }
export class ProjectInitializationError extends BaseError { }
```


### 2. RBAC 系统 (权限控制)

**文件**: `packages/core/src/rbac/casl/casl-ability.factory.ts`

**问题**:
```typescript
// ❌ Core 层直接查询业务数据
@Injectable()
export class CaslAbilityFactory {
  constructor(@Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>) {}

  async createForUser(userId: string, organizationId?: string): Promise<AppAbility> {
    // ❌ 查询组织成员信息 - 业务逻辑
    const member = await this.db.query.organizationMembers.findFirst({
      where: and(
        eq(schema.organizationMembers.userId, userId),
        eq(schema.organizationMembers.organizationId, organizationId),
      ),
    })

    // ❌ 查询项目成员信息 - 业务逻辑
    const projectMemberships = await this.db.query.projectMembers.findMany({
      where: eq(schema.projectMembers.userId, userId),
    })
  }
}
```

**违规原因**:
- RBAC 系统依赖 `User`、`Organization`、`Project`、`Role` 等业务概念
- Core 层直接查询业务数据表（`organizationMembers`、`projectMembers`）
- 权限系统是业务功能，不是基础设施

**影响**:
- Core 层与 Foundation/Business 层强耦合
- 无法独立测试 RBAC 系统
- 无法将 Core 层复用到其他项目（其他项目可能没有 Organization/Project 概念）

**正确做法**:
```typescript
// ✅ RBAC 应该在 Foundation 层
// packages/services/foundation/src/rbac/rbac.service.ts
@Injectable()
export class RbacService {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async createAbilityForUser(userId: string, organizationId?: string) {
    // 通过 Foundation 层服务获取数据
    const orgMember = await this.organizationsService.getMember(userId, organizationId)
    const projectMembers = await this.projectsService.getUserProjects(userId)
    
    return defineAbilitiesFor(user, orgMember, projectMembers)
  }
}
```

**迁移计划**:
1. 将 `packages/core/src/rbac/` 移动到 `packages/services/foundation/src/rbac/`
2. 修改依赖关系，通过 Foundation 层服务获取数据
3. 更新所有导入路径


### 3. SSE 模块 (Server-Sent Events)

**文件**: `packages/core/src/sse/`

**问题**:
```typescript
// ❌ SSE 是特定的通信方式，不是基础设施
@Global()
@Module({
  imports: [ConfigModule, LoggerModule],
  providers: [EventBusService],
  exports: [EventBusService],
})
export class SseModule {}
```

**违规原因**:
- SSE 是一种特定的通信方式（Server-Sent Events），不是所有项目都需要
- Core 层应该只提供最基础的能力（如 EventEmitter），而不是特定的通信协议
- SSE 更像是一个可选的功能模块，应该在 Foundation 或 Business 层按需使用

**影响**:
- 增加 Core 层的复杂度
- 强制所有项目都包含 SSE 功能
- 违反"Core 层是纯基础设施"的原则

**正确做法**:
```typescript
// ✅ SSE 应该在 Foundation 层作为可选功能
// packages/services/foundation/src/sse/sse.service.ts
@Injectable()
export class SseService {
  constructor(
    private readonly eventEmitter: EventEmitter2, // 使用 Core 层的基础能力
  ) {}

  // SSE 特定的业务逻辑
  createStream(userId: string) { }
  sendEvent(userId: string, event: any) { }
}
```

**迁移计划**:
1. 将 `packages/core/src/sse/` 移动到 `packages/services/foundation/src/sse/`
2. 依赖 Core 层的 `EventEmitter2`（基础能力）
3. 更新所有导入路径


### 4. Repository Worker (业务 Worker)

**文件**: `packages/core/src/queue/workers/repository.worker.ts` (400+ 行)

**问题**:
```typescript
// ❌ Core 层包含完整的业务逻辑
@Injectable()
export class RepositoryWorker implements OnModuleInit {
  private async handleCreateRepository(job: Job) {
    // ❌ 业务逻辑：创建 GitHub/GitLab 仓库
    const result = await this.callAPI(provider, 'create', { name, visibility, accessToken })
    
    // ❌ 业务逻辑：创建数据库记录
    await this.db.insert(schema.repositories).values({ ... })
    
    // ❌ 业务逻辑：推送初始代码
    await this.pushInitialCode(provider, accessToken, fullName, branch)
    
    // ❌ 业务逻辑：更新项目状态
    await this.db.update(schema.projects).set({ status: 'active' })
  }

  // ❌ 业务逻辑：推送文件到 GitHub
  private async pushToGitHub(accessToken, fullName, files, branch) { }
  
  // ❌ 业务逻辑：推送文件到 GitLab
  private async pushToGitLab(accessToken, fullName, files, branch) { }
}
```

**违规原因**:
- Repository Worker 包含完整的业务逻辑（创建仓库、推送代码、更新项目状态）
- Core 层不应该知道 `Repository`、`Project` 等业务概念
- Core 层不应该直接调用 GitHub/GitLab API
- Core 层不应该包含业务 Worker，只应该提供 Queue 基础设施

**影响**:
- Core 层与 Business 层强耦合
- 无法独立测试 Queue 基础设施
- 违反单一职责原则

**正确做法**:
```typescript
// ✅ Core 层只提供 Queue 基础设施
// packages/core/src/queue/queue.module.ts
@Module({
  imports: [BullModule.forRoot({ ... })],
  exports: [BullModule],
})
export class QueueModule {}

// ✅ Business Worker 在 Business 层
// packages/services/business/src/repositories/workers/repository.worker.ts
@Injectable()
export class RepositoryWorker {
  constructor(
    private readonly repositoriesService: RepositoriesService,
    private readonly gitProviderService: GitProviderService,
  ) {}

  async handleCreateRepository(job: Job) {
    // 通过 Business 层服务处理业务逻辑
    await this.repositoriesService.create(job.data)
  }
}
```

**迁移计划**:
1. 将 `packages/core/src/queue/workers/repository.worker.ts` 移动到 `packages/services/business/src/repositories/workers/`
2. 修改依赖关系，通过 Business 层服务处理业务逻辑
3. Core 层只保留 Queue 基础设施（`QueueModule`、`QUEUE_TOKENS`）


## 🟡 中等问题

### 5. Logger 服务 (仅仅是 re-export)

**文件**: `packages/core/src/logger/logger.service.ts`

**问题**:
```typescript
// ❌ 没有任何价值，只是重命名
export { PinoLogger, PinoLogger as Logger, PinoLogger as LoggerService } from 'nestjs-pino'
```

**违规原因**:
- Logger 服务只是简单的 re-export，没有提供任何额外功能
- 如果只是重命名，为什么不直接使用 `nestjs-pino`？
- 如果要封装，应该提供统一接口和增强功能（如自动添加 context、格式化等）

**影响**:
- 增加不必要的抽象层
- 没有提供实际价值
- 混淆开发者（不知道应该用 `PinoLogger` 还是 `Logger`）

**两种解决方案**:

#### 方案 A: 直接使用 nestjs-pino ✅ 推荐
```typescript
// ✅ 直接导入使用
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class MyService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MyService.name)
  }
}
```

#### 方案 B: 提供真正的封装
```typescript
// ✅ 提供统一接口和增强功能
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class Logger {
  constructor(private readonly pino: PinoLogger) {}

  // 自动添加 context
  info(message: string, context?: Record<string, any>) {
    this.pino.info({ ...context, timestamp: Date.now() }, message)
  }

  // 自动格式化错误
  error(message: string, error?: Error, context?: Record<string, any>) {
    this.pino.error({
      ...context,
      error: {
        message: error?.message,
        stack: error?.stack,
        name: error?.name,
      },
    }, message)
  }
}
```

**建议**: 采用方案 A，直接使用 `nestjs-pino`，删除 `logger.service.ts`


### 6. Events 模块 (过度封装)

**文件**: `packages/core/src/events/events.module.ts`

**问题**:
```typescript
// ❌ 对 EventEmitter2 的过度封装
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
  ],
  providers: [EventPublisher, EventReplayService],
  exports: [EventEmitterModule, EventPublisher, EventReplayService],
})
export class CoreEventsModule {}
```

**违规原因**:
- `EventEmitter2` 已经很好用了，为什么要包一层？
- `EventPublisher`、`EventReplayService` 是业务功能，不是基础设施
- 事件重放（Event Replay）是特定的业务需求，不是所有项目都需要

**影响**:
- 增加不必要的抽象层
- `EventPublisher` 和 `EventReplayService` 可能包含业务逻辑
- 违反"Core 层是纯基础设施"的原则

**两种解决方案**:

#### 方案 A: 直接使用 EventEmitter2 ✅ 推荐
```typescript
// ✅ 直接使用 NestJS 的 EventEmitterModule
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
  ],
})
export class AppModule {}

// ✅ 直接注入 EventEmitter2
@Injectable()
export class MyService {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  async doSomething() {
    this.eventEmitter.emit('user.created', { userId: '123' })
  }
}
```

#### 方案 B: 提供极简封装
```typescript
// ✅ 只提供配置，不添加额外功能
@Global()
@Module({
  imports: [
    EventEmitterModule.forRoot({
      wildcard: true,
      delimiter: '.',
      maxListeners: 20,
    }),
  ],
  exports: [EventEmitterModule],
})
export class CoreEventsModule {}
```

**建议**: 
- 采用方案 A，直接使用 `EventEmitterModule`
- 删除 `EventPublisher` 和 `EventReplayService`（如果包含业务逻辑，移到 Business 层）


### 7. Utils 目录 (杂乱无章)

**文件**: `packages/core/src/utils/`

**问题**:
```
utils/
├── date.ts          # 日期工具
├── id.ts            # ID 生成
├── string.ts        # 字符串工具
├── validation.ts    # 验证工具
├── logger.ts        # 又一个 logger？
└── disposable.ts    # 资源管理
```

**违规原因**:
- 什么都往 `utils` 扔，没有分类和组织
- `logger.ts` 和 `logger/` 文件夹重复
- 应该按功能域分类，或者直接使用成熟库（`lodash`、`date-fns`）

**影响**:
- 代码难以查找和维护
- 重复造轮子（很多功能成熟库已经提供）
- 缺乏统一的工具函数标准

**解决方案**:

#### 方案 A: 使用成熟库 ✅ 推荐
```typescript
// ✅ 使用 date-fns 替代自定义日期工具
import { format, parseISO, addDays } from 'date-fns'

// ✅ 使用 nanoid 替代自定义 ID 生成
import { nanoid } from 'nanoid'

// ✅ 使用 lodash 替代自定义字符串工具
import { camelCase, kebabCase, snakeCase } from 'lodash'

// ✅ 使用 zod 替代自定义验证工具
import { z } from 'zod'
```

#### 方案 B: 按功能域重新组织
```typescript
// ✅ 按功能域分类
core/
├── id/              # ID 生成（如果有特殊需求）
│   └── nanoid.ts
├── validation/      # 验证（如果有特殊需求）
│   └── zod-helpers.ts
└── disposable/      # 资源管理（保留，这是基础设施）
    └── disposable.ts
```

**建议**:
- 删除 `date.ts`、`string.ts`，使用 `date-fns` 和 `lodash`
- 删除 `validation.ts`，使用 `zod`
- 删除 `logger.ts`（与 `logger/` 重复）
- 保留 `id.ts`（如果有特殊需求）和 `disposable.ts`（资源管理是基础设施）


## 📊 违规问题汇总

| 模块 | 问题 | 严重程度 | 应该在哪一层 | 代码量 |
|------|------|---------|------------|--------|
| **business-errors.ts** | 包含业务错误类 | 🔴 严重 | Business/Foundation | 500+ 行 |
| **rbac/** | 依赖业务概念 | 🔴 严重 | Foundation | 200+ 行 |
| **sse/** | 特定通信方式 | 🔴 严重 | Foundation | 100+ 行 |
| **queue/workers/repository.worker.ts** | 业务 Worker | 🔴 严重 | Business | 400+ 行 |
| **logger/logger.service.ts** | 仅仅是 re-export | 🟡 中等 | 删除或增强 | 5 行 |
| **events/** | 过度封装 | 🟡 中等 | 简化或删除 | 100+ 行 |
| **utils/** | 杂乱无章 | 🟡 中等 | 重组或使用成熟库 | 200+ 行 |

**总计**: 约 1,500+ 行代码违反 Core 层原则


## 🎯 正确的 Core 层设计

基于分层架构原则，Core 层应该只包含：

```
@juanie/core
├── database/           # ✅ 数据库连接、事务管理（不含 Schema）
│   ├── client.ts       # createDatabaseClient()
│   ├── database.module.ts
│   └── index.ts
│
├── redis/              # ✅ Redis 客户端封装
│   ├── client.ts       # createRedisClient()
│   ├── redis.module.ts
│   └── index.ts
│
├── queue/              # ✅ BullMQ 队列基础设施（不含 Worker）
│   ├── queue.module.ts
│   ├── tokens.ts
│   └── index.ts
│
├── config/             # ✅ 配置管理（环境变量、验证）
│   ├── config.module.ts
│   └── index.ts
│
├── encryption/         # ✅ 加密/解密工具
│   ├── encryption.service.ts
│   └── index.ts
│
├── storage/            # ✅ 对象存储（MinIO/S3）
│   ├── storage.service.ts
│   └── index.ts
│
├── observability/      # ✅ 日志、追踪、指标
│   ├── logger/         # 统一日志接口（或直接用 nestjs-pino）
│   ├── tracing/        # OpenTelemetry
│   └── metrics/        # Prometheus
│
├── errors/             # ✅ 基础错误类（不含业务错误）
│   ├── base-errors.ts  # BaseError, NotFoundError, ValidationError
│   └── index.ts
│
└── tokens/             # ✅ 依赖注入 Token
    └── index.ts
```

**应该移出 Core 的**:

```
❌ errors/business-errors.ts → 拆分
   - 基础错误类留在 Core（BaseError、HttpError）
   - 业务错误移到各服务层

❌ rbac/ → Foundation
   - 权限系统依赖用户、角色等业务概念

❌ sse/ → Foundation 或 Business
   - 按需使用的通信方式

❌ events/ → 简化或删除
   - 直接用 EventEmitter2，或提供极简封装

❌ queue/workers/ → 各服务层
   - Core 只提供 QueueModule
   - Worker 由 Business 层实现

❌ utils/ → 拆分或删除
   - 用成熟库替代（lodash、date-fns）
   - 或按功能域重新组织
```


## 🚀 重构优先级和计划

### 阶段 1: 高优先级（立即修复）🔥

**目标**: 移除明显的业务逻辑

#### 1.1 移除业务错误类
```bash
# 1. 在 Core 层只保留基础错误类
packages/core/src/errors/
├── base-errors.ts      # BaseError, NotFoundError, ValidationError, etc.
└── index.ts

# 2. 将业务错误移到各服务层
packages/services/business/src/projects/errors.ts
packages/services/business/src/deployments/errors.ts
packages/services/foundation/src/auth/errors.ts
```

**影响范围**: 所有使用业务错误类的地方（约 50+ 处）

**预计工作量**: 2-3 小时

#### 1.2 移除 Repository Worker
```bash
# 1. 移动 Worker 到 Business 层
mv packages/core/src/queue/workers/repository.worker.ts \
   packages/services/business/src/repositories/workers/

# 2. Core 层只保留 Queue 基础设施
packages/core/src/queue/
├── queue.module.ts
├── tokens.ts
└── index.ts
```

**影响范围**: Queue 模块的导入路径

**预计工作量**: 1 小时


### 阶段 2: 中优先级（逐步改进）🟡

**目标**: 移动业务功能到正确的层

#### 2.1 移动 RBAC 到 Foundation 层
```bash
# 1. 移动 RBAC 模块
mv packages/core/src/rbac/ \
   packages/services/foundation/src/rbac/

# 2. 修改依赖关系
# - 通过 Foundation 层服务获取数据
# - 不直接查询数据库
```

**影响范围**: 所有使用 RBAC 的地方（约 20+ 处）

**预计工作量**: 3-4 小时

#### 2.2 移动 SSE 到 Foundation 层
```bash
# 1. 移动 SSE 模块
mv packages/core/src/sse/ \
   packages/services/foundation/src/sse/

# 2. 依赖 Core 层的 EventEmitter2
```

**影响范围**: 所有使用 SSE 的地方（约 5+ 处）

**预计工作量**: 1-2 小时

#### 2.3 简化 Logger
```bash
# 方案 A: 直接删除 logger.service.ts，使用 nestjs-pino
rm packages/core/src/logger/logger.service.ts

# 方案 B: 提供真正的封装（如果需要）
# - 自动添加 context
# - 格式化错误
# - 统一日志格式
```

**影响范围**: 所有使用 Logger 的地方（约 100+ 处）

**预计工作量**: 2-3 小时（如果直接删除）或 4-5 小时（如果提供封装）


### 阶段 3: 低优先级（长期优化）🟢

**目标**: 优化和清理

#### 3.1 简化 Events 模块
```bash
# 方案 A: 直接使用 EventEmitterModule（推荐）
# - 删除 EventPublisher 和 EventReplayService
# - 直接注入 EventEmitter2

# 方案 B: 提供极简封装
# - 只保留配置
# - 不添加额外功能
```

**影响范围**: 所有使用 Events 的地方（约 30+ 处）

**预计工作量**: 2-3 小时

#### 3.2 重组 Utils 目录
```bash
# 1. 使用成熟库替代
# - date.ts → date-fns
# - string.ts → lodash
# - validation.ts → zod

# 2. 删除重复的 logger.ts

# 3. 保留必要的工具
# - id.ts（如果有特殊需求）
# - disposable.ts（资源管理）
```

**影响范围**: 所有使用 Utils 的地方（约 50+ 处）

**预计工作量**: 3-4 小时

#### 3.3 完善文档和测试
```bash
# 1. 更新 Core 包 README
# 2. 添加使用示例
# 3. 完善单元测试
# 4. 更新导入路径文档
```

**预计工作量**: 2-3 小时


## 📝 重构检查清单

### 阶段 1: 高优先级 🔥

- [ ] **移除业务错误类**
  - [ ] 在 Core 层创建 `base-errors.ts`（BaseError、NotFoundError、ValidationError）
  - [ ] 在 Business 层创建 `projects/errors.ts`（ProjectNotFoundError、ProjectInitializationError）
  - [ ] 在 Business 层创建 `deployments/errors.ts`（DeploymentNotFoundError）
  - [ ] 在 Foundation 层创建 `auth/errors.ts`（UnauthorizedError、InvalidStateError）
  - [ ] 更新所有导入路径（约 50+ 处）
  - [ ] 删除 `packages/core/src/errors/business-errors.ts`

- [ ] **移除 Repository Worker**
  - [ ] 移动 `repository.worker.ts` 到 `packages/services/business/src/repositories/workers/`
  - [ ] 更新 Worker 的依赖关系（通过 Business 层服务）
  - [ ] 更新导入路径
  - [ ] 删除 `packages/core/src/queue/workers/`

### 阶段 2: 中优先级 🟡

- [ ] **移动 RBAC 到 Foundation 层**
  - [ ] 移动 `packages/core/src/rbac/` 到 `packages/services/foundation/src/rbac/`
  - [ ] 修改 `CaslAbilityFactory` 依赖关系（通过 Foundation 层服务获取数据）
  - [ ] 更新所有导入路径（约 20+ 处）
  - [ ] 更新 `packages/core/package.json` exports

- [ ] **移动 SSE 到 Foundation 层**
  - [ ] 移动 `packages/core/src/sse/` 到 `packages/services/foundation/src/sse/`
  - [ ] 修改依赖关系（依赖 Core 层的 EventEmitter2）
  - [ ] 更新所有导入路径（约 5+ 处）
  - [ ] 更新 `packages/core/package.json` exports

- [ ] **简化 Logger**
  - [ ] 决定方案（直接删除 or 提供封装）
  - [ ] 如果删除：更新所有导入路径（约 100+ 处）
  - [ ] 如果封装：实现真正的增强功能
  - [ ] 删除 `packages/core/src/logger/logger.service.ts`

### 阶段 3: 低优先级 🟢

- [ ] **简化 Events 模块**
  - [ ] 决定方案（直接使用 EventEmitterModule or 极简封装）
  - [ ] 删除或移动 `EventPublisher` 和 `EventReplayService`
  - [ ] 更新所有导入路径（约 30+ 处）

- [ ] **重组 Utils 目录**
  - [ ] 安装成熟库（date-fns、lodash）
  - [ ] 替换 `date.ts` 使用 date-fns
  - [ ] 替换 `string.ts` 使用 lodash
  - [ ] 替换 `validation.ts` 使用 zod
  - [ ] 删除 `logger.ts`（重复）
  - [ ] 保留 `id.ts` 和 `disposable.ts`

- [ ] **完善文档和测试**
  - [ ] 更新 `packages/core/README.md`
  - [ ] 添加使用示例
  - [ ] 完善单元测试
  - [ ] 更新 `.kiro/steering/project-guide.md`


## 🔄 重构影响评估

### 影响范围统计

| 模块 | 受影响文件数 | 受影响代码行数 | 风险等级 |
|------|------------|--------------|---------|
| **business-errors.ts** | ~50 个文件 | ~200 行导入 | 🟡 中等 |
| **rbac/** | ~20 个文件 | ~100 行导入 | 🟡 中等 |
| **sse/** | ~5 个文件 | ~20 行导入 | 🟢 低 |
| **repository.worker.ts** | ~3 个文件 | ~10 行导入 | 🟢 低 |
| **logger/** | ~100 个文件 | ~300 行导入 | 🔴 高 |
| **events/** | ~30 个文件 | ~100 行导入 | 🟡 中等 |
| **utils/** | ~50 个文件 | ~150 行导入 | 🟡 中等 |

### 风险控制策略

#### 1. 渐进式重构
```bash
# ✅ 不要一次性重构所有模块
# ✅ 按优先级逐个重构
# ✅ 每个模块重构后立即测试

# 阶段 1: 移除业务错误类（2-3 小时）
# 阶段 2: 移除 Repository Worker（1 小时）
# 阶段 3: 移动 RBAC（3-4 小时）
# 阶段 4: 移动 SSE（1-2 小时）
# ...
```

#### 2. 保持向后兼容（临时）
```typescript
// ✅ 在过渡期保持旧的导出路径
// packages/core/src/errors/index.ts
export * from './base-errors'

// 临时保持向后兼容（添加 @deprecated 注释）
/** @deprecated 使用 @juanie/service-business/projects/errors */
export { ProjectNotFoundError } from '@juanie/service-business/projects/errors'
```

#### 3. 自动化测试
```bash
# ✅ 重构前运行所有测试
bun test

# ✅ 重构后再次运行测试
bun test

# ✅ 检查类型错误
bun run type-check
```

#### 4. 分支策略
```bash
# ✅ 为每个重构阶段创建独立分支
git checkout -b refactor/core-remove-business-errors
git checkout -b refactor/core-move-rbac
git checkout -b refactor/core-move-sse

# ✅ 每个分支独立测试和合并
# ✅ 避免大规模合并冲突
```


## 💡 重构最佳实践

### 1. 移除业务错误类的步骤

```bash
# Step 1: 创建基础错误类
# packages/core/src/errors/base-errors.ts
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
  ) {
    super(message)
    this.name = this.constructor.name
  }
}

export class NotFoundError extends BaseError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, 'NOT_FOUND', 404)
  }
}

# Step 2: 在各服务层创建业务错误
# packages/services/business/src/projects/errors.ts
import { NotFoundError } from '@juanie/core/errors'

export class ProjectNotFoundError extends NotFoundError {
  constructor(projectId: string) {
    super('Project', projectId)
  }
}

# Step 3: 批量替换导入路径
# 使用 IDE 的全局搜索替换功能
# 查找: import { ProjectNotFoundError } from '@juanie/core/errors'
# 替换: import { ProjectNotFoundError } from '@juanie/service-business/projects/errors'

# Step 4: 删除旧文件
rm packages/core/src/errors/business-errors.ts
```

### 2. 移动 RBAC 的步骤

```bash
# Step 1: 移动文件
mv packages/core/src/rbac/ packages/services/foundation/src/rbac/

# Step 2: 修改依赖关系
# packages/services/foundation/src/rbac/casl-ability.factory.ts
@Injectable()
export class CaslAbilityFactory {
  constructor(
    private readonly usersService: UsersService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async createForUser(userId: string, organizationId?: string) {
    // ✅ 通过 Foundation 层服务获取数据
    const orgMember = await this.organizationsService.getMember(userId, organizationId)
    const projectMembers = await this.projectsService.getUserProjects(userId)
    
    return defineAbilitiesFor({ id: userId }, orgMember, projectMembers)
  }
}

# Step 3: 更新导入路径
# 查找: import { CaslAbilityFactory } from '@juanie/core/rbac'
# 替换: import { CaslAbilityFactory } from '@juanie/service-foundation/rbac'

# Step 4: 更新 package.json exports
# packages/services/foundation/package.json
{
  "exports": {
    "./rbac": {
      "types": "./dist/rbac/index.d.ts",
      "default": "./dist/rbac/index.js"
    }
  }
}
```

### 3. 简化 Logger 的步骤

```bash
# 方案 A: 直接删除（推荐）

# Step 1: 删除 logger.service.ts
rm packages/core/src/logger/logger.service.ts

# Step 2: 批量替换导入路径
# 查找: import { Logger } from '@juanie/core/logger'
# 替换: import { PinoLogger } from 'nestjs-pino'

# Step 3: 更新构造函数
# 查找: constructor(private readonly logger: Logger)
# 替换: constructor(private readonly logger: PinoLogger)

# Step 4: 添加 setContext（如果需要）
constructor(private readonly logger: PinoLogger) {
  this.logger.setContext(MyService.name)
}
```


## 📈 重构收益

### 代码质量提升

| 指标 | 重构前 | 重构后 | 改善 |
|------|--------|--------|------|
| **Core 层代码量** | ~3,000 行 | ~1,500 行 | ⬇️ 50% |
| **业务逻辑耦合** | 严重 | 无 | ✅ 100% |
| **分层架构违规** | 7 个模块 | 0 个模块 | ✅ 100% |
| **可复用性** | 低 | 高 | ⬆️ 显著提升 |
| **可测试性** | 中等 | 高 | ⬆️ 显著提升 |

### 架构清晰度

**重构前**:
```
Core 层 = 基础设施 + 业务逻辑 + 特定功能 ❌
- 职责不清晰
- 难以理解
- 难以维护
```

**重构后**:
```
Core 层 = 纯基础设施 ✅
- 职责清晰
- 易于理解
- 易于维护
- 可独立复用
```

### 开发效率

**重构前**:
- ❌ 修改业务逻辑需要改 Core 层
- ❌ Core 层变更影响所有层
- ❌ 难以独立测试基础设施
- ❌ 新人难以理解架构

**重构后**:
- ✅ 业务逻辑在正确的层
- ✅ Core 层变更不影响业务层
- ✅ 可独立测试基础设施
- ✅ 架构清晰易懂

### 长期维护

**重构前**:
- ❌ 技术债务累积
- ❌ 重构成本越来越高
- ❌ 难以引入新功能

**重构后**:
- ✅ 技术债务清零
- ✅ 重构成本降低
- ✅ 易于引入新功能


## 🎓 架构原则总结

### Core 层的"三不原则"

1. **不包含业务概念**
   - ❌ 不能有 Project、Organization、User、Team
   - ✅ 只能有 Database、Queue、Cache、Logger

2. **不包含业务逻辑**
   - ❌ 不能有创建项目、管理用户、权限检查
   - ✅ 只能有连接数据库、发送消息、记录日志

3. **不依赖上层**
   - ❌ 不能依赖 Foundation、Business、Extensions
   - ✅ 只能依赖第三方库（Drizzle、BullMQ、Pino）

### 判断是否属于 Core 层的标准

**问题 1**: 这个功能是否所有项目都需要？
- ✅ 是 → 可能属于 Core 层
- ❌ 否 → 不属于 Core 层

**问题 2**: 这个功能是否包含业务概念？
- ✅ 是 → 不属于 Core 层
- ❌ 否 → 可能属于 Core 层

**问题 3**: 这个功能是否可以独立复用到其他项目？
- ✅ 是 → 可能属于 Core 层
- ❌ 否 → 不属于 Core 层

**示例**:

| 功能 | 所有项目都需要？ | 包含业务概念？ | 可独立复用？ | 结论 |
|------|----------------|--------------|------------|------|
| Database 连接 | ✅ 是 | ❌ 否 | ✅ 是 | ✅ Core 层 |
| Queue 基础设施 | ✅ 是 | ❌ 否 | ✅ 是 | ✅ Core 层 |
| RBAC 权限系统 | ❌ 否 | ✅ 是 | ❌ 否 | ❌ Foundation 层 |
| SSE 通信 | ❌ 否 | ❌ 否 | ⚠️ 部分 | ❌ Foundation 层 |
| Repository Worker | ❌ 否 | ✅ 是 | ❌ 否 | ❌ Business 层 |
| 业务错误类 | ❌ 否 | ✅ 是 | ❌ 否 | ❌ 各服务层 |


## 📚 参考文档

### 相关架构文档

- **分层架构分析**: `docs/architecture/layered-architecture-analysis.md`
  - 详细的分层架构设计
  - 各层职责和依赖关系
  - 重构策略和边界

- **Core 包设计审查**: `docs/architecture/core-package-design-review.md`
  - Core 包的设计问题
  - 具体的改进建议

- **分层架构违规**: `docs/architecture/layered-architecture-violations.md`
  - 所有层的违规问题
  - 跨层依赖分析

### 重构指南

- **Monorepo 最佳实践**: `docs/guides/monorepo-best-practices.md`
  - 单一依赖树管理
  - 包导入路径规范

- **分层架构执行**: `docs/guides/layered-architecture-enforcement.md`
  - 如何执行分层架构
  - 代码审查检查清单

### 项目指南

- **项目指南**: `.kiro/steering/project-guide.md`
  - 技术栈和项目结构
  - 导入示例和命名规范
  - 核心原则和协作建议


## 🎯 总结

### 核心发现

Core 包存在**严重的架构违规问题**，主要体现在：

1. **业务逻辑混入** - 包含 500+ 行业务错误类和 400+ 行业务 Worker
2. **职责不清** - RBAC、SSE 等业务功能放在基础设施层
3. **过度封装** - Logger、Events 等模块没有提供实际价值
4. **缺乏组织** - Utils 目录杂乱无章

### 重构建议

**立即执行（阶段 1）**:
- 移除业务错误类 → 拆分到各服务层
- 移除 Repository Worker → 移到 Business 层

**逐步改进（阶段 2）**:
- 移动 RBAC → Foundation 层
- 移动 SSE → Foundation 层
- 简化 Logger → 直接使用 nestjs-pino

**长期优化（阶段 3）**:
- 简化 Events → 直接使用 EventEmitter2
- 重组 Utils → 使用成熟库
- 完善文档和测试

### 预期收益

- ✅ Core 层代码量减少 50%
- ✅ 分层架构违规清零
- ✅ 可复用性和可测试性显著提升
- ✅ 架构清晰度大幅改善
- ✅ 开发效率和维护性提高

### 下一步行动

1. **评审本文档** - 确认分析和建议是否合理
2. **制定详细计划** - 确定重构时间表和负责人
3. **开始阶段 1** - 移除业务错误类和 Repository Worker
4. **持续迭代** - 按优先级逐步完成所有重构

---

**文档版本**: v1.0  
**最后更新**: 2024-12-24  
**作者**: 资深架构师  
**状态**: ✅ 待评审

