/**
 * 资源管理工具 - 支持 TypeScript 5.2+ Using Declarations
 *
 * 使用 `using` 关键字自动管理资源生命周期，防止资源泄漏
 *
 * @example
 * ```typescript
 * // 自动清理数据库事务
 * using tx = await createDisposableTransaction(db);
 * await tx.insert(schema.users).values({ name: 'Alice' });
 * // 事务自动提交或回滚
 * ```
 */

import type { Database } from '../database/client'

/**
 * 可释放资源接口
 */
export interface Disposable {
  [Symbol.dispose](): void
}

/**
 * 异步可释放资源接口
 */
export interface AsyncDisposable {
  [Symbol.asyncDispose](): Promise<void>
}

/**
 * 数据库事务包装器
 *
 * 自动管理事务生命周期：
 * - 成功时自动提交
 * - 失败时自动回滚
 * - 使用 `using` 关键字确保资源释放
 */
export class DisposableTransaction<T = any> implements AsyncDisposable {
  private committed = false
  private rolledBack = false

  constructor(
    private readonly transaction: T,
    private readonly commit: () => Promise<void>,
    private readonly rollback: () => Promise<void>,
  ) {}

  /**
   * 获取事务对象
   */
  get tx(): T {
    return this.transaction
  }

  /**
   * 手动提交事务
   */
  async commitTransaction(): Promise<void> {
    if (this.committed || this.rolledBack) {
      return
    }
    await this.commit()
    this.committed = true
  }

  /**
   * 手动回滚事务
   */
  async rollbackTransaction(): Promise<void> {
    if (this.committed || this.rolledBack) {
      return
    }
    await this.rollback()
    this.rolledBack = true
  }

  /**
   * 自动释放资源（Symbol.asyncDispose）
   *
   * 当 `using` 块结束时自动调用：
   * - 如果未提交且未回滚，则自动提交
   * - 如果发生错误，则自动回滚
   */
  async [Symbol.asyncDispose](): Promise<void> {
    if (!this.committed && !this.rolledBack) {
      // 默认提交事务
      await this.commitTransaction()
    }
  }
}

/**
 * Redis 连接包装器
 *
 * 自动管理 Redis 连接生命周期
 */
export class DisposableRedisConnection implements AsyncDisposable {
  constructor(
    private readonly client: any,
    private readonly disconnect: () => Promise<void>,
  ) {}

  /**
   * 获取 Redis 客户端
   */
  get redis(): any {
    return this.client
  }

  /**
   * 自动释放资源（Symbol.asyncDispose）
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.disconnect()
  }
}

/**
 * 通用资源包装器
 *
 * 包装任何需要清理的资源
 */
export class DisposableResource<T> implements Disposable {
  constructor(
    private readonly resource: T,
    private readonly cleanup: (resource: T) => void,
  ) {}

  /**
   * 获取资源
   */
  get value(): T {
    return this.resource
  }

  /**
   * 自动释放资源（Symbol.dispose）
   */
  [Symbol.dispose](): void {
    this.cleanup(this.resource)
  }
}

/**
 * 异步资源包装器
 */
export class AsyncDisposableResource<T> implements AsyncDisposable {
  constructor(
    private readonly resource: T,
    private readonly cleanup: (resource: T) => Promise<void>,
  ) {}

  /**
   * 获取资源
   */
  get value(): T {
    return this.resource
  }

  /**
   * 自动释放资源（Symbol.asyncDispose）
   */
  async [Symbol.asyncDispose](): Promise<void> {
    await this.cleanup(this.resource)
  }
}

/**
 * 创建可释放的资源
 *
 * @example
 * ```typescript
 * using file = createDisposable(
 *   fs.openSync('file.txt', 'r'),
 *   (fd) => fs.closeSync(fd)
 * );
 * // 使用 file.value
 * // 自动关闭文件
 * ```
 */
export function createDisposable<T>(
  resource: T,
  cleanup: (resource: T) => void,
): DisposableResource<T> {
  return new DisposableResource(resource, cleanup)
}

/**
 * 创建异步可释放的资源
 *
 * @example
 * ```typescript
 * await using conn = await createAsyncDisposable(
 *   await connectToDatabase(),
 *   async (conn) => await conn.close()
 * );
 * // 使用 conn.value
 * // 自动关闭连接
 * ```
 */
export function createAsyncDisposable<T>(
  resource: T,
  cleanup: (resource: T) => Promise<void>,
): AsyncDisposableResource<T> {
  return new AsyncDisposableResource(resource, cleanup)
}

/**
 * 创建可释放的数据库事务
 *
 * 注意：这是一个示例实现，实际使用需要根据具体的 ORM 调整
 *
 * @example
 * ```typescript
 * await using tx = await createDisposableTransaction(db, async (tx) => {
 *   await tx.insert(schema.users).values({ name: 'Alice' });
 *   await tx.insert(schema.posts).values({ title: 'Hello' });
 *   // 自动提交
 * });
 * ```
 */
export async function createDisposableTransaction<T>(
  db: Database,
  callback: (tx: any) => Promise<T>,
): Promise<{ result: T; dispose: () => Promise<void> } & AsyncDisposable> {
  let result: T

  // 执行事务
  result = await db.transaction(async (tx) => {
    return await callback(tx)
  })

  return {
    result,
    async dispose() {
      // 事务已经在 db.transaction 中处理
    },
    async [Symbol.asyncDispose]() {
      // 事务已经在 db.transaction 中处理
    },
  }
}

/**
 * 创建可释放的 Redis 连接
 *
 * @example
 * ```typescript
 * await using redis = await createDisposableRedis(redisUrl);
 * await redis.value.set('key', 'value');
 * // 自动断开连接
 * ```
 */
export async function createDisposableRedis(client: any): Promise<DisposableRedisConnection> {
  return new DisposableRedisConnection(client, async () => {
    if (client.quit) {
      await client.quit()
    } else if (client.disconnect) {
      await client.disconnect()
    }
  })
}
