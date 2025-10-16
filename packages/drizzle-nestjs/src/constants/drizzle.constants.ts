/**
 * Drizzle 模块常量
 */
export const DRIZZLE_OPTIONS = Symbol('DRIZZLE_OPTIONS')
export const DRIZZLE_CONNECTION = Symbol('DRIZZLE_CONNECTION')
export const DRIZZLE_TRANSACTION = Symbol('DRIZZLE_TRANSACTION')

/**
 * 默认连接名称
 */
export const DEFAULT_CONNECTION_NAME = 'default'

/**
 * 支持的数据库类型
 */
export enum DatabaseType {
  POSTGRES = 'postgres',
  MYSQL = 'mysql',
  SQLITE = 'sqlite',
}

/**
 * 连接状态
 */
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  ERROR = 'error',
}

/**
 * 事务隔离级别
 */
export enum TransactionIsolationLevel {
  READ_UNCOMMITTED = 'read uncommitted',
  READ_COMMITTED = 'read committed',
  REPEATABLE_READ = 'repeatable read',
  SERIALIZABLE = 'serializable',
}