# @juanie/core

核心基础设施包 - 提供数据库、队列、加密、存储等纯基础设施功能

## 📦 包含模块

### 🗄️ Database

数据库连接和 Schema 定义。

**导入**:
```typescript
import * as schema from '@juanie/database'
import { createDatabaseClient } from '@juanie/core/database'
import type { DatabaseClient } from '@juanie/core/database'
```

**使用**:
```typescript
import { Inject, Injectable } from '@nestjs/common'
import { eq } from 'drizzle-orm'
import { DATABASE } from '@juanie/core/tokens'

@Injectable()
export class MyService {
  constructor(
    @Inject(DATABASE) private db: DatabaseClient
  ) {}
  
  async getUser(id: string) {
    return this.db.query.users.findFirst({
      where: eq(schema.users.id, id)
    })
  }
}
```

---

### 📬 Queue

BullMQ 队列系统，用于异步任务处理。

**导入**:
```typescript
import { QueueModule, DEPLOYMENT_QUEUE, PROJECT_INITIALIZATION_QUEUE } from '@juanie/core/queue'
import { InjectQueue } from '@nestjs/bullmq'
import type { Queue } from 'bullmq'
```

**模块注册**:
```typescript
@Module({
  imports: [QueueModule]
})
export class MyModule {}
```

**使用**:
```typescript
@Injectable()
export class MyService {
  constructor(
    @InjectQueue(DEPLOYMENT_QUEUE) private queue: Queue
  ) {}
  
  async triggerDeployment(data: DeploymentData) {
    await this.queue.add('deploy', data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 }
    })
  }
}
```

**可用的队列**:
- `DEPLOYMENT_QUEUE` - 部署队列
- `PROJECT_INITIALIZATION_QUEUE` - 项目初始化队列
- `GIT_SYNC_QUEUE` - Git 同步队列
- `REPOSITORY_QUEUE` - 仓库队列
- `PIPELINE_QUEUE` - 流水线队列

**注意**: Workers 已移动到各服务层，Core 层只提供队列基础设施。

---

### 📡 Events

EventEmitter2 事件系统，用于模块间通信。

**导入**:
```typescript
import { EventEmitter2 } from '@nestjs/event-emitter'
import { OnEvent } from '@nestjs/event-emitter'
import { CoreEventsModule } from '@juanie/core/events'
import { DomainEvents, SystemEvents } from '@juanie/core/events'
```

**模块注册**:
```typescript
@Module({
  imports: [CoreEventsModule]
})
export class MyModule {}
```

**发布事件**:
```typescript
@Injectable()
export class MyService {
  constructor(
    private eventEmitter: EventEmitter2
  ) {}
  
  async createProject(data: any) {
    const project = await this.db.insert(schema.projects).values(data)
    
    // 发布领域事件
    this.eventEmitter.emit(
      DomainEvents.PROJECT_CREATED,
      { projectId: project.id, userId: data.userId }
    )
  }
}
```

**监听事件**:
```typescript
@Injectable()
export class MyListener {
  @OnEvent(DomainEvents.PROJECT_CREATED)
  async handleProjectCreated(payload: { projectId: string }) {
    // 处理项目创建事件
  }
}
```

**可用的事件常量**:
- `DomainEvents.*` - 领域事件（项目、部署等）
- `SystemEvents.*` - 系统事件（K8s 资源变化等）

---

### 📝 Logger

使用 nestjs-pino 进行结构化日志记录。

**导入**:
```typescript
import { PinoLogger } from 'nestjs-pino'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  constructor(
    private readonly logger: PinoLogger
  ) {
    this.logger.setContext(MyService.name)
  }
  
  async doSomething() {
    this.logger.info('Starting operation...')
    
    try {
      // ... 业务逻辑
      this.logger.info('Operation completed', { result: 'success' })
    } catch (error) {
      this.logger.error('Operation failed', error)
      throw error
    }
  }
}
```

**日志级别**:
- `logger.info()` - 信息日志
- `logger.error()` - 错误日志
- `logger.warn()` - 警告日志
- `logger.debug()` - 调试日志

---

### ⚠️ Errors

基础错误类，业务错误在各服务层定义。

**导入**:
```typescript
import { 
  BaseError, 
  NotFoundError, 
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  OperationFailedError,
  ErrorFactory,
  handleServiceError
} from '@juanie/core/errors'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  async getProject(id: string) {
    const project = await this.db.query.projects.findFirst({
      where: eq(schema.projects.id, id)
    })
    
    if (!project) {
      throw new NotFoundError('Project', id)
    }
    
    return project
  }
  
  async updateProject(id: string, data: any) {
    if (!data.name) {
      throw new ValidationError('name', 'Name is required')
    }
    
    // ... 更新逻辑
  }
}
```

**业务错误**:
- Foundation 层错误: `@juanie/service-foundation/errors`
- Business 层错误: `@juanie/service-business/errors`

---

### 🔐 Encryption

AES-256-GCM 加密服务。

**导入**:
```typescript
import { EncryptionService } from '@juanie/core/encryption'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  constructor(
    private encryption: EncryptionService
  ) {}
  
  async storeToken(token: string) {
    const encrypted = this.encryption.encrypt(token)
    // 存储 encrypted
  }
  
  async getToken(encrypted: string) {
    return this.encryption.decrypt(encrypted)
  }
}
```

**环境变量**: `ENCRYPTION_KEY` (32 字符)

---

### 📦 Storage

MinIO 对象存储服务。

**导入**:
```typescript
import { StorageService } from '@juanie/core/storage'
```

**使用**:
```typescript
@Injectable()
export class MyService {
  constructor(
    private storage: StorageService
  ) {}
  
  async uploadFile(file: Buffer) {
    const url = await this.storage.uploadFile(
      'path/to/file.png',
      file,
      'image/png'
    )
    return url
  }
}
```

**环境变量**: `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`

---

### 🛠️ Utils

基础工具函数。

**导入**:
```typescript
import { generateId } from '@juanie/core/utils'
```

**可用函数**:
- `generateId()` - 生成唯一 ID (使用 cuid2)
- `Disposable` - 资源清理接口

**日期和字符串工具已移除，请使用**:
- 日期: `date-fns`
- 字符串: `lodash`

---

## 🚫 不要做的事

### ❌ 不要绕过 Foundation 层直接查询数据库

**错误示例**:
```typescript
// ❌ Business 层直接查询 organizations 表
@Injectable()
export class ProjectsService {
  async create(data: CreateProjectInput) {
    const [org] = await this.db
      .select()
      .from(schema.organizations)  // ❌ 绕过 Foundation 层
      .where(eq(schema.organizations.id, data.organizationId))
  }
}
```

**正确做法**:
```typescript
// ✅ 通过 Foundation 层的 OrganizationsService
@Injectable()
export class ProjectsService {
  constructor(
    private organizationsService: OrganizationsService  // ✅ 注入 Foundation 服务
  ) {}
  
  async create(data: CreateProjectInput) {
    const org = await this.organizationsService.get(
      data.organizationId,
      userId
    )
    
    if (!org) {
      throw new NotFoundError('Organization', data.organizationId)
    }
  }
}
```

**原因**:
- Foundation 层负责基础实体（users, organizations, teams）的管理
- Business 层应该通过 Foundation 层的 Service 访问这些实体
- 这样可以统一权限检查、缓存策略、错误处理

**可以直接查询的表**:
- ✅ Business 层自己的表: `projects`, `deployments`, `environments`, `pipelines`
- ❌ Foundation 层的表: `users`, `organizations`, `teams` - 必须通过 Service

---

### ❌ 不要深层导入

**错误示例**:
```typescript
// ❌ 深层导入
import { users } from '@juanie/core/database/schemas/users'
```

**正确做法**:
```typescript
// ✅ 从模块入口导入
import * as schema from '@juanie/database'

const user = schema.users
```

---

### ❌ 不要在 Core 包添加业务逻辑

**Core 包只包含纯基础设施，不包含任何业务逻辑**

**错误示例**:
```typescript
// ❌ 在 Core 包添加业务逻辑
// packages/core/src/database/helpers/project-helpers.ts
export function canUserAccessProject(userId: string, projectId: string) {
  // 业务逻辑不应该在 Core 包
}
```

**正确做法**:
```typescript
// ✅ 业务逻辑放在 Foundation/Business 层
// packages/services/foundation/src/projects/projects.service.ts
export class ProjectsService {
  async canUserAccess(userId: string, projectId: string) {
    // 业务逻辑在 Service 层
  }
}
```

---

## 📚 更多文档

- [Core 包重构总结](../../docs/architecture/core-refactoring-summary.md)
- [Core 包重构执行日志](../../docs/architecture/core-refactoring-execution-log.md)
- [分层架构指南](../../docs/guides/layered-architecture-enforcement.md)
- [数据库设计规范](../../docs/architecture/database-design-standards.md)

---

## 🤝 贡献指南

### 添加新的 Schema

1. 在 `packages/database/src/schemas/` 创建新文件
2. 在 `packages/database/src/index.ts` 导出
3. 运行 `bun run db:push` 应用迁移

### 添加新的队列

1. 在 `src/queue/tokens.ts` 定义队列名称
2. 在 `src/queue/queue.module.ts` 注册队列
3. 在 `src/queue/index.ts` 导出

### 添加新的事件

1. 在 `src/events/event-types.ts` 定义事件名称
2. 在 `src/events/index.ts` 导出

---

## 📄 License

MIT
