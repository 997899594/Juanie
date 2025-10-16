import { drizzle } from 'drizzle-orm/postgres-js'
import { drizzle as drizzleMysql } from 'drizzle-orm/mysql2'
import { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3'
import postgres from 'postgres'
// import mysql from 'mysql2/promise'
// import Database from 'better-sqlite3'
import type { Logger } from 'drizzle-orm'
import type { 
  DatabaseConnectionConfig, 
  DrizzleModuleOptions 
} from '../interfaces/drizzle-options.interface.js'
import type { DrizzleDatabase } from '../interfaces/drizzle-connection.interface.js'
import { DatabaseType } from '../constants/drizzle.constants.js'

/**
 * 创建数据库连接
 */
export async function createDatabaseConnection(
  config: DatabaseConnectionConfig,
  logger?: boolean | Logger
): Promise<{ database: DrizzleDatabase; rawConnection: any }> {
  switch (config.type) {
    case DatabaseType.POSTGRES:
      return createPostgresConnection(config, logger)
    
    case DatabaseType.MYSQL:
      return createMysqlConnection(config, logger)
    
    case DatabaseType.SQLITE:
      return createSqliteConnection(config, logger)
    
    default:
      throw new Error(`Unsupported database type: ${config.type}`)
  }
}

/**
 * 创建 PostgreSQL 连接
 */
async function createPostgresConnection(
  config: DatabaseConnectionConfig,
  logger?: boolean | Logger
): Promise<{ database: DrizzleDatabase; rawConnection: any }> {
  const connectionConfig = typeof config.connection === 'string' 
    ? config.connection 
    : (config.connection as any).connectionString || String(config.connection)

  const sql = postgres(connectionConfig, {
    max: config.pool?.max || 10,
    idle_timeout: config.pool?.idleTimeoutMillis || 30000,
    connect_timeout: config.pool?.connectionTimeoutMillis || 10000,
    ssl: config.ssl,
    ...config.driverOptions,
  })

  const database = drizzle(sql, {
    schema: config.schema,
    logger,
  })

  return { database, rawConnection: sql }
}

/**
 * 创建 MySQL 连接
 */
async function createMysqlConnection(
  config: DatabaseConnectionConfig,
  logger?: boolean | Logger
): Promise<{ database: DrizzleDatabase; rawConnection: any }> {
  try {
    // TODO: 实现 MySQL 连接创建
    throw new Error('MySQL support is not implemented yet')
  } catch (error) {
    throw new Error(`Failed to create MySQL connection: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 创建 SQLite 连接
 */
async function createSqliteConnection(
  config: DatabaseConnectionConfig,
  logger?: boolean | Logger
): Promise<{ database: DrizzleDatabase; rawConnection: any }> {
  try {
    // TODO: 实现 SQLite 连接创建
    throw new Error('SQLite support is not implemented yet')
  } catch (error) {
    throw new Error(`Failed to create SQLite connection: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * 测试数据库连接
 */
export async function testConnection(database: DrizzleDatabase): Promise<boolean> {
  try {
    // 执行简单查询测试连接
    await database.execute('SELECT 1' as any)
    return true
  } catch (error) {
    console.error('Database connection test failed:', error)
    return false
  }
}

/**
 * 关闭数据库连接
 */
export async function closeConnection(rawConnection: any, type: DatabaseType): Promise<void> {
  try {
    switch (type) {
      case DatabaseType.POSTGRES:
        await rawConnection.end()
        break
      
      case DatabaseType.MYSQL:
        await rawConnection.end()
        break
      
      case DatabaseType.SQLITE:
        rawConnection.close()
        break
    }
  } catch (error) {
    console.error('Error closing database connection:', error)
  }
}

/**
 * 获取连接统计信息
 */
export function getConnectionStats(rawConnection: any, type: DatabaseType): Record<string, any> {
  try {
    switch (type) {
      case DatabaseType.POSTGRES:
        return {
          totalConnections: rawConnection.options.max || 0,
          idleConnections: rawConnection.idle?.length || 0,
          activeConnections: rawConnection.reserved?.length || 0,
        }
      
      case DatabaseType.MYSQL:
        return {
          threadId: rawConnection.threadId,
          state: rawConnection.state,
        }
      
      case DatabaseType.SQLITE:
        return {
          inTransaction: rawConnection.inTransaction,
          readonly: rawConnection.readonly,
        }
      
      default:
        return {}
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * 验证连接配置
 */
export function validateConnectionConfig(config: DatabaseConnectionConfig): void {
  if (!config.type) {
    throw new Error('Database type is required')
  }

  if (!Object.values(DatabaseType).includes(config.type)) {
    throw new Error(`Unsupported database type: ${config.type}`)
  }

  if (!config.connection) {
    throw new Error('Database connection configuration is required')
  }

  // 验证连接池配置
  if (config.pool) {
    if (config.pool.min && config.pool.max && config.pool.min > config.pool.max) {
      throw new Error('Pool min size cannot be greater than max size')
    }
  }
}

/**
 * 格式化连接字符串（隐藏敏感信息）
 */
export function formatConnectionString(connection: string | Record<string, any>): string {
  if (typeof connection === 'string') {
    // 隐藏密码
    return connection.replace(/:([^:@]+)@/, ':***@')
  }
  
  return JSON.stringify({
    ...connection,
    password: connection.password ? '***' : undefined,
  })
}