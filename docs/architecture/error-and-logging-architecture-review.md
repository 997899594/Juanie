# 错误处理和日志系统架构审查

## 📊 当前状态分析

### 1. 错误处理系统

#### ✅ 优点

**分层清晰**：
```
Core 层 (基础错误类)
    ↓
Foundation 层 (领域错误类)
    ↓
Business 层 (业务错误)
    ↓
Types 层 (应用错误 + ErrorFactory)
```

**类型安全**：
- 所有错误都继承自 `BaseError`
- 强制实现 `getUserMessage()` 方法
- 自动转换为 `TRPCError`

**用户友好**：
- 区分技术错误和用户消息
- 支持错误上下文（context）
- 支持重试标记（retryable）

#### ❌ 问题

**1. 错误类重复定义**
```typescript
// Core 层
export class NotFoundError extends BaseError { }
export class ValidationError extends BaseError { }
export class UnauthorizedError extends BaseError { }

// Types 层 (重复！)
export class NotFoundError extends AppError { }
export class ValidationError extends AppError { }
export class UnauthorizedError extends AppError { }
```

**2. 两套错误体系并存**
- `BaseError` (Core 层) - 用于服务层
- `AppError` (Types 层) - 用于 API 层
- 没有统一的转换机制

**3. ErrorFactory 分散**
- Core 层有 `ErrorFactory`
- Types 层也有 `ErrorFactory`
- 功能重复，容易混淆

**4. 缺少全局错误处理器**
- 没有统一的错误拦截器
- 没有错误聚合和监控
- 没有错误告警机制

---

### 2. 日志系统

#### ✅ 优点

**职责明确**：
```
PinoLogger (应用日志)
    ↓ 调试、监控、性能追踪
    
GitSyncLogsService (Git 同步日志)
    ↓ Git 操作状态、错误追踪
    
AuditLogsService (审计日志)
    ↓ 用户操作、合规审计
```

**持久化存储**：
- 所有业务日志都存储在数据库
- 支持查询、统计、分析
- 有完善的索引优化

**结构化数据**：
- 使用 PostgreSQL 枚举类型
- JSONB 存储元数据
- 支持复杂查询

#### ❌ 问题

**1. 日志级别不统一**
```typescript
// 有些地方用 logger.info
this.logger.info('Operation completed')

// 有些地方用 logger.log
this.logger.log({ event: 'operation_completed' })

// 有些地方用 logger.debug
this.logger.debug('Debug info')
```

**2. 缺少结构化日志标准**
```typescript
// ❌ 不一致的日志格式
this.logger.info('User created')
this.logger.info(`User ${userId} created`)
this.logger.info({ userId, action: 'create' }, 'User created')
```

**3. 缺少日志聚合**
- 没有集中的日志查询接口
- 没有日志分析工具
- 没有日志告警

**4. 性能问题**
- 同步写入数据库可能影响性能
- 没有日志批量写入
- 没有日志轮转策略

---

## 🎯 现代化改进方案

### 方案 A：统一错误体系（推荐）

#### 1. 删除重复的错误类

**保留 Core 层的 BaseError**：
```typescript
// packages/core/src/errors/base-errors.ts
export abstract class BaseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly retryable: boolean = false,
    public readonly context?: Record<string, any>,
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }

  abstract getUserMessage(): string
  
  toTRPCError(): TRPCError { }
  toJSON() { }
}
```

**删除 Types 层的 AppError**：
- ❌ 删除 `packages/types/src/errors/app-error.ts`
- ✅ 所有错误都继承自 `BaseError`

#### 2. 统一 ErrorFactory

**创建单一的 ErrorFactory**：
```typescript
// packages/core/src/errors/error-factory.ts
export class ErrorFactory {
  // 通用错误
  static notFound(resource: string, id: string) { }
  static validation(field: string, message: string) { }
  static unauthorized(reason?: string) { }
  static forbidden(resource: string, action: string) { }
  static conflict(resource: string, reason: string) { }
  
  // 领域错误（从 Types 层移过来）
  static user = {
    notFound: (id: string) => new NotFoundError('User', id),
    alreadyExists: (email: string) => new ConflictError('User', `Email ${email} already exists`),
  }
  
  static org = { }
  static project = { }
  static gitops = { }
  static ai = { }
}
```

#### 3. 全局错误处理器

**NestJS 全局异常过滤器**：
```typescript
// apps/api-gateway/src/filters/global-exception.filter.ts
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: PinoLogger,
    private readonly errorTracker: ErrorTrackingService, // 新增
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse()
    const request = ctx.getRequest()

    // 1. 记录错误
    this.logger.error({
      error: exception,
      url: request.url,
      method: request.method,
      userId: request.user?.id,
    })

    // 2. 追踪错误（用于监控和告警）
    this.errorTracker.track(exception, {
      url: request.url,
      userId: request.user?.id,
    })

    // 3. 返回用户友好的错误
    if (exception instanceof BaseError) {
      return response.status(exception.statusCode).json({
        success: false,
        error: {
          code: exception.code,
          message: exception.getUserMessage(),
          timestamp: new Date().toISOString(),
        },
      })
    }

    // 4. 未知错误
    return response.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '服务器内部错误',
        timestamp: new Date().toISOString(),
      },
    })
  }
}
```

---

### 方案 B：现代化日志系统

#### 1. 统一日志格式

**定义标准日志接口**：
```typescript
// packages/core/src/logging/structured-logger.ts
export interface LogContext {
  // 请求上下文
  requestId?: string
  userId?: string
  organizationId?: string
  
  // 操作上下文
  operation?: string
  resource?: string
  action?: string
  
  // 性能追踪
  duration?: number
  
  // 额外数据
  [key: string]: any
}

export class StructuredLogger {
  constructor(private readonly pino: PinoLogger) {}

  info(message: string, context?: LogContext) {
    this.pino.info({ ...context, message })
  }

  error(message: string, error: Error, context?: LogContext) {
    this.pino.error({
      ...context,
      message,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    })
  }

  warn(message: string, context?: LogContext) {
    this.pino.warn({ ...context, message })
  }

  debug(message: string, context?: LogContext) {
    this.pino.debug({ ...context, message })
  }
}
```

**使用示例**：
```typescript
// ✅ 统一的结构化日志
this.logger.info('User created', {
  operation: 'create_user',
  userId: user.id,
  duration: 150,
})

this.logger.error('Failed to create user', error, {
  operation: 'create_user',
  email: data.email,
})
```

#### 2. 异步日志写入

**使用队列批量写入**：
```typescript
// packages/core/src/logging/async-log-writer.ts
@Injectable()
export class AsyncLogWriter {
  private logQueue: LogEntry[] = []
  private flushInterval: NodeJS.Timeout

  constructor(
    @InjectQueue('logs') private readonly logsQueue: Queue,
  ) {
    // 每 5 秒或 100 条日志批量写入
    this.flushInterval = setInterval(() => this.flush(), 5000)
  }

  async write(log: LogEntry) {
    this.logQueue.push(log)
    
    if (this.logQueue.length >= 100) {
      await this.flush()
    }
  }

  private async flush() {
    if (this.logQueue.length === 0) return

    const logs = [...this.logQueue]
    this.logQueue = []

    await this.logsQueue.add('batch-write', { logs })
  }
}
```

#### 3. 日志聚合和查询

**统一日志查询接口**：
```typescript
// packages/services/foundation/src/logging/log-aggregator.service.ts
@Injectable()
export class LogAggregatorService {
  constructor(
    private readonly gitSyncLogs: GitSyncLogsService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /**
   * 查询所有类型的日志
   */
  async queryLogs(filter: {
    userId?: string
    organizationId?: string
    projectId?: string
    startDate?: Date
    endDate?: Date
    logType?: 'git_sync' | 'audit' | 'application'
    status?: string
  }) {
    const results = {
      gitSync: [],
      audit: [],
      total: 0,
    }

    // 并行查询
    const [gitSyncLogs, auditLogs] = await Promise.all([
      this.queryGitSyncLogs(filter),
      this.queryAuditLogs(filter),
    ])

    results.gitSync = gitSyncLogs
    results.audit = auditLogs
    results.total = gitSyncLogs.length + auditLogs.length

    return results
  }

  /**
   * 获取错误统计
   */
  async getErrorStats(filter: {
    startDate: Date
    endDate: Date
    organizationId?: string
  }) {
    // 聚合所有错误日志
    const stats = {
      total: 0,
      byType: {},
      byService: {},
      topErrors: [],
    }

    // 实现统计逻辑...

    return stats
  }
}
```

#### 4. 日志告警

**错误告警服务**：
```typescript
// packages/services/extensions/src/monitoring/error-alerting.service.ts
@Injectable()
export class ErrorAlertingService {
  constructor(
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * 检查错误阈值并发送告警
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkErrorThresholds() {
    const last5Minutes = new Date(Date.now() - 5 * 60 * 1000)

    // 查询最近 5 分钟的错误
    const errors = await this.getRecentErrors(last5Minutes)

    // 检查阈值
    if (errors.length > 100) {
      await this.sendAlert({
        severity: 'high',
        message: `High error rate detected: ${errors.length} errors in 5 minutes`,
        errors: errors.slice(0, 10), // 只发送前 10 个
      })
    }

    // 检查特定错误类型
    const criticalErrors = errors.filter(e => e.severity === 'critical')
    if (criticalErrors.length > 0) {
      await this.sendAlert({
        severity: 'critical',
        message: `Critical errors detected`,
        errors: criticalErrors,
      })
    }
  }

  private async sendAlert(alert: Alert) {
    // 发送到 Slack、Email、PagerDuty 等
  }
}
```

---

## 📋 实施计划

### 阶段 1：统一错误体系（1-2 天）

1. ✅ 删除 `packages/types/src/errors/app-error.ts`
2. ✅ 合并两个 `ErrorFactory` 到 Core 层
3. ✅ 更新所有导入路径
4. ✅ 添加全局异常过滤器

### 阶段 2：标准化日志（2-3 天）

1. ✅ 创建 `StructuredLogger`
2. ✅ 更新所有服务使用统一日志格式
3. ✅ 添加日志上下文（requestId, userId 等）
4. ✅ 实现异步日志写入

### 阶段 3：日志聚合和监控（3-5 天）

1. ✅ 创建 `LogAggregatorService`
2. ✅ 实现统一查询接口
3. ✅ 添加错误统计和分析
4. ✅ 实现错误告警

### 阶段 4：可观测性增强（可选）

1. ✅ 集成 OpenTelemetry
2. ✅ 添加分布式追踪
3. ✅ 集成 Prometheus metrics
4. ✅ 添加 Grafana 仪表板

---

## 🎯 最佳实践建议

### 1. 错误处理

**DO ✅**：
```typescript
// 使用领域特定的错误
throw ErrorFactory.user.notFound(userId)

// 提供上下文信息
throw new OperationFailedError('create_user', 'Email already exists', false)

// 标记可重试的错误
throw new OperationFailedError('fetch_data', 'Network timeout', true)
```

**DON'T ❌**：
```typescript
// 不要抛出通用 Error
throw new Error('Something went wrong')

// 不要丢失错误上下文
catch (error) {
  throw new Error('Failed')
}

// 不要在服务层返回 HTTP 状态码
return { statusCode: 404, message: 'Not found' }
```

### 2. 日志记录

**DO ✅**：
```typescript
// 使用结构化日志
this.logger.info('Operation completed', {
  operation: 'create_project',
  projectId: project.id,
  duration: 150,
})

// 记录错误时包含完整上下文
this.logger.error('Operation failed', error, {
  operation: 'create_project',
  userId: user.id,
  input: sanitizedInput,
})
```

**DON'T ❌**：
```typescript
// 不要使用字符串拼接
this.logger.info(`User ${userId} created project ${projectId}`)

// 不要记录敏感信息
this.logger.info('User logged in', { password: user.password })

// 不要过度日志
this.logger.debug('Step 1')
this.logger.debug('Step 2')
this.logger.debug('Step 3')
```

---

## 📊 对比总结

| 方面 | 当前状态 | 改进后 |
|------|---------|--------|
| **错误类重复** | ❌ 两套体系 | ✅ 统一体系 |
| **ErrorFactory** | ❌ 分散定义 | ✅ 集中管理 |
| **全局错误处理** | ❌ 缺失 | ✅ 完善 |
| **日志格式** | ❌ 不统一 | ✅ 结构化 |
| **日志性能** | ❌ 同步写入 | ✅ 异步批量 |
| **日志聚合** | ❌ 分散查询 | ✅ 统一接口 |
| **错误监控** | ❌ 缺失 | ✅ 实时告警 |
| **可观测性** | ⚠️ 基础 | ✅ 完善 |

---

## 🚀 结论

当前的错误处理和日志系统**基础良好，但需要优化**：

**优势**：
- ✅ 分层清晰
- ✅ 类型安全
- ✅ 持久化存储

**需要改进**：
- ❌ 错误类重复
- ❌ 日志格式不统一
- ❌ 缺少监控和告警

**推荐行动**：
1. **立即**：删除重复的错误类，统一 ErrorFactory
2. **短期**：标准化日志格式，添加全局错误处理
3. **中期**：实现日志聚合和错误告警
4. **长期**：增强可观测性，集成 OpenTelemetry

这是一个**现代化、可扩展的错误和日志架构**！
