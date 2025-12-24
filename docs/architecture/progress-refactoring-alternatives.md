# 进度系统重构 - 更好的方向探索

## 目的

探索除了"统一到 PostgreSQL"之外，是否有更优雅的重构方向。

---

## 当前问题回顾

1. **代码冗余**: 两套系统做相同的事
2. **数据不一致**: Redis 和 PostgreSQL 可能不同步
3. **维护成本高**: 需要同时维护两套系统
4. **前端复杂**: 需要合并两个数据源

---

## 方案对比

### 方案 1: 统一到 PostgreSQL（之前的方案）

**架构**:
```
InitializationSteps (PostgreSQL + Redis Pub/Sub)
    ↓
  持久化存储 + 实时通知
```

**优点**:
- ✅ 单一数据源
- ✅ 数据可靠
- ✅ 代码简洁

**缺点**:
- ❌ 性能略慢（2-5ms vs 0.1ms）
- ❌ 架构不纯粹（存储 + 通知混合）

---

### 方案 2: 使用 PostgreSQL NOTIFY/LISTEN（更纯粹）

**核心思想**: 完全移除 Redis 依赖，使用 PostgreSQL 原生的 Pub/Sub

**架构**:
```
InitializationSteps (PostgreSQL)
    ↓
  写入数据库
    ↓
  触发 PostgreSQL NOTIFY
    ↓
  前端通过 LISTEN 接收
```

**实现**:
```typescript
// InitializationStepsService
async updateStepProgress(projectId: string, step: string, progress: number) {
  // 1. 更新数据库
  await this.db.update(schema.projectInitializationSteps)
    .set({ progress: progress.toString() })
    .where(...)
  
  // 2. 发送 PostgreSQL NOTIFY
  await this.db.execute(sql`
    NOTIFY project_progress, ${JSON.stringify({
      projectId,
      step,
      progress
    })}
  `)
}

// ProjectsService
async *subscribeToProgress(projectId: string) {
  // 使用 PostgreSQL LISTEN
  await this.db.execute(sql`LISTEN project_progress`)
  
  // 监听通知
  this.db.on('notification', (msg) => {
    if (msg.channel === 'project_progress') {
      yield JSON.parse(msg.payload)
    }
  })
}
```

**优点**:
- ✅ 完全移除 Redis 依赖
- ✅ 架构纯粹（只依赖 PostgreSQL）
- ✅ 数据和通知在同一个事务中
- ✅ 不会出现数据不一致

**缺点**:
- ❌ PostgreSQL NOTIFY 有限制（8KB payload）
- ❌ 需要保持数据库连接（长连接）
- ❌ 扩展性不如 Redis Pub/Sub

**适用场景**: 小规模应用（< 1000 并发连接）

---

### 方案 3: 事件驱动架构（最优雅）

**核心思想**: 引入事件总线，解耦存储和通知

**架构**:
```
InitializationSteps (PostgreSQL)
    ↓
  写入数据库
    ↓
  发布领域事件
    ↓
EventBus (内存 / Redis / RabbitMQ)
    ↓
  ├─→ 前端订阅（实时通知）
  ├─→ 日志服务（审计）
  └─→ 监控服务（告警）
```

**实现**:
```typescript
// 1. 定义领域事件
interface StepProgressUpdatedEvent {
  type: 'step.progress.updated'
  projectId: string
  step: string
  progress: number
  timestamp: number
}

// 2. InitializationStepsService 发布事件
async updateStepProgress(projectId: string, step: string, progress: number) {
  // 更新数据库
  await this.db.update(schema.projectInitializationSteps)
    .set({ progress: progress.toString() })
    .where(...)
  
  // 发布领域事件
  await this.eventBus.publish<StepProgressUpdatedEvent>({
    type: 'step.progress.updated',
    projectId,
    step,
    progress,
    timestamp: Date.now()
  })
}

// 3. 前端订阅事件
async *subscribeToProgress(projectId: string) {
  // 订阅事件
  const subscription = this.eventBus.subscribe(
    `step.progress.updated.${projectId}`
  )
  
  for await (const event of subscription) {
    yield event
  }
}
```

**优点**:
- ✅ 架构优雅（关注点完全分离）
- ✅ 可扩展（可以添加更多订阅者）
- ✅ 可测试（事件可以 mock）
- ✅ 符合领域驱动设计（DDD）

**缺点**:
- ❌ 需要引入事件总线（增加依赖）
- ❌ 复杂度略高（需要管理订阅）

**适用场景**: 中大型应用，需要扩展性

---

### 方案 4: 混合缓存策略（最实用）

**核心思想**: PostgreSQL 作为主存储，Redis 作为缓存层

**架构**:
```
InitializationSteps (PostgreSQL)
    ↓
  写入数据库（主存储）
    ↓
  写入 Redis（缓存，可选）
    ↓
  发布 Redis Pub/Sub（通知）
```

**实现**:
```typescript
async updateStepProgress(projectId: string, step: string, progress: number) {
  // 1. 写入 PostgreSQL（主存储，必须成功）
  await this.db.update(schema.projectInitializationSteps)
    .set({ progress: progress.toString() })
    .where(...)
  
  // 2. 写入 Redis（缓存，失败不影响）
  try {
    await this.redis.setex(
      `project:${projectId}:progress`,
      3600,
      JSON.stringify({ step, progress })
    )
  } catch (error) {
    this.logger.warn('Failed to cache progress in Redis')
  }
  
  // 3. 发布事件（通知，失败不影响）
  try {
    await this.redis.publish(`project:${projectId}`, JSON.stringify({
      type: 'step.progress.updated',
      step,
      progress
    }))
  } catch (error) {
    this.logger.warn('Failed to publish event')
  }
}

// 读取时优先从 Redis 读取
async getProjectProgress(projectId: string): Promise<number> {
  // 1. 尝试从 Redis 读取
  try {
    const cached = await this.redis.get(`project:${projectId}:progress`)
    if (cached) {
      return JSON.parse(cached).progress
    }
  } catch (error) {
    this.logger.warn('Failed to read from Redis cache')
  }
  
  // 2. 从 PostgreSQL 读取
  const steps = await this.getProjectSteps(projectId)
  return this.calculateProgress(steps)
}
```

**优点**:
- ✅ PostgreSQL 作为唯一真相源（数据可靠）
- ✅ Redis 作为缓存（性能优化）
- ✅ Redis 失败不影响核心功能
- ✅ 架构清晰（主存储 + 缓存）

**缺点**:
- ⚠️ 仍然需要维护 Redis
- ⚠️ 缓存失效策略需要考虑

**适用场景**: 需要高性能，但也要数据可靠

---

## 深度对比

### 架构纯粹性

| 方案 | 纯粹性 | 说明 |
|------|--------|------|
| 方案 1: 统一到 PostgreSQL | 🟡 中 | 存储 + 通知混合 |
| 方案 2: PostgreSQL NOTIFY | 🟢 高 | 只依赖 PostgreSQL |
| 方案 3: 事件驱动 | 🟢 高 | 关注点完全分离 |
| 方案 4: 混合缓存 | 🟡 中 | 主存储 + 缓存 |

### 性能

| 方案 | 写入性能 | 读取性能 | 实时性 |
|------|---------|---------|--------|
| 方案 1 | 2-5ms | 2-5ms | 好 |
| 方案 2 | 2-5ms | 2-5ms | 好 |
| 方案 3 | 2-5ms | 2-5ms | 极好 |
| 方案 4 | 2-5ms | 0.1ms (缓存命中) | 极好 |

### 可靠性

| 方案 | 数据可靠性 | 通知可靠性 | 故障恢复 |
|------|-----------|-----------|---------|
| 方案 1 | 🟢 高 | 🟡 中 | 容易 |
| 方案 2 | 🟢 高 | 🟢 高 | 容易 |
| 方案 3 | 🟢 高 | 🟡 中 | 中等 |
| 方案 4 | 🟢 高 | 🟡 中 | 容易 |

### 复杂度

| 方案 | 实现复杂度 | 维护复杂度 | 学习曲线 |
|------|-----------|-----------|---------|
| 方案 1 | 🟢 低 | 🟢 低 | 平缓 |
| 方案 2 | 🟡 中 | 🟢 低 | 平缓 |
| 方案 3 | 🔴 高 | 🟡 中 | 陡峭 |
| 方案 4 | 🟡 中 | 🟡 中 | 平缓 |

---

## 我的推荐排序

### 1. 方案 4: 混合缓存策略（最推荐）

**理由**:
- ✅ 兼顾性能和可靠性
- ✅ PostgreSQL 作为唯一真相源
- ✅ Redis 失败不影响核心功能
- ✅ 架构清晰，易于理解

**适合你的项目**，因为：
- 你已经有 Redis（不需要额外依赖）
- 你需要实时通知（Redis Pub/Sub）
- 你需要数据可靠（PostgreSQL）

**实施成本**: 中等（2-3 小时）

---

### 2. 方案 1: 统一到 PostgreSQL（次推荐）

**理由**:
- ✅ 最简单
- ✅ 代码最少
- ✅ 维护成本最低

**适合你的项目**，如果：
- 你不在意 Redis 依赖
- 你追求简单

**实施成本**: 低（1-2 小时）

---

### 3. 方案 3: 事件驱动架构（长期推荐）

**理由**:
- ✅ 架构最优雅
- ✅ 可扩展性最好
- ✅ 符合 DDD 原则

**适合你的项目**，如果：
- 你计划长期发展
- 你需要添加更多订阅者（日志、监控、告警）
- 你的团队熟悉事件驱动

**实施成本**: 高（1-2 天）

---

### 4. 方案 2: PostgreSQL NOTIFY（不推荐）

**理由**:
- ⚠️ 有限制（8KB payload）
- ⚠️ 需要长连接
- ⚠️ 扩展性差

**不适合你的项目**，因为：
- 你已经有 Redis
- 你可能需要扩展

---

## 最佳方案详细设计

### 方案 4: 混合缓存策略

#### 架构图

```
┌─────────────────────────────────────────┐
│         InitializationSteps             │
│                                         │
│  updateStepProgress(projectId, step)   │
│         ↓                               │
│    1. 写入 PostgreSQL (主存储)          │
│         ↓                               │
│    2. 写入 Redis (缓存, 可选)           │
│         ↓                               │
│    3. 发布 Redis Pub/Sub (通知, 可选)   │
└─────────────────────────────────────────┘
         ↓                    ↓
    PostgreSQL            Redis
    (永久保存)          (临时缓存)
         ↓                    ↓
    历史查询            实时通知
```

#### 核心代码

```typescript
@Injectable()
export class InitializationStepsService {
  constructor(
    @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
    @Inject(REDIS) private redis: Redis,
    private readonly logger: Logger,
  ) {}

  /**
   * 更新步骤进度（带缓存和通知）
   */
  async updateStepProgressWithNotification(
    projectId: string,
    step: string,
    progress: number,
    message: string
  ): Promise<void> {
    // 1. 单调性检查（从数据库读取）
    const currentStep = await this.getCurrentStep(projectId)
    if (currentStep && currentStep.step === step) {
      const currentProgress = Number.parseInt(currentStep.progress || '0')
      if (progress < currentProgress) {
        this.logger.warn(`Progress regression rejected: ${progress} < ${currentProgress}`)
        return
      }
    }
    
    // 2. 写入 PostgreSQL（主存储，必须成功）
    await this.db.update(schema.projectInitializationSteps)
      .set({ 
        progress: progress.toString(),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(schema.projectInitializationSteps.projectId, projectId),
          eq(schema.projectInitializationSteps.step, step)
        )
      )
    
    // 3. 计算总体进度
    const totalProgress = calculateStepProgress(step, progress)
    
    // 4. 写入 Redis 缓存（可选，失败不影响）
    try {
      await this.redis.setex(
        `project:${projectId}:progress`,
        3600, // 1 小时过期
        JSON.stringify({
          step,
          progress: totalProgress,
          message,
          timestamp: Date.now()
        })
      )
    } catch (error) {
      this.logger.warn('Failed to cache progress in Redis:', error)
      // 不抛出错误，继续执行
    }
    
    // 5. 发布事件（可选，失败不影响）
    try {
      await this.redis.publish(
        `project:${projectId}`,
        JSON.stringify({
          type: 'initialization.progress',
          data: { projectId, step, progress: totalProgress, message },
          timestamp: Date.now()
        })
      )
    } catch (error) {
      this.logger.warn('Failed to publish event:', error)
      // 不抛出错误，继续执行
    }
  }

  /**
   * 获取项目进度（优先从缓存读取）
   */
  async getProjectProgress(projectId: string): Promise<{
    progress: number
    message: string
    timestamp: number
  }> {
    // 1. 尝试从 Redis 缓存读取
    try {
      const cached = await this.redis.get(`project:${projectId}:progress`)
      if (cached) {
        const data = JSON.parse(cached)
        this.logger.debug(`Cache hit for project ${projectId}`)
        return data
      }
    } catch (error) {
      this.logger.warn('Failed to read from Redis cache:', error)
    }
    
    // 2. 从 PostgreSQL 读取（缓存未命中）
    this.logger.debug(`Cache miss for project ${projectId}, reading from database`)
    const steps = await this.getProjectSteps(projectId)
    
    // 计算总体进度
    let totalProgress = 0
    let currentMessage = '初始化中...'
    
    for (const step of steps) {
      const stepDef = INITIALIZATION_STEPS.find(s => s.name === step.step)
      if (!stepDef) continue
      
      if (step.status === 'completed') {
        totalProgress = stepDef.progressEnd
      } else if (step.status === 'running') {
        const stepProgress = Number.parseInt(step.progress || '0')
        totalProgress = calculateStepProgress(step.step, stepProgress)
        currentMessage = stepDef.label
        break
      }
    }
    
    return {
      progress: totalProgress,
      message: currentMessage,
      timestamp: Date.now()
    }
  }
}
```

#### 优势总结

1. **数据可靠性**: PostgreSQL 作为唯一真相源
2. **性能优化**: Redis 缓存加速读取
3. **实时通知**: Redis Pub/Sub 推送事件
4. **容错能力**: Redis 失败不影响核心功能
5. **架构清晰**: 主存储 + 缓存 + 通知

---

## 最终建议

**推荐方案 4（混合缓存策略）**，因为：

1. **最适合你的项目**
   - 你已经有 Redis 和 PostgreSQL
   - 你需要实时通知
   - 你需要数据可靠

2. **最佳的权衡**
   - 性能好（Redis 缓存）
   - 可靠性高（PostgreSQL 主存储）
   - 复杂度适中（2-3 小时实施）

3. **未来可扩展**
   - 可以轻松迁移到方案 3（事件驱动）
   - 可以添加更多缓存策略
   - 可以优化性能

---

## 实施计划

### 阶段 1: 实现混合缓存（2-3 小时）

1. 修改 `InitializationStepsService`
   - 添加 `updateStepProgressWithNotification()`
   - 添加 `getProjectProgress()`
   - 添加 Redis 缓存逻辑

2. 更新 Worker
   - 替换 `progressManager.updateProgress()`
   - 使用新的 API

3. 测试验证
   - 测试 Redis 失败场景
   - 测试缓存命中率

### 阶段 2: 删除 ProgressManager（1 小时）

1. 移除 `ProgressManager` 文件
2. 移除相关导入
3. 更新文档

### 阶段 3: 观察和优化（1 周）

1. 监控缓存命中率
2. 监控性能指标
3. 根据需要调整缓存策略

---

## 你觉得呢？

方案 4（混合缓存）是否是更好的方向？

还是你更倾向于：
- 方案 1（最简单）
- 方案 3（最优雅，但复杂）
