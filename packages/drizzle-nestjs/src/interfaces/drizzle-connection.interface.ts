import type { 
  PostgresJsDatabase
} from 'drizzle-orm/postgres-js'
import type { ConnectionStatus, TransactionIsolationLevel } from '../constants/drizzle.constants.js'

/**
 * 通用数据库连接接口
 */
export type DrizzleDatabase = PostgresJsDatabase<any> // | MySql2Database<any> | BetterSQLite3Database<any>

/**
 * 连接信息接口
 */
export interface DrizzleConnectionInfo {
  /**
   * 连接名称
   */
  name: string
  
  /**
   * 连接状态
   */
  status: ConnectionStatus
  
  /**
   * 数据库实例
   */
  database: DrizzleDatabase
  
  /**
   * 原始连接对象
   */
  rawConnection: any
  
  /**
   * 连接创建时间
   */
  createdAt: Date
  
  /**
   * 最后活跃时间
   */
  lastActiveAt: Date
  
  /**
   * 连接配置
   */
  config: any
  
  /**
   * 连接统计信息
   */
  stats: {
    totalQueries: number
    totalTransactions: number
    activeQueries: number
    activeTransactions: number
    errors: number
  }
}

/**
 * 事务配置接口
 */
export interface TransactionConfig {
  /**
   * 事务隔离级别
   */
  isolationLevel?: TransactionIsolationLevel
  
  /**
   * 事务超时时间（毫秒）
   */
  timeout?: number
  
  /**
   * 是否只读事务
   */
  readOnly?: boolean
  
  /**
   * 事务标签（用于调试）
   */
  label?: string
  
  /**
   * 自定义元数据
   */
  meta?: Record<string, any>
}

/**
 * 事务上下文接口
 */
export interface TransactionContext {
  /**
   * 事务 ID
   */
  id: string
  
  /**
   * 事务数据库实例
   */
  tx: DrizzleDatabase
  
  /**
   * 事务配置
   */
  config: TransactionConfig
  
  /**
   * 事务开始时间
   */
  startedAt: Date
  
  /**
   * 是否已提交
   */
  committed: boolean
  
  /**
   * 是否已回滚
   */
  rolledBack: boolean
  
  /**
   * 事务统计
   */
  stats: {
    queries: number
    duration: number
  }
}

/**
 * 查询统计接口
 */
export interface QueryStats {
  /**
   * 查询 SQL
   */
  sql: string
  
  /**
   * 查询参数
   */
  params: any[]
  
  /**
   * 执行时间（毫秒）
   */
  duration: number
  
  /**
   * 执行时间戳
   */
  timestamp: Date
  
  /**
   * 是否成功
   */
  success: boolean
  
  /**
   * 错误信息（如果有）
   */
  error?: string
  
  /**
   * 影响行数
   */
  rowCount?: number
}

/**
 * 健康检查结果接口
 */
export interface HealthCheckResult {
  /**
   * 连接名称
   */
  name: string
  
  /**
   * 是否健康
   */
  healthy: boolean
  
  /**
   * 响应时间（毫秒）
   */
  responseTime: number
  
  /**
   * 检查时间
   */
  timestamp: Date
  
  /**
   * 错误信息（如果有）
   */
  error?: string
  
  /**
   * 额外信息
   */
  details?: Record<string, any>
}