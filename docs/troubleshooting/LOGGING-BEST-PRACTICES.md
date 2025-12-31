# 日志最佳实践

## 为什么选择 Pino？

Pino 是现代 Node.js 应用的日志标准，被 Vercel、Netflix、Uber 等公司广泛使用。

### ✅ Pino 的优势

1. **结构化日志** - JSON 格式，易于解析和查询
   ```json
   {
     "level": 30,
     "time": 1703851634000,
     "context": "Database",
     "msg": "使用自动构建的数据库连接",
     "traceId": "abc123",
     "spanId": "def456"
   }
   ```

2. **自动集成 OpenTelemetry** - traceId、spanId 自动注入
   - 通过 `@opentelemetry/instrumentation-pino` 实现
   - 无需手动传递 context
   - 支持分布式追踪

3. **高性能** - 异步写入，不阻塞主线程
   - 使用 worker threads（生产环境）
   - 使用 sonic-boom（快速写入）
   - 比 Winston 快 5-10 倍

4. **易于查询** - 结构化数据支持复杂查询
   ```bash
   # 查询特定 traceId 的所有日志
   cat logs.json | jq 'select(.traceId == "abc123")'
   
   # 查询错误日志
   cat logs.json | jq 'select(.level >= 50)'
   ```

### ❌ 不推荐的日志方式

1. **console.log** - 纯文本，无结构，难以解析
2. **NestJS 默认日志** - 格式固定，无法自定义，不支持 OpenTelemetry
3. **Winston** - 性能较差，配置复杂

## 配置指南

### 1. 基础配置（app.module.ts）

```typescript
import { LoggerModule } from 'nestjs-pino'
import pretty from 'pino-pretty'

const isDev = process.env.NODE_ENV !== 'production'

// 开发环境使用 pretty stream（兼容 Bun）
const prettyStream = isDev
  ? pretty({
      colorize: true,
      translateTime: 'SYS:HH:MM:ss',
      ignore: 'pid,hostname,context',
      singleLine: true,
      messageFormat: (log, messageKey) => {
        const ctx = log.context || 'App'
        const msg = log[messageKey] || ''
        return `[${ctx}] ${msg}`
      },
    })
  : undefined

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        ...(isDev ? { stream: prettyStream } : {}),
        serializers: {
          req: (req) => ({ method: req.method, url: req.url }),
          res: (res) => ({ statusCode: res.statusCode }),
        },
      },
    }),
  ],
})
export class AppModule {}
```

### 2. 应用启动配置（main.ts）

```typescript
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  fastifyAdapter,
  {
    bufferLogs: true,  // ✅ 缓冲日志，等待 Pino 初始化
    logger: false,     // ✅ 禁用 NestJS 默认日志
    abortOnError: false,
  }
)

// ✅ LoggerModule.forRoot() 已自动配置全局 logger
// ❌ 不需要调用 app.useLogger()
```

### 3. Service 中使用

```typescript
import { Injectable } from '@nestjs/common'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class MyService {
  constructor(private readonly logger: PinoLogger) {
    this.logger.setContext(MyService.name)
  }

  async doSomething() {
    // ✅ 结构化日志
    this.logger.info({ userId: '123', action: 'create' }, 'User created')
    
    // ✅ 错误日志（自动包含 stack trace）
    try {
      await riskyOperation()
    } catch (error) {
      this.logger.error({ error }, 'Operation failed')
    }
  }
}
```

## 日志级别

Pino 使用数字表示日志级别：

| 级别 | 数字 | 用途 |
|------|------|------|
| trace | 10 | 详细的调试信息 |
| debug | 20 | 调试信息 |
| info | 30 | 一般信息（默认） |
| warn | 40 | 警告信息 |
| error | 50 | 错误信息 |
| fatal | 60 | 致命错误 |

### 设置日志级别

```bash
# 开发环境 - 显示所有日志
LOG_LEVEL=debug bun run dev:api

# 生产环境 - 只显示 info 及以上
LOG_LEVEL=info bun run start
```

## 开发环境 vs 生产环境

### 开发环境

```typescript
// 使用 pino-pretty 格式化输出
const prettyStream = pretty({
  colorize: true,           // 彩色输出
  translateTime: 'SYS:HH:MM:ss',  // 时间格式
  singleLine: true,         // 单行输出
})
```

**输出示例**：
```
[14:27:14] INFO: [Database] 📦 使用自动构建的数据库连接
[14:27:14] WARN: [OllamaService] ⚠️ Ollama 连接失败
[14:27:14] ERROR: [StorageService] MinIO bucket setup error
```

### 生产环境

```typescript
// 直接输出 JSON（不使用 pretty stream）
LoggerModule.forRoot({
  pinoHttp: {
    level: 'info',
    // 不设置 stream，使用默认 JSON 输出
  },
})
```

**输出示例**：
```json
{"level":30,"time":1703851634000,"context":"Database","msg":"使用自动构建的数据库连接","traceId":"abc123"}
{"level":40,"time":1703851634100,"context":"OllamaService","msg":"Ollama 连接失败"}
{"level":50,"time":1703851634200,"context":"StorageService","msg":"MinIO bucket setup error","error":{"type":"Error","message":"Connection failed"}}
```

## OpenTelemetry 集成

Pino 自动集成 OpenTelemetry，无需额外配置：

```typescript
// observability/tracing.ts
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino'

const sdk = new NodeSDK({
  instrumentations: [
    new PinoInstrumentation(),  // ✅ 自动注入 traceId/spanId
    // ...
  ],
})
```

**效果**：
```json
{
  "level": 30,
  "msg": "User created",
  "traceId": "abc123",  // ✅ 自动注入
  "spanId": "def456"    // ✅ 自动注入
}
```

## 常见问题

### Q: 为什么不能使用 `app.useLogger(app.get('PinoLogger'))`？

A: `PinoLogger` 是 REQUEST scoped provider，不能在应用启动阶段使用 `app.get()`。

**错误**：
```
InvalidClassScopeException: PinoLogger is marked as a scoped provider.
```

**解决方案**：
```typescript
// ❌ 错误
app.useLogger(app.get('PinoLogger'))
app.useLogger(app.get('Logger'))

// ✅ 正确 - LoggerModule.forRoot() 已自动配置全局 logger
const app = await NestFactory.create(AppModule, adapter, {
  bufferLogs: true,
  logger: false,  // 禁用 NestJS 默认日志
})
// 不需要调用 app.useLogger()
```

### Q: 如何在启动阶段输出日志？

A: 使用 `console.error` 输出错误（仅限启动阶段）：

```typescript
// main.ts
process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason)
  setTimeout(() => process.exit(1), 100)
})

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error)
  setTimeout(() => process.exit(1), 200)
})
```

### Q: 如何在 Worker 中使用 Pino？

A: Worker 自动继承 Pino 配置：

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq'
import { PinoLogger } from 'nestjs-pino'

@Processor('my-queue')
export class MyWorker extends WorkerHost {
  constructor(private readonly logger: PinoLogger) {
    super()
    this.logger.setContext(MyWorker.name)
  }

  async process(job: Job) {
    this.logger.info({ jobId: job.id }, 'Processing job')
  }
}
```

## 日志查询示例

### 使用 jq 查询

```bash
# 查询特定 context 的日志
cat logs.json | jq 'select(.context == "Database")'

# 查询错误日志
cat logs.json | jq 'select(.level >= 50)'

# 查询特定时间范围
cat logs.json | jq 'select(.time >= 1703851634000 and .time <= 1703851635000)'

# 查询包含特定字段的日志
cat logs.json | jq 'select(.userId != null)'
```

### 使用 Grafana Loki

```promql
# 查询特定 context
{job="api-gateway"} | json | context="Database"

# 查询错误日志
{job="api-gateway"} | json | level >= 50

# 查询特定 traceId
{job="api-gateway"} | json | traceId="abc123"
```

## 参考资料

- [Pino 官方文档](https://getpino.io/)
- [nestjs-pino 文档](https://github.com/iamolegga/nestjs-pino)
- [OpenTelemetry Pino Instrumentation](https://www.npmjs.com/package/@opentelemetry/instrumentation-pino)
- [Pino Best Practices](https://getpino.io/#/docs/best-practices)
