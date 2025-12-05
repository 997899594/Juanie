# TypeScript Using Declarations 使用指南

> TypeScript 5.2+ 引入的自动资源管理特性

## 概述

Using Declarations 是 TypeScript 5.2 引入的新特性，基于 ECMAScript Explicit Resource Management 提案。它提供了一种声明式的方式来管理资源生命周期，确保资源在使用完毕后自动释放。

**核心优势：**
- ✅ 自动资源清理，防止资源泄漏
- ✅ 代码更简洁，无需手动 try-finally
- ✅ 类型安全，编译时检查
- ✅ 支持同步和异步资源

## 配置

### TypeScript 配置

项目已配置支持 Using Declarations：

```json
// packages/config/typescript/base.json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"]  // 包含 Symbol.dispose 和 Symbol.asyncDispose
  }
}
```

### 运行时支持

- **Bun**: 原生支持 ✅
- **Node.js**: 需要 v20.4.0+ ✅

## 基本用法

### 同步资源

使用 `using` 关键字：

```typescript
import { createDisposable } from '@juanie/core/utils'

function processFile() {
  using file = createDisposable(
    fs.openSync('data.txt', 'r'),
    (fd) => fs.closeSync(fd)
  )
  
  // 使用文件
  const data = fs.readFileSync(file.value)
  
  // 块结束时自动关闭文件
}
```

### 异步资源

使用 `await using` 关键字：

```typescript
import { createAsyncDisposable } from '@juanie/core/utils'

async function queryDatabase() {
  await using conn = createAsyncDisposable(
    await connectToDatabase(),
    async (conn) => await conn.close()
  )
  
  // 使用连接
  const result = await conn.value.query('SELECT * FROM users')
  
  // 块结束时自动关闭连接
}
```

## 项目中的应用

### 1. 性能监控

自动记录操作耗时：

```typescript
import { PerformanceTimer } from '@juanie/core/utils'

@Injectable()
export class ProjectsService {
  async createProject(data: CreateProjectInput) {
    using timer = new PerformanceTimer('createProject')
    
    // 执行项目创建逻辑
    const project = await this.db.insert(schema.projects).values(data)
    
    // 自动记录耗时
    return project
  }
}
```

### 2. Redis 连接管理

```typescript
import { createDisposableRedis } from '@juanie/core/utils'

async function cacheData(key: string, value: string) {
  await using redis = await createDisposableRedis(redisClient)
  
  await redis.redis.set(key, value, 'EX', 3600)
  
  // 自动断开连接
}
```

### 3. 数据库事务

虽然 Drizzle ORM 已经自动管理事务，但可以用于其他场景：

```typescript
import { createAsyncDisposable } from '@juanie/core/utils'

async function complexOperation() {
  // 锁定资源
  await using lock = createAsyncDisposable(
    await acquireLock('resource-id'),
    async (lock) => await lock.release()
  )
  
  // 执行需要锁的操作
  await performCriticalOperation()
  
  // 自动释放锁
}
```

### 4. 临时文件管理

```typescript
import { createAsyncDisposable } from '@juanie/core/utils'
import { unlink } from 'node:fs/promises'

async function processUpload(file: File) {
  const tempPath = `/tmp/${Date.now()}-${file.name}`
  
  await using temp = createAsyncDisposable(
    tempPath,
    async (path) => await unlink(path)
  )
  
  // 保存临时文件
  await file.save(temp.value)
  
  // 处理文件
  const result = await processFile(temp.value)
  
  // 自动删除临时文件
  return result
}
```

### 5. API 请求追踪

```typescript
class RequestTracer implements AsyncDisposable {
  private startTime: number
  
  constructor(
    private readonly requestId: string,
    private readonly logger: Logger
  ) {
    this.startTime = Date.now()
    this.logger.log(`[${requestId}] 请求开始`)
  }
  
  async [Symbol.asyncDispose]() {
    const duration = Date.now() - this.startTime
    this.logger.log(`[${this.requestId}] 请求完成 (${duration}ms)`)
  }
}

async function handleRequest(req: Request) {
  await using tracer = new RequestTracer(req.id, logger)
  
  // 处理请求
  const response = await processRequest(req)
  
  // 自动记录请求完成
  return response
}
```

## 自定义可释放类

### 实现 Symbol.dispose

同步资源：

```typescript
class FileHandle implements Disposable {
  constructor(private fd: number) {}
  
  read() {
    return fs.readSync(this.fd, ...)
  }
  
  [Symbol.dispose]() {
    fs.closeSync(this.fd)
  }
}

// 使用
using file = new FileHandle(fd)
file.read()
// 自动关闭
```

### 实现 Symbol.asyncDispose

异步资源：

```typescript
class DatabaseConnection implements AsyncDisposable {
  private connected = true
  
  async query(sql: string) {
    if (!this.connected) {
      throw new Error('连接已关闭')
    }
    return await this.executeQuery(sql)
  }
  
  async [Symbol.asyncDispose]() {
    if (this.connected) {
      await this.close()
      this.connected = false
    }
  }
}

// 使用
await using db = new DatabaseConnection()
await db.query('SELECT * FROM users')
// 自动关闭连接
```

## 最佳实践

### 1. 优先使用 using 而非 try-finally

❌ **避免：**
```typescript
const file = fs.openSync('data.txt', 'r')
try {
  const data = fs.readSync(file, ...)
} finally {
  fs.closeSync(file)
}
```

✅ **推荐：**
```typescript
using file = createDisposable(
  fs.openSync('data.txt', 'r'),
  (fd) => fs.closeSync(fd)
)
const data = fs.readSync(file.value, ...)
```

### 2. 多个资源按顺序释放

资源会按照声明的相反顺序释放（后进先出）：

```typescript
await using redis = await createDisposableRedis(redisClient)  // 最后释放
await using db = await createDisposableDb(dbClient)           // 第二释放
using file = createDisposableFile(filePath)                   // 最先释放

// 使用所有资源
```

### 3. 错误处理

即使发生错误，资源也会被正确释放：

```typescript
try {
  await using conn = new DatabaseConnection()
  
  // 可能抛出错误的操作
  await conn.query('INVALID SQL')
} catch (error) {
  console.error('查询失败:', error)
}
// 连接已经被自动关闭
```

### 4. 条件资源管理

```typescript
async function processData(useCache: boolean) {
  // 只在需要时创建资源
  await using cache = useCache 
    ? await createDisposableRedis(redisClient)
    : null
  
  if (cache) {
    const cached = await cache.redis.get('key')
    if (cached) return cached
  }
  
  // 处理数据
  const result = await fetchData()
  
  if (cache) {
    await cache.redis.set('key', result)
  }
  
  return result
}
```

## 性能考虑

### 开销

Using Declarations 的性能开销极小：
- 编译时转换为 try-finally
- 运行时只是函数调用
- 与手动 try-finally 性能相同

### 适用场景

✅ **适合使用：**
- 文件操作
- 数据库连接
- 网络连接
- 锁和信号量
- 临时资源
- 性能监控

❌ **不适合使用：**
- 简单的内存对象（会被 GC 自动回收）
- 不需要清理的资源
- 过度使用会降低代码可读性

## 迁移指南

### 从 try-finally 迁移

**之前：**
```typescript
async function oldWay() {
  const conn = await createConnection()
  try {
    return await conn.query('SELECT * FROM users')
  } finally {
    await conn.close()
  }
}
```

**之后：**
```typescript
async function newWay() {
  await using conn = createAsyncDisposable(
    await createConnection(),
    async (c) => await c.close()
  )
  return await conn.value.query('SELECT * FROM users')
}
```

### 从手动清理迁移

**之前：**
```typescript
async function oldWay() {
  const tempFile = `/tmp/${Date.now()}.txt`
  await writeFile(tempFile, data)
  
  try {
    await processFile(tempFile)
  } finally {
    await unlink(tempFile)
  }
}
```

**之后：**
```typescript
async function newWay() {
  const tempFile = `/tmp/${Date.now()}.txt`
  await writeFile(tempFile, data)
  
  await using temp = createAsyncDisposable(
    tempFile,
    async (path) => await unlink(path)
  )
  
  await processFile(temp.value)
}
```

## 工具函数

项目提供了以下工具函数（位于 `@juanie/core/utils`）：

### createDisposable

创建同步可释放资源：

```typescript
function createDisposable<T>(
  resource: T,
  cleanup: (resource: T) => void
): DisposableResource<T>
```

### createAsyncDisposable

创建异步可释放资源：

```typescript
function createAsyncDisposable<T>(
  resource: T,
  cleanup: (resource: T) => Promise<void>
): AsyncDisposableResource<T>
```

### createDisposableRedis

创建可释放的 Redis 连接：

```typescript
function createDisposableRedis(
  client: RedisClient
): Promise<DisposableRedisConnection>
```

### PerformanceTimer

性能监控类：

```typescript
class PerformanceTimer implements Disposable {
  constructor(label: string)
  [Symbol.dispose](): void
}
```

## 示例代码

完整示例请参考：
- `packages/core/src/utils/disposable.ts` - 工具函数实现
- `packages/core/src/utils/disposable.example.ts` - 使用示例

## 参考资料

- [TypeScript 5.2 Release Notes](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-5-2.html#using-declarations-and-explicit-resource-management)
- [ECMAScript Explicit Resource Management](https://github.com/tc39/proposal-explicit-resource-management)
- [MDN: Symbol.dispose](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Symbol/dispose)

## 总结

Using Declarations 是一个强大的特性，可以：
- ✅ 简化资源管理代码
- ✅ 防止资源泄漏
- ✅ 提高代码可读性
- ✅ 确保资源正确释放

在项目中逐步采用这个特性，可以显著提升代码质量和可维护性。
