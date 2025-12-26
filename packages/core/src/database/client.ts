import * as schema from '@juanie/database'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

/**
 * 数据库连接配置
 */
export interface DatabaseConfig {
  connectionString: string
  max?: number
  idleTimeout?: number
  connectTimeout?: number
  prepare?: boolean
  logger?:
    | boolean
    | {
        logQuery: (query: string, params: unknown[]) => void
      }
}

/**
 * 创建数据库客户端
 *
 * 这是唯一的数据库连接创建函数
 * database.module.ts 和脚本都使用这个函数
 */
export function createDatabaseClient(config: DatabaseConfig) {
  const client = postgres(config.connectionString, {
    max: config.max ?? 10,
    idle_timeout: config.idleTimeout ?? 20,
    connect_timeout: config.connectTimeout ?? 10,
    prepare: config.prepare ?? false,
  })

  return drizzle(client, {
    schema,
    logger: config.logger || false,
  })
}

/**
 * 数据库客户端类型
 */
export type DatabaseClient = ReturnType<typeof createDatabaseClient>
