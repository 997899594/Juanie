/**
 * Using Declarations 使用示例
 *
 * TypeScript 5.2+ 引入的 Using Declarations 特性
 * 自动管理资源生命周期，防止资源泄漏
 */

import {
  type AsyncDisposable,
  createAsyncDisposable,
  createDisposable,
  createDisposableRedis,
  type Disposable,
} from './disposable'

/**
 * 示例 1: 同步资源管理
 *
 * 使用 `using` 关键字自动释放资源
 */
export function example1_SyncResource() {
  // 模拟文件句柄
  const fileHandle = { fd: 123, path: '/tmp/file.txt' }

  using file = createDisposable(fileHandle, (handle) => {
    console.log(`关闭文件: ${handle.path}`)
    // 实际场景中会调用 fs.closeSync(handle.fd)
  })

  // 使用文件
  console.log(`读取文件: ${file.value.path}`)

  // 块结束时自动调用 Symbol.dispose，关闭文件
}

/**
 * 示例 2: 异步资源管理
 *
 * 使用 `await using` 关键字自动释放异步资源
 */
export async function example2_AsyncResource() {
  // 模拟数据库连接
  const dbConnection = {
    connected: true,
    async query(_sql: string) {
      return [{ id: 1, name: 'Alice' }]
    },
    async close() {
      console.log('关闭数据库连接')
      this.connected = false
    },
  }

  await using conn = createAsyncDisposable(dbConnection, async (conn) => {
    await conn.close()
  })

  // 使用连接
  const result = await conn.value.query('SELECT * FROM users')
  console.log('查询结果:', result)

  // 块结束时自动调用 Symbol.asyncDispose，关闭连接
}

/**
 * 示例 3: Redis 连接管理
 *
 * 自动管理 Redis 连接生命周期
 */
export async function example3_RedisConnection() {
  // 模拟 Redis 客户端
  const redisClient = {
    async set(key: string, value: string) {
      console.log(`SET ${key} = ${value}`)
    },
    async get(key: string) {
      console.log(`GET ${key}`)
      return 'value'
    },
    async quit() {
      console.log('断开 Redis 连接')
    },
  }

  await using redis = await createDisposableRedis(redisClient)

  // 使用 Redis
  await redis.redis.set('user:1', 'Alice')
  const value = await redis.redis.get('user:1')
  console.log('Redis 值:', value)

  // 块结束时自动断开连接
}

/**
 * 示例 4: 多个资源管理
 *
 * 可以在同一个作用域中管理多个资源
 * 资源会按照声明的相反顺序释放（后进先出）
 */
export async function example4_MultipleResources() {
  await using _redis = await createDisposableRedis({
    async quit() {
      console.log('1. 断开 Redis')
    },
  })

  await using _db = createAsyncDisposable({ name: 'postgres' }, async (_conn) => {
    console.log('2. 关闭数据库')
  })

  using _file = createDisposable({ path: '/tmp/file.txt' }, (_f) => {
    console.log('3. 关闭文件')
  })

  console.log('使用所有资源...')

  // 块结束时按照相反顺序释放：
  // 3. 关闭文件
  // 2. 关闭数据库
  // 1. 断开 Redis
}

/**
 * 示例 5: 错误处理
 *
 * 即使发生错误，资源也会被正确释放
 */
export async function example5_ErrorHandling() {
  try {
    await using _conn = createAsyncDisposable({ connected: true }, async (_c) => {
      console.log('清理连接（即使发生错误也会执行）')
    })

    // 模拟错误
    throw new Error('操作失败')
  } catch (error) {
    console.log('捕获错误:', (error as Error).message)
  }

  // 连接已经被清理
}

/**
 * 示例 6: 自定义可释放类
 *
 * 实现 Symbol.dispose 或 Symbol.asyncDispose
 */
export class DatabaseConnection implements AsyncDisposable {
  private connected = true

  async query(sql: string) {
    if (!this.connected) {
      throw new Error('连接已关闭')
    }
    console.log(`执行查询: ${sql}`)
    return []
  }

  async [Symbol.asyncDispose]() {
    if (this.connected) {
      console.log('自动关闭数据库连接')
      this.connected = false
    }
  }
}

export async function example6_CustomDisposable() {
  await using db = new DatabaseConnection()

  await db.query('SELECT * FROM users')

  // 自动调用 Symbol.asyncDispose
}

/**
 * 示例 7: 实际应用 - 数据库事务
 *
 * 在实际项目中使用 using 管理事务
 */
export async function example7_RealWorldTransaction(db: any) {
  // 注意：这是概念示例，实际实现需要根据 Drizzle ORM 调整

  try {
    // 使用 using 自动管理事务
    const result = await db.transaction(async (tx: any) => {
      // 插入用户
      const [user] = await tx.insert({ name: 'Alice' }).returning()

      // 插入文章
      await tx.insert({ userId: user.id, title: 'Hello World' })

      return user
    })

    console.log('事务成功:', result)
  } catch (error) {
    console.log('事务失败，自动回滚')
  }
}

/**
 * 示例 8: 性能监控
 *
 * 使用 using 自动记录操作耗时
 */
export class PerformanceTimer implements Disposable {
  private startTime: number

  constructor(private readonly label: string) {
    this.startTime = performance.now()
    console.log(`⏱️  开始: ${label}`)
  }

  [Symbol.dispose]() {
    const duration = performance.now() - this.startTime
    console.log(`⏱️  结束: ${this.label} (${duration.toFixed(2)}ms)`)
  }
}

export function example8_PerformanceMonitoring() {
  using _timer = new PerformanceTimer('数据处理')

  // 执行耗时操作
  const data = Array.from({ length: 1000000 }, (_, i) => i)
  const sum = data.reduce((a, b) => a + b, 0)

  console.log('计算结果:', sum)

  // 自动记录耗时
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('\n=== 示例 1: 同步资源 ===')
  example1_SyncResource()

  console.log('\n=== 示例 2: 异步资源 ===')
  await example2_AsyncResource()

  console.log('\n=== 示例 3: Redis 连接 ===')
  await example3_RedisConnection()

  console.log('\n=== 示例 4: 多个资源 ===')
  await example4_MultipleResources()

  console.log('\n=== 示例 5: 错误处理 ===')
  await example5_ErrorHandling()

  console.log('\n=== 示例 6: 自定义可释放类 ===')
  await example6_CustomDisposable()

  console.log('\n=== 示例 8: 性能监控 ===')
  example8_PerformanceMonitoring()
}

// 如果直接运行此文件
if (import.meta.main) {
  runAllExamples().catch(console.error)
}
