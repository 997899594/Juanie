# Pino Logger 配置优化

**日期**: 2024-12-29  
**问题**: 日志混合了多种格式（console.log + Pino + NestJS 默认）  
**解决方案**: 统一使用 Pino 结构化日志

## 问题描述

应用启动时日志混合了三种格式：

```
[Bootstrap] ✅ Redis 连接成功          # console.log（临时调试）
[14:27:14] INFO: [Database] 📦 使用... # Pino 格式（正确）
[Nest] 23442 - LOG [NestFactory]       # NestJS 默认（不推荐）
[API Gateway] 🚀 API Gateway running   # console.log（临时调试）
```

## 根本原因

1. **临时调试日志未清理**：
   - `apps/api-gateway/src/main.ts` 中使用了 `console.log`
   - `apps/api-gateway/src/observability/tracing.ts` 中使用了 `console.log`

2. **NestJS 默认日志未禁用**：
   - `NestFactory.create()` 的 `logger` 选项未设置
   - NestJS 框架日志仍然使用默认格式

## 解决方案

### 1. 清理所有 console.log

**修改文件**：
- `apps/api-gateway/src/main.ts`
- `apps/api-gateway/src/observability/tracing.ts`

**删除的日志**：
```typescript
// ❌ 删除
console.log('✅ OpenTelemetry 已启动')
console.log('📊 Prometheus 指标: http://localhost:9465/metrics')
console.log(`🚀 API Gateway: http://localhost:${port}`)
console.log(`📊 Health: http://localhost:${port}/health`)
console.log(`🔌 tRPC: http://localhost:${port}/trpc`)
console.log(`🎛️  Panel: http://localhost:${port}/panel`)
```

### 2. 禁用 NestJS 默认日志

**main.ts 配置**：
```typescript
const app = await NestFactory.create<NestFastifyApplication>(
  AppModule,
  fastifyAdapter,
  {
    bufferLogs: true,  // 缓冲日志，等待 Pino 初始化
    logger: false,     // ✅ 禁用 NestJS 默认日志
    abortOnError: false,
  }
)

// ✅ LoggerModule.forRoot() 已自动配置全局 logger
// ❌ 不需要调用 app.useLogger()
```

**关键点**：
- ✅ `logger: false` - 禁用 NestJS 默认 logger（`[Nest] 24313 - LOG`）
- ✅ `bufferLogs: true` - 缓冲启动日志，等待 Pino 初始化
- ✅ `LoggerModule.forRoot()` - 自动配置全局 logger，无需手动调用 `app.useLogger()`

### 3. Pino 配置（app.module.ts）

```typescript
LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.LOG_LEVEL || 'info',
    // 开发环境使用 pretty stream（兼容 Bun）
    ...(isDev ? { stream: prettyStream } : {}),
    serializers: {
      req: (req) => ({ method: req.method, url: req.url }),
      res: (res) => ({ statusCode: res.statusCode }),
    },
  },
})
```

**Pretty Stream 配置**：
```typescript
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
```

## 最佳实践

### ✅ 推荐：完全使用 Pino

**优势**：
1. **结构化日志** - JSON 格式，易于解析和查询
2. **自动集成 OpenTelemetry** - traceId、spanId 自动注入
3. **高性能** - 异步写入，不阻塞主线程
4. **业界标准** - Vercel、Netflix、Uber 等公司使用

**日志格式**：
```
[14:27:14] INFO: [Database] 📦 使用自动构建的数据库连接
[14:27:14] WARN: [OllamaService] ⚠️ Ollama 连接失败
[14:27:14] ERROR: [StorageService] MinIO bucket setup error
```

### ❌ 不推荐：NestJS 默认日志

**缺点**：
1. 纯文本格式，难以解析
2. 无法集成 OpenTelemetry
3. 不支持结构化查询
4. 性能较差（同步写入）

**日志格式**：
```
[Nest] 23442 - 12/29/2024, 2:27:14 PM     LOG [NestFactory] Starting Nest application...
```

## 验证

启动应用后，所有日志应该使用统一的 Pino 格式：

```bash
bun run dev:api
```

**期望输出**：
```
[14:27:14] INFO: [Database] 📦 使用自动构建的数据库连接
[14:27:14] INFO: [AIConfigGenerator] AI Config Generator initialized
[14:27:14] INFO: [TemplateLoader] 🔄 Loading templates from file system...
[14:27:14] INFO: [TemplateLoader] ✅ Successfully loaded 1 templates
```

## 相关文件

- `apps/api-gateway/src/main.ts` - 应用入口
- `apps/api-gateway/src/app.module.ts` - Pino 配置
- `apps/api-gateway/src/observability/tracing.ts` - OpenTelemetry 配置

## 参考资料

- [nestjs-pino 文档](https://github.com/iamolegga/nestjs-pino)
- [Pino 文档](https://getpino.io/)
- [OpenTelemetry Pino Instrumentation](https://www.npmjs.com/package/@opentelemetry/instrumentation-pino)
