# 任务 2: 事件系统优化

**优先级**: 🔴 高  
**预计时间**: 2天  
**依赖**: 任务 1 (服务冗余清理)

---

## 📋 问题描述

### 现状

1. **三种事件机制混用**
   - Redis Pub/Sub: 用于实时推送
   - NestJS EventEmitter: 用于应用内事件
   - BullMQ: 用于异步任务
   - 开发者不知道该用哪种

2. **事件命名不统一**
   ```typescript
   // 三种不同的命名风格
   'project:init'           // Redis 风格
   'project.created'        // 点分隔风格
   'PROJECT_CREATED'        // 常量风格
   ```

3. **事件数据结构不一致**
   ```typescript
   // 有的带 timestamp，有的不带
   { projectId: 'xxx' }
   { projectId: 'xxx', timestamp: Date.now() }
   { project_id: 'xxx', created_at: '2024-01-01' }
   ```

4. **缺少事件版本控制**
   - 事件结构变更时没有版本号
   - 旧版本消费者可能出错

5. **没有事件重放机制**
   - 事件丢失无法追踪
   - 调试困难

### 影响

- ❌ 开发者困惑，不知道该用哪种事件
- ❌ 事件丢失难以追踪和恢复
- ❌ 系统升级时事件兼容性问题
- ❌ 调试和监控困难

---

## 🎯 方案选择

### 方案对比

| 方案 | 优点 | 缺点 | 评分 |
|------|------|------|------|
| A. 统一使用 Redis Pub/Sub | 支持分布式 | 无持久化，事件可能丢失 | ❌ |
| B. 统一使用 BullMQ | 有持久化和重试 | 不适合实时事件，延迟高 | ❌ |
| C. 分层使用 + 统一规范 | 各取所长，职责清晰 | 需要制定规范 | ✅ 推荐 |

### 选择方案 C 的理由

1. **分层清晰** - 不同场景用不同机制
2. **性能最优** - 实时事件用 Redis，异步任务用 BullMQ
3. **可靠性高** - 重要事件有持久化
4. **易于理解** - 规范明确，开发者知道该用哪种

---

## 🔧 实施步骤

### 2.1 定义事件分层规范 (0.5天)

#### 创建事件类型定义

```typescript
// packages/core/src/events/event-types.ts

/**
 * 事件分层规范
 * 
 * 1. 领域事件 (Domain Events) - 使用 NestJS EventEmitter
 *    - 同步处理，应用内部
 *    - 例如: user.created, project.updated
 * 
 * 2. 集成事件 (Integration Events) - 使用 BullMQ
 *    - 异步处理，需要持久化和重试
 *    - 例如: deployment.queued, gitops.sync
 * 
 * 3. 实时事件 (Realtime Events) - 使用 Redis Pub/Sub
 *    - 推送到前端，不需要持久化
 *    - 例如: progress.updated, status.changed
 */

/**
 * 事件命名规范: <domain>.<action>.<status>
 */
export const DomainEvents = {
  // 项目事件
  PROJECT_CREATED: 'project.created',
  PROJECT_UPDATED: 'project.updated',
  PROJECT_DELETED: 'project.deleted',
  
  // 初始化事件
  INIT_STARTED: 'project.init.started',
  INIT_STEP_COMPLETED: 'project.init.step_completed',
  INIT_COMPLETED: 'project.init.completed',
  INIT_FAILED: 'project.init.failed',
  
  // 用户事件
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
} as const

export const IntegrationEvents = {
  // 部署事件
  DEPLOYMENT_QUEUED: 'deployment.queued',
  DEPLOYMENT_PROCESSING: 'deployment.processing',
  DEPLOYMENT_COMPLETED: 'deployment.completed',
  DEPLOYMENT_FAILED: 'deployment.failed',
  
  // GitOps 事件
  GITOPS_SYNC_QUEUED: 'gitops.sync.queued',
  GITOPS_SYNC_COMPLETED: 'gitops.sync.completed',
  GITOPS_SYNC_FAILED: 'gitops.sync.failed',
} as const

export const RealtimeEvents = {
  // 进度事件
  PROGRESS_UPDATED: 'progress.updated',
  STATUS_CHANGED: 'status.changed',
  
  // 通知事件
  NOTIFICATION_SENT: 'notification.sent',
} as const

/**
 * 事件数据基类
 */
export interface BaseEvent {
  /** 事件 ID */
  id: string
  /** 事件类型 */
  type: string
  /** 事件版本 */
  version: number
  /** 时间戳 */
  timestamp: number
  /** 关联的资源 ID */
  resourceId: string
  /** 触发用户 ID */
  userId?: string
}

/**
 * 项目创建事件
 */
export interface ProjectCreatedEvent extends BaseEvent {
  type: typeof DomainEvents.PROJECT_CREATED
  version: 1
  data: {
    projectId: string
    name: string
    organizationId: string
    createdBy: string
  }
}

/**
 * 进度更新事件
 */
export interface ProgressUpdatedEvent extends BaseEvent {
  type: typeof RealtimeEvents.PROGRESS_UPDATED
  version: 1
  data: {
    projectId: string
    step: string
    progress: number
    message: string
  }
}
```

---

### 2.2 实现事件发布器 (0.5天)

#### 创建统一的事件发布器

```typescript
// packages/core/src/events/event-publisher.service.ts

import { Injectable } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { Queue } from 'bullmq'
import Redis from 'ioredis'
import { nanoid } from 'nanoid'
import type { BaseEvent } from './event-types'

@Injectable()
export class EventPublisher {
  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly redis: Redis,
    private readonly queue: Queue,
  ) {}

  /**
   * 发布领域事件（同步）
   */
  async publishDomain<T extends BaseEvent>(event: Omit<T, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent = this.enrichEvent(event)
    
    // 使用 NestJS EventEmitter
    this.eventEmitter.emit(event.type, fullEvent)
    
    // 记录事件日志
    await this.logEvent(fullEvent)
  }

  /**
   * 发布集成事件（异步，持久化）
   */
  async publishIntegration<T extends BaseEvent>(
    event: Omit<T, 'id' | 'timestamp'>,
  ): Promise<void> {
    const fullEvent = this.enrichEvent(event)
    
    // 添加到 BullMQ 队列
    await this.queue.add(event.type, fullEvent, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    })
    
    // 记录事件日志
    await this.logEvent(fullEvent)
  }

  /**
   * 发布实时事件（推送到前端）
   */
  async publishRealtime<T extends BaseEvent>(
    event: Omit<T, 'id' | 'timestamp'>,
  ): Promise<void> {
    const fullEvent = this.enrichEvent(event)
    
    // 发布到 Redis Pub/Sub
    const channel = `realtime:${event.resourceId}`
    await this.redis.publish(channel, JSON.stringify(fullEvent))
    
    // 记录事件日志（可选）
    await this.logEvent(fullEvent)
  }

  /**
   * 丰富事件数据
   */
  private enrichEvent<T extends BaseEvent>(event: Omit<T, 'id' | 'timestamp'>): T {
    return {
      ...event,
      id: nanoid(),
      timestamp: Date.now(),
    } as T
  }

  /**
   * 记录事件日志
   */
  private async logEvent(event: BaseEvent): Promise<void> {
    // 存储到数据库或日志系统
    await this.redis.zadd(
      `events:${event.resourceId}`,
      event.timestamp,
      JSON.stringify(event),
    )
    
    // 设置过期时间（30天）
    await this.redis.expire(`events:${event.resourceId}`, 30 * 24 * 60 * 60)
  }
}
```

---

### 2.3 更新现有代码使用新规范 (0.5天)

#### 示例：项目服务

```typescript
// packages/services/business/src/projects/projects.service.ts

@Injectable()
export class ProjectsService {
  constructor(
    private readonly eventPublisher: EventPublisher,
  ) {}

  async create(userId: string, input: CreateProjectInput) {
    // 创建项目
    const project = await this.db.insert(schema.projects).values({
      ...input,
      createdBy: userId,
    }).returning()

    // ✅ 发布领域事件（同步）
    await this.eventPublisher.publishDomain<ProjectCreatedEvent>({
      type: DomainEvents.PROJECT_CREATED,
      version: 1,
      resourceId: project.id,
      userId,
      data: {
        projectId: project.id,
        name: project.name,
        organizationId: project.organizationId,
        createdBy: userId,
      },
    })

    // ✅ 发布集成事件（异步初始化）
    await this.eventPublisher.publishIntegration({
      type: IntegrationEvents.INIT_QUEUED,
      version: 1,
      resourceId: project.id,
      userId,
      data: {
        projectId: project.id,
      },
    })

    return project
  }
}
```

#### 示例：进度管理

```typescript
// packages/services/business/src/projects/initialization/progress-manager.service.ts

@Injectable()
export class ProgressManagerService {
  constructor(
    private readonly eventPublisher: EventPublisher,
  ) {}

  async updateProgress(projectId: string, step: string, progress: number) {
    // 更新数据库
    await this.updateDatabase(projectId, step, progress)

    // ✅ 发布实时事件（推送到前端）
    await this.eventPublisher.publishRealtime<ProgressUpdatedEvent>({
      type: RealtimeEvents.PROGRESS_UPDATED,
      version: 1,
      resourceId: projectId,
      data: {
        projectId,
        step,
        progress,
        message: `正在执行: ${step}`,
      },
    })
  }
}
```

---

### 2.4 实现事件重放机制 (0.5天)

#### 创建事件重放服务

```typescript
// packages/core/src/events/event-replay.service.ts

@Injectable()
export class EventReplayService {
  constructor(
    private readonly redis: Redis,
    private readonly eventPublisher: EventPublisher,
  ) {}

  /**
   * 获取资源的所有事件
   */
  async getEvents(resourceId: string, options?: {
    from?: number
    to?: number
    limit?: number
  }): Promise<BaseEvent[]> {
    const from = options?.from ?? 0
    const to = options?.to ?? Date.now()
    const limit = options?.limit ?? 100

    const events = await this.redis.zrangebyscore(
      `events:${resourceId}`,
      from,
      to,
      'LIMIT',
      0,
      limit,
    )

    return events.map(e => JSON.parse(e))
  }

  /**
   * 重放事件
   */
  async replay(resourceId: string, eventId: string): Promise<void> {
    const events = await this.getEvents(resourceId)
    const event = events.find(e => e.id === eventId)

    if (!event) {
      throw new Error(`Event ${eventId} not found`)
    }

    // 根据事件类型重新发布
    if (this.isDomainEvent(event.type)) {
      await this.eventPublisher.publishDomain(event)
    } else if (this.isIntegrationEvent(event.type)) {
      await this.eventPublisher.publishIntegration(event)
    }
  }

  private isDomainEvent(type: string): boolean {
    return Object.values(DomainEvents).includes(type as any)
  }

  private isIntegrationEvent(type: string): boolean {
    return Object.values(IntegrationEvents).includes(type as any)
  }
}
```

---

## ✅ 验收标准

### 功能验收

- [ ] 所有事件使用新的命名规范
- [ ] 事件数据结构统一（包含 id, timestamp, version）
- [ ] 领域事件使用 EventEmitter
- [ ] 集成事件使用 BullMQ
- [ ] 实时事件使用 Redis Pub/Sub
- [ ] 事件重放功能正常

### 代码质量

- [ ] 所有事件有类型定义
- [ ] 事件发布使用统一的 EventPublisher
- [ ] 事件日志正常记录
- [ ] 测试覆盖率 > 80%

### 文档更新

- [ ] 事件系统设计文档
- [ ] 事件使用指南
- [ ] 事件类型参考

---

## 📊 预期收益

- ✅ 事件使用规范统一，开发者不再困惑
- ✅ 事件可追踪、可重放，调试更容易
- ✅ 事件版本控制，系统升级更安全
- ✅ 性能优化，实时事件延迟降低

---

## 📝 相关文档

- [事件驱动架构](../../architecture/event-driven.md)
- [事件使用指南](../../guides/event-usage.md)
