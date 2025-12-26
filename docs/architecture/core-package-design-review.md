# Core 包设计评审与最佳实践

> 创建时间: 2024-12-24
> 状态: ✅ 设计合理，需要补充保障机制

## 📋 评审总结

### 整体评价: ✅ 优秀

Core 包的设计和组织**非常合理**，符合现代 Monorepo 最佳实践：

- ✅ 职责清晰（纯基础设施，零业务逻辑）
- ✅ 模块化良好（Database, Queue, Events, Logger 等独立模块）
- ✅ 导出规范（统一的 index.ts 导出）
- ✅ 类型安全（TypeScript 严格模式）
- ✅ 依赖合理（只依赖 @juanie/types）

---

## 🎯 设计优点分析

### 1. 清晰的模块划分

```
packages/core/src/
├── database/          # 数据库层（Schema + ORM）
├── queue/             # 队列系统（BullMQ）
├── events/            # 事件系统（EventEmitter2）
├── logger/            # 日志系统（Pino）
├── observability/     # 可观测性（OpenTelemetry）
├── rbac/              # 权限控制（CASL）
├── sse/               # Server-Sent Events
├── errors/            # 错误处理
├── tokens/            # NestJS DI Tokens
└── utils/             # 工具函数
```

**优点**:
- ✅ 每个模块职责单一
- ✅ 模块之间低耦合
- ✅ 易于理解和维护

### 2. 规范的导出结构

**package.json 的 exports 字段**:
```json
{
  "exports": {
    ".": "./dist/index.js",
    "./database": "./dist/database/index.js",
    "./queue": "./dist/queue/index.js",
    "./events": "./dist/events/index.js",
    // ... 其他模块
  }
}
```

**优点**:
- ✅ 支持子路径导入（`@juanie/core/database`）
- ✅ 避免深层导入（不能 `@juanie/core/database/schemas/users`）
- ✅ 明确的 API 边界

### 3. 统一的 index.ts 导出

**每个模块都有 index.ts**:
```typescript
// packages/core/src/database/index.ts
export * from './client'
export { DatabaseModule } from './database.module'
export * from './relations'
export * from './schemas'
```

**优点**:
- ✅ 统一的导入入口
- ✅ 易于控制导出内容
- ✅ 便于重构（内部结构变化不影响外部）

### 4. 合理的依赖关系

```json
{
  "dependencies": {
    "@juanie/types": "workspace:*",  // ✅ 只依赖 types 包
    "@nestjs/common": "^11.1.7",     // ✅ 框架依赖
    "drizzle-orm": "0.45.0",         // ✅ ORM 依赖
    "bullmq": "^5.36.3",             // ✅ 队列依赖
    // ... 其他基础设施依赖
  }
}
```

**优点**:
- ✅ 不依赖 Foundation/Business 层（避免循环依赖）
- ✅ 只包含基础设施依赖
- ✅ 依赖版本统一管理

---

## ⚠️ 潜在问题

### 问题 1: 缺少使用文档

**现状**: 没有明确的 API 文档

**影响**:
- ❌ 下游开发者不知道有哪些功能可用
- ❌ 容易重复造轮子
- ❌ 容易误用或绕过

**解决方案**: 见下文"保障机制"

### 问题 2: 缺少使用示例

**现状**: 没有示例代码

**影响**:
- ❌ 下游开发者不知道如何正确使用
- ❌ 学习成本高

**解决方案**: 见下文"保障机制"

### 问题 3: 缺少架构约束

**现状**: 没有 ESLint 规则防止违规

**影响**:
- ❌ Business 层可以绕过 Foundation 层直接查询数据库
- ❌ 分层架构容易被破坏

**解决方案**: 见下文"保障机制"

---

## 🛡️ 如何保证下游正确使用

### 保障机制 1: API 文档（README.md）

**创建**: `packages/core/README.md`

```markdown
# @juanie/core

核心基础设施包 - 提供数据库、队列、事件、日志等基础功能

## 📦 包含模块

### Database
- **Schema 定义**: 所有数据库表的 Drizzle Schema
- **ORM 客户端**: PostgreSQL 数据库客户端
- **Relations**: 表关系定义

**导入**:
```typescript
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  constructor(
    @Inject(DATABASE) private db: Database
  ) {}
  
  async getUser(id: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id)
    })
  }
}
```

### Queue
- **BullMQ 集成**: 队列系统
- **Job 事件发布**: 自动发布 Job 事件

**导入**:
```typescript
import { QueueModule, DEPLOYMENT_QUEUE } from '@juanie/core/queue'
```

**使用**:
```typescript
@Module({
  imports: [QueueModule]
})
export class MyModule {}

@Injectable()
export class MyService {
  constructor(
    @InjectQueue(DEPLOYMENT_QUEUE) private queue: Queue
  ) {}
  
  async triggerDeployment(data: any) {
    await this.queue.add('deploy', data)
  }
}
```

### Events
- **EventEmitter2 集成**: 事件系统
- **事件发布器**: 统一的事件发布接口

**导入**:
```typescript
import { EventPublisher, DomainEvents } from '@juanie/core/events'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  constructor(
    private eventPublisher: EventPublisher
  ) {}
  
  async createProject(data: any) {
    // ... 创建项目
    
    await this.eventPublisher.publish(
      DomainEvents.PROJECT_CREATED,
      { projectId: project.id }
    )
  }
}
```

### Logger
- **Pino 集成**: 结构化日志
- **上下文日志**: 自动添加上下文信息

**导入**:
```typescript
import { Logger } from '@juanie/core/logger'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name)
  
  async doSomething() {
    this.logger.log('Doing something...')
    this.logger.error('Something went wrong', error)
  }
}
```

### Errors
- **统一错误处理**: 标准化的错误类型
- **错误工厂**: 创建业务错误

**导入**:
```typescript
import { BusinessError, ErrorFactory } from '@juanie/core/errors'
```

**使用**:
```typescript
throw ErrorFactory.notFound('Project', projectId)
throw ErrorFactory.forbidden('You do not have permission')
throw ErrorFactory.validation('name', 'Name is required')
```

### Utils
- **ID 生成**: `generateId()`, `generateSlug()`
- **日期处理**: `formatDate()`, `parseDate()`
- **字符串处理**: `slugify()`, `truncate()`
- **验证**: `isValidEmail()`, `isValidUrl()`

**导入**:
```typescript
import { generateId, slugify } from '@juanie/core/utils'
```

## 🚫 不要做的事

### ❌ 不要绕过 Foundation 层直接查询数据库

**错误示例**:
```typescript
// ❌ Business 层直接查询 organizations 表
const [org] = await this.db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.id, orgId))
```

**正确做法**:
```typescript
// ✅ 通过 Foundation 层的 OrganizationsService
const org = await this.organizationsService.get(orgId, userId)
```

### ❌ 不要深层导入

**错误示例**:
```typescript
// ❌ 深层导入
import { users } from '@juanie/core/database/schemas/users'
```

**正确做法**:
```typescript
// ✅ 从模块入口导入
import * as schema from '@juanie/core/database'
const user = schema.users
```

### ❌ 不要在 Core 包添加业务逻辑

**Core 包只包含基础设施，不包含任何业务逻辑**

## 📚 更多文档

- [分层架构指南](../../docs/architecture/layered-architecture-analysis.md)
- [数据库设计规范](../../docs/architecture/database-design-standards.md)
```

### 保障机制 2: 使用示例（examples/）

**创建**: `packages/core/examples/`

```typescript
// packages/core/examples/database-usage.ts
/**
 * 数据库使用示例
 */
import * as schema from '@juanie/core/database'
import { DATABASE } from '@juanie/core/tokens'
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'

@Injectable()
export class ExampleService {
  constructor(
    @Inject(DATABASE) private db: Database
  ) {}
  
  // ✅ 正确: 查询单个用户
  async getUser(id: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id)
    })
  }
  
  // ✅ 正确: 查询用户列表
  async listUsers() {
    return this.db.query.users.findMany({
      limit: 10
    })
  }
  
  // ✅ 正确: 创建用户
  async createUser(data: { email: string; name: string }) {
    const [user] = await this.db
      .insert(schema.users)
      .values(data)
      .returning()
    
    return user
  }
}
```

```typescript
// packages/core/examples/queue-usage.ts
/**
 * 队列使用示例
 */
import { DEPLOYMENT_QUEUE } from '@juanie/core/queue'
import { InjectQueue } from '@nestjs/bull'
import { Injectable } from '@nestjs/common'
import type { Queue } from 'bullmq'

@Injectable()
export class ExampleService {
  constructor(
    @InjectQueue(DEPLOYMENT_QUEUE) private queue: Queue
  ) {}
  
  // ✅ 正确: 添加 Job
  async triggerDeployment(projectId: string) {
    await this.queue.add('deploy', {
      projectId,
      timestamp: Date.now()
    })
  }
  
  // ✅ 正确: 获取 Job 状态
  async getJobStatus(jobId: string) {
    const job = await this.queue.getJob(jobId)
    return job?.getState()
  }
}
```

### 保障机制 3: ESLint 规则

**创建**: `packages/core/.eslintrc.js`

```javascript
module.exports = {
  rules: {
    // 禁止从 Foundation/Business 层导入
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@juanie/service-foundation*', '@juanie/service-business*'],
            message: 'Core 层不能依赖 Foundation/Business 层'
          }
        ]
      }
    ]
  }
}
```

**创建**: `packages/services/business/.eslintrc.js`

```javascript
module.exports = {
  rules: {
    // 禁止直接从 core/database 导入 schema 并查询 Foundation 层的表
    'no-restricted-syntax': [
      'error',
      {
        selector: 'MemberExpression[object.name="schema"][property.name=/^(organizations|organizationMembers|teams|teamMembers|users)$/]',
        message: 'Business 层不能直接查询 Foundation 层的表，请使用 Foundation 层的 Service'
      }
    ]
  }
}
```

### 保障机制 4: 类型检查

**利用 TypeScript 的类型系统**:

```typescript
// packages/core/src/database/index.ts

/**
 * ⚠️ 警告: 直接使用 Database Schema 查询
 * 
 * 如果你在 Business 层使用这些 Schema，请确保：
 * 1. 你查询的是 Business 层自己的表（projects, deployments 等）
 * 2. 如果查询 Foundation 层的表（organizations, users 等），
 *    请使用 Foundation 层的 Service
 * 
 * 错误示例:
 * ```typescript
 * // ❌ Business 层直接查询 organizations 表
 * const org = await this.db.query.organizations.findFirst(...)
 * ```
 * 
 * 正确做法:
 * ```typescript
 * // ✅ 通过 Foundation 层的 OrganizationsService
 * const org = await this.organizationsService.get(orgId, userId)
 * ```
 */
export * from './schemas'
```

### 保障机制 5: 代码审查清单

**创建**: `docs/guides/code-review-checklist.md`

```markdown
# 代码审查清单

## Core 包

- [ ] 没有业务逻辑
- [ ] 没有依赖 Foundation/Business 层
- [ ] 所有导出都通过 index.ts
- [ ] 有对应的类型定义

## Foundation 层

- [ ] 只依赖 Core 层
- [ ] 不依赖 Business 层
- [ ] Service 方法有明确的职责
- [ ] 有单元测试

## Business 层

- [ ] 不直接查询 Foundation 层的表
- [ ] 通过 Foundation 层的 Service 访问数据
- [ ] 复杂查询有注释说明
- [ ] 有集成测试

## 分层架构检查

### ❌ 违规示例

```typescript
// Business 层直接查询 organizations 表
const [org] = await this.db
  .select()
  .from(schema.organizations)
  .where(eq(schema.organizations.id, orgId))
```

### ✅ 正确示例

```typescript
// 通过 Foundation 层的 OrganizationsService
const org = await this.organizationsService.get(orgId, userId)
```
```

### 保障机制 6: 自动化测试

**创建**: `packages/core/tests/architecture.test.ts`

```typescript
import { describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Core Package Architecture', () => {
  it('should not import from Foundation layer', () => {
    const coreFiles = getAllTsFiles('packages/core/src')
    
    for (const file of coreFiles) {
      const content = fs.readFileSync(file, 'utf-8')
      
      expect(content).not.toMatch(/@juanie\/service-foundation/)
      expect(content).not.toMatch(/@juanie\/service-business/)
    }
  })
  
  it('should export through index.ts', () => {
    const modules = [
      'database',
      'queue',
      'events',
      'logger',
      'errors',
      'utils'
    ]
    
    for (const module of modules) {
      const indexPath = path.join('packages/core/src', module, 'index.ts')
      expect(fs.existsSync(indexPath)).toBe(true)
    }
  })
})

function getAllTsFiles(dir: string): string[] {
  // ... 实现
}
```

---

## 📋 实施计划

### Phase 1: 文档完善（1 天）

- [ ] 创建 `packages/core/README.md`
- [ ] 创建 `packages/core/examples/`
- [ ] 更新 `docs/architecture/layered-architecture-analysis.md`

### Phase 2: 规则配置（0.5 天）

- [ ] 配置 ESLint 规则
- [ ] 添加类型检查警告
- [ ] 创建代码审查清单

### Phase 3: 自动化测试（0.5 天）

- [ ] 添加架构测试
- [ ] 添加 CI 检查
- [ ] 配置 pre-commit hook

### Phase 4: 团队培训（0.5 天）

- [ ] 分享文档
- [ ] 代码示例演示
- [ ] Q&A 答疑

---

## 🎯 预期效果

### 1. 下游开发者知道有什么可用

✅ README.md 列出所有模块和功能
✅ 示例代码展示如何使用
✅ 文档说明不要做什么

### 2. 下游开发者知道如何正确使用

✅ 详细的使用示例
✅ 常见错误和正确做法对比
✅ 代码审查清单

### 3. 自动防止违规

✅ ESLint 规则自动检查
✅ 架构测试自动验证
✅ CI 自动拦截违规代码

### 4. 持续改进

✅ 代码审查时参考清单
✅ 定期审计分层架构
✅ 及时更新文档和示例

---

## 📚 参考资料

- [分层架构分析](./layered-architecture-analysis.md)
- [分层架构违规](./layered-architecture-violations.md)
- [分层架构修复进度](./layered-architecture-fix-progress.md)
- [Monorepo 最佳实践](../guides/monorepo-best-practices.md)

---

## 总结

### Core 包设计: ✅ 优秀

- 职责清晰
- 模块化良好
- 导出规范
- 依赖合理

### 需要补充: 保障机制

- 📖 API 文档
- 📝 使用示例
- 🛡️ ESLint 规则
- ✅ 自动化测试
- 📋 代码审查清单

**实施这些保障机制后，可以确保下游正确使用 Core 包，避免重复造轮子和违反分层架构。**
