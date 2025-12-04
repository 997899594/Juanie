# 迁移到 Pino Logger

## 背景

项目已经配置了 `nestjs-pino`，但各个服务还在使用 `@nestjs/common` 的 Logger。
现在我们统一使用 Pino Logger，实现完全的结构化日志。

## 迁移步骤

### 1. 更新导入语句

**之前：**
```typescript
import { Injectable, Logger } from '@nestjs/common'

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name)
}
```

**之后：**
```typescript
import { Injectable } from '@nestjs/common'
import { Logger } from '@juanie/core/logger'

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name)
}
```

或者更简洁：
```typescript
import { Injectable } from '@nestjs/common'
import { Logger } from 'nestjs-pino'

@Injectable()
export class MyService {
  private readonly logger = new Logger(MyService.name)
}
```

### 2. API 完全兼容

好消息：`nestjs-pino` 的 Logger API 与 `@nestjs/common` 的 Logger **完全兼容**！

```typescript
// 所有这些方法都可以正常使用
this.logger.log('Info message')
this.logger.error('Error message', error)
this.logger.warn('Warning message')
this.logger.debug('Debug message')
this.logger.verbose('Verbose message')
```

### 3. 结构化日志（可选）

Pino Logger 还支持结构化日志：

```typescript
// 传统方式（兼容）
this.logger.log('User created', userId)

// 结构化方式（推荐）
this.logger.log({
  msg: 'User created',
  userId,
  email: user.email,
  timestamp: new Date(),
})
```

## 批量迁移

### 使用 VS Code 全局替换

1. 打开 VS Code
2. 按 `Cmd+Shift+F`（Mac）或 `Ctrl+Shift+F`（Windows）
3. 搜索：`import { (.*), Logger } from '@nestjs/common'`
4. 替换为：`import { $1 } from '@nestjs/common'\nimport { Logger } from '@juanie/core/logger'`
5. 使用正则表达式模式

### 或者使用命令行

```bash
# 查找所有使用 @nestjs/common Logger 的文件
grep -r "import.*Logger.*from '@nestjs/common'" packages/services --include="*.ts"

# 使用 sed 批量替换（Mac）
find packages/services -name "*.ts" -exec sed -i '' \
  's/import { \(.*\), Logger } from '\''@nestjs\/common'\''/import { \1 } from '\''@nestjs\/common'\''\nimport { Logger } from '\''@juanie\/core\/logger'\''/g' {} +
```

## 迁移优先级

### 高优先级（立即迁移）

1. **错误处理相关的服务**
   - `CredentialManagerService`
   - `GitSyncService`
   - `FluxResourcesService`
   - `K3sService`

2. **核心业务服务**
   - `ProjectsService`
   - `DeploymentsService`
   - `GitOpsService`

### 中优先级（逐步迁移）

3. **其他业务服务**
   - 所有 `packages/services/business` 下的服务
   - 所有 `packages/services/foundation` 下的服务

### 低优先级（可选）

4. **扩展服务**
   - AI 相关服务
   - 监控服务
   - 通知服务

## 验证迁移

### 1. 检查日志格式

迁移后，日志应该是 JSON 格式：

**开发环境（pino-pretty）：**
```
[15:04:57.462] INFO (GitProviderService): Pushing 28 files to repository
    repo: "997899594/110110110"
    fileCount: 28
```

**生产环境（JSON）：**
```json
{
  "level": 30,
  "time": 1764831895555,
  "pid": 79701,
  "context": "GitProviderService",
  "msg": "Pushing 28 files to repository",
  "repo": "997899594/110110110",
  "fileCount": 28
}
```

### 2. 检查错误日志

错误日志应该包含完整的堆栈信息：

```typescript
try {
  await riskyOperation()
} catch (error) {
  this.logger.error('Operation failed', error)
  // 或者结构化方式
  this.logger.error({
    msg: 'Operation failed',
    error: error.message,
    stack: error.stack,
  })
}
```

### 3. 运行测试

```bash
# 类型检查
bun run type-check

# 启动应用
bun run dev

# 检查日志输出
```

## 常见问题

### Q: 迁移后日志格式变了？

A: 是的，这是预期的。开发环境使用 `pino-pretty` 美化输出，生产环境使用 JSON 格式。

### Q: 如何临时禁用结构化日志？

A: 设置环境变量：
```bash
LOG_LEVEL=silent bun run dev
```

### Q: 如何只看特定服务的日志？

A: 使用 `grep` 过滤：
```bash
bun run dev | grep "GitProviderService"
```

### Q: 迁移后性能有影响吗？

A: Pino 是最快的 Node.js 日志库之一，性能比 NestJS 默认 Logger 更好。

## 回滚方案

如果遇到问题，可以快速回滚：

1. 恢复导入语句：
```typescript
import { Injectable, Logger } from '@nestjs/common'
```

2. 或者临时禁用 Pino：
```typescript
// apps/api-gateway/src/main.ts
// 注释掉这一行
// app.useLogger(app.get(Logger))
```

## 相关资源

- [nestjs-pino 文档](https://github.com/iamolegga/nestjs-pino)
- [Pino 文档](https://getpino.io/)
- [日志最佳实践](./logging-best-practices.md)

## 总结

迁移到 Pino Logger 的好处：

1. ✅ 完全结构化的日志（JSON）
2. ✅ 更好的性能
3. ✅ 更容易查询和分析
4. ✅ 与 Grafana Loki 等工具集成
5. ✅ API 完全兼容，无需修改业务逻辑

**建议**：逐步迁移，从核心服务开始，确保每个服务迁移后都能正常工作。
