# 日志最佳实践

## 当前问题

### 1. 日志格式不统一

**问题**：
- HTTP 请求日志：结构化 JSON（Fastify/Pino）
- 应用日志：纯文本（NestJS Logger）
- 数据库查询：原始 SQL（Drizzle）

**示例**：
```
✅ 好的（结构化）：
{"level":30,"time":1764831895555,"pid":79701,"reqId":"req-1k","msg":"request completed"}

❌ 不好的（纯文本）：
[2025-12-04 15:04:57.462 +0800] INFO: Pushing 28 files to github repository
    context: "GitProviderService"

❌ 更糟的（原始 SQL）：
Query: insert into "repositories" ("id", "project_id", ...
```

### 2. 错误信息不完整

**问题**：
```
ERROR: Failed to sync to project-xxx-development:
```
错误信息是空的，无法排查问题。

### 3. 缺少关键上下文

**问题**：
- 没有 trace_id 关联
- 没有用户信息
- 没有性能指标

## 改进方案

### 方案 1：统一使用 Pino（推荐）

NestJS 默认使用自己的 Logger，但可以替换为 Pino。

#### 1.1 安装依赖

```bash
bun add nestjs-pino pino-http pino-pretty
```

#### 1.2 配置 Pino Logger

```typescript
// apps/api-gateway/src/main.ts
import { Logger } from 'nestjs-pino'

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // 缓冲日志直到 logger 准备好
  })

  // 使用 Pino Logger
  app.useLogger(app.get(Logger))
  
  // ...
}
```

#### 1.3 配置 Pino Module

```typescript
// apps/api-gateway/src/app.module.ts
import { LoggerModule } from 'nestjs-pino'

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL || 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  colorize: true,
                  translateTime: 'SYS:standard',
                  ignore: 'pid,hostname',
                  singleLine: false,
                },
              }
            : undefined,
        customProps: (req, res) => ({
          context: 'HTTP',
        }),
        serializers: {
          req(req) {
            return {
              id: req.id,
              method: req.method,
              url: req.url,
              // 不记录敏感信息
              // headers: req.headers,
            }
          },
          res(res) {
            return {
              statusCode: res.statusCode,
            }
          },
        },
      },
    }),
    // ...
  ],
})
export class AppModule {}
```

#### 1.4 在服务中使用

```typescript
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class GitProviderService {
  private readonly logger = new Logger(GitProviderService.name)

  async pushFiles(repo: string, files: File[]) {
    // ✅ 结构化日志
    this.logger.log({
      msg: 'Pushing files to repository',
      repo,
      fileCount: files.length,
      files: files.map(f => f.path),
    })

    try {
      // ...
      
      this.logger.log({
        msg: 'Successfully pushed files',
        repo,
        fileCount: files.length,
        duration: Date.now() - startTime,
      })
    } catch (error) {
      // ✅ 完整的错误信息
      this.logger.error({
        msg: 'Failed to push files',
        repo,
        error: error.message,
        stack: error.stack,
        code: error.code,
      })
      throw error
    }
  }
}
```

### 方案 2：改进现有 Logger（快速方案）

如果不想大改，可以改进现有的日志调用：

#### 2.1 创建日志工具函数

```typescript
// packages/core/src/utils/logger.ts

/**
 * 格式化错误对象为可读字符串
 */
export function formatError(error: any): string {
  if (error instanceof Error) {
    return `${error.message} (${error.name})`
  }
  if (typeof error === 'object') {
    return JSON.stringify(error)
  }
  return String(error)
}

/**
 * 提取错误详情
 */
export function extractErrorDetails(error: any): {
  message: string
  stack?: string
  code?: string
  statusCode?: number
} {
  return {
    message: error.message || String(error),
    stack: error.stack,
    code: error.code,
    statusCode: error.statusCode || error.status,
  }
}

/**
 * 创建结构化日志上下文
 */
export function createLogContext(data: Record<string, any>): string {
  return JSON.stringify(data, null, 2)
}
```

#### 2.2 使用工具函数

```typescript
import { formatError, extractErrorDetails } from '@juanie/core/utils'

// ❌ 之前
this.logger.error(`Failed to sync to ${namespace}:`, error)

// ✅ 改进后
this.logger.error(
  `Failed to sync to ${namespace}: ${formatError(error)}`,
  extractErrorDetails(error),
)

// 或者更详细
this.logger.error({
  msg: `Failed to sync credential to namespace`,
  namespace,
  secretName,
  ...extractErrorDetails(error),
})
```

### 方案 3：禁用 Drizzle SQL 日志（生产环境）

```typescript
// packages/core/src/database/client.ts
import { drizzle } from 'drizzle-orm/postgres-js'

export const db = drizzle(connection, {
  schema,
  logger: process.env.NODE_ENV === 'development', // 只在开发环境启用
})
```

## 日志级别规范

### 级别定义

- **ERROR**: 错误，需要立即处理
- **WARN**: 警告，可能需要关注
- **INFO**: 重要信息，业务流程
- **DEBUG**: 调试信息，详细流程
- **TRACE**: 追踪信息，最详细

### 使用场景

```typescript
// ERROR - 业务失败，需要人工介入
this.logger.error('Failed to create project', { projectId, error })

// WARN - 可能的问题，但不影响主流程
this.logger.warn('Git sync failed, will retry', { projectId })

// INFO - 重要的业务事件
this.logger.log('Project created successfully', { projectId, userId })

// DEBUG - 调试信息
this.logger.debug('Fetching user from database', { userId })

// TRACE - 非常详细的追踪
this.logger.verbose('Request payload', { payload })
```

## 日志内容规范

### 必须包含的信息

1. **操作描述**：清晰说明在做什么
2. **关键 ID**：projectId, userId, organizationId 等
3. **结果**：成功/失败
4. **错误详情**：完整的错误信息和堆栈

### 不应该记录的信息

1. **敏感数据**：
   - 密码、Token、API Key
   - 用户个人信息（邮箱、手机号）
   - 信用卡信息

2. **大量数据**：
   - 完整的文件内容
   - 大型数组（超过 10 个元素）
   - 完整的 HTTP 请求体

### 示例

```typescript
// ✅ 好的日志
this.logger.log({
  msg: 'Creating GitOps resources',
  projectId: 'xxx',
  environments: ['dev', 'staging', 'prod'],
  provider: 'github',
})

// ❌ 不好的日志
this.logger.log('Creating resources') // 缺少上下文

// ❌ 危险的日志
this.logger.log('Using token', { token: 'ghp_xxx' }) // 泄露敏感信息
```

## 性能监控

### 记录操作耗时

```typescript
async pushFiles(repo: string, files: File[]) {
  const startTime = Date.now()
  
  try {
    // 执行操作
    await this.gitApi.push(repo, files)
    
    const duration = Date.now() - startTime
    this.logger.log({
      msg: 'Files pushed successfully',
      repo,
      fileCount: files.length,
      duration, // 毫秒
    })
  } catch (error) {
    const duration = Date.now() - startTime
    this.logger.error({
      msg: 'Failed to push files',
      repo,
      duration,
      error: error.message,
    })
    throw error
  }
}
```

### 使用 OpenTelemetry（已集成）

项目已经集成了 OpenTelemetry，可以自动追踪：
- HTTP 请求
- 数据库查询
- 外部 API 调用

确保在日志中包含 trace_id：

```typescript
import { trace } from '@opentelemetry/api'

const span = trace.getActiveSpan()
const traceId = span?.spanContext().traceId

this.logger.log({
  msg: 'Processing request',
  traceId, // 关联到分布式追踪
  projectId,
})
```

## 日志聚合和查询

### 开发环境

使用 `pino-pretty` 美化输出：

```bash
bun run dev | pino-pretty
```

### 生产环境

推荐使用以下工具之一：

1. **Grafana Loki**（推荐）
   - 轻量级
   - 与 Prometheus 集成
   - 已在项目中配置

2. **ELK Stack**
   - Elasticsearch + Logstash + Kibana
   - 功能强大但重量级

3. **Datadog / New Relic**
   - SaaS 方案
   - 开箱即用

### Loki 配置示例

```yaml
# docker-compose.yml
loki:
  image: grafana/loki:latest
  ports:
    - "3100:3100"
  volumes:
    - ./loki-config.yaml:/etc/loki/local-config.yaml

promtail:
  image: grafana/promtail:latest
  volumes:
    - /var/log:/var/log
    - ./promtail-config.yaml:/etc/promtail/config.yml
  command: -config.file=/etc/promtail/config.yml
```

## 实施计划

### 阶段 1：快速修复（1 天）

- [x] 修复 CredentialManagerService 错误日志
- [ ] 创建 `formatError` 工具函数
- [ ] 修复其他明显的日志问题

### 阶段 2：统一格式（3 天）

- [ ] 集成 nestjs-pino
- [ ] 配置 pino-pretty（开发环境）
- [ ] 更新所有服务使用结构化日志

### 阶段 3：生产优化（5 天）

- [ ] 配置 Grafana Loki
- [ ] 设置日志告警规则
- [ ] 创建日志查询面板
- [ ] 性能优化（减少日志量）

## 相关资源

- [Pino 文档](https://getpino.io/)
- [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
- [Grafana Loki](https://grafana.com/oss/loki/)
- [OpenTelemetry](https://opentelemetry.io/)

## 总结

**当前最紧急的改进**：

1. ✅ 修复错误日志信息缺失（已完成）
2. 禁用生产环境的 SQL 日志
3. 统一使用结构化日志格式

**长期目标**：

1. 完全迁移到 Pino
2. 集成 Grafana Loki
3. 建立日志监控和告警体系
