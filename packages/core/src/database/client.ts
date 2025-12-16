import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as relations from './relations'
import * as tables from './schemas'

// 合并表定义和关系定义，确保类型推断正确
const schema = { ...tables, ...relations }

/**
 * 创建数据库客户端
 * @param connectionString - PostgreSQL 连接字符串
 * @param options - 连接选项
 */
export function createDatabaseClient(
  connectionString: string,
  options?: {
    max?: number
    idle_timeout?: number
    connect_timeout?: number
    prepare?: boolean
  },
) {
  const client = postgres(connectionString, {
    max: options?.max ?? 10,
    idle_timeout: options?.idle_timeout ?? 20,
    connect_timeout: options?.connect_timeout ?? 10,
    prepare: options?.prepare ?? false,
  })

  return drizzle(client, { schema })
}

/**
 * 数据库客户端类型
 */
export type DatabaseClient = ReturnType<typeof createDatabaseClient>

/**
 * 数据库类型（别名）
 */
export type Database = DatabaseClient
